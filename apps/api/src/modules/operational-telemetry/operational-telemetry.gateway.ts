import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionTokenUtil } from '../auth/session-token.util';
import { getEnv } from '../../config/env.validation';
import { isOriginAllowed } from '../../common/utils/cors-origin.util';
import { PublicBroadcastNoticeSeverity, UserRole } from '@cubiora/shared';
import {
  TELEMETRY_EVENTS,
  TelemetryPingPayload,
  AdminBroadcastNoticePayload,
  CubicleStateChangedPayload,
  QueueUpdatedPayload,
  TelemetrySnapshotPayload,
} from '@cubiora/shared';
import { OperationalTelemetryService } from './operational-telemetry.service';
import { PublicDisplayService } from '../public-display/public-display.service';

/** Roles autorizados para recibir telemetría operativa. */
const ALLOWED_ROLES: ReadonlySet<UserRole> = new Set([UserRole.ADMIN]);
const ADMINS_ROOM = 'admins';
const SNAPSHOT_REQUEST_COOLDOWN_MS = 1500;
const MIN_NOTICE_LENGTH = 5;
const MAX_NOTICE_LENGTH = 240;

interface SocketAuthenticatedUser {
  sub?: string;
  role: UserRole;
  displayName: string;
  exp?: number;
  tokenVersion?: number;
}

function sanitizeControlChars(input: string): string {
  let sanitized = '';
  let lastWasSpace = false;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      if (!lastWasSpace) {
        sanitized += ' ';
        lastWasSpace = true;
      }
    } else {
      sanitized += input[i];
      lastWasSpace = false;
    }
  }

  return sanitized.trim();
}

