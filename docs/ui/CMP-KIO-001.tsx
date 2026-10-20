import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { TicketCategory, Ticket } from '../types/queue';
import { useQueue } from '../context/QueueContext';
import { SurfaceCard } from './ui/SurfaceCard';
import { TicketCodeDisplay } from './ui/TicketCodeDisplay';
import { Button } from './ui/Button';
import { Heading, Text } from '@radix-ui/themes';

interface TicketKioskProps {
  onIssueTicket?: (ticket: Ticket) => void;
}

interface CategoryItem {
  id: TicketCategory;
  label: string;
  letter: string;
}

const CATEGORIES: readonly CategoryItem[] = [
  { id: 'general', label: 'General', letter: 'A' },
  { id: 'preferencial', label: 'Prioritaria', letter: 'P' },
  { id: 'especial', label: 'Fórmulas Especiales', letter: 'E' },
  { id: 'triage', label: 'Triage Farmacéutico', letter: 'T' },
];

export const TicketKiosk: React.FC<TicketKioskProps> = ({ onIssueTicket }) => {
  const { issueTicket } = useQueue();
  const [issuedTicket, setIssuedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!issuedTicket) return;
    const timer = window.setTimeout(() => {
      setIssuedTicket(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [issuedTicket]);

  const handleSelect = (category: TicketCategory, categoryLabel: string, letter: string) => {
    const newTicket = issueTicket(category, categoryLabel, letter);
    setIssuedTicket(newTicket);
    onIssueTicket?.(newTicket);
  };

  return (
    <main className="w-full min-h-screen bg-surface-base text-text-primary flex flex-col justify-center items-center p-6 sm:p-12 select-none">
      <SurfaceCard aria-labelledby="kiosk-heading" className="w-full max-w-lg">
        {!issuedTicket ? (
          <div>
            <header className="text-center mb-8">
              <Heading id="kiosk-heading" size="4" weight="bold" className="mb-2">
                Seleccione su categoría
              </Heading>
              <Text size="2" color="gray" className="text-text-secondary/85">
                Presione una opción para obtener su turno
              </Text>
            </header>

            <div className="flex flex-col gap-3.5" role="group" aria-labelledby="kiosk-heading">
              {CATEGORIES.map(({ id, label, letter }) => (
                <Button
                  key={id}
                  variant="surface"
                  onClick={() => handleSelect(id, label, letter)}
                  className="justify-between p-5 min-h-[60px]"
                  rightIcon={<ChevronRight className="w-6 h-6 text-brand-primary shrink-0" />}
                >
                  <span className="text-base sm:text-lg font-bold text-text-primary">
                    {label}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div role="status" aria-live="polite" className="text-center">
            <Heading
              id="kiosk-heading"
              size="3"
              color="blue"
              className="text-xs uppercase tracking-widest font-bold block mb-3"
            >
              Turno Generado
            </Heading>

            <div className="my-2">
              <TicketCodeDisplay
                code={issuedTicket.code}
                category={issuedTicket.category}
                size="md"
              />
            </div>

            <div className="my-8 py-6 border-y border-brand-primary/20 space-y-2">
              <Text size="3" weight="bold" className="block">
                Conserve su comprobante.
              </Text>
              <Text size="2" color="gray" className="text-text-secondary/90">
                Espere el llamado en pantalla.
              </Text>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIssuedTicket(null)}
            >
              Emitir otro turno
            </Button>
          </div>
        )}
      </SurfaceCard>
    </main>
  );
};

export default TicketKiosk;