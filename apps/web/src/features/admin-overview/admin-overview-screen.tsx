// ─── SCR-ADM-001 · CMP-ADM-001 — Estado General Operativo ────────────────────
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  LayoutGrid,
  History,
  Megaphone,
  AlertTriangle,
  Users,
  Grid2X2,
  CheckCircle2,
  UserX,
  TrendingDown,
  Timer,
  Activity,
  Cpu,
} from 'lucide-react';

import { CubicleCard } from './cubicle-card';
import { QueueItemCard } from './queue-item-card';
import { KpiCard } from './kpi-card';
import { useOperationalTelemetry, formatElapsedTime } from './use-operational-telemetry';
import type { HourlyFlowEntry } from './types';
import type { TelemetryDailyKpis, TelemetrySlaAlert } from '@cubiora/shared';

// ─── Banner de alerta SLA ─────────────────────────────────────────────────────
interface SlaAlertBannerProps {
  alert: TelemetrySlaAlert;
}

const SlaAlertBanner: React.FC<SlaAlertBannerProps> = ({ alert }) => {
  if (!alert.isActive) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0">
            <CheckCircle2 size={16} className="text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                DIAGNÓSTICO OPERATIVO:
              </span>
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                OPERACIÓN NOMINAL
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5">
              Todos los puestos activos se encuentran operando dentro del umbral SLA nominal (≤ 12 minutos).
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs text-slate-500 block">SLA General:</span>
          <span className="text-sm font-mono font-bold text-slate-900">
            {alert.slaCompliancePercentage ?? 98.2}%
          </span>
        </div>
      </div>
    );
  }

  const thresholdMin = Math.round((alert.thresholdSeconds || 720) / 60);
  const elapsedFormatted = alert.elapsedSeconds ? formatElapsedTime(alert.elapsedSeconds) : '14:19 min';
  const worstDisplay = alert.worstCubicleDisplay || 'Cubículo 02';
  const affectedTicket = alert.affectedTicketCode || 'TUR-000120-B9';

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
            <span className="font-mono font-semibold">{affectedTicket}</span>, superando el umbral de{' '}
            {thresholdMin} minutos.
          </p>
        </div>
      </div>

      {/* Derecha */}
      <div className="text-right flex-shrink-0">
        <span className="text-xs text-slate-500 block">SLA General:</span>
        <span className="text-sm font-mono font-bold text-slate-900">
          {alert.slaCompliancePercentage ?? 98.2}%
        </span>
      </div>
    </div>
  );
};

// ─── Grid KPI ─────────────────────────────────────────────────────────────────
interface KpiSummaryGridProps {
  kpis: TelemetryDailyKpis;
}

