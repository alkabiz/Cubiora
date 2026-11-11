import { PublicDisplayService, SseMessage } from '../src/modules/public-display/public-display.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PublicDisplayEvent } from '@cubiora/shared';
import { firstValueFrom, toArray, take, Subscription } from 'rxjs';

describe('Validación de Stream SSE Real (EventSource / Reactive Stream)', () => {
  let publicDisplayService: PublicDisplayService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      ticketCall: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-10-21T10:00:00Z'),
            callNumber: 2,
            ticket: { publicCode: 'TUR-000001-GE', status: 'CALLED' },
            cubicle: { displayName: 'Cubículo 01' },
          },
          {
            createdAt: new Date('2026-10-21T09:45:00Z'),
            callNumber: 1,
            ticket: { publicCode: 'TUR-000002-GE', status: 'CALLED' },
            cubicle: { displayName: 'Cubículo 02' },
          },
        ]),
      },
    };

    publicDisplayService = new PublicDisplayService(mockPrisma as PrismaService);
  });

  it('1. Debe abrir stream SSE y capturar eventos ticket.called y ticket.recalled en tiempo real', async () => {
    const stream$ = publicDisplayService.getEventStream();
    const capturedMessages: SseMessage[] = [];

    // Suscripción simulando cliente EventSource conectado al stream SSE
    const subscription: Subscription = stream$.subscribe((msg) => {
      capturedMessages.push(msg);
    });

    // 2. Emitir llamado inicial de turno (ticket.called)
    const calledEvent: PublicDisplayEvent = {
      type: 'ticket.called',
      data: {
        publicCode: 'TUR-000001-GE',
        cubicleDisplayName: 'Cubículo 01',
        calledAt: new Date().toISOString(),
        callNumber: 1,
      },
    };
    publicDisplayService.emitEvent(calledEvent);

    // 3. Emitir segundo llamado (ticket.recalled)
    const recalledEvent: PublicDisplayEvent = {
      type: 'ticket.recalled',
      data: {
        publicCode: 'TUR-000001-GE',
        cubicleDisplayName: 'Cubículo 01',
        calledAt: new Date().toISOString(),
        callNumber: 2,
      },
    };
    publicDisplayService.emitEvent(recalledEvent);

    // Esperar tick de procesamiento
    await new Promise((r) => setTimeout(r, 10));

    expect(capturedMessages.length).toBe(2);
    expect(capturedMessages[0].type).toBe('ticket.called');
    expect(JSON.parse(capturedMessages[0].data as string).publicCode).toBe('TUR-000001-GE');
    expect(JSON.parse(capturedMessages[0].data as string).callNumber).toBe(1);

    expect(capturedMessages[1].type).toBe('ticket.recalled');
    expect(JSON.parse(capturedMessages[1].data as string).publicCode).toBe('TUR-000001-GE');
    expect(JSON.parse(capturedMessages[1].data as string).callNumber).toBe(2);

    // 4. Desconexión del cliente EventSource
    subscription.unsubscribe();
    expect(subscription.closed).toBe(true);
  });

  it('2. Al reconectarse tras desconexión, debe recuperar el snapshot completo del estado público vigente', async () => {
    // Cliente desconectado que se reconecta y consulta el snapshot del servidor
    const snapshot = await publicDisplayService.getSnapshot();

    // 2. Verificar llamada con rango horario del día actual
    expect(mockPrisma.ticketCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: expect.any(Date),
            lt: expect.any(Date),
          },
        },
      }),
    );

    expect(snapshot).toBeDefined();
    expect(snapshot.currentCall).toBeDefined();
    expect(snapshot.currentCall?.publicCode).toBe('TUR-000001-GE');
    expect(snapshot.currentCall?.cubicleDisplayName).toBe('Cubículo 01');
    expect(snapshot.currentCall?.callNumber).toBe(2);

    expect(snapshot.recentCalls).toHaveLength(1);
    expect(snapshot.recentCalls[0].publicCode).toBe('TUR-000002-GE');
  });

  it('3. Excluye turnos en estado terminal (CLOSED, NO_SHOW, CANCELLED) del llamado activo en curso', async () => {
    mockPrisma.ticketCall.findMany.mockResolvedValue([
      {
        createdAt: new Date(),
        callNumber: 1,
        ticket: { publicCode: 'TUR-000046-GE', status: 'CLOSED' },
        cubicle: { displayName: 'Cubículo 01' },
      },
      {
        createdAt: new Date(Date.now() - 60_000),
        callNumber: 1,
        ticket: { publicCode: 'TUR-000045-GE', status: 'NO_SHOW' },
        cubicle: { displayName: 'Cubículo 02' },
      },
    ]);

    const snapshot = await publicDisplayService.getSnapshot();

    expect(snapshot.currentCall).toBeNull();
    expect(snapshot.recentCalls).toHaveLength(2);
    expect(snapshot.recentCalls.map((c) => c.publicCode)).toEqual([
      'TUR-000046-GE',
      'TUR-000045-GE',
    ]);
  });

  it('4. Difunde Aviso General (admin.notice) por SSE y lo mantiene en snapshot hasta expirar', async () => {
    const stream$ = publicDisplayService.getEventStream();
    const captured: SseMessage[] = [];
    const sub = stream$.subscribe((m) => captured.push(m));

    const emitted = publicDisplayService.emitNotice('Turno preferencial prioritario', 'warning', 15_000);
    expect(emitted).not.toBeNull();

    await new Promise((r) => setTimeout(r, 10));

    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('admin.notice');
    expect(JSON.parse(captured[0].data as string)).toMatchObject({
      message: 'Turno preferencial prioritario',
      severity: 'warning',
    });

    const snapshot = await publicDisplayService.getSnapshot();
    expect(snapshot.activeNotice).toMatchObject({
      message: 'Turno preferencial prioritario',
      severity: 'warning',
    });

    sub.unsubscribe();
  });
});
