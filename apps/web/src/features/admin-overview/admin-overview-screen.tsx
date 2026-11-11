// ─── SCR-ADM-001 · CMP-ADM-001 — Estado General Operativo ────────────────────
import React, { useState } from 'react';
import {
  RefreshCw,
  Megaphone,
  AlertTriangle,
  Users,
  Grid2X2,
  CheckCircle2,
  UserX,
  Clock,
  Timer,
  Activity,
  Cpu,
  WifiOff,
} from 'lucide-react';

import { AppMain } from '../../app/app-main';
import { PageHeader } from '../../app/page-header';
import { BroadcastNoticeDialog } from './broadcast-notice-dialog';
import { CubicleCard } from './cubicle-card';
import { QueueItemCard } from './queue-item-card';
import { KpiCard } from './kpi-card';
import { useOperationalTelemetry, formatElapsedTime } from './use-operational-telemetry';
import type { HourlyFlowEntry } from './types';
import type { TelemetryDailyKpis, TelemetrySlaAlert, BottleneckRecommendation } from '@cubiora/shared';

// ─── Banner de alerta SLA ─────────────────────────────────────────────────────
interface SlaAlertBannerProps {
  alert: TelemetrySlaAlert;
  slaThresholdSeconds: number | null;
  isLoaded: boolean;
}

const SlaAlertBanner: React.FC<SlaAlertBannerProps> = ({
  alert,
  slaThresholdSeconds,
  isLoaded,
}) => {
  const effectiveThreshold =
    alert.thresholdSeconds > 0 ? alert.thresholdSeconds : slaThresholdSeconds ?? 0;
  const thresholdMin = effectiveThreshold > 0 ? Math.round(effectiveThreshold / 60) : null;
  const complianceDisplay =
    alert.slaCompliancePercentage !== null ? `${alert.slaCompliancePercentage}%` : '—';

  if (!alert.isActive) {
    return (
      <div className="bg-[#008f7a]/10 border border-[#008f7a] rounded-xl p-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#008f7a] flex-shrink-0">
            <CheckCircle2 size={16} className="text-[#008f7a]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                DIAGNÓSTICO OPERATIVO:
              </span>
              <span className="bg-[#008f7a] text-[#020617] text-[11px] font-bold px-2 py-0.5 rounded">
                {isLoaded ? 'OPERACIÓN NOMINAL' : 'SINCRONIZANDO'}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5">
              {!isLoaded
                ? 'Esperando el primer snapshot de telemetría en tiempo real desde la sede activa.'
                : thresholdMin !== null
                  ? `Todos los puestos activos operan dentro del umbral SLA configurado (≤ ${thresholdMin} minutos).`
                  : 'Todos los puestos activos operan dentro de los parámetros nominales.'}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs text-slate-600 block">SLA General:</span>
          <span className="text-sm font-mono font-bold text-slate-900">
            {complianceDisplay}
          </span>
        </div>
      </div>
    );
  }

  const elapsedFormatted =
    alert.elapsedSeconds !== null ? formatElapsedTime(alert.elapsedSeconds) : '—';
  const worstDisplay = alert.worstCubicleDisplay || alert.worstCubicleCode || 'Puesto en atención';
  const affectedTicket = alert.affectedTicketCode || '—';

  return (
    <div className="bg-[#FEF2F2] border border-red-200/80 rounded-xl p-3.5 flex items-center justify-between gap-4">
      {/* Izquierda */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100/80 flex-shrink-0 mt-0.5">
          <AlertTriangle size={15} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
              DIAGNÓSTICO OPERATIVO:
            </span>
            <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
              DESVIACIÓN DE SLA DETECTADA
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
            El puesto {worstDisplay} registra un tiempo acumulado de atención de{' '}
            <span className="font-semibold">{elapsedFormatted}</span> en el turno{' '}
            <span className="font-mono font-semibold">{affectedTicket}</span>
            {thresholdMin !== null ? `, superando el umbral de ${thresholdMin} minutos.` : '.'}
          </p>
        </div>
      </div>

      {/* Derecha */}
      <div className="text-right flex-shrink-0">
        <span className="text-xs text-slate-700 font-medium block">SLA General:</span>
        <span className="text-sm font-mono font-bold text-slate-900">
          {complianceDisplay}
        </span>
      </div>
    </div>
  );
};

// ─── Grid KPI ─────────────────────────────────────────────────────────────────
interface KpiSummaryGridProps {
  kpis: TelemetryDailyKpis;
  slaThresholdSeconds: number | null;
}

const KpiSummaryGrid: React.FC<KpiSummaryGridProps> = ({ kpis, slaThresholdSeconds }) => {
  const waitingPadded = String(kpis.waitingCount).padStart(2, '0');
  const activePercent =
    kpis.totalCubicles > 0 ? Math.round((kpis.activeCubicles / kpis.totalCubicles) * 100) : 0;
  const closedCountStr = String(kpis.closedTodayCount);
  const slaComplianceStr =
    kpis.slaCompliancePercentage !== null ? `${kpis.slaCompliancePercentage}%` : '—';
  const noShowPadded = String(kpis.noShowTodayCount).padStart(2, '0');
  const noShowRateStr = kpis.noShowRate !== null ? `${kpis.noShowRate}%` : '—';
  const slaTargetMins =
    slaThresholdSeconds && slaThresholdSeconds > 0
      ? Math.round(slaThresholdSeconds / 60)
      : null;

  let waitText = '—';
  let waitClass = 'text-[#2c73d2]';

  if (kpis.averageWaitSeconds !== undefined && kpis.averageWaitSeconds !== null) {
    const mins = Math.round(kpis.averageWaitSeconds / 60);
    waitText = `${mins}m prom.`;
    if (kpis.averageWaitSeconds > 1500) {
      waitClass = 'text-red-700 bg-red-50 px-1.5 py-0.5 rounded font-extrabold';
    } else if (kpis.averageWaitSeconds > 900) {
      waitClass = 'motion-safe:animate-pulse text-amber-700 font-extrabold';
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1 — Turnos en espera */}
      <KpiCard
        label="Turnos en espera"
        icon={<Users size={15} />}
        mainValue={waitingPadded}
        mainUnit="turnos"
        secondaryValue={<span className={waitClass}>{waitText}</span>}
        secondaryLabel="Espera promedio (AWT)"
        footer={
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Clock size={12} className="text-slate-600 flex-shrink-0" aria-hidden="true" />
            <span>
              {kpis.waitingCount > 0
                ? 'Pacientes aguardando llamado en sala'
                : 'Sin turnos pendientes en cola'}
            </span>
          </div>
        }
      />

      {/* 2 — Cubículos activos */}
      <KpiCard
        label="Cubículos activos"
        icon={<Grid2X2 size={15} />}
        mainValue={`${activePercent}%`}
        mainUnit="habilitados"
        secondaryValue={
          <span className="text-slate-800">
            {kpis.activeCubicles} de {kpis.totalCubicles}
          </span>
        }
        secondaryLabel="puntos operativos"
        footer={
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2c73d2] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, activePercent))}%` }}
              />
            </div>
          </div>
        }
      />

      {/* 3 — Finalizados hoy */}
      <KpiCard
        label="Finalizados hoy"
        icon={<CheckCircle2 size={15} />}
        mainValue={closedCountStr}
        mainUnit="atendidos"
        secondaryValue={<span className="text-[#0f172a] font-bold">{slaComplianceStr}</span>}
        secondaryLabel={slaTargetMins !== null ? `SLA ≤ ${slaTargetMins} min` : 'Cumplimiento SLA'}
        footer={
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Timer size={12} className="text-slate-600 flex-shrink-0" aria-hidden="true" />
            <span>
              {kpis.averageServiceSeconds !== undefined && kpis.averageServiceSeconds !== null
                ? `TMM hoy: ${formatElapsedTime(kpis.averageServiceSeconds)}`
                : 'Sin turnos cerrados en la jornada'}
            </span>
          </div>
        }
      />

      {/* 4 — No presentados */}
      <KpiCard
        label="No presentados"
        icon={<UserX size={15} />}
        mainValue={noShowPadded}
        mainUnit="abandonos"
        secondaryValue={<span className="text-red-700 font-bold">{noShowRateStr}</span>}
        secondaryLabel="Tasa de abandono"
        footer={
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Activity size={12} className="text-slate-600 flex-shrink-0" aria-hidden="true" />
            <span>Reingreso bloqueado por sistema</span>
          </div>
        }
      />
    </div>
  );
};

// ─── Leyenda de estados ───────────────────────────────────────────────────────
const StatusLegend: React.FC = () => (
  <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
    <span className="flex items-center gap-1">
      <span className="text-[#0081cf]">●</span> Atendiendo
    </span>
    <span className="flex items-center gap-1">
      <span className="text-[#008e9b]">●</span> Llamando
    </span>
    <span className="flex items-center gap-1">
      <span className="text-[#008f7a]">●</span> Disponible
    </span>
    <span className="flex items-center gap-1">
      <span className="text-red-600">●</span> SLA Excedido
    </span>
    <span className="flex items-center gap-1">
      <span className="text-slate-600">●</span> Inactivo
    </span>
  </div>
);

// ─── Flujo de carga por hora ──────────────────────────────────────────────────
interface HourlyFlowWidgetProps {
  flow: HourlyFlowEntry[];
}

const HourlyFlowWidget: React.FC<HourlyFlowWidgetProps> = ({ flow }) => {
  const maxVolume = Math.max(1, ...flow.map((h) => h.volume));

  return (
    <div className="mt-4 bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-800">Flujo de Carga por Hora</span>
        <span className="text-xs text-slate-600">Turnos procesados / Hora de atención</span>
      </div>

      {flow.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-600">
          Sin datos de flujo horario para la jornada actual.
        </div>
      ) : (
        <>
          {/* Barras */}
          <div className="flex items-end justify-around gap-2 pt-4 pb-1 h-20">
            {flow.map((entry) => {
              const heightPct = Math.round((entry.volume / maxVolume) * 100);
              return (
                <div key={entry.hour} className="flex flex-col items-center gap-1 flex-1">
                  <span
                    className={`text-[11px] font-mono tabular-nums font-bold ${
                      entry.isCurrentHour ? 'text-[#2c73d2]' : 'text-slate-600'
                    }`}
                  >
                    {entry.volume}
                  </span>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      entry.isCurrentHour ? 'bg-[#0081cf]' : 'bg-slate-200'
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: '4px' }}
                    title={`${entry.hour} — ${entry.volume} turnos`}
                  />
                </div>
              );
            })}
          </div>

          {/* Etiquetas de hora */}
          <div className="flex justify-around pt-1">
            {flow.map((entry) => (
              <span
                key={entry.hour}
                className={`text-xs font-mono tabular-nums flex-1 text-center ${
                  entry.isCurrentHour ? 'font-bold text-[#2c73d2]' : 'text-slate-600'
                }`}
              >
                {entry.hour}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Algoritmo FIFO card ──────────────────────────────────────────────────────
const FifoInfoCard: React.FC = () => (
  <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 mt-4">
    <div className="flex items-center gap-2 mb-1.5">
      <Cpu size={14} className="text-[#2c73d2] flex-shrink-0" />
      <span className="text-xs font-bold text-slate-800">Algoritmo de Asignación FIFO</span>
    </div>
    <p className="text-xs text-slate-600 leading-relaxed">
      Modo <span className="font-semibold text-slate-800">FIFO Dinámico</span> activo. El sistema
      asigna automáticamente los turnos al primer puesto con estado disponible &lt; 2 minutos de
      ocio.
    </p>
  </div>
);

// ─── Tarjeta Prescriptiva de Cuello de Botella ────────────────────────────────
interface BottleneckCardProps {
  recommendation?: BottleneckRecommendation | null;
}

const BottleneckCard: React.FC<BottleneckCardProps> = ({ recommendation }) => {
  if (!recommendation || !recommendation.detected) return null;

  return (
    <div
      className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 mt-4 shadow-xs"
      data-testid="bottleneck-recommendation-card"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle size={15} className="text-amber-700 flex-shrink-0 motion-safe:animate-pulse" />
        <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
          Cuello de Botella Detectado
        </span>
      </div>
      <p className="text-xs text-amber-950 font-medium leading-relaxed">
        {recommendation.message}
      </p>
      {recommendation.suggestedAction && (
        <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex items-start gap-2">
          <span className="bg-amber-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
            Acción Sugerida
          </span>
          <span className="text-xs text-amber-900 font-semibold">
            {recommendation.suggestedAction}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Componente principal SCR-ADM-001 ─────────────────────────────────────────
export const AdminOverviewScreen: React.FC = () => {
  const {
    facilityCode,
    facilityName,
    slaThresholdSeconds,
    isLoaded,
    cubicles,
    queue,
    kpis,
    slaAlert,
    bottleneckRecommendation,
    hourlyFlow,
    connectionStatus,
    latencyMs,
    forceRefresh,
    sendBroadcastNotice,
  } = useOperationalTelemetry(true);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [densityMode, setDensityMode] = useState<'standard' | 'compact'>('standard');
  const [noticeFeedback, setNoticeFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    forceRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleBroadcastClick = () => {
    setNoticeFeedback(null);
    setBroadcastDialogOpen(true);
  };

  const wsStatusLabel =
    connectionStatus === 'connected'
      ? latencyMs !== null
        ? `${latencyMs}ms`
        : 'En línea'
      : connectionStatus === 'connecting'
        ? 'Conectando…'
        : connectionStatus === 'offline'
          ? 'Offline'
          : 'Desconectado';

  const facilityBadgeText = facilityCode
    ? facilityCode
    : isLoaded
      ? 'SIN SEDE'
      : 'SINCRONIZANDO';

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {/* WebSocket pill con botón de refresco conectado a forceRefresh() */}
      <button
        type="button"
        onClick={handleRefreshClick}
        title="Estado de conexión WebSocket. Clic para solicitar snapshot actualizado"
        className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-500 rounded-full px-3 py-1.5 min-h-[36px] text-xs hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2] focus-visible:ring-offset-2"
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            connectionStatus === 'connected'
              ? 'bg-[#008f7a] motion-safe:animate-pulse'
              : connectionStatus === 'connecting'
                ? 'bg-amber-500 motion-safe:animate-pulse'
                : 'bg-red-500'
          }`}
        />
        <span className="text-slate-600">WebSocket</span>
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {wsStatusLabel}
        </span>
        <RefreshCw
          size={11}
          className={`text-slate-600 transition-transform ${isRefreshing ? 'motion-safe:animate-spin text-[#2c73d2]' : ''}`}
        />
      </button>

      {/* CTA primario — Aviso General */}
      <button
        type="button"
        onClick={handleBroadcastClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-bold text-white bg-[#2c73d2] rounded-lg hover:shadow-[inset_0_0_0_100vmax_rgba(2,6,23,0.14)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2] focus-visible:ring-offset-2"
      >
        <Megaphone size={13} aria-hidden="true" />
        Aviso General
      </button>
    </div>
  );

  return (
    <AppMain
      header={
        <PageHeader
          section="Supervisión Operativa en Tiempo Real"
          title="Estado General Operativo"
          titleBadge={
            <span
              title={facilityName ?? undefined}
              className="bg-[#2c73d2]/12 text-[#0f172a] border border-[#2c73d2] text-xs font-mono px-2 py-0.5 rounded flex-shrink-0"
            >
              {facilityBadgeText}
            </span>
          }
          action={headerActions}
        />
      }
    >
      <div className="space-y-5">
        {(connectionStatus === 'offline' || connectionStatus === 'disconnected') && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs font-medium"
          >
            <WifiOff size={15} className="text-red-600 flex-shrink-0" aria-hidden="true" />
            <span>
              Telemetría sin conexión en vivo ({connectionStatus === 'offline' ? 'OFFLINE' : 'DESCONECTADO'}).
              {isLoaded
                ? ' Se muestran los últimos datos confirmados antes de perder conexión.'
                : ' No se ha recibido snapshot operativo del servidor.'}
            </span>
          </div>
        )}

        {noticeFeedback && (
          <div
            role="status"
            className={`rounded-xl px-4 py-2.5 text-xs font-medium border ${
              noticeFeedback.type === 'success'
                ? 'bg-[#008f7a]/12 border-[#008f7a] text-[#0f172a]'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {noticeFeedback.text}
          </div>
        )}

        {/* Banner SLA reactivo */}
        <SlaAlertBanner
          alert={slaAlert}
          slaThresholdSeconds={slaThresholdSeconds}
          isLoaded={isLoaded}
        />

        {/* Grid KPI reactivo */}
        <KpiSummaryGrid kpis={kpis} slaThresholdSeconds={slaThresholdSeconds} />

        {/* Split view 8/4 */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* ── Columna izquierda (8/12) ── */}
          <div className="col-span-12 lg:col-span-8">
            {/* Encabezado de sección */}
            <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2c73d2] flex-shrink-0" />
                  <span className="font-bold text-slate-900 text-sm">Estado de Cubículos</span>
                  <span className="text-xs text-slate-600 font-medium">
                    ({cubicles.length} Puestos Parametrizados)
                  </span>
                </div>

                {/* Switcher de densidad de grilla */}
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    type="button"
                    onClick={() => setDensityMode('standard')}
                    aria-pressed={densityMode === 'standard'}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      densityMode === 'standard'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Estándar (2 col)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensityMode('compact')}
                    aria-pressed={densityMode === 'compact'}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      densityMode === 'compact'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Compacta Mega-Centro (3-4 col)
                  </button>
                </div>
              </div>

              <StatusLegend />
            </div>

            {/* Grilla de cubículos */}
            {cubicles.length === 0 ? (
              <div className="mt-4 bg-white border border-slate-200/80 rounded-xl p-8 text-center text-xs text-slate-600">
                {isLoaded
                  ? 'No hay cubículos parametrizados para la sede activa.'
                  : 'Esperando snapshot operativo de cubículos...'}
              </div>
            ) : (
              <div
                className={`mt-4 ${
                  densityMode === 'compact'
                    ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5'
                    : 'grid grid-cols-1 md:grid-cols-2 gap-4'
                }`}
              >
                {cubicles.map((station) => (
                  <div
                    key={station.id}
                    className={densityMode === 'standard' && station.fullWidth ? 'md:col-span-2' : ''}
                  >
                    <CubicleCard station={station} />
                  </div>
                ))}
              </div>
            )}

            {/* Flujo por hora reactivo */}
            <HourlyFlowWidget flow={hourlyFlow} />
          </div>

          {/* ── Columna derecha (4/12) ── */}
          <div className="col-span-12 lg:col-span-4">
            {/* Header cola */}
            <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-bold text-slate-900 text-sm">Cola Centralizada</span>
              </div>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded">
                {queue.length} EN ESPERA
              </span>
            </div>

            {/* Lista de turnos */}
            <div className="space-y-3 mt-4">
              {queue.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-xl p-6 text-center text-xs text-slate-600">
                  Sin turnos pendientes en cola.
                </div>
              ) : (
                queue.map((ticket) => (
                  <QueueItemCard key={ticket.ticketCode} ticket={ticket} />
                ))
              )}
            </div>

            {/* Tarjeta FIFO */}
            <FifoInfoCard />

            {/* Tarjeta Prescriptiva de Cuello de Botella */}
            <BottleneckCard recommendation={bottleneckRecommendation} />
          </div>
        </div>
      </div>

      <BroadcastNoticeDialog
        open={broadcastDialogOpen}
        onOpenChange={setBroadcastDialogOpen}
        isConnected={connectionStatus === 'connected'}
        onSendNotice={sendBroadcastNotice}
        onSentSuccess={() => {
          setNoticeFeedback({
            type: 'success',
            text: 'Aviso general enviado en tiempo real a monitores de sala.',
          });
        }}
      />
    </AppMain>
  );
};