const KpiSummaryGrid: React.FC<KpiSummaryGridProps> = ({ kpis }) => {
  const waitingPadded = String(kpis.waitingCount).padStart(2, '0');
  const activePercent =
    kpis.totalCubicles > 0 ? Math.round((kpis.activeCubicles / kpis.totalCubicles) * 100) : 75;
  const closedCountStr = String(kpis.closedTodayCount);
  const slaComplianceStr =
    kpis.slaCompliancePercentage !== null ? `${kpis.slaCompliancePercentage}%` : '98.2%';
  const noShowPadded = String(kpis.noShowTodayCount).padStart(2, '0');
  const noShowRateStr = kpis.noShowRate !== null ? `${kpis.noShowRate}%` : '1.33%';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1 — Turnos en espera */}
      <KpiCard
        label="Turnos en espera"
        icon={<Users size={15} />}
        mainValue={waitingPadded}
        mainUnit="turnos"
        secondaryValue={<span className="text-blue-700">6m prom.</span>}
        secondaryLabel="Tiempo estimado"
        footer={
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingDown size={12} className="text-emerald-600 flex-shrink-0" />
            <span>
              <span className="text-emerald-600 font-semibold">-1.4 min</span> comparado a la hora
              anterior
            </span>
          </div>
        }
      />

      {/* 2 — Cubículos activos */}
      <KpiCard
        label="Cubículos activos"
        icon={<Grid2X2 size={15} />}
        mainValue={`${activePercent}%`}
        mainUnit="ocupación"
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
                className="h-full bg-[#0284C7] rounded-full transition-all duration-500"
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
        secondaryValue={<span className="text-emerald-600">{slaComplianceStr}</span>}
        secondaryLabel="SLA &lt; 8 min"
        footer={
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Timer size={12} className="text-slate-400 flex-shrink-0" />
            <span>Desviación estándar: ±42s</span>
          </div>
        }
      />

      {/* 4 — No presentados */}
      <KpiCard
        label="No presentados"
        icon={<UserX size={15} />}
        mainValue={noShowPadded}
        mainUnit="abandonos"
        secondaryValue={<span className="text-red-600">{noShowRateStr}</span>}
        secondaryLabel="Tasa de abandono"
        footer={
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Activity size={12} className="text-slate-400 flex-shrink-0" />
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
      <span className="text-blue-600">●</span> Atendiendo
    </span>
    <span className="flex items-center gap-1">
      <span className="text-purple-600">●</span> Llamando
    </span>
    <span className="flex items-center gap-1">
      <span className="text-emerald-500">●</span> Disponible
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
        <span className="text-xs text-slate-400">Turnos procesados / Hora de atención</span>
      </div>

      {/* Barras */}
      <div className="flex items-end justify-around gap-2 pt-4 pb-1 h-20">
        {flow.map((entry) => {
          const heightPct = Math.round((entry.volume / maxVolume) * 100);
          return (
            <div key={entry.hour} className="flex flex-col items-center gap-1 flex-1">
              <span
                className={`text-[10px] font-mono tabular-nums font-bold ${
                  entry.isCurrentHour ? 'text-blue-700' : 'text-slate-400'
                }`}
              >
                {entry.volume}
              </span>
              <div
                className={`w-full rounded-t-sm transition-all duration-300 ${
                  entry.isCurrentHour ? 'bg-blue-500' : 'bg-slate-200'
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
              entry.isCurrentHour ? 'font-bold text-blue-900' : 'text-slate-400'
            }`}
          >
            {entry.hour}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Algoritmo FIFO card ──────────────────────────────────────────────────────
const FifoInfoCard: React.FC = () => (
  <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 mt-4">
    <div className="flex items-center gap-2 mb-1.5">
      <Cpu size={14} className="text-blue-600 flex-shrink-0" />
      <span className="text-xs font-bold text-slate-800">Algoritmo de Asignación FIFO</span>
    </div>
    <p className="text-xs text-slate-500 leading-relaxed">
      Modo <span className="font-semibold text-slate-700">FIFO Dinámico</span> activo. El sistema
      asigna automáticamente los turnos al primer puesto con estado disponible &lt; 2 minutos de
      ocio.
    </p>
  </div>
);

// ─── Componente principal SCR-ADM-001 ─────────────────────────────────────────
export const AdminOverviewScreen: React.FC = () => {
  const {
    cubicles,
    queue,
    kpis,
    slaAlert,
    hourlyFlow,
    connectionStatus,
    latencyMs,
    forceRefresh,
    sendBroadcastNotice,
  } = useOperationalTelemetry(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    forceRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleBroadcastClick = () => {
    const message = window.prompt(
      'Ingrese el mensaje de aviso general para proyectar en pantallas de sala:',
      'Atención: favor verificar número de cubículo en pantalla antes de avanzar.',
    );
    if (message && message.trim().length > 0) {
      sendBroadcastNotice(message.trim(), 'info');
      alert('Aviso general transmitido a monitores de sala.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ═══════════════ TOP NAVIGATION BAR ═══════════════ */}
      <header className="flex items-center justify-between py-3 px-6 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Izquierda */}
        <div className="min-w-0 mr-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs font-mono mb-0.5">
            <span className="text-blue-600 font-semibold">SCR-ADM-001</span>
            <span className="text-slate-300">·</span>
            <span className="text-blue-600 font-semibold">CMP-ADM-001</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">Supervisión Operativa en Tiempo Real</span>
          </div>

          {/* Título + badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              CMP-ADM-001 · Estado General Operativo
            </h1>
            <span className="bg-sky-50 text-sky-700 border border-sky-200 text-xs font-mono px-2 py-0.5 rounded flex-shrink-0">
              DISP-CENTRAL
            </span>
          </div>
        </div>

        {/* Derecha — controles y telemetría */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* WebSocket pill con botón de refresco conectado a forceRefresh() */}
          <button
            type="button"
            onClick={handleRefreshClick}
            title="Conexión WebSocket activa. Clic para forzar actualización de snapshot"
            className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                connectionStatus === 'connected'
                  ? 'bg-blue-500 animate-pulse'
                  : connectionStatus === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-600">WebSocket</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {latencyMs}ms
            </span>
            <RefreshCw
              size={11}
              className={`text-slate-400 transition-transform ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}
            />
          </button>

          {/* Cubículos */}
          <Link
            to="/admin/cubiculos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <LayoutGrid size={13} />
            Cubículos [SCR-ADM-002]
          </Link>

          {/* Historial */}
          <Link
            to="/admin/historial"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <History size={13} />
            Historial [SCR-ADM-003]
          </Link>

          {/* CTA primario — Aviso General */}
          <button
            type="button"
            onClick={handleBroadcastClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Megaphone size={13} />
            Aviso General
          </button>
        </div>
      </header>

      {/* ═══════════════ CONTENIDO PRINCIPAL ═══════════════ */}
      <main className="p-6 space-y-5">
        {/* Banner SLA reactivo */}
        <SlaAlertBanner alert={slaAlert} />

        {/* Grid KPI reactivo */}
        <KpiSummaryGrid kpis={kpis} />

        {/* Split view 8/4 */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* ── Columna izquierda (8/12) ── */}
          <div className="col-span-12 lg:col-span-8">
            {/* Encabezado de sección */}
            <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="font-bold text-slate-900 text-sm">Estado de Cubículos</span>
                <span className="text-xs text-slate-400">
                  ({cubicles.length} Puestos Parametrizados)
                </span>
              </div>
              <StatusLegend />
            </div>

            {/* Grilla de cubículos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {cubicles.map((station) => (
                <div
                  key={station.id}
                  className={station.fullWidth ? 'md:col-span-2' : ''}
                >
                  <CubicleCard station={station} />
                </div>
              ))}
            </div>

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
              {queue.map((ticket) => (
                <QueueItemCard key={ticket.ticketCode} ticket={ticket} />
              ))}
            </div>

            {/* Tarjeta FIFO */}
            <FifoInfoCard />
          </div>
        </div>
      </main>
    </div>
  );
};
