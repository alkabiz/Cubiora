import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SessionTokenUtil } from '../auth/session-token.util';
import { getEnv } from '../../config/env.validation';
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

@WebSocketGateway({
  namespace: '/operational-telemetry',
  cors: {
    // CORS dinámico: lee la lista de orígenes autorizados al igual que main.ts
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const env = getEnv();
      const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim());
      if (!origin || allowed.includes(origin) || allowed.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error('Origen no autorizado'), false);
      }
    },
    credentials: true,
  },
})
export class OperationalTelemetryGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(OperationalTelemetryGateway.name);

  constructor(
    private readonly telemetryService: OperationalTelemetryService,
    @Optional() private readonly publicDisplayService?: PublicDisplayService,
  ) {}

  onModuleInit(): void {
    this.telemetryService.onCubicleUpdate$.subscribe((payload) => {
      this.emitCubicleUpdate(payload);
    });

    this.telemetryService.onQueueUpdate$.subscribe((payload) => {
      this.emitQueueUpdate(payload);
    });

    this.telemetryService.onSnapshotBroadcast$.subscribe((snapshot) => {
      this.server?.emit(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
    });
  }

  // ─── Ciclo de vida de conexión ──────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const payload = this.extractAndVerifyToken(client);

    if (!payload || !ALLOWED_ROLES.has(payload.role)) {
      this.logger.warn(
        `Conexión rechazada al namespace /operational-telemetry. ` +
          `Socket: ${client.id}. Motivo: ${!payload ? 'token inválido' : `rol no autorizado (${payload.role})`}`,
      );
      client.emit('exception', {
        code: 'AUTH_REQUIRED',
        message: 'Acceso denegado al canal de telemetría operativa.',
      });
      client.disconnect(true);
      return;
    }

    this.logger.log(
      `Admin conectado al canal de telemetría: ${payload.displayName} (${client.id})`,
    );

    // Adjuntar usuario al socket para uso posterior
    (client as unknown as { user: typeof payload }).user = payload;

    // Emitir snapshot completo inmediatamente
    try {
      const snapshot = await this.telemetryService.buildSnapshot();
      client.emit(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
    } catch (err) {
      this.logger.error('Error construyendo snapshot inicial de telemetría:', err);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = (client as unknown as { user?: { displayName: string } }).user;
    this.logger.log(
      `Desconexión del canal de telemetría: ${user?.displayName ?? 'desconocido'} (${client.id})`,
    );
  }

  // ─── Eventos Cliente → Servidor ─────────────────────────────────────────────

  /** Ping para medir latencia RTT. */
  @SubscribeMessage(TELEMETRY_EVENTS.PING)
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TelemetryPingPayload,
  ): void {
    client.emit(TELEMETRY_EVENTS.PONG, {
      clientSentAt: data?.clientSentAt ?? Date.now(),
      serverTime: new Date().toISOString(),
    });
  }

  /** El cliente solicita un snapshot fresco (botón de refresco). */
  @SubscribeMessage(TELEMETRY_EVENTS.REQUEST_SNAPSHOT)
  async handleRequestSnapshot(@ConnectedSocket() client: Socket): Promise<void> {
    if (!this.isAuthorized(client)) return;

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
  ): void {
    if (!this.isAuthorized(client)) return;

    const trimmedMessage = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!trimmedMessage) return;

    const rawSeverity = data?.severity;
    const severity: PublicBroadcastNoticeSeverity =
      rawSeverity === 'warning' || rawSeverity === 'critical' ? rawSeverity : 'info';

    const user = (client as unknown as { user?: { displayName: string } }).user;
    this.logger.log(
      `Aviso general emitido por ${user?.displayName ?? 'admin'}: [${severity}] ${trimmedMessage}`,
    );

    const emittedNotice = this.publicDisplayService?.emitNotice(trimmedMessage, severity);
    const issuedAt = emittedNotice?.issuedAtIso ?? new Date().toISOString();

    // Re-emitir el aviso a todos los administradores conectados
    this.server?.emit('admin:notice', {
      message: trimmedMessage,
      severity,
      sentAt: issuedAt,
      sentBy: user?.displayName ?? 'Administrador',
    });
  }

  // ─── Métodos de emisión (llamados desde TicketsService) ─────────────────────

  /**
   * Emite el estado actualizado de un cubículo a todos los clientes del canal.
   * Llamado por TicketsService después de confirmar transacciones.
   */
  emitCubicleUpdate(payload: CubicleStateChangedPayload): void {
    this.server.emit(TELEMETRY_EVENTS.CUBICLE_STATE_CHANGED, payload);
    this.logger.debug(
      `cubicle:state-changed emitido para ${payload.cubicle.cubicleCode} → ${payload.cubicle.visualStatus}`,
    );
  }

  /**
   * Emite la cola y KPIs actualizados a todos los clientes del canal.
   * Llamado cuando hay cambios en la cola (nuevo turno, asignación, abandono).
   */
  emitQueueUpdate(payload: QueueUpdatedPayload): void {
    this.server.emit(TELEMETRY_EVENTS.QUEUE_UPDATED, payload);
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
      this.server.emit(TELEMETRY_EVENTS.SNAPSHOT, snapshot);
    } catch (err) {
      this.logger.error('Error al hacer broadcast de snapshot:', err);
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private extractAndVerifyToken(client: Socket) {
    // 1. Prioridad: cookie cubiora_session enviada con la conexión
    const rawCookieHeader = client.handshake.headers?.cookie ?? '';
    const cookieMap = this.parseCookies(rawCookieHeader);
    const cookieToken = cookieMap['cubiora_session'];

    // 2. Fallback: auth.token enviado en el handshake (útil en tests y clientes SPA)
    const authRecord = client.handshake.auth as Record<string, string> | undefined;
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
      const [key, ...rest] = part.trim().split('=');
      if (key) result[key.trim()] = decodeURIComponent(rest.join('=').trim());
    }
    return result;
  }

  private isAuthorized(client: Socket): boolean {
    const user = (client as unknown as { user?: { role: UserRole } }).user;
    return !!user && ALLOWED_ROLES.has(user.role);
  }
}

