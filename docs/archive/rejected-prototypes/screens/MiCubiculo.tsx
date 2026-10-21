import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  RotateCcw, 
  UserX, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';

export type CubicleOperationalStep =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'PROCESSING_CALL'
  | 'CALLED'
  | 'PROCESSING_START'
  | 'IN_SERVICE'
  | 'CONFIRM_CLOSE'
  | 'PROCESSING_CLOSE'
  | 'CLOSED_NEXT'
  | 'CLOSED_NO_NEXT'
  | 'CONFIRM_NO_SHOW'
  | 'NO_SHOW_NEXT';

export interface TicketData {
  id: string;
  patientName: string;
  documentId: string;
  assignedTime: string;
  calledTime?: string;
  startTime?: string;
}

export interface MiCubiculoProps {
  cubicleNumber?: string;
  cubicleLabel?: string;
  className?: string;
  onStatusChange?: (status: CubicleOperationalStep) => void;
}

const TICKET_INITIAL: TicketData = {
  id: 'TUR-0124',
  patientName: 'Carlos Pérez',
  documentId: 'C.C. 79.438.212',
  assignedTime: '10:24',
  calledTime: '10:25',
  startTime: '10:26'
};

const TICKET_NEXT: TicketData = {
  id: 'TUR-0125',
  patientName: 'María Ortiz',
  documentId: 'C.C. 52.891.442',
  assignedTime: '10:29',
  calledTime: '10:30',
  startTime: '10:31'
};

/**
 * CMP-CAJ-001 · Mi Cubículo
 * Componente funcional reactivo independiente responsable del flujo operativo de ventanilla.
 */
