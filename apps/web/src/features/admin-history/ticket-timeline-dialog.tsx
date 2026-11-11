import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Callout, Dialog, Flex, Separator } from '@radix-ui/themes';
import {
  AlertCircle,
  Bell,
  Clock,
  FileCheck2,
  History,
  Pill,
  RefreshCw,
} from 'lucide-react';
import {
  DispensationResolution,
  TicketStatus,
  USER_ROLE_LABELS_ES,
  type TicketTimelineDto,
} from '@cubiora/shared';
import { apiClient, unwrapApiData, type WrappedApiResponse } from '../../lib/api';

interface TicketTimelineDialogProps {
  open: boolean;
  publicId: string | null;
  ticketCode: string;
  onOpenChange: (open: boolean) => void;
}

const TICKET_STATUS_LABELS_ES: Record<TicketStatus, string> = {
  [TicketStatus.PENDING]: 'En espera',
  [TicketStatus.ASSIGNED]: 'Asignado',
  [TicketStatus.CALLED]: 'Llamado',
  [TicketStatus.IN_SERVICE]: 'En atención',
  [TicketStatus.CLOSED]: 'Cerrado',
  [TicketStatus.NO_SHOW]: 'No presentado',
  [TicketStatus.CANCELLED]: 'Cancelado',
};

