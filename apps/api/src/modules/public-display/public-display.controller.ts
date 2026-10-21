import { Controller, Get, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Public } from '../../common/decorators/public.decorator';
import { PublicDisplayService, SseMessage } from './public-display.service';
import { PublicDisplaySnapshot } from '@cubiora/shared';

@Public()
@Controller('public-display')
export class PublicDisplayController {
  constructor(private readonly publicDisplayService: PublicDisplayService) {}

  /**
   * GET /api/v1/public-display/snapshot
   * Retorna el snapshot inicial de turnos llamados y recientes.
   * Totalmente público, sin autenticación ni datos de pacientes (Cero PII).
   */
  @Get('snapshot')
  async getSnapshot(): Promise<{ success: boolean; data: PublicDisplaySnapshot }> {
    const data = await this.publicDisplayService.getSnapshot();
    return {
      success: true,
      data,
    };
  }

  /**
   * GET /api/v1/public-display/events
   * Stream Server-Sent Events (SSE) para notificar llamados en tiempo real.
   */
  @Sse('events')
  sendEvents(): Observable<SseMessage> {
    return this.publicDisplayService.getEventStream();
  }
}
