import React, { useState, useEffect } from 'react';
import { Turno, TurnoEstado, ConexionEstado } from '../../types';
import {
  WifiOff,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Lock,
  Loader2,
} from 'lucide-react';

interface CubicleScreenProps {
  cubiculoNombre: string;
  estado: TurnoEstado;
  turnoActual?: Turno;
  siguienteTurno?: Turno;
  cantidadEnEspera: number;
  conexionEstado: ConexionEstado;
  sesionExpirada: boolean;
  bloqueoCierreSesion: boolean;
  onCerrarBloqueoSesion: () => void;
  onLlamarTurno: () => Promise<boolean>;
  onRepetirLlamado: () => Promise<boolean>;
  onIniciarAtencion: () => Promise<boolean>;
  onConfirmarCierre: () => Promise<void>;
  onConfirmarNoPresentado: () => Promise<void>;
  onLlamarSiguienteTurno: () => Promise<boolean>;
  onVerificarConexion: () => void;
  onReanudarSesion: () => void;
}

export const CubicleScreen: React.FC<CubicleScreenProps> = ({
  cubiculoNombre,
  estado,
  turnoActual,
  siguienteTurno,
  cantidadEnEspera,
  conexionEstado,
  sesionExpirada,
  bloqueoCierreSesion,
  onCerrarBloqueoSesion,
  onLlamarTurno,
  onRepetirLlamado,
  onIniciarAtencion,
  onConfirmarCierre,
  onConfirmarNoPresentado,
  onLlamarSiguienteTurno,
  onVerificarConexion,
  onReanudarSesion,
}) => {
  // Modal states
  const [mostrarDialogoCierre, setMostrarDialogoCierre] = useState(false);
  const [mostrarDialogoNoPresentado, setMostrarDialogoNoPresentado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calling asynchronous in-progress state
  const [isCalling, setIsCalling] = useState(false);
  const [isStartingAttention, setIsStartingAttention] = useState(false);
  const [errorLlamadoIncierto, setErrorLlamadoIncierto] = useState(false);

  // Screen-reader announcement for state changes
  const [anuncioAccesible, setAnuncioAccesible] = useState('');

  // Chronometer for elapsed time in CALLED or IN_SERVICE
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (estado === 'CALLED' || estado === 'IN_SERVICE') {
      interval = setInterval(() => {
        setSegundosTranscurridos((prev) => prev + 1);
      }, 1000);
    } else {
      setSegundosTranscurridos(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [estado, turnoActual?.codigo]);

  // Announce state transitions to assistive technologies
  useEffect(() => {
    switch (estado) {
      case 'AVAILABLE':
        setAnuncioAccesible('Cubículo disponible. Esperando el siguiente turno.');
        break;
      case 'ASSIGNED':
        setAnuncioAccesible(`Turno asignado: ${turnoActual?.codigo || ''}.`);
        break;
      case 'CALLED':
        setAnuncioAccesible(`Turno ${turnoActual?.codigo || ''} llamado.`);
        break;
      case 'IN_SERVICE':
        setAnuncioAccesible(`Turno ${turnoActual?.codigo || ''} en atención.`);
        break;
      case 'CLOSED':
        setAnuncioAccesible('Turno finalizado. Cubículo liberado.');
        break;
    }
  }, [estado, turnoActual?.codigo]);

  const formatearTiempo = (totalSegundos: number) => {
    const mins = Math.floor(totalSegundos / 60);
    const secs = totalSegundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isOffline = conexionEstado === 'OFFLINE' || conexionEstado === 'VERIFYING';

  // Handle calling turn with server confirmation and uncertain result handling
  const handleEjecutarLlamado = async () => {
    if (isCalling || isOffline) return;
    setIsCalling(true);
    setErrorLlamadoIncierto(false);
    try {
      const exitoso = await onLlamarTurno();
      if (!exitoso) {
        setErrorLlamadoIncierto(true);
      }
    } catch {
      setErrorLlamadoIncierto(true);
    } finally {
      setIsCalling(false);
    }
  };

  // Handle calling next turn from CLOSED
  const handleEjecutarLlamarSiguiente = async () => {
    if (isCalling || isOffline) return;
    setIsCalling(true);
    setErrorLlamadoIncierto(false);
    try {
      const exitoso = await onLlamarSiguienteTurno();
      if (!exitoso) {
        setErrorLlamadoIncierto(true);
      }
    } catch {
      setErrorLlamadoIncierto(true);
    } finally {
      setIsCalling(false);
    }
  };

  // Handle repeated calling
  const handleEjecutarRepetirLlamado = async () => {
    if (isCalling || isOffline) return;
    setIsCalling(true);
    setErrorLlamadoIncierto(false);
    try {
      const exitoso = await onRepetirLlamado();
      if (!exitoso) {
        setErrorLlamadoIncierto(true);
      }
    } catch {
      setErrorLlamadoIncierto(true);
    } finally {
      setIsCalling(false);
    }
  };

  // Handle starting attention with server confirmation
  const handleEjecutarIniciarAtencion = async () => {
    if (isStartingAttention || isOffline) return;
    setIsStartingAttention(true);
    try {
      await onIniciarAtencion();
    } finally {
      setIsStartingAttention(false);
    }
  };

  // Handle closing modal submit
  const handleEjecutarCierre = async () => {
    if (isSubmitting || isOffline) return;
    setIsSubmitting(true);
    try {
      await onConfirmarCierre();
      setMostrarDialogoCierre(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle no-show modal submit
  const handleEjecutarNoPresentado = async () => {
    if (isSubmitting || isOffline) return;
    setIsSubmitting(true);
    try {
      await onConfirmarNoPresentado();
      setMostrarDialogoNoPresentado(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolve uncertain state by querying true server status
  const handleResolverEstadoIncierto = () => {
    setErrorLlamadoIncierto(false);
    onVerificarConexion();
  };

  // 1. SESIÓN EXPIRADA
  if (sesionExpirada) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[#0F2942]">Tu sesión expiró</h2>
          <p className="text-sm text-[#475569]">
            Vuelve a ingresar para continuar con la operación del cubículo.
          </p>
        </div>
        <button
          onClick={onReanudarSesion}
          className="w-full py-2.5 px-4 bg-[#0F2942] hover:bg-[#001428] text-white font-semibold rounded-lg transition-colors text-sm cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
        >
          Iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Live region for accessibility announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {anuncioAccesible}
      </div>

      {/* 2. BANNER SIN CONEXIÓN */}
      {conexionEstado === 'OFFLINE' && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-amber-950"
        >
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
            <div>
              <strong className="text-sm block">Sin conexión</strong>
              <p className="text-xs text-amber-800">
                Cubiora no puede confirmar cambios en este momento.
              </p>
            </div>
          </div>
          <button
            onClick={onVerificarConexion}
            className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-xs font-semibold text-amber-900 rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
          >
            Verificar conexión
          </button>
        </div>
      )}

      {conexionEstado === 'VERIFYING' && (
        <div className="bg-[#EFF4FF] border border-[#CBDDF8] rounded-lg p-3 text-xs text-[#004666] flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#006591]" aria-hidden="true" />
          <span>Verificando estado actual con el servidor...</span>
        </div>
      )}

      {/* 7. ALERTA DE LLAMADO INCIERTO */}
      {errorLlamadoIncierto && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-950 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs leading-relaxed font-medium">
              No pudimos confirmar el llamado. Cubiora verificará el estado actual antes de permitir otro intento.
            </p>
          </div>
          <div className="pl-8">
            <button
              onClick={handleResolverEstadoIncierto}
              className="px-3 py-1.5 bg-white border border-amber-400 hover:bg-amber-100 text-xs font-semibold text-amber-900 rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
            >
              Verificar estado actual
            </button>
          </div>
        </div>
      )}

      {/* 3. TARJETA CENTRAL DEL CUBÍCULO */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center justify-between shadow-2xs">
        <div>
          <span className="text-xs uppercase tracking-wider text-[#64748B] font-semibold block">
            Mi cubículo
          </span>
          <h1 className="text-xl font-bold text-[#0F2942] mt-0.5">
            {cubiculoNombre}
          </h1>
        </div>

        {/* Estado Badge */}
        <div>
          {estado === 'AVAILABLE' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" aria-hidden="true" />
              Disponible
            </span>
          )}

          {estado === 'ASSIGNED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" aria-hidden="true" />
              Turno asignado
            </span>
          )}

          {estado === 'CALLED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" aria-hidden="true" />
              Llamado
            </span>
          )}

          {estado === 'IN_SERVICE' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" aria-hidden="true" />
              En atención
            </span>
          )}

          {estado === 'CLOSED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Liberado
            </span>
          )}
        </div>
      </div>

      {/* 4. TARJETA PRINCIPAL DEL TURNO SEGÚN ESTADO */}

      {/* ESTADO 1: DISPONIBLE */}
      {estado === 'AVAILABLE' && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#0F2942]">
              Esperando el siguiente turno
            </h2>
            <p className="text-xs text-[#64748B]">
              {cantidadEnEspera > 0
                ? `${cantidadEnEspera} paciente${cantidadEnEspera > 1 ? 's' : ''} en espera`
                : 'No hay pacientes en espera'}
            </p>
          </div>
        </div>
      )}

      {/* ESTADO 2: TURNO ASIGNADO */}
      {estado === 'ASSIGNED' && turnoActual && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 sm:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-[#F1F5F9] pb-4">
            <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider block">
              Número de turno
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-bold text-[#0F2942] tracking-wider mt-1">
              {turnoActual.codigo}
            </div>
          </div>

          {/* Área Privada: Nombre del Paciente y Hora de Asignación */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-2">
            <span className="text-xs text-slate-500 block">
              Paciente (área privada):
            </span>
            <strong className="text-sm sm:text-base text-[#0F2942] block">
              {turnoActual.paciente}
            </strong>
            <span className="text-xs text-[#64748B] font-mono block">
              Asignado a las {turnoActual.horaAsignacion}
            </span>
          </div>

          {/* Acción Principal */}
          <div>
            <button
              onClick={handleEjecutarLlamado}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isCalling) {
                  e.preventDefault();
                }
              }}
              disabled={isCalling || isOffline || errorLlamadoIncierto}
              aria-busy={isCalling}
              className={`w-full py-3 px-6 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden ${
                isCalling || isOffline || errorLlamadoIncierto
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-[#0F2942] hover:bg-[#001428] cursor-pointer'
              }`}
            >
              {isCalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Llamando turno…</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4" aria-hidden="true" />
                  <span>Llamar turno</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 3: TURNO LLAMADO */}
      {estado === 'CALLED' && turnoActual && (
        <div className="bg-white border-2 border-[#8B5CF6] rounded-lg p-6 sm:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-[#F1F5F9] pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-[#8B5CF6] font-semibold uppercase tracking-wider block">
                Número de turno · Llamado
              </span>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-[#0F2942] tracking-wider mt-1">
                {turnoActual.codigo}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Tiempo transcurrido</span>
              <span className="font-mono text-xl font-bold text-[#8B5CF6] tabular-nums">
                {formatearTiempo(segundosTranscurridos)}
              </span>
            </div>
          </div>

          {/* Área Privada: Nombre del Paciente y Hora del Llamado */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-1">
            <span className="text-xs text-slate-500 block">
              Paciente (área privada):
            </span>
            <strong className="text-sm sm:text-base text-[#0F2942] block">
              {turnoActual.paciente}
            </strong>
            {turnoActual.horaLlamado && (
              <span className="text-xs text-[#64748B] font-mono block">
                Llamado a las {turnoActual.horaLlamado}
              </span>
            )}
          </div>

          {/* Acciones */}
          <div className="space-y-3 pt-2">
            {/* Única Acción Principal Dominante */}
            <button
              onClick={handleEjecutarIniciarAtencion}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isStartingAttention) {
                  e.preventDefault();
                }
              }}
              disabled={isStartingAttention || isOffline}
              aria-busy={isStartingAttention}
              className={`w-full py-3 px-6 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden ${
                isStartingAttention || isOffline
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-[#0F2942] hover:bg-[#001428] cursor-pointer'
              }`}
            >
              {isStartingAttention ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Iniciando atención…</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <span>Iniciar atención</span>
                </>
              )}
            </button>

            {/* Máximo dos acciones secundarias */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                onClick={handleEjecutarRepetirLlamado}
                disabled={isCalling || isOffline}
                aria-busy={isCalling}
                className="py-2 px-3 bg-white border border-[#CBD5E1] text-[#0F2942] hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
              >
                {isCalling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B5CF6]" aria-hidden="true" />
                ) : (
                  <PhoneCall className="w-3.5 h-3.5 text-[#8B5CF6]" aria-hidden="true" />
                )}
                <span>Repetir llamado</span>
              </button>

              <button
                onClick={() => setMostrarDialogoNoPresentado(true)}
                disabled={isOffline}
                className="py-2 px-3 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
              >
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Paciente no presentado</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESTADO 4: EN ATENCIÓN */}
      {estado === 'IN_SERVICE' && turnoActual && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 sm:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-[#F1F5F9] pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider block">
                Número de turno · En atención
              </span>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-[#0F2942] tracking-wider mt-1">
                {turnoActual.codigo}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Duración de atención</span>
              <span className="font-mono text-xl font-bold text-[#0F2942] tabular-nums">
                {formatearTiempo(segundosTranscurridos)}
              </span>
            </div>
          </div>

          {/* Área Privada: Paciente y Hora de Inicio */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-1">
            <span className="text-xs text-slate-500 block">
              Paciente (área privada):
            </span>
            <strong className="text-sm sm:text-base text-[#0F2942] block">
              {turnoActual.paciente}
            </strong>
            <span className="text-xs text-[#64748B] font-mono block">
              Inicio de atención: {turnoActual.horaInicio || '10:28'}
            </span>
          </div>

          {/* Acción Principal Dominante */}
          <div>
            <button
              onClick={() => setMostrarDialogoCierre(true)}
              disabled={isOffline}
              className={`w-full py-3 px-6 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden ${
                isOffline
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-[#0F2942] hover:bg-[#001428] cursor-pointer'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Cerrar turno</span>
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 6: CIERRE EXITOSO */}
      {estado === 'CLOSED' && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 sm:p-8 space-y-6 shadow-2xs">
          <div className="space-y-1 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-[#0F2942]">Turno finalizado</h2>
            {turnoActual && (
              <span className="font-mono text-sm text-slate-600 block">
                {turnoActual.codigo}
              </span>
            )}
            <p className="text-xs text-[#64748B] mt-1">
              El {cubiculoNombre} fue liberado.
            </p>
          </div>

          {siguienteTurno ? (
            <div className="border-t border-[#F1F5F9] pt-6 space-y-4">
              <div className="bg-[#EFF4FF] border border-[#CBDDF8] rounded-md p-4 text-center">
                <span className="text-xs text-[#006591] font-semibold block uppercase tracking-wider">
                  Siguiente turno asignado
                </span>
                <span className="font-mono font-bold text-2xl text-[#0F2942] block mt-1">
                  {siguienteTurno.codigo}
                </span>
              </div>

              {/* Botón Principal para el siguiente */}
              <button
                onClick={handleEjecutarLlamarSiguiente}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isCalling) {
                    e.preventDefault();
                  }
                }}
                disabled={isCalling || isOffline || errorLlamadoIncierto}
                aria-busy={isCalling}
                className={`w-full py-3 px-6 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden ${
                  isCalling || isOffline || errorLlamadoIncierto
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                    : 'bg-[#0F2942] hover:bg-[#001428] cursor-pointer'
                }`}
              >
                {isCalling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Llamando turno…</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-4 h-4" aria-hidden="true" />
                    <span>Llamar siguiente turno</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="border-t border-[#F1F5F9] pt-4 text-center space-y-1">
              <p className="text-sm font-semibold text-[#0F2942]">
                No hay pacientes en espera
              </p>
              <p className="text-xs text-[#64748B]">
                El cubículo permanece disponible.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 9. CONTADOR DE COLA: SOLO CANTIDAD, NO ENLACE, SIN NOMBRES NI ESTIMADOS */}
      {estado !== 'AVAILABLE' && (
        <div className="text-center text-xs text-[#64748B]">
          {cantidadEnEspera > 0 ? (
            <span>{cantidadEnEspera} paciente{cantidadEnEspera > 1 ? 's' : ''} en espera</span>
          ) : (
            <span>No hay pacientes en espera</span>
          )}
        </div>
      )}

      {/* 5. DIÁLOGO: CONFIRMACIÓN DE CIERRE */}
      {mostrarDialogoCierre && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0F2942]/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#CBD5E1] rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#0F2942]">
                ¿Cerrar el turno {turnoActual?.codigo}?
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Se finalizará la atención y el {cubiculoNombre} quedará disponible para recibir el siguiente turno.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleEjecutarCierre}
                disabled={isSubmitting || isOffline}
                aria-busy={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#0F2942] hover:bg-[#001428] disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Cerrando turno y liberando cubículo…</span>
                  </>
                ) : (
                  <span>Cerrar turno y liberar cubículo</span>
                )}
              </button>

              <button
                onClick={() => setMostrarDialogoCierre(false)}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#0F2942] font-semibold rounded-lg text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
              >
                Continuar atención
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DIÁLOGO: NO PRESENTADO */}
      {mostrarDialogoNoPresentado && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0F2942]/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#CBD5E1] rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#0F2942]">
                ¿Registrar el turno {turnoActual?.codigo} como no presentado?
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                El cubículo quedará disponible para recibir al siguiente paciente.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleEjecutarNoPresentado}
                disabled={isSubmitting || isOffline}
                aria-busy={isSubmitting}
                className="w-full py-2.5 px-4 bg-rose-700 hover:bg-rose-800 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Marcando como no presentado…</span>
                  </>
                ) : (
                  <span>Marcar como no presentado</span>
                )}
              </button>

              <button
                onClick={() => setMostrarDialogoNoPresentado(false)}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#0F2942] font-semibold rounded-lg text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
              >
                Volver al turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. DIÁLOGO: BLOQUEO DE CIERRE DE SESIÓN CON TURNO ACTIVO */}
      {bloqueoCierreSesion && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#0F2942]/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#CBD5E1] rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#0F2942]">
                  Turno activo en curso
                </h3>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                No puedes cerrar sesión durante un turno activo. Finaliza la atención antes de salir.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onCerrarBloqueoSesion}
                className="w-full py-2.5 px-4 bg-[#0F2942] hover:bg-[#001428] text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:outline-hidden"
              >
                Volver al turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