function formatDateTimeEs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export const TicketTimelineDialog: React.FC<TicketTimelineDialogProps> = ({
  open,
  publicId,
  ticketCode,
  onOpenChange,
}) => {
  const [timeline, setTimeline] = useState<TicketTimelineDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!open || !publicId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient<WrappedApiResponse<TicketTimelineDto>>(
        `/tickets/${encodeURIComponent(publicId)}/history`,
      );
      setTimeline(unwrapApiData(response));
    } catch (error) {
      setTimeline(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'No fue posible consultar la trazabilidad del turno.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [open, publicId]);

  useEffect(() => {
    if (open && publicId) {
      void loadTimeline();
    } else if (!open) {
      setTimeline(null);
      setLoadError(null);
      setIsLoading(false);
    }
  }, [open, publicId, loadTimeline]);

  const ticket = timeline?.ticket;
  const dispensation = timeline?.dispensation;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="680px"
        aria-describedby="ticket-timeline-description"
        className="max-h-[85vh] overflow-y-auto"
      >
        <Dialog.Title className="flex items-center gap-2 text-slate-900">
          <History className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <span>Trazabilidad del turno {ticket?.publicCode ?? ticketCode}</span>
        </Dialog.Title>
        <Dialog.Description id="ticket-timeline-description" size="2" color="gray" mb="4">
          Auditoría cronológica de transiciones de estado, llamados en sala y registro farmacéutico.
        </Dialog.Description>

        {isLoading && (
          <div
            role="status"
            className="py-10 flex items-center justify-center gap-2 text-xs font-medium text-slate-600"
          >
            <RefreshCw className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
            Cargando línea de tiempo del turno…
          </div>
        )}

        {loadError && !isLoading && (
          <Callout.Root color="red" role="alert" mb="4">
            <Callout.Icon>
              <AlertCircle size={16} aria-hidden="true" />
            </Callout.Icon>
            <div className="flex items-center justify-between gap-3 flex-wrap w-full">
              <Callout.Text>{loadError}</Callout.Text>
              <Button
                type="button"
                size="1"
                variant="soft"
                color="red"
                onClick={() => void loadTimeline()}
                className="cursor-pointer"
              >
                Reintentar
              </Button>
            </div>
          </Callout.Root>
        )}

        {timeline && ticket && !isLoading && (
          <div className="space-y-5 text-xs">
            {/* Resumen operativo */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 font-semibold block">Estado final / actual</span>
                <div className="mt-1 flex items-center gap-2">
                  <Badge color="blue" variant="soft">
                    {TICKET_STATUS_LABELS_ES[ticket.status] ?? ticket.status}
                  </Badge>
                  <Badge color={ticket.slaCompliant ? 'green' : 'red'} variant="soft">
                    {ticket.slaCompliant ? 'SLA Cumplido' : 'SLA Excedido'}
                  </Badge>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block">Puesto y operador</span>
                <p className="mt-1 font-medium text-slate-900">
                  {ticket.assignedStation} · {ticket.operatorName}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block">Documento (enmascarado)</span>
                <p className="mt-1 font-mono text-slate-800">
                  {ticket.maskedDocument ?? 'Sin documento registrado'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block">Tiempos de gestión</span>
                <p className="mt-1 font-mono text-slate-800">
                  Espera: {formatDurationSeconds(ticket.waitingDurationSeconds)} · Atención:{' '}
                  {formatDurationSeconds(ticket.serviceDurationSeconds)}
                </p>
              </div>

              {timeline.terminalReason && (
                <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold block">Motivo terminal registrado</span>
                  <p className="mt-1 text-slate-900 font-medium">{timeline.terminalReason}</p>
                </div>
              )}
            </div>

            <Separator size="4" />

            {/* Línea de tiempo WORM de estados */}
            <section aria-label="Historial de transiciones de estado">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                Línea de tiempo de estados ({timeline.statusHistory.length})
              </h3>

              {timeline.statusHistory.length === 0 ? (
                <p className="text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  No se registraron transiciones de estado en la auditoría.
                </p>
              ) : (
                <ol className="space-y-2.5 border-l-2 border-blue-200 pl-4 ml-1.5">
                  {timeline.statusHistory.map((entry) => {
                    const fromLabel = entry.fromStatus
                      ? (TICKET_STATUS_LABELS_ES[entry.fromStatus] ?? entry.fromStatus)
                      : 'Creación';
                    const toLabel = TICKET_STATUS_LABELS_ES[entry.toStatus] ?? entry.toStatus;
                    const roleLabel = entry.actorRole
                      ? (USER_ROLE_LABELS_ES[entry.actorRole] ?? entry.actorRole)
                      : null;

                    return (
                      <li
                        key={entry.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            {fromLabel} → {toLabel}
                          </span>
                          <span className="font-mono text-[11px] text-slate-600">
                            {formatDateTimeEs(entry.createdAt)}
                          </span>
                        </div>
                        <div className="text-slate-600 flex items-center gap-2 flex-wrap">
                          {entry.cubicleDisplayName && (
                            <span>Cubículo: {entry.cubicleDisplayName}</span>
                          )}
                          {entry.actorName && (
                            <span>
                              · Operador: {entry.actorName}
                              {roleLabel ? ` (${roleLabel})` : ''}
                            </span>
                          )}
                          {entry.reasonCode && <span>· Motivo: {entry.reasonCode}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Llamados en sala */}
            <section aria-label="Registro de llamados en sala">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-purple-700" aria-hidden="true" />
                Llamados en sala ({timeline.calls.length})
              </h3>
              {timeline.calls.length === 0 ? (
                <p className="text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  No se emitieron llamados para este turno.
                </p>
              ) : (
                <ul className="space-y-2">
                  {timeline.calls.map((call) => (
                    <li
                      key={call.id}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                    >
                      <span className="font-semibold text-slate-900">
                        Llamado #{call.callNumber} · {call.cubicleDisplayName}
                        {call.callerName ? ` · ${call.callerName}` : ''}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        {formatDateTimeEs(call.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Registro de dispensación farmacéutica */}
            <section aria-label="Registro de dispensación farmacéutica">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Dispensación farmacéutica
              </h3>

              {!dispensation ? (
                <p className="text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  Sin registro de dispensación asociado a este turno.
                </p>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                      <FileCheck2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      {dispensation.resolution === DispensationResolution.PENDING_48H
                        ? 'Pendiente 48h (Resolución 1604)'
                        : 'Entrega Total (PBS)'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600">
                      {formatDateTimeEs(dispensation.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                    <p>
                      <span className="font-semibold">Fórmula / Prescripción:</span>{' '}
                      <span className="font-mono">{dispensation.prescriptionCode ?? '—'}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Ítems entregados / pendientes:</span>{' '}
                      <span className="font-mono">
                        {dispensation.itemsDeliveredCount} / {dispensation.itemsPendingCount}
                      </span>
                    </p>
                    {dispensation.resolution === DispensationResolution.PENDING_48H && (
                      <>
                        <p>
                          <span className="font-semibold">Dirección de entrega:</span>{' '}
                          {dispensation.deliveryAddress ?? '—'}
                        </p>
                        <p>
                          <span className="font-semibold">Teléfono de contacto:</span>{' '}
                          <span className="font-mono">{dispensation.deliveryPhone ?? '—'}</span>
                        </p>
                        {dispensation.deliveryDeadline && (
                          <p className="sm:col-span-2">
                            <span className="font-semibold">Plazo límite 48h:</span>{' '}
                            <span className="font-mono">
                              {formatDateTimeEs(dispensation.deliveryDeadline)}
                            </span>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <Flex justify="end" pt="4" mt="4" className="border-t border-slate-200">
          <Dialog.Close>
            <Button type="button" variant="soft" color="gray" className="cursor-pointer">
              Cerrar
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

