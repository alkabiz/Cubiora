import React from 'react';
import { BellRing } from 'lucide-react';
import { PharmacistPhase, CubicleInfo } from '../types/queue';
import { useQueue } from '../context/QueueContext';
import { usePharmacistWorkflow } from '../hooks/usePharmacistWorkflow';
import { SurfaceCard } from './ui/SurfaceCard';
import { TicketCodeDisplay } from './ui/TicketCodeDisplay';
import { Button } from './ui/Button';
import { Heading, Flex, Box, Badge } from '@radix-ui/themes';

interface PharmacistConsoleProps {
  cubicleName?: string;
  onCallTicket?: () => void;
  onStartAttention?: () => void;
  onDispatchTicket?: () => void;
}

const PHASE_STYLES: Record<PharmacistPhase, { label: string; color: 'green' | 'blue' | 'amber' | 'gray' }> = {
  DISPONIBLE: { label: 'DISPONIBLE', color: 'green' },
  TURNO_ASIGNADO: { label: 'TURNO ASIGNADO', color: 'blue' },
  TURNO_LLAMADO: { label: 'TURNO LLAMADO', color: 'amber' },
  EN_ATENCION: { label: 'EN ATENCIÓN', color: 'blue' },
  DESPACHADO: { label: 'DESPACHADO', color: 'gray' },
};

export const PharmacistConsole: React.FC<PharmacistConsoleProps> = ({
  cubicleName = 'CUBÍCULO 04',
  onCallTicket,
  onStartAttention,
  onDispatchTicket,
}) => {
  const { queue, callNextTicket, recallCurrentTicket, startAttention, dispatchCurrentTicket } =
    useQueue();

  const {
    phase,
    currentTicket,
    callTicket,
    startAttention: triggerStartWorkflow,
    dispatchTicket: triggerDispatchWorkflow,
  } = usePharmacistWorkflow((completedTicket) => {
    dispatchCurrentTicket(completedTicket.id);
  });

  const handleCall = () => {
    const cubicleInfo: CubicleInfo = {
      id: 'cub-04',
      name: cubicleName,
      module: 'Módulo A4',
      deskName: 'Ventanilla 4',
      pharmacistName: 'Dr. Turno',
    };

    const called = callNextTicket(cubicleInfo);
    if (!called) return;

    callTicket(called);
    onCallTicket?.();
  };

  const handleStart = () => {
    if (currentTicket) {
      startAttention(currentTicket.id);
    }
    triggerStartWorkflow();
    onStartAttention?.();
  };

  const handleDispatch = () => {
    triggerDispatchWorkflow();
    onDispatchTicket?.();
  };

  const currentPhaseConfig = PHASE_STYLES[phase];
  const queueCount = queue.length;

  return (
    <main className="w-full min-h-screen bg-surface-base text-text-primary flex flex-col justify-center items-center p-6 sm:p-12 select-none">
      <SurfaceCard
        aria-label={`Consola de gestión para ${cubicleName}`}
        className="w-full max-w-xl"
      >
        <header className="flex items-center justify-between pb-6 border-b border-brand-primary/20">
          <div>
            <span className="text-xs uppercase tracking-wider text-text-secondary/80 block mb-0.5">
              Ventanilla
            </span>
            <Heading size="4" weight="bold">
              {cubicleName}
            </Heading>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-text-secondary/80 block mb-0.5">
              Estado Actual
            </span>
            <Badge
              color={currentPhaseConfig.color}
              variant="soft"
              size="2"
              className="px-3 py-1 rounded-full text-xs font-bold"
            >
              {currentPhaseConfig.label}
            </Badge>
          </div>
        </header>

        <Flex justify="between" align="center" className="py-4 my-2 border-b border-brand-primary/15 text-xs sm:text-sm">
          <span className="text-text-secondary/90 font-medium">Turnos en espera:</span>
          <span className="font-mono-code text-base font-bold text-brand-primary">
            {queueCount} {queueCount === 1 ? 'turno' : 'turnos'}
          </span>
        </Flex>

        <Box aria-live="polite" className="text-center py-8">
          <span className="text-xs uppercase tracking-widest text-text-secondary/80 font-semibold block mb-3">
            Turno Actual
          </span>
          {currentTicket ? (
            <div className="flex flex-col items-center">
              <TicketCodeDisplay
                code={currentTicket.code}
                category={currentTicket.category}
                size="lg"
                framed={false}
              />
              <div className="inline-block mt-4 px-3 py-1 rounded-lg bg-surface-base border border-brand-primary/30 text-xs text-brand-primary font-medium">
                Categoría: <strong className="text-text-primary">{currentTicket.categoryLabel}</strong>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <span
                aria-hidden="true"
                className="text-4xl font-bold text-text-secondary/60 font-mono-code"
              >
                ---
              </span>
              <p className="text-xs text-text-secondary/80 mt-2">
                Ventanilla sin turno asignado
              </p>
            </div>
          )}
        </Box>

        <div className="pt-6 border-t border-brand-primary/20 flex flex-col gap-3">
          {phase === 'DISPONIBLE' && (
            <Button
              variant="primary"
              onClick={handleCall}
              disabled={queueCount === 0}
            >
              {queueCount > 0 ? 'Llamar Siguiente Turno' : 'Sin turnos en espera'}
            </Button>
          )}

          {phase === 'TURNO_LLAMADO' && (
            <>
              <Button variant="success" onClick={handleStart}>
                Iniciar Atención
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={recallCurrentTicket}
                leftIcon={<BellRing className="w-4 h-4 text-brand-primary" />}
              >
                Volver a llamar en pantalla
              </Button>
            </>
          )}

          {phase === 'EN_ATENCION' && (
            <Button variant="primary" onClick={handleDispatch}>
              Despachar / Completar
            </Button>
          )}

          {phase === 'DESPACHADO' && (
            <div
              role="status"
              aria-live="assertive"
              className="text-center py-3 text-sm text-status-available font-semibold"
            >
              Dispensación completada
            </div>
          )}
        </div>
      </SurfaceCard>
    </main>
  );
};

export default PharmacistConsole;