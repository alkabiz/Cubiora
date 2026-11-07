import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface PrePickingPayload {
  ticketId: string;
  publicCode: string;
  queueCategory: string;
  cubicleCode: string;
  prescriptionBarcode?: string | null;
  calledAt: string;
}

export interface PrePickingDispatchEvent {
  id: string;
  payload: PrePickingPayload;
  signature: string;
  dispatchedAt: string;
  status: 'BUFFERED' | 'SENT' | 'FAILED';
  error?: string;
}

@Injectable()
export class WmsIntegrationService {
  private readonly logger = new Logger(WmsIntegrationService.name);
  private readonly circularBuffer: PrePickingDispatchEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 50;

  private get secret(): string {
    return (
      process.env['WMS_WEBHOOK_SECRET'] ||
      'cubiora-wms-secret-key-enterprise-32ch-min'
    );
  }

  private get webhookUrl(): string | undefined {
    return process.env['WMS_WEBHOOK_URL'];
  }

  /**
   * Genera firma criptográfica HMAC-SHA256 sobre el contenido JSON
   * para autenticación segura en SAP / WMS de dispensación robotizada.
   */
  signPayload(payload: PrePickingPayload): string {
    const serialized = JSON.stringify(payload);
    return crypto.createHmac('sha256', this.secret).update(serialized).digest('hex');
  }

  /**
   * Alias de signPayload para compatibilidad y pruebas unitarias.
   */
  computeSignature(payload: PrePickingPayload): string {
    return this.signPayload(payload);
  }

  /**
   * Notifica a la bodega central o sistema de picking robotizado
   * en el momento exacto en que un paciente es llamado a ventanilla.
   */
  async notifyPrePickingOnCall(payload: PrePickingPayload): Promise<PrePickingDispatchEvent> {
    const signature = this.signPayload(payload);
    const eventId = `wms-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const dispatchEvent: PrePickingDispatchEvent = {
      id: eventId,
      payload,
      signature,
      dispatchedAt: nowIso,
      status: this.webhookUrl ? 'SENT' : 'BUFFERED',
    };

    // Buffer circular en memoria (últimos 50 eventos)
    this.circularBuffer.unshift(dispatchEvent);
    if (this.circularBuffer.length > this.MAX_BUFFER_SIZE) {
      this.circularBuffer.pop();
    }

    this.logger.log(
      `Evento de pre-picking registrado para turno ${payload.publicCode} en ${payload.cubicleCode}. Firma: ${signature.substring(0, 12)}…`,
    );

    // Despacho asíncrono no bloqueante vía Webhook si está configurado
    if (this.webhookUrl) {
      await this.dispatchWebhook(dispatchEvent);
    }

    return dispatchEvent;
  }

  /**
   * Consulta los últimos despachos de picking registrados en memoria.
   */
  getRecentDispatches(): PrePickingDispatchEvent[] {
    return [...this.circularBuffer];
  }

  private async dispatchWebhook(event: PrePickingDispatchEvent): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cubiora-Event': 'ticket.called',
          'X-Cubiora-Signature': event.signature,
          'X-Cubiora-Signature-256': event.signature,
          'X-Cubiora-Event-ID': event.id,
          'User-Agent': 'Cubiora-WMS-Dispatcher/1.0',
        },
        body: JSON.stringify(event.payload),
      });

      if (!response.ok) {
        event.status = 'FAILED';
        event.error = `HTTP ${response.status} ${response.statusText}`;
        this.logger.warn(`Fallo al enviar webhook WMS: ${event.error}`);
      } else {
        event.status = 'SENT';
      }
    } catch (err) {
      event.status = 'FAILED';
      event.error = (err as Error).message;
      this.logger.warn(`Error de red al despachar webhook WMS: ${event.error}`);
    }
  }
}
