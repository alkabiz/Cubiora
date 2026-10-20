import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Volume2, VolumeX } from 'lucide-react';
import { Ticket, RecentCall } from '../types/queue';
import { useQueue } from '../context/QueueContext';
import { useClinicalChime } from '../hooks/useClinicalChime';
import { SurfaceCard } from './ui/SurfaceCard';
import { TicketCodeDisplay } from './ui/TicketCodeDisplay';

interface PublicDisplayProps {
  currentCall?: Ticket | null;
  recentCalls?: RecentCall[];
}

export const PublicDisplay: React.FC<PublicDisplayProps> = ({
  currentCall: propCurrentCall,
  recentCalls: propRecentCalls,
}) => {
  const queueContext = useQueue();
  const currentCall = propCurrentCall !== undefined ? propCurrentCall : queueContext.currentCall;
  const recentCalls = propRecentCalls ?? queueContext.recentCalls;

  const shouldReduceMotion = useReducedMotion();
  const { playChime, unlockAudio, isAudioUnlocked } = useClinicalChime();

  useEffect(() => {
    if (currentCall?.code) {
      void playChime();
    }
  }, [currentCall?.id, currentCall?.calledAt, currentCall?.code, playChime]);

  const callAnimationKey = currentCall
    ? `${currentCall.id}-${currentCall.calledAt ?? 'init'}`
    : 'empty-state';

  return (
    <main className="w-full min-h-screen bg-surface-base text-text-primary flex flex-col p-6 sm:p-12 justify-center items-center select-none relative">
      <div className="w-full max-w-7xl flex justify-end mb-4">
        <button
          type="button"
          onClick={() => {
            void unlockAudio();
            void playChime();
          }}
          aria-pressed={isAudioUnlocked}
          className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
            isAudioUnlocked
              ? 'bg-status-available/15 text-status-available border-status-available/40'
              : 'bg-status-called/20 text-status-called border-status-called/50'
          }`}
        >
          {isAudioUnlocked ? (
            <>
              <Volume2 aria-hidden="true" className="w-4 h-4" />
              <span>Audio de sala activo</span>
            </>
          ) : (
            <>
              <VolumeX aria-hidden="true" className="w-4 h-4" />
              <span>Activar sonido de llamados</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
        <SurfaceCard
          as="section"
          aria-labelledby="current-call-heading"
          aria-live="assertive"
          aria-atomic="true"
          className="lg:col-span-8 sm:p-14 items-center justify-center text-center overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {currentCall ? (
              <motion.div
                key={callAnimationKey}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: 16 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.98, y: -12 }
                }
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full max-w-4xl flex flex-col items-center"
              >
                <div className="flex items-center gap-3 mb-6">
                  <h1
                    id="current-call-heading"
                    className="text-xs sm:text-sm font-bold uppercase tracking-[0.35em] text-brand-primary"
                  >
                    Llamado Actual
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
                    {currentCall.categoryLabel}
                  </span>
                </div>

                <div className="w-full mb-8">
                  <TicketCodeDisplay
                    code={currentCall.code}
                    category={currentCall.category}
                    size="xl"
                  />
                </div>

                <span className="text-xs sm:text-sm uppercase tracking-widest text-text-secondary/85 font-bold mb-4">
                  Diríjase a
                </span>

                <div className="w-full max-w-2xl bg-brand-primary/10 rounded-2xl p-6 sm:p-8 border border-brand-primary/30">
                  <div className="text-[clamp(2.25rem,4.5vw,5rem)] font-black text-text-primary tracking-tight leading-none mb-3">
                    {currentCall.cubicle || 'CUBÍCULO 04'}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-[clamp(1.25rem,2.2vw,2.5rem)] text-text-secondary font-bold">
                    <span>{currentCall.module || 'Módulo A4'}</span>
                    <span aria-hidden="true" className="text-brand-primary/60">
                      •
                    </span>
                    <span className="text-brand-primary font-semibold">
                      {currentCall.deskName || 'Ventanilla 4'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="waiting-room"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center p-8"
              >
                <h1 id="current-call-heading" className="text-2xl font-bold text-text-primary mb-2">
                  SALA EN ESPERA DE ATENCIÓN
                </h1>
                <p className="text-sm text-text-secondary/85">
                  Por favor tome asiento. Su turno aparecerá en esta pantalla.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </SurfaceCard>

        {recentCalls.length > 0 && (
          <SurfaceCard
            as="aside"
            variant="muted"
            aria-labelledby="recent-calls-heading"
            className="lg:col-span-4 justify-between"
          >
            <div className="w-full flex flex-col">
              <h2
                id="recent-calls-heading"
                className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-secondary/90 pb-5 mb-6 border-b border-brand-primary/20"
              >
                Últimos Llamados
              </h2>

              <ul className="w-full flex flex-col gap-4 sm:gap-5 list-none m-0 p-0">
                <AnimatePresence initial={false}>
                  {recentCalls.map((item) => (
                    <motion.li
                      key={item.id}
                      layout={!shouldReduceMotion}
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="w-full px-6 sm:px-8 py-5 rounded-2xl bg-surface-base border border-brand-primary/25 flex items-center justify-between gap-4 shadow-md"
                    >
                      <div>
                        <span className="font-mono-code text-base sm:text-lg font-bold text-text-primary tracking-wider block mb-1">
                          {item.code}
                        </span>
                        <span className="text-xs sm:text-sm text-text-secondary/80">
                          {item.timeAgo}
                        </span>
                      </div>
                      <span className="text-sm sm:text-base font-bold text-brand-primary shrink-0">
                        {item.cubicle}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          </SurfaceCard>
        )}
      </div>
    </main>
  );
};

export default PublicDisplay;