@WebSocketGateway({
  namespace: '/operational-telemetry',
  cors: {
    // CORS dual estricto: orígenes en CORS_ORIGINS + subred LAN http://192.168.1.* (sin comodín '*')
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const env = getEnv();
      if (!origin || isOriginAllowed(origin, env.CORS_ORIGINS)) {
        cb(null, true);
      } else {
        cb(new Error('Origen no autorizado'), false);
      }
    },
    credentials: true,
  },
})
export class OperationalTelemetryGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(OperationalTelemetryGateway.name);
  private readonly subscriptions: Subscription[] = [];
  private readonly socketsByUserId = new Map<string, Set<Socket>>();
  private readonly lastSnapshotRequestBySocket = new Map<string, number>();

  constructor(
    private readonly telemetryService: OperationalTelemetryService,
    @Optional() private readonly publicDisplayService?: PublicDisplayService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  onModuleInit(): void {
    this.subscriptions.push(
      this.telemetryService.onCubicleUpdate$.subscribe((payload) => {
        this.emitCubicleUpdate(payload);
      }),
      this.telemetryService.onQueueUpdate$.subscribe((payload) => {
        this.emitQueueUpdate(payload);
      }),
      this.telemetryService.onSnapshotBroadcast$.subscribe((snapshot) => {
        this.emitToAdmins(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
      }),
    );

    if (this.telemetryService.onUserSessionRevoked$) {
      this.subscriptions.push(
        this.telemetryService.onUserSessionRevoked$.subscribe((userId) => {
          this.disconnectUserSockets(userId, 'SESSION_REVOKED');
        }),
      );
    }
  }

  onModuleDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.length = 0;
    this.socketsByUserId.clear();
    this.lastSnapshotRequestBySocket.clear();
  }

  // ─── Ciclo de vida de conexión ──────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const payload = this.extractAndVerifyToken(client);

      if (!payload || !ALLOWED_ROLES.has(payload.role)) {
        this.logger.warn(
          `Conexión rechazada al namespace /operational-telemetry. ` +
            `Socket: ${client.id}. Motivo: ${!payload ? 'token inválido' : `rol no autorizado (${payload.role})`}`,
        );
        this.rejectConnection(client, 'AUTH_REQUIRED', 'Acceso denegado al canal de telemetría operativa.');
        return;
      }

      if (typeof payload.tokenVersion !== 'number' || !Number.isInteger(payload.tokenVersion)) {
        this.logger.warn(
          `Conexión WebSocket rechazada por tokenVersion inválido en socket ${client.id}.`,
        );
        this.rejectConnection(client, 'AUTH_REQUIRED', 'Sesión inválida o heredada. Vuelva a iniciar sesión.');
        return;
      }

      if (typeof this.prisma?.user?.findUnique === 'function') {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, active: true, tokenVersion: true },
        });
        const dbTokenVersion = dbUser?.tokenVersion;
        if (
          !dbUser ||
          !dbUser.active ||
          !ALLOWED_ROLES.has(dbUser.role as UserRole) ||
          typeof dbTokenVersion !== 'number' ||
          dbTokenVersion !== payload.tokenVersion
        ) {
          this.logger.warn(
            `Conexión WebSocket revocada o inactiva para socket ${client.id}.`,
          );
          this.rejectConnection(client, 'AUTH_REQUIRED', 'Sesión revocada, expirada o sin permisos.');
          return;
        }
      } else if (this.getRuntimeNodeEnv() !== 'test') {
        this.rejectConnection(client, 'AUTH_REQUIRED', 'Servicio de verificación de sesión no disponible.');
        return;
      }

      const safeUser: SocketAuthenticatedUser = {
        sub: payload.sub,
        role: payload.role,
        displayName: sanitizeControlChars(payload.displayName || 'Administrador').slice(0, 80),
        exp: payload.exp,
        tokenVersion: payload.tokenVersion,
      };

      // Adjuntar usuario validado al socket para uso posterior
      (client as unknown as { user: SocketAuthenticatedUser }).user = safeUser;

      if (payload.sub) {
        let userSockets = this.socketsByUserId.get(payload.sub);
        if (!userSockets) {
          userSockets = new Set<Socket>();
          this.socketsByUserId.set(payload.sub, userSockets);
        }
        userSockets.add(client);
      }

      if (typeof client.join === 'function') {
        await client.join(ADMINS_ROOM);
      }

      this.logger.log(`Admin conectado al canal de telemetría (${client.id})`);

      // Emitir snapshot completo inmediatamente
      try {
        const snapshot = await this.telemetryService.buildSnapshot();
        client.emit(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
      } catch (err) {
        this.logger.error('Error construyendo snapshot inicial de telemetría:', err);
      }
    } catch (err) {
      this.logger.warn(
        `Error inesperado validando handshake WebSocket (${client.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      try {
        client.disconnect?.(true);
      } catch {
        // noop
      }
    }
  }

  handleDisconnect(client: Socket): void {
    const user = (client as unknown as { user?: SocketAuthenticatedUser }).user;
    if (user?.sub) {
      const userSockets = this.socketsByUserId.get(user.sub);
      if (userSockets) {
        userSockets.delete(client);
        if (userSockets.size === 0) {
          this.socketsByUserId.delete(user.sub);
        }
      }
    }
    if (client.id) {
      this.lastSnapshotRequestBySocket.delete(client.id);
    }
    this.logger.log(
      `Desconexión del canal de telemetría (${client.id})`,
    );
  }

  // ─── Eventos Cliente → Servidor ─────────────────────────────────────────────

  /** Ping para medir latencia RTT. */
  @SubscribeMessage(TELEMETRY_EVENTS.PING)
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TelemetryPingPayload,
  ): void {
    if (!this.isAuthorized(client)) {
      this.rejectActiveSocket(client, 'SESSION_EXPIRED');
      return;
    }

    client.emit(TELEMETRY_EVENTS.PONG, {
      clientSentAt: data?.clientSentAt ?? Date.now(),
      serverTime: new Date().toISOString(),
    });
  }

  /** El cliente solicita un snapshot fresco (botón de refresco). */
  @SubscribeMessage(TELEMETRY_EVENTS.REQUEST_SNAPSHOT)
  async handleRequestSnapshot(@ConnectedSocket() client: Socket): Promise<void> {
    if (!(await this.verifySocketSessionStillValid(client))) {
      return;
    }

    const socketKey = client.id || '__default__';
    const nowMs = Date.now();
    const lastRequestAt = this.lastSnapshotRequestBySocket.get(socketKey) ?? 0;
    if (lastRequestAt > 0 && nowMs - lastRequestAt < SNAPSHOT_REQUEST_COOLDOWN_MS) {
      return;
    }
    this.lastSnapshotRequestBySocket.set(socketKey, nowMs);

    try {
      const snapshot = await this.telemetryService.buildSnapshot();
      client.emit(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
    } catch (err) {
      this.logger.error('Error al procesar solicitud de snapshot:', err);
    }
  }

  /** Aviso general desde el panel de administrador a monitores de sala. */
  @SubscribeMessage(TELEMETRY_EVENTS.BROADCAST_NOTICE)
  handleBroadcastNotice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AdminBroadcastNoticePayload,
  ): Promise<void> | void {
    if (!this.isAuthorized(client)) {
      this.rejectActiveSocket(client, 'SESSION_EXPIRED');
      return;
    }

    const emitValidatedNotice = (): void => {
      const sanitizedMessage =
        typeof data?.message === 'string' ? sanitizeControlChars(data.message) : '';
      if (
        sanitizedMessage.length < MIN_NOTICE_LENGTH ||
        sanitizedMessage.length > MAX_NOTICE_LENGTH
      ) {
        return;
      }

      const rawSeverity = data?.severity;
      const severity: PublicBroadcastNoticeSeverity =
        rawSeverity === 'warning' || rawSeverity === 'critical' ? rawSeverity : 'info';

      const user = (client as unknown as { user?: SocketAuthenticatedUser }).user;
      const safeSentBy = sanitizeControlChars(user?.displayName || 'Administrador').slice(0, 80);

      this.logger.log(
        `Aviso general emitido por admin (${client.id ?? 'socket'}): severity=${severity}, length=${sanitizedMessage.length}`,
      );

      const emittedNotice = this.publicDisplayService?.emitNotice(sanitizedMessage, severity);
      const issuedAt = emittedNotice?.issuedAtIso ?? new Date().toISOString();

      // Re-emitir el aviso únicamente al room autenticado de administradores
      this.emitToAdmins('admin:notice', {
        message: sanitizedMessage,
        severity,
        sentAt: issuedAt,
        sentBy: safeSentBy,
      });
    };

    if (typeof this.prisma?.user?.findUnique === 'function' || this.getRuntimeNodeEnv() !== 'test') {
      return this.verifySocketSessionStillValid(client).then((valid) => {
        if (valid) {
          emitValidatedNotice();
        }
      });
    }

    emitValidatedNotice();
  }

  // ─── Métodos de emisión (llamados desde TicketsService) ─────────────────────

  /**
   * Emite el estado actualizado de un cubículo a los administradores conectados.
   * Llamado por TicketsService después de confirmar transacciones.
   */
  emitCubicleUpdate(payload: CubicleStateChangedPayload): void {
    this.emitToAdmins(TELEMETRY_EVENTS.CUBICLE_STATE_CHANGED, payload);
    this.logger.debug(
      `cubicle:state-changed emitido para ${payload.cubicle.cubicleCode} → ${payload.cubicle.visualStatus}`,
    );
  }

  /**
   * Emite la cola y KPIs actualizados a los administradores conectados.
   * Llamado cuando hay cambios en la cola (nuevo turno, asignación, abandono).
   */
  emitQueueUpdate(payload: QueueUpdatedPayload): void {
    this.emitToAdmins(TELEMETRY_EVENTS.QUEUE_UPDATED, payload);
    this.logger.debug(
      `queue:updated emitido — ${payload.queue.length} turnos en espera`,
    );
  }

  /**
   * Emite un snapshot completo a todos los administradores conectados.
   * Para forzar recarga global (ej. tras operaciones masivas).
   */
  async broadcastSnapshot(): Promise<void> {
    try {
      const snapshot: TelemetrySnapshotPayload = await this.telemetryService.buildSnapshot();
      this.emitToAdmins(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
    } catch (err) {
      this.logger.error('Error al hacer broadcast de snapshot:', err);
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private emitToAdmins(event: string, payload: unknown): void {
    if (!this.server) return;
    if (typeof (this.server as { to?: unknown }).to === 'function') {
      this.server.to(ADMINS_ROOM).emit(event, payload);
      return;
    }
    this.server.emit?.(event, payload);
  }

  private rejectConnection(client: Socket, code: string, message: string): void {
    try {
      client.emit?.('exception', { code, message });
      client.disconnect?.(true);
    } catch {
      // noop
    }
  }

  private rejectActiveSocket(client: Socket, reason: string): void {
    const user = (client as unknown as { user?: SocketAuthenticatedUser }).user;
    if (user?.sub) {
      const userSockets = this.socketsByUserId.get(user.sub);
      userSockets?.delete(client);
      if (userSockets && userSockets.size === 0) {
        this.socketsByUserId.delete(user.sub);
      }
    }
    this.rejectConnection(client, 'AUTH_REQUIRED', `Sesión inválida (${reason}). Reconecte su sesión.`);
  }

  private disconnectUserSockets(userId: string, reasonCode: string): void {
    const userSockets = this.socketsByUserId.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return;
    }
    for (const client of Array.from(userSockets)) {
      this.rejectConnection(
        client,
        'AUTH_REQUIRED',
        `Sesión cerrada o revocada (${reasonCode}).`,
      );
    }
    this.socketsByUserId.delete(userId);
  }

  private getRuntimeNodeEnv(): string {
    try {
      return getEnv().NODE_ENV;
    } catch {
      return process.env['NODE_ENV'] || 'development';
    }
  }

  private async verifySocketSessionStillValid(client: Socket): Promise<boolean> {
    if (!this.isAuthorized(client)) {
      this.rejectActiveSocket(client, 'SESSION_EXPIRED');
      return false;
    }

    if (typeof this.prisma?.user?.findUnique !== 'function') {
      if (this.getRuntimeNodeEnv() !== 'test') {
        this.rejectActiveSocket(client, 'AUTH_SERVICE_UNAVAILABLE');
        return false;
      }
      return true;
    }

    const user = (client as unknown as { user?: SocketAuthenticatedUser }).user;
    if (
      !user?.sub ||
      typeof user.tokenVersion !== 'number' ||
      !Number.isInteger(user.tokenVersion)
    ) {
      this.rejectActiveSocket(client, 'AUTH_REQUIRED');
      return false;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { active: true, role: true, tokenVersion: true },
    });

    const dbTokenVersion = dbUser?.tokenVersion;
    if (
      !dbUser ||
      !dbUser.active ||
      !ALLOWED_ROLES.has(dbUser.role as UserRole) ||
      typeof dbTokenVersion !== 'number' ||
      dbTokenVersion !== user.tokenVersion
    ) {
      this.rejectActiveSocket(client, 'SESSION_REVOKED');
      return false;
    }

    return true;
  }

  private extractAndVerifyToken(client: Socket) {
    // 1. Prioridad: cookie cubiora_session enviada con la conexión
    const rawCookieHeader = client.handshake.headers?.cookie ?? '';
    const cookieMap = this.parseCookies(rawCookieHeader);
    const cookieToken = cookieMap['cubiora_session'];

    // 2. Fallback: auth.token solo en entornos no productivos para tests automatizados
    const authRecord =
      this.getRuntimeNodeEnv() !== 'production'
        ? (client.handshake.auth as Record<string, string> | undefined)
        : undefined;
    const authToken = authRecord ? authRecord['token'] : null;

    const token = cookieToken ?? authToken ?? null;
    if (!token) return null;

    let secret = process.env['SESSION_SECRET'] || '';
    try {
      secret = getEnv().SESSION_SECRET;
    } catch {
      // fallback a variable de entorno directa
    }

    if (!secret) return null;
    return SessionTokenUtil.verify(token, secret);
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const part of cookieHeader.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const rawVal = trimmed.slice(eqIdx + 1).trim();
      if (!key) continue;
      try {
        result[key] = decodeURIComponent(rawVal);
      } catch {
        result[key] = rawVal;
      }
    }
    return result;
  }

  private isAuthorized(client: Socket): boolean {
    const user = (client as unknown as { user?: SocketAuthenticatedUser }).user;
    if (!user || !ALLOWED_ROLES.has(user.role)) {
      return false;
    }
    if (
      typeof user.exp !== 'number' ||
      !Number.isFinite(user.exp) ||
      user.exp * 1000 <= Date.now()
    ) {
      return false;
    }
    return true;
  }
}

