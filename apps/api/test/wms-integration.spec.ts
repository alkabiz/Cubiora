import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WmsIntegrationService } from '../src/modules/wms-integration/wms-integration.service';
import { QueueCategory } from '@cubiora/shared';
import * as crypto from 'crypto';

describe('WMS / ERP Integration Service (Fase 5 - Picking Pharmacist Pre-dispatch)', () => {
  let service: WmsIntegrationService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('WMS_WEBHOOK_URL', 'https://wms.audifarma.local/api/v1/pre-picking');
    vi.stubEnv('WMS_WEBHOOK_SECRET', 'test-wms-secret-key-1234567890');
    service = new WmsIntegrationService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('debe generar una firma HMAC-SHA256 válida con el secreto configurado', () => {
    const payload = {
      ticketId: 'tick-001',
      publicCode: 'TUR-000100-HC',
      queueCategory: QueueCategory.HIGH_COST,
      prescriptionBarcode: 'MED-998877',
      cubicleCode: 'CUB-01',
      calledAt: '2026-11-07T05:00:00.000Z',
    };

    const signature = service.computeSignature(payload);
    const expected = crypto
      .createHmac('sha256', 'test-wms-secret-key-1234567890')
      .update(JSON.stringify(payload))
      .digest('hex');

    expect(signature).toBe(expected);
  });

  it('debe enviar la notificación POST con headers X-Cubiora-Signature y registrar en buffer circular', async () => {
    let capturedUrl = '';
    let capturedOptions: any = null;

    global.fetch = vi.fn().mockImplementation((url, options) => {
      capturedUrl = String(url);
      capturedOptions = options;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('OK'),
      });
    }) as any;

    const payload = {
      ticketId: 'tick-001',
      publicCode: 'TUR-000100-HC',
      queueCategory: QueueCategory.HIGH_COST,
      prescriptionBarcode: 'BARCODE-12345',
      cubicleCode: 'CUB-01',
      calledAt: new Date().toISOString(),
    };

    await service.notifyPrePickingOnCall(payload);

    expect(capturedUrl).toBe('https://wms.audifarma.local/api/v1/pre-picking');
    expect(capturedOptions.method).toBe('POST');
    expect(capturedOptions.headers['Content-Type']).toBe('application/json');
    expect(capturedOptions.headers['X-Cubiora-Event']).toBe('ticket.called');
    expect(capturedOptions.headers['X-Cubiora-Signature']).toBeDefined();

    const body = JSON.parse(capturedOptions.body);
    expect(body.ticketId).toBe('tick-001');
    expect(body.publicCode).toBe('TUR-000100-HC');
    expect(body.queueCategory).toBe('HIGH_COST');
    expect(body.prescriptionBarcode).toBe('BARCODE-12345');
    expect(body.cubicleCode).toBe('CUB-01');

    // Verificar buffer circular
    const recent = service.getRecentDispatches();
    expect(recent.length).toBe(1);
    expect(recent[0]?.payload.ticketId).toBe('tick-001');
    expect(recent[0]?.status).toBe('SENT');
  });

  it('debe tolerar fallos de red en el endpoint WMS sin lanzar excepciones a la llamada del turno', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Connection Refused'));

    const payload = {
      ticketId: 'tick-002',
      publicCode: 'TUR-000101-GE',
      queueCategory: QueueCategory.GENERAL,
      prescriptionBarcode: null,
      cubicleCode: 'CUB-02',
      calledAt: new Date().toISOString(),
    };

    // No debe lanzar excepción
    await expect(service.notifyPrePickingOnCall(payload)).resolves.not.toThrow();

    const recent = service.getRecentDispatches();
    expect(recent.length).toBe(1);
    expect(recent[0]?.payload.ticketId).toBe('tick-002');
    expect(recent[0]?.status).toBe('FAILED');
    expect(recent[0]?.error).toContain('Network Connection Refused');
  });

  it('el buffer circular no debe almacenar más de 50 elementos', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('OK'),
    }) as any;

    for (let i = 1; i <= 60; i++) {
      await service.notifyPrePickingOnCall({
        ticketId: `tick-${i}`,
        publicCode: `TUR-${String(i).padStart(6, '0')}`,
        queueCategory: QueueCategory.GENERAL,
        prescriptionBarcode: null,
        cubicleCode: 'CUB-01',
        calledAt: new Date().toISOString(),
      });
    }

    const recent = service.getRecentDispatches();
    expect(recent.length).toBe(50);
    // El primer elemento debe ser el más reciente (tick-60)
    expect(recent[0]?.payload.ticketId).toBe('tick-60');
    // El último elemento debe ser tick-11
    expect(recent[49]?.payload.ticketId).toBe('tick-11');
  });
});
