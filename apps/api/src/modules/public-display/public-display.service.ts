import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PublicBroadcastNotice,
  PublicBroadcastNoticeSeverity,
  PublicDisplaySnapshot,
  PublicCall,
  PublicDisplayEvent,
  TicketStatus,
} from '@cubiora/shared';

export interface SseMessage {
  data: string | object;
  type?: string;
  id?: string;
  retry?: number;
}

const TERMINAL_TICKET_STATUSES: ReadonlySet<string> = new Set([
  TicketStatus.CLOSED,
  TicketStatus.NO_SHOW,
  TicketStatus.CANCELLED,
]);

@Injectable()
export class PublicDisplayService {
  private static readonly DEFAULT_NOTICE_TTL_MS = 5 * 60 * 1000;

  private readonly logger = new Logger(PublicDisplayService.name);
  private readonly eventSubject = new Subject<PublicDisplayEvent>();
  private activeNoticeState: { notice: PublicBroadcastNotice; expiresAtMs: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emite un evento en tiempo real a todos los clientes SSE conectados.
   */
  emitEvent(event: PublicDisplayEvent): void {
    if (event.type === 'admin.notice') {
      this.logger.log(`Difundiendo evento SSE: ${event.type} [${event.data.severity}]`);
    } else {
      this.logger.log(`Difundiendo evento SSE: ${event.type} para ${event.data.publicCode}`);
    }
    this.eventSubject.next(event);
  }

  /**
   * Publica un aviso general institucional hacia las pantallas públicas de sala.
   * Persiste en memoria por un TTL corto para hidratar reconexiones en snapshot.
   */
  emitNotice(
    message: string,
    severity: PublicBroadcastNoticeSeverity = 'info',
    ttlMs = PublicDisplayService.DEFAULT_NOTICE_TTL_MS,
  ): PublicBroadcastNotice | null {
    const trimmed = message.trim();
    if (!trimmed) {
      return null;
    }

    const nowMs = Date.now();
    const expiresAtMs = nowMs + Math.max(10_000, ttlMs);
    const notice: PublicBroadcastNotice = {
      message: trimmed,
      severity,
      issuedAtIso: new Date(nowMs).toISOString(),
      expiresAtIso: new Date(expiresAtMs).toISOString(),
    };

    this.activeNoticeState = { notice, expiresAtMs };
    this.emitEvent({ type: 'admin.notice', data: notice });
    return notice;
  }

  /**
   * Retorna el snapshot actual de la pantalla pública para la jornada vigente.
   * Regla de Privacidad: CERO PII. Nombres y documentos de identidad jamás se retornan aquí.
   */
  async getSnapshot(): Promise<PublicDisplaySnapshot> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    // 1. Buscar llamados únicamente de la jornada actual ordenados descendentemente
    const todayCallsRaw = await this.prisma.ticketCall.findMany({
      where: {
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      take: 25,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: {
          select: {
            publicCode: true,
            status: true,
          },
        },
        cubicle: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const toPublicCall = (call: (typeof todayCallsRaw)[number]): PublicCall => ({
      publicCode: call.ticket.publicCode,
      cubicleDisplayName: call.cubicle.displayName,
      calledAt: call.createdAt.toISOString(),
      callNumber: call.callNumber,
    });

    // 2. El llamado activo en hero nunca puede pertenecer a un turno ya terminado
    const activeCallRaw = todayCallsRaw.find((call) => {
      const status = (call.ticket as { status?: string } | undefined)?.status;
      return !status || !TERMINAL_TICKET_STATUSES.has(status);
    });

    const currentCall: PublicCall | null = activeCallRaw ? toPublicCall(activeCallRaw) : null;

    // 3. Llamados recientes del día actual (deduplicados por código, sin repetir el hero actual)
    const seenCodes = new Set<string>();
    if (currentCall) {
      seenCodes.add(currentCall.publicCode);
    }

    const recentCalls: PublicCall[] = [];
    for (const call of todayCallsRaw) {
      const code = call.ticket.publicCode;
      if (seenCodes.has(code)) {
        continue;
      }
      seenCodes.add(code);
      recentCalls.push(toPublicCall(call));
      if (recentCalls.length >= 4) {
        break;
      }
    }

    // 4. Aviso institucional vigente (si no expiró)
    let activeNotice: PublicBroadcastNotice | null = null;
    if (this.activeNoticeState) {
      if (this.activeNoticeState.expiresAtMs > now.getTime()) {
        activeNotice = this.activeNoticeState.notice;
      } else {
        this.activeNoticeState = null;
      }
    }

    return {
      currentCall,
      recentCalls,
      activeNotice,
    };
  }

  /**
   * Stream reactivo para SSE.
   * Combina eventos de llamadas en tiempo real con un heartbeat periódico.
   */
  getEventStream(): Observable<SseMessage> {
    const eventsStream$ = this.eventSubject.asObservable().pipe(
      map((event) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      })),
    );

    // Heartbeat cada 20 segundos para evitar que proxies y firewalls cierren la conexión SSE
    const heartbeatStream$ = interval(20000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      })),
    );

    return merge(eventsStream$, heartbeatStream$);
  }
}
