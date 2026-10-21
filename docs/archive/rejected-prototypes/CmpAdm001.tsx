import React, { useState } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  Users,
  Grid,
  CheckCircle,
  UserX,
  TrendingDown,
  Timer,
  AlertTriangle,
  RefreshCw,
  Megaphone,
  History,
  LayoutGrid,
  Activity,
  Bot,
  Volume2,
} from 'lucide-react';

/**
 * CMP-ADM-001 · Estado General Operativo
 *
 * Dashboard de supervisión operativa y flujo de turnos.
 * Responde a la pregunta: "¿La operación está funcionando correctamente?"
 *
 * Excluye explícitamente: datos de pacientes, DNI, coberturas, medicamentos,
 * diagnósticos, recetas, y acciones operativas de ventanilla (priorizar, llamar, intervenir).
 */
export const CmpAdm001: React.FC = () => {
  const {
    cubicles,
    waitingQueue,
    metrics,
    hourlyLoads,
    setBroadcastModalOpen,
    isLiveSync,
    toggleLiveSync,
    setCurrentView,
  } = usePharmacy();

  const [isRotatingSync, setIsRotatingSync] = useState(false);

  const handleSyncClick = () => {
    setIsRotatingSync(true);
    toggleLiveSync();
    setTimeout(() => setIsRotatingSync(false), 700);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} min`;
  };

  const hasExceededSla = cubicles.some((c) => c.status === 'exceeded');
  const cubicleExceeded = cubicles.find((c) => c.status === 'exceeded');

  return (
    <div className="flex flex-col w-full" data-component="CMP-ADM-001">
      <div className="px-4 lg:px-8 py-6 flex flex-col gap-6">
        {/* Top Header & Identification Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-[#475569] text-xs mb-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#006591] font-semibold">
                SCR-ADM-001
              </span>
              <span>·</span>
              <span className="font-bold text-[#006591]">CMP-ADM-001</span>
              <span>·</span>
              <span>Supervisión Operativa en Tiempo Real</span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl text-[#001428] tracking-tight font-bold">
                CMP-ADM-001 · Estado General Operativo
              </h1>
              <span className="bg-[#d3e4fe] px-2 py-0.5 rounded text-[#006591] font-mono text-[11px] font-semibold">
                DISP-CENTRAL
              </span>
            </div>
          </div>

          {/* Supervisor Controls & Real-Time Sync Status */}
          <div
            aria-label="Controles de supervisión operativa"
            className="flex flex-wrap items-center gap-2"
            role="group"
          >
            <div
              aria-label="Estado de conexión del sistema de colas"
              className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-xs border border-[#E2E8F0]"
              role="status"
            >
              <div className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isLiveSync ? 'bg-[#39b8fd]' : 'bg-[#94A3B8]'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isLiveSync ? 'bg-[#006591]' : 'bg-[#64748B]'
                  }`}
                ></span>
              </div>
              <span className="text-xs text-[#475569] font-medium">WebSocket</span>
              <span className="font-mono text-xs text-[#006591] font-bold">18ms</span>
              <button
                aria-label="Sincronizar telemetría operativa"
                className="ml-1 text-[#475569] hover:text-[#001428] transition-colors flex items-center"
                onClick={handleSyncClick}
                title={isLiveSync ? 'Pausar sincronización' : 'Reanudar sincronización'}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#006591] ${
                    isRotatingSync ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => setCurrentView('cubicles_config')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#eff4ff] text-[#001428] text-xs font-semibold rounded-lg shadow-xs border border-[#E2E8F0] transition-colors"
            >
              <LayoutGrid className="w-4 h-4 text-[#006591]" />
              <span>Cubículos [SCR-ADM-002]</span>
            </button>

            <button
              onClick={() => setCurrentView('history')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#eff4ff] text-[#001428] text-xs font-semibold rounded-lg shadow-xs border border-[#E2E8F0] transition-colors"
            >
              <History className="w-4 h-4 text-[#006591]" />
              <span>Historial [SCR-ADM-003]</span>
            </button>

            <button
              onClick={() => setBroadcastModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0F2942] text-white text-xs font-semibold rounded-lg hover:bg-[#001428] transition-all shadow-xs"
            >
              <Megaphone className="w-4 h-4 text-[#89ceff]" />
              <span>Aviso General</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Card: ¿La operación está funcionando correctamente? */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            hasExceededSla
              ? 'bg-[#ffdad6]/40 border-[#ffdad6]'
              : 'bg-[#ECFDF5]/70 border-[#A7F3D0]'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                hasExceededSla ? 'bg-[#ffdad6]' : 'bg-[#D1FAE5]'
              }`}
            >
              {hasExceededSla ? (
                <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
              ) : (
                <CheckCircle className="w-5 h-5 text-[#065F46]" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    hasExceededSla ? 'text-[#93000a]' : 'text-[#065F46]'
                  }`}
                >
                  Diagnóstico Operativo:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                    hasExceededSla
                      ? 'bg-[#ba1a1a] text-white'
                      : 'bg-[#065F46] text-white'
                  }`}
                >
                  {hasExceededSla ? 'DESVIACIÓN DE SLA DETECTADA' : 'OPERACIÓN NOMINAL'}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5 font-medium">
                {hasExceededSla && cubicleExceeded
                  ? `El puesto ${cubicleExceeded.name} registra un tiempo acumulado de atención de ${formatTimer(
                      cubicleExceeded.sessionElapsedSeconds
                    )} en el turno ${cubicleExceeded.currentTicketId}, superando el umbral de 12 minutos.`
                  : 'Todos los cubículos activos se encuentran operando dentro de los límites de SLA parametrizados.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <span className="text-xs text-[#64748B] font-mono">
              SLA General: <strong className="text-[#001428]">{metrics.slaCompliancePct}%</strong>
            </span>
          </div>
        </div>

        {/* 1. Métricas Operativas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Métrica 1: Turnos en Espera */}
          <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E2E8F0] flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#475569] font-bold">
                Turnos en Espera
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#006591]">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold text-[#001428] leading-none tabular-nums">
                  {String(metrics.waitingCount).padStart(2, '0')}
                </span>
                <span className="text-xs text-[#475569]">turnos</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-xs text-[#006591] font-bold">
                  {metrics.avgWaitMinutes}m prom.
                </span>
                <span className="text-[11px] text-[#475569]">Tiempo estimado</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#f1f5f9] flex items-center gap-1.5 text-[#475569] text-[11px]">
              <TrendingDown className="w-3.5 h-3.5 text-[#10B981]" />
              <span>-1.4 min comparado a la hora anterior</span>
            </div>
          </div>

          {/* Métrica 2: Cubículos Activos (Ocupación Operativa) */}
          <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E2E8F0] flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#475569] font-bold">
                Cubículos Activos
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#006591]">
                <Grid className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold text-[#001428] leading-none tabular-nums">
                  {metrics.occupancyPct}%
                </span>
                <span className="text-xs text-[#475569]">ocupación</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-xs text-[#001428] font-bold">
                  {metrics.activeCount} de {metrics.totalCount}
                </span>
                <span className="text-[11px] text-[#475569]">puntos operativos</span>
              </div>
            </div>

            <div className="w-full bg-[#dce9ff] h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-[#006591] h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.occupancyPct}%` }}
              ></div>
            </div>
          </div>

          {/* Métrica 3: Finalizados Hoy */}
          <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E2E8F0] flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#475569] font-bold">
                Finalizados Hoy
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#006591]">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold text-[#001428] leading-none tabular-nums">
                  {metrics.completedToday}
                </span>
                <span className="text-xs text-[#475569]">atendidos</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-xs text-[#065F46] font-bold">
                  {metrics.slaCompliancePct}%
                </span>
                <span className="text-[11px] text-[#475569]">SLA &lt; 8 min</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#f1f5f9] flex items-center gap-1.5 text-[#475569] text-[11px]">
              <Timer className="w-3.5 h-3.5 text-[#006591]" />
              <span>Desviación estándar: ±42s</span>
            </div>
          </div>

          {/* Métrica 4: No Presentados */}
          <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E2E8F0] flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#475569] font-bold">
                No Presentados
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#475569]">
                <UserX className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold text-[#475569] leading-none tabular-nums">
                  {String(metrics.abandonedCount).padStart(2, '0')}
                </span>
                <span className="text-xs text-[#475569]">abandonos</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-xs text-[#ba1a1a] font-bold">
                  {metrics.abandonmentRatePct}%
                </span>
                <span className="text-[11px] text-[#475569]">Tasa de abandono</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#f1f5f9] flex items-center gap-1.5 text-[#475569] text-[11px]">
              <Activity className="w-3.5 h-3.5 text-[#475569]" />
              <span>Reingreso bloqueado por sistema</span>
            </div>
          </div>
        </div>

        {/* 2. Matriz de Estado de Cubículos + 3. Cola Centralizada */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Matriz de Cubículos (8 Columns on XL) */}
          <div className="xl:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-xs border border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-[#006591]"></div>
                <h2 className="text-base text-[#001428] font-bold">
                  Estado de Cubículos
                </h2>
                <span className="text-xs text-[#475569]">
                  ({cubicles.length} Puestos Parametrizados)
                </span>
              </div>

              {/* Status Reference Legend */}
              <div className="hidden sm:flex items-center gap-3 text-[#475569] text-xs">
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span> Atendiendo
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#8B5CF6]"></span> Llamando
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]"></span> Disponible
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span> SLA Excedido
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#64748B]"></span> Inactivo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cubicles.map((c) => {
                const isExceeded = c.status === 'exceeded';
                const isBusy = c.status === 'busy';
                const isCalling = c.status === 'calling';
                const isAvailable = c.status === 'available';
                const isInactive = c.status === 'inactive';

                const borderLeftColor = isExceeded
                  ? 'bg-[#ba1a1a]'
                  : isBusy
                  ? 'bg-[#3B82F6]'
                  : isCalling
                  ? 'bg-[#8B5CF6]'
                  : isAvailable
                  ? 'bg-[#10B981]'
                  : 'bg-[#64748B]';

                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-xl p-5 shadow-xs border border-[#E2E8F0] flex flex-col justify-between gap-4 relative overflow-hidden transition-shadow ${
                      isInactive ? 'md:col-span-2 bg-white/80' : 'hover:shadow-md'
                    } ${isExceeded ? 'ring-1 ring-[#ba1a1a]/30' : ''}`}
                  >
                    {/* Left Accent Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${borderLeftColor}`}></div>

                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 pl-2">
                        <span className="text-base font-bold text-[#001428]">{c.name}</span>

                        {isBusy && (
                          <span className="bg-[#EFF6FF] text-[#1D4ED8] px-2 py-0.5 rounded text-[11px] font-bold tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
                            ATENDIENDO
                          </span>
                        )}

                        {isExceeded && (
                          <span className="bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded text-[11px] font-bold tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-ping"></span>
                            SLA EXCEDIDO
                          </span>
                        )}

                        {isCalling && (
                          <span className="bg-[#F5F3FF] text-[#5B21B6] px-2 py-0.5 rounded text-[11px] font-bold tracking-wide flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B5CF6]"></span>
                            </span>
                            LLAMANDO
                          </span>
                        )}

                        {isAvailable && (
                          <span className="bg-[#ECFDF5] text-[#065F46] px-2 py-0.5 rounded text-[11px] font-bold tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                            DISPONIBLE
                          </span>
                        )}

                        {isInactive && (
                          <span className="bg-[#e5eeff] text-[#475569] px-2 py-0.5 rounded text-[11px] font-bold tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>
                            INACTIVO
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-xs text-[#475569] bg-[#eff4ff] px-2 py-0.5 rounded font-semibold">
                        {c.moduleType}
                      </span>
                    </div>

                    {/* Operational Telemetry Data Box */}
                    <div
                      className={`p-3.5 rounded-xl flex flex-col gap-1.5 ml-2 ${
                        isExceeded
                          ? 'bg-[#ffdad6]/20'
                          : isCalling
                          ? 'bg-[#FAF5FF]'
                          : isAvailable
                          ? 'bg-[#F0FDF4]'
                          : isInactive
                          ? 'bg-[#eff4ff]/60'
                          : 'bg-[#eff4ff]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#475569]">Turno asignado:</span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            isExceeded
                              ? 'text-[#ba1a1a]'
                              : isCalling
                              ? 'text-[#5B21B6]'
                              : 'text-[#001428]'
                          }`}
                        >
                          {c.currentTicketId || 'Sin turno asignado'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#475569]">Operador a cargo:</span>
                        <span className="text-xs text-[#0b1c30] font-semibold">
                          {c.operator}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-black/5">
                        <span className="text-xs text-[#475569]">Tiempo acumulado:</span>
                        <span
                          className={`font-mono text-xs font-bold tabular-nums ${
                            isExceeded
                              ? 'text-[#ba1a1a]'
                              : isCalling
                              ? 'text-[#5B21B6]'
                              : isAvailable
                              ? 'text-[#065F46]'
                              : 'text-[#1D4ED8]'
                          }`}
                        >
                          {isAvailable
                            ? `Ocio: hace ${Math.floor(
                                (c.lastCompletedElapsedSeconds || 75) / 60
                              )}m ${(c.lastCompletedElapsedSeconds || 75) % 60}s`
                            : isInactive
                            ? 'Fuera de servicio'
                            : formatTimer(c.sessionElapsedSeconds)}
                        </span>
                      </div>
                    </div>

                    {/* Diagnostic Summary Line */}
                    <div className="flex items-center justify-between ml-2 pt-1 text-xs text-[#475569]">
                      <div className="flex items-center gap-1.5">
                        {isExceeded && (
                          <span className="text-[#ba1a1a] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Umbral superado (&gt;12 min)
                          </span>
                        )}
                        {isBusy && (
                          <span className="text-[#10B981] font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            En rango de SLA nominal
                          </span>
                        )}
                        {isCalling && (
                          <span className="text-[#8B5CF6] font-semibold flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5" />
                            Proyectado en monitor
                          </span>
                        )}
                        {isAvailable && (
                          <span className="text-[#065F46] font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Estación lista para asignación
                          </span>
                        )}
                        {isInactive && (
                          <span className="italic text-[#64748B]">
                            Puesto en mantenimiento programado
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-[11px] text-[#64748B]">
                        {c.assignedTicketsCountToday} turnos hoy
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Micro-Chart: Flujo de Carga por Hora */}
            <div className="bg-white p-4 rounded-xl shadow-xs border border-[#E2E8F0] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#001428]">
                  Flujo de Carga por Hora
                </span>
                <span className="text-[11px] text-[#475569]">
                  Turnos procesados / Hora de atención
                </span>
              </div>
              <div className="h-16 w-full flex items-end gap-2 pt-2">
                {hourlyLoads.map((load, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t transition-all ${
                        load.isPeak
                          ? 'bg-[#39b8fd] shadow-xs'
                          : 'bg-[#dce9ff] hover:bg-[#cbdbf5]'
                      }`}
                      style={{ height: `${load.percentage}%` }}
                      title={`${load.count} turnos procesados`}
                    ></div>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        load.isPeak ? 'text-[#006591] font-bold' : 'text-[#475569]'
                      }`}
                    >
                      {load.hour}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Cola Centralizada (4 Columns on XL) - Telemetría pura de cola */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-xl shadow-xs border border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div>
                <h2 className="text-base text-[#001428] font-bold">Cola Centralizada</h2>
              </div>
              <span className="font-mono text-xs bg-[#FFFBEB] text-[#92400E] px-2 py-0.5 rounded font-bold tabular-nums">
                {waitingQueue.length} EN ESPERA
              </span>
            </div>

            {/* Waiting Queue Telemetry Rows (Clean: Code, Time, Priority) */}
            <div className="flex flex-col gap-2.5">
              {waitingQueue.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] text-center text-xs text-[#64748B]">
                  No hay turnos en cola de espera en este momento.
                </div>
              ) : (
                waitingQueue.map((item, index) => {
                  const minutesWaiting = Math.floor(
                    (Date.now() - item.issuedAt.getTime()) / 60000
                  );
                  const secondsWaiting = Math.floor(
                    ((Date.now() - item.issuedAt.getTime()) % 60000) / 1000
                  );
                  const waitString = `${String(minutesWaiting).padStart(2, '0')}:${String(
                    secondsWaiting
                  ).padStart(2, '0')} min`;

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-xl shadow-xs border border-[#E2E8F0] flex flex-col gap-1.5 hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F59E0B]"></div>

                      <div className="flex items-center justify-between pl-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#eff4ff] flex items-center justify-center font-mono text-xs text-[#001428] font-bold">
                            {index + 1}
                          </span>
                          <span className="font-mono text-xs text-[#001428] font-bold">
                            {item.id}
                          </span>
                        </div>

                        {/* Prioridad Operativa */}
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            item.priority === 'preferencial'
                              ? 'bg-[#F5F3FF] text-[#5B21B6]'
                              : item.priority === 'urgente'
                              ? 'bg-[#FEF2F2] text-[#991B1B]'
                              : item.priority === 'especial'
                              ? 'bg-[#F0F9FF] text-[#0369A1]'
                              : 'bg-[#FFFBEB] text-[#92400E]'
                          }`}
                        >
                          {item.priority.toUpperCase()}
                        </span>
                      </div>

                      {/* Tiempo de Espera y Hora de Emisión */}
                      <div className="flex items-center justify-between pl-2 text-[#475569] text-xs mt-1">
                        <span>
                          Emisión:{' '}
                          <strong className="font-mono text-[#0b1c30]">
                            {item.issuedAt.toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </strong>
                        </span>
                        <span>
                          Tiempo en espera:{' '}
                          <strong className="font-mono text-[#001428] tabular-nums font-bold">
                            {waitString}
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Automation Logic Card */}
            <div className="bg-[#eff4ff] p-4 rounded-xl flex flex-col gap-1.5 border border-[#E2E8F0]">
              <div className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-[#006591]" />
                <span className="text-xs font-bold text-[#001428]">
                  Algoritmo de Asignación FIFO
                </span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Modo FIFO Dinámico activo. El sistema asigna automáticamente los
                turnos al primer puesto con estado disponible &lt; 2 minutos de ocio.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
