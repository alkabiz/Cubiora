import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as net from 'net';

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

const DISALLOWED_WMS_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  'metadata.google.internal',
]);

@Injectable()
export class WmsIntegrationService {
  private readonly logger = new Logger(WmsIntegrationService.name);
  private readonly circularBuffer: PrePickingDispatchEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 50;
  private static readonly WEBHOOK_TIMEOUT_MS = 5000;

  private get configuredSecret(): string | undefined {
    const raw = process.env['WMS_WEBHOOK_SECRET']?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  }

  private get webhookUrl(): string | undefined {
    const raw = process.env['WMS_WEBHOOK_URL']?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  }

  private requireValidSecret(): string {
    const secret = this.configuredSecret;
    if (!secret) {
      throw new Error(
        'WMS_WEBHOOK_SECRET no está configurado; no se puede firmar eventos WMS sin un secreto explícito.',
      );
    }
    const minLength = process.env['NODE_ENV'] === 'production' ? 32 : 24;
    if (secret.length < minLength) {
      throw new Error(
        `WMS_WEBHOOK_SECRET debe tener al menos ${minLength} caracteres.`,
      );
    }
    return secret;
  }

  private validateWebhookUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error('WMS_WEBHOOK_URL tiene un formato de URL inválido.');
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('WMS_WEBHOOK_URL debe utilizar protocolo HTTPS.');
    }

    if (parsed.username || parsed.password) {
      throw new Error('WMS_WEBHOOK_URL no debe incluir credenciales incrustadas.');
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname) {
      throw new Error('WMS_WEBHOOK_URL debe especificar un host válido.');
    }

    if (net.isIP(hostname) !== 0) {
      throw new Error('WMS_WEBHOOK_URL no puede apuntar directamente a direcciones IP.');
    }

    if (
      DISALLOWED_WMS_HOSTS.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.internal')
    ) {
      throw new Error(`Host no permitido para webhook WMS: '${hostname}'.`);
    }

    return parsed;
  }

  /**
   * Genera firma criptográfica HMAC-SHA256 sobre el contenido JSON
   * para autenticación segura en SAP / WMS de dispensación robotizada.
   */
  signPayload(payload: PrePickingPayload): string {
    const secret = this.requireValidSecret();
    const serialized = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(serialized).digest('hex');
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
    const targetUrl = this.webhookUrl;
    const hasSecret = Boolean(this.configuredSecret);

    if (!targetUrl && !hasSecret) {
      const bufferedEvent: PrePickingDispatchEvent = {
        id: `wms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        payload,
        signature: '',
        dispatchedAt: new Date().toISOString(),
        status: 'BUFFERED',
      };
      this.circularBuffer.unshift(bufferedEvent);
      if (this.circularBuffer.length > this.MAX_BUFFER_SIZE) {
        this.circularBuffer.pop();
      }
      this.logger.debug(
        `Evento de pre-picking en buffer sin despacho (WMS_WEBHOOK_URL no configurado) para turno ${payload.publicCode} en ${payload.cubicleCode}.`,
      );
      return bufferedEvent;
    }

    const validatedUrl = targetUrl ? this.validateWebhookUrl(targetUrl) : null;
    const signature = this.signPayload(payload);
    const eventId = `wms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const dispatchEvent: PrePickingDispatchEvent = {
      id: eventId,
      payload,
      signature,
      dispatchedAt: nowIso,
      status: validatedUrl ? 'SENT' : 'BUFFERED',
    };

    // Buffer circular en memoria (últimos 50 eventos)
    this.circularBuffer.unshift(dispatchEvent);
    if (this.circularBuffer.length > this.MAX_BUFFER_SIZE) {
      this.circularBuffer.pop();
    }

    this.logger.log(
      `Evento de pre-picking registrado para turno ${payload.publicCode} en ${payload.cubicleCode}.`,
    );

    // Despacho asíncrono no bloqueante vía Webhook si está configurado
    if (validatedUrl) {
      await this.dispatchWebhook(dispatchEvent, validatedUrl);
    }

    return dispatchEvent;
  }

  /**
   * Consulta los últimos despachos de picking registrados en memoria.
   */
  getRecentDispatches(): PrePickingDispatchEvent[] {
    return [...this.circularBuffer];
  }

  private async dispatchWebhook(event: PrePickingDispatchEvent, targetUrl: URL): Promise<void> {
    try {
      const response = await fetch(targetUrl.toString(), {
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
        redirect: 'error',
        signal: AbortSignal.timeout(WmsIntegrationService.WEBHOOK_TIMEOUT_MS),
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
