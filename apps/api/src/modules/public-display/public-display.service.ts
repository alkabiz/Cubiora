import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PublicDisplaySnapshot,
  PublicCall,
  PublicDisplayEvent,
} from '@cubiora/shared';

export interface SseMessage {
  data: string | object;
  type?: string;
  id?: string;
  retry?: number;
}

@Injectable()
export class PublicDisplayService {
  private readonly logger = new Logger(PublicDisplayService.name);
  private readonly eventSubject = new Subject<PublicDisplayEvent>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emite un evento en tiempo real a todos los clientes SSE conectados.
   */
  emitEvent(event: PublicDisplayEvent): void {
    this.logger.log(`Difundiendo evento SSE: ${event.type} para ${event.data.publicCode}`);
    this.eventSubject.next(event);
  }

  /**
   * Retorna el snapshot actual de la pantalla pública.
   * Regla de Privacidad: CERO PII. Nombres y documentos de identidad jamás se retornan aquí.
   */
  async getSnapshot(): Promise<PublicDisplaySnapshot> {
    // 1. Buscar los 5 llamados más recientes ordenados descendentemente
    const recentCallsRaw = await this.prisma.ticketCall.findMany({
      take: 5,
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

    const callsFormatted: PublicCall[] = recentCallsRaw.map((call) => ({
      publicCode: call.ticket.publicCode,
      cubicleDisplayName: call.cubicle.displayName,
      calledAt: call.createdAt.toISOString(),
      callNumber: call.callNumber,
    }));

    // El primer registro (más reciente) es el llamado actual si existe
    const currentCall: PublicCall | null = callsFormatted[0] ?? null;
    // Los siguientes hasta 4 son los recientes
    const recentCalls = callsFormatted.slice(1, 5);

    return {
      currentCall,
      recentCalls,
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
