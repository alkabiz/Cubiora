import { describe, expect, it } from 'vitest';
import {
  CubicleStatus,
  TicketStatus,
  type CubicleActiveTicket,
  type CubicleSnapshot,
  maskDocument,
} from '@cubiora/shared';
import {
  deriveStableViewStep,
  formatClockTime,
  formatDuration,
  getServerClockOffsetMs,
  waitingPatientsLabel,
} from './cubicle-view-model';

function snapshotWith(ticket: CubicleActiveTicket | null): CubicleSnapshot {
  return {
    cubicle: {
      id: 'cub_03',
      code: 'CUB-03',
      displayName: 'Cubículo 03',
      status: ticket ? CubicleStatus.RESERVED : CubicleStatus.AVAILABLE,
      version: 1,
    },
    activeTicket: ticket,
    waitingCount: 0,
    serverTime: '2026-10-21T10:00:00.000Z',
  };
}

function ticket(status: TicketStatus): CubicleActiveTicket {
  return {
    id: 'ticket_1',
    publicId: '01JTICKET1',
    publicCode: 'TUR-000124-C3',
    patientName: 'Carlos Pérez',
    maskedDocument: 'C.C. ••••••8212',
    status,
    version: 1,
    assignedAt: '2026-10-21T09:55:00.000Z',
    calledAt: '2026-10-21T09:58:00.000Z',
    serviceStartedAt: '2026-10-21T10:00:00.000Z',
    callNumber: 1,
  };
}

describe('Modelo de presentación de Mi cubículo', () => {
  it('deriva AVAILABLE cuando no hay turno activo', () => {
    expect(deriveStableViewStep(snapshotWith(null))).toBe('AVAILABLE');
  });

  it.each([
    [TicketStatus.ASSIGNED, 'ASSIGNED'],
    [TicketStatus.CALLED, 'CALLED'],
    [TicketStatus.IN_SERVICE, 'IN_SERVICE'],
  ] as const)('deriva %s como %s desde el snapshot persistido', (status, expected) => {
    expect(deriveStableViewStep(snapshotWith(ticket(status)))).toBe(expected);
  });

  it('no deriva estados transitorios desde estados terminales persistidos', () => {
    expect(deriveStableViewStep(snapshotWith(ticket(TicketStatus.CLOSED)))).toBe('AVAILABLE');
    expect(deriveStableViewStep(snapshotWith(ticket(TicketStatus.NO_SHOW)))).toBe('AVAILABLE');
  });

  it('formatea duraciones desde timestamps, no desde un contador acumulado', () => {
    const startedAt = '2026-10-21T10:00:00.000Z';
    expect(formatDuration(startedAt, Date.parse('2026-10-21T10:01:05.000Z'))).toBe('01:05');
    expect(formatDuration(startedAt, Date.parse('2026-10-21T11:05:09.000Z'))).toBe('65:09');
  });

  it('protege el cronómetro ante fechas inválidas o reloj anterior al inicio', () => {
    expect(formatDuration(undefined, Date.now())).toBe('—');
    expect(formatDuration('fecha-invalida', Date.now())).toBe('—');
    expect(formatDuration('2026-10-21T10:00:00.000Z', Date.parse('2026-10-21T09:59:59.000Z'))).toBe(
      '00:00',
    );
  });

  it('presenta horas HH:mm y un offset de reloj utilizable', () => {
    const iso = '2026-10-21T10:07:00.000Z';
    expect(formatClockTime(iso)).toMatch(/^\d{2}:\d{2}$/);
    expect(formatClockTime(null)).toBe('—');

    const clientNow = Date.parse('2026-10-21T10:00:05.000Z');
    expect(getServerClockOffsetMs('2026-10-21T10:00:00.000Z', clientNow)).toBe(-5_000);
    expect(getServerClockOffsetMs(undefined, clientNow)).toBe(0);
  });

  it('nunca presenta "0 pacientes en espera"', () => {
    expect(waitingPatientsLabel(0)).toBe('No hay pacientes en espera');
    expect(waitingPatientsLabel(-3)).toBe('No hay pacientes en espera');
    expect(waitingPatientsLabel(1)).toBe('1 paciente en espera');
    expect(waitingPatientsLabel(4)).toBe('4 pacientes en espera');
  });

  it('enmascara el documento y conserva como máximo los últimos cuatro dígitos', () => {
    expect(maskDocument('79.438.212')).toBe('C.C. ••••••8212');
    expect(maskDocument('10203040')).toBe('C.C. ••••••3040');
    expect(maskDocument('79.438.212')).not.toContain('79.438');
    expect(maskDocument('123')).toBe('C.C. ••••••');
    expect(maskDocument(null)).toBeNull();
    expect(maskDocument('')).toBeNull();
  });
});