export const MiCubiculo: React.FC<MiCubiculoProps> = ({
  cubicleNumber = '03',
  cubicleLabel = 'Cubículo 03',
  className = '',
  onStatusChange
}) => {
  const [step, setStep] = useState<CubicleOperationalStep>('AVAILABLE');
  const [activeTicket, setActiveTicket] = useState<TicketData>(TICKET_INITIAL);
  const [lastFinishedId, setLastFinishedId] = useState<string>('TUR-0124');
  const [queueCount, setQueueCount] = useState<number>(4);

  // Cronómetros en vivo
  const [calledTimerSec, setCalledTimerSec] = useState<number>(0);
  const [serviceTimerSec, setServiceTimerSec] = useState<number>(0);

  // Notificar cambio de estado si se pasa handler
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(step);
    }
  }, [step, onStatusChange]);

  // Cronómetro de espera en llamado
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'CALLED') {
      interval = setInterval(() => {
        setCalledTimerSec(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  // Cronómetro de duración en atención activa
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'IN_SERVICE') {
      interval = setInterval(() => {
        setServiceTimerSec(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  // Transiciones automáticas por respuesta asíncrona del backend y eventos del sistema
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // 1. En AVAILABLE: el backend simula la asignación FIFO tras 2.2s
    if (step === 'AVAILABLE') {
      timer = setTimeout(() => {
        setActiveTicket(TICKET_INITIAL);
        setStep('ASSIGNED');
      }, 2200);
    }

    // 2. Procesando llamado -> respuesta backend activa CALLED
    if (step === 'PROCESSING_CALL') {
      timer = setTimeout(() => {
        setCalledTimerSec(1);
        setStep('CALLED');
      }, 1100);
    }

    // 3. Procesando inicio de atención -> respuesta backend activa IN_SERVICE
    if (step === 'PROCESSING_START') {
      timer = setTimeout(() => {
        setServiceTimerSec(1);
        setStep('IN_SERVICE');
      }, 1100);
    }

    // 4. Procesando cierre -> respuesta backend confirma y asigna siguiente
    if (step === 'PROCESSING_CLOSE') {
      timer = setTimeout(() => {
        setLastFinishedId(activeTicket.id);
        if (activeTicket.id === 'TUR-0124') {
          setActiveTicket(TICKET_NEXT);
          setQueueCount(3);
          setStep('CLOSED_NEXT');
        } else {
          setQueueCount(0);
          setStep('CLOSED_NO_NEXT');
        }
      }, 1100);
    }

    // 5. Cierre sin siguiente -> después de 3.5s regresa al estado AVAILABLE en reposo
    if (step === 'CLOSED_NO_NEXT') {
      timer = setTimeout(() => {
        setQueueCount(4);
        setStep('AVAILABLE');
      }, 3500);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step, activeTicket.id]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Render Badge de estado
  const renderBadge = () => {
    switch (step) {
      case 'AVAILABLE':
      case 'CLOSED_NO_NEXT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>Disponible</span>
          </span>
        );
      case 'ASSIGNED':
      case 'CLOSED_NEXT':
      case 'NO_SHOW_NEXT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span>Turno asignado</span>
          </span>
        );
      case 'CALLED':
      case 'CONFIRM_NO_SHOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#F5F3FF] border border-[#DDD6FE] text-[#5B21B6] text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse" />
            <span>Llamado</span>
          </span>
        );
      case 'IN_SERVICE':
      case 'CONFIRM_CLOSE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#EFF4FF] border border-[#C9E6FF] text-[#006591] text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" />
            <span>En atención</span>
          </span>
        );
      case 'PROCESSING_CALL':
      case 'PROCESSING_START':
      case 'PROCESSING_CLOSE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#EFF4FF] border border-[#C9E6FF] text-[#006591] text-xs font-bold uppercase tracking-wider">
            <Loader2 className="w-3 h-3 text-[#0EA5E9] animate-spin" />
            <span>Procesando</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`w-full bg-[#FFFFFF] rounded-xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden select-none font-sans text-[#0F2942] ${className}`}>
      
      {/* 1. Identificación del Cubículo + Badge de Estado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0F2942] text-white flex items-center justify-center font-mono font-bold text-base shrink-0 shadow-2xs">
            {cubicleNumber}
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Mi cubículo
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F2942] tracking-tight">
              {cubicleLabel}
            </h2>
          </div>
        </div>

        {/* Badge visual */}
        <div className="self-start sm:self-center">
          {renderBadge()}
        </div>
      </div>

      {/* 2. Cuerpo del Componente según el Estado Activo */}

      {/* ESTADO: AVAILABLE */}
      {step === 'AVAILABLE' && (
        <div className="py-8 text-center space-y-3">
          <div className="text-base sm:text-lg font-semibold text-[#0F2942]">
            Esperando el siguiente turno
          </div>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            El próximo turno se asignará automáticamente.
          </p>
          <div className="pt-2 text-xs font-semibold text-[#0EA5E9]">
            {queueCount} pacientes en espera
          </div>
        </div>
      )}

      {/* ESTADO: ASSIGNED */}
      {step === 'ASSIGNED' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="text-xs text-[#64748B] font-medium">Turno asignado:</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>
            <div className="text-xs text-[#64748B] pt-1">
              Asignado a las {activeTicket.assignedTime}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setStep('PROCESSING_CALL')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs"
            >
              Llamar turno
            </button>
            <div className="text-xs text-[#64748B]">
              {queueCount} pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: PROCESSING_CALL */}
      {step === 'PROCESSING_CALL' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 opacity-90">
            <div className="text-xs text-[#64748B] font-medium">Turno asignado:</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>
            <div className="text-xs text-[#64748B] pt-1">
              Asignado a las {activeTicket.assignedTime}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              disabled
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0F2942]/80 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Loader2 className="w-4 h-4 animate-spin text-[#38BDF8]" />
              <span>Llamando turno…</span>
            </button>
            <div className="text-xs text-[#64748B]">
              {queueCount} pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: CALLED */}
      {step === 'CALLED' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-[#F5F3FF]/40 border border-[#DDD6FE] space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#5B21B6] font-semibold">Turno en llamado:</div>
              <div className="font-mono text-xs font-bold text-[#5B21B6] bg-[#FFFFFF] px-2.5 py-0.5 rounded border border-[#DDD6FE] flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>{formatTimer(calledTimerSec)}</span>
              </div>
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>
            <div className="text-xs text-[#64748B] pt-1">
              Llamado a las {activeTicket.calledTime}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => setStep('PROCESSING_START')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs"
            >
              Iniciar atención
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <button
                  onClick={() => setStep('PROCESSING_CALL')}
                  className="w-full sm:w-auto px-3.5 py-2 rounded text-xs font-semibold text-[#0F2942] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Repetir llamado</span>
                </button>

                <button
                  onClick={() => setStep('CONFIRM_NO_SHOW')}
                  className="w-full sm:w-auto px-3.5 py-2 rounded text-xs font-semibold text-[#BA1A1A] hover:bg-[#FFDAD6]/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Paciente no presentado</span>
                </button>
              </div>

              <div className="text-xs text-[#64748B]">
                {queueCount} pacientes en espera
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: PROCESSING_START */}
      {step === 'PROCESSING_START' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-[#F5F3FF]/40 border border-[#DDD6FE] space-y-2 opacity-90">
            <div className="text-xs text-[#5B21B6] font-semibold">Turno en llamado:</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>
            <div className="text-xs text-[#64748B] pt-1">
              Llamado a las {activeTicket.calledTime}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              disabled
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0EA5E9]/80 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Iniciando atención…</span>
            </button>

            <div className="text-xs text-[#64748B]">
              {queueCount} pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: IN_SERVICE */}
      {step === 'IN_SERVICE' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-[#EFF4FF]/50 border border-[#C9E6FF] space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
                {activeTicket.id}
              </div>
              <div className="font-mono text-xs font-bold text-[#006591] bg-[#FFFFFF] px-2.5 py-1 rounded border border-[#C9E6FF] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0EA5E9]" />
                <span>Duración: {formatTimer(serviceTimerSec)}</span>
              </div>
            </div>

            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>

            <div className="text-xs text-[#64748B] pt-1">
              Inicio a las {activeTicket.startTime}
            </div>
          </div>

          {/* Única acción autorizada: Cerrar turno */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setStep('CONFIRM_CLOSE')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs"
            >
              Cerrar turno
            </button>
            <div className="text-xs text-[#64748B]">
              {queueCount} pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: CONFIRM_CLOSE (Fondo visual) */}
      {step === 'CONFIRM_CLOSE' && (
        <div className="space-y-6 opacity-40 pointer-events-none">
          <div className="p-4 rounded-lg bg-[#EFF4FF]/50 border border-[#C9E6FF] space-y-2">
            <div className="font-mono text-3xl font-extrabold text-[#0F2942]">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button className="px-5 py-3 rounded-lg bg-[#0F2942] text-white font-bold text-sm">
              Cerrar turno
            </button>
            <div className="text-xs text-[#64748B]">{queueCount} pacientes en espera</div>
          </div>
        </div>
      )}

      {/* ESTADO: PROCESSING_CLOSE */}
      {step === 'PROCESSING_CLOSE' && (
        <div className="py-10 text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#0EA5E9] mx-auto" />
          <div className="text-base font-bold text-[#0F2942]">
            Cerrando turno y liberando cubículo…
          </div>
          <p className="text-xs text-[#64748B]">
            Registrando finalización de atención y actualizando estado.
          </p>
        </div>
      )}

      {/* ESTADO: CLOSED_NEXT */}
      {step === 'CLOSED_NEXT' && (
        <div className="space-y-5">
          <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="font-medium">
              Turno <strong>{lastFinishedId}</strong> finalizado con éxito.
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="text-xs text-[#64748B] font-semibold uppercase tracking-wider">
              Siguiente turno asignado:
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>
            <div className="text-xs text-[#64748B] pt-1">
              Asignado a las {activeTicket.assignedTime}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              onClick={() => setStep('PROCESSING_CALL')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs"
            >
              Llamar siguiente turno
            </button>
            <div className="text-xs text-[#64748B]">
              {queueCount} pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: CLOSED_NO_NEXT */}
      {step === 'CLOSED_NO_NEXT' && (
        <div className="space-y-5">
          <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="font-medium">
              Turno <strong>{lastFinishedId}</strong> finalizado con éxito.
            </span>
          </div>

          <div className="py-6 text-center space-y-2">
            <div className="text-base font-bold text-[#0F2942]">
              No hay pacientes en espera
            </div>
            <p className="text-xs text-[#64748B]">
              El cubículo se encuentra disponible en reposo.
            </p>
            <div className="text-xs font-semibold text-[#64748B] pt-1">
              0 pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* ESTADO: CONFIRM_NO_SHOW (Fondo visual) */}
      {step === 'CONFIRM_NO_SHOW' && (
        <div className="space-y-6 opacity-40 pointer-events-none">
          <div className="p-4 rounded-lg bg-[#F5F3FF]/40 border border-[#DDD6FE] space-y-2">
            <div className="font-mono text-3xl font-extrabold text-[#0F2942]">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button className="px-5 py-3 rounded-lg bg-[#0EA5E9] text-white font-bold text-sm">
              Iniciar atención
            </button>
            <div className="text-xs text-[#64748B]">{queueCount} pacientes en espera</div>
          </div>
        </div>
      )}

      {/* ESTADO: NO_SHOW_NEXT */}
      {step === 'NO_SHOW_NEXT' && (
        <div className="space-y-5">
          <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-center gap-2">
            <UserX className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span className="font-medium">
              Turno <strong>{lastFinishedId}</strong> marcado como no presentado.
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="text-xs text-[#64748B] font-semibold uppercase tracking-wider">
              Siguiente turno asignado:
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[#0F2942] tracking-wider">
              {activeTicket.id}
            </div>
            <div className="text-sm font-bold text-[#0F2942]">
              {activeTicket.patientName}{' '}
              <span className="text-xs font-normal text-[#64748B] font-mono">
                ({activeTicket.documentId})
              </span>
            </div>
            <div className="text-xs text-[#64748B] pt-1">
              Asignado a las {activeTicket.assignedTime}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              onClick={() => setStep('PROCESSING_CALL')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold text-sm transition-colors cursor-pointer shadow-xs"
            >
              Llamar siguiente turno
            </button>
            <div className="text-xs text-[#64748B]">
              {queueCount} pacientes en espera
            </div>
          </div>
        </div>
      )}

      {/* 3. Modales Contextuales Propios del Componente */}

      {/* MODAL: Confirmación de Cierre */}
      {step === 'CONFIRM_CLOSE' && (
        <div className="absolute inset-0 z-40 bg-[#0F2942]/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#CBD5E1] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="space-y-2">
              <h3 className="font-bold text-[#0F2942] text-base">
                ¿Deseas cerrar el turno y liberar el cubículo?
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                El turno <strong className="font-mono text-[#0F2942]">{activeTicket.id}</strong> ({activeTicket.patientName}) quedará registrado como finalizado y el cubículo estará disponible para el siguiente paciente.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setStep('IN_SERVICE')}
                className="w-full sm:w-auto order-2 sm:order-1 px-4 py-2.5 rounded border border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC] font-semibold transition-colors cursor-pointer"
              >
                Continuar atención
              </button>
              <button
                onClick={() => setStep('PROCESSING_CLOSE')}
                className="w-full sm:w-auto order-1 sm:order-2 px-4 py-2.5 rounded bg-[#0F2942] hover:bg-[#0A1B2C] text-white font-bold transition-colors cursor-pointer"
              >
                Cerrar turno y liberar cubículo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmación de No Presentado */}
      {step === 'CONFIRM_NO_SHOW' && (
        <div className="absolute inset-0 z-40 bg-[#0F2942]/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#CBD5E1] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="space-y-2">
              <h3 className="font-bold text-[#0F2942] text-base">
                ¿Confirmar que el paciente no se presentó al llamado?
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                El turno <strong className="font-mono text-[#0F2942]">{activeTicket.id}</strong> será cancelado por inasistencia. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2 text-xs">
              <button
                onClick={() => setStep('CALLED')}
                className="w-full sm:w-auto order-2 sm:order-1 px-4 py-2.5 rounded border border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC] font-semibold transition-colors cursor-pointer"
              >
                Volver al turno
              </button>
              <button
                onClick={() => {
                  setLastFinishedId(activeTicket.id);
                  setActiveTicket(TICKET_NEXT);
                  setQueueCount(3);
                  setStep('NO_SHOW_NEXT');
                }}
                className="w-full sm:w-auto order-1 sm:order-2 px-4 py-2.5 rounded bg-[#BA1A1A] hover:bg-[#93000A] text-white font-bold transition-colors cursor-pointer"
              >
                Marcar como no presentado
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
