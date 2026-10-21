import React, { useState } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import { PriorityLevel, Ticket } from '../types/pharmacy';
import {
  Box,
  Flex,
  Grid,
  Card,
  Heading,
  Text,
  Badge,
  Button,
  Dialog,
  ScrollArea,
  Separator,
} from '@radix-ui/themes';
import {
  Printer,
  Heart,
  Accessibility,
  Flame,
  Users,
  QrCode,
  Ticket as TicketIcon,
} from 'lucide-react';

export const ReceptionView: React.FC = () => {
  const { createTicket, waitingQueue } = usePharmacy();
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel>('general');
  const [printedTicket, setPrintedTicket] = useState<Ticket | null>(null);

  const priorityOptions: {
    id: PriorityLevel;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: 'gray' | 'purple' | 'cyan' | 'red';
  }[] = [
    {
      id: 'general',
      label: 'Turno General',
      sublabel: 'Flujo estándar de atención',
      icon: <Users className="w-5 h-5 text-slate-600" />,
      color: 'gray',
    },
    {
      id: 'preferencial',
      label: 'Atención Prioritaria',
      sublabel: 'Adulto mayor o atención preferente',
      icon: <Heart className="w-5 h-5 text-purple-600" />,
      color: 'purple',
    },
    {
      id: 'especial',
      label: 'Atención Especial',
      sublabel: 'Movilidad reducida o gestantes',
      icon: <Accessibility className="w-5 h-5 text-cyan-600" />,
      color: 'cyan',
    },
    {
      id: 'urgente',
      label: 'Despacho Urgente',
      sublabel: 'Derivación de prioridad inmediata',
      icon: <Flame className="w-5 h-5 text-red-600" />,
      color: 'red',
    },
  ];

  const handleIssueTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const newTicket = createTicket(selectedPriority);
    setPrintedTicket(newTicket);
  };

  return (
    <Box className="w-full">
      <Flex direction="column" gap="6" className="px-4 lg:px-8 py-6">
        {/* Title bar */}
        <Flex
          direction={{ initial: 'column', sm: 'row' }}
          justify="between"
          align={{ initial: 'start', sm: 'center' }}
          gap="4"
        >
          <Box>
            <Flex align="center" gap="2" className="mb-1">
              <Badge variant="surface" color="blue" size="1">
                SCR-REC-001
              </Badge>
              <Text size="1" color="gray">
                · Emisión de Turnos y Gestión de Flujo
              </Text>
            </Flex>
            <Heading size="6" weight="bold" className="text-[#001428] tracking-tight">
              [SCR-REC-001] Recepción · Tótem Dispensador de Turnos
            </Heading>
          </Box>

          <Badge size="2" color="teal" variant="surface" className="flex items-center gap-1.5 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" aria-hidden="true" />
            Tótem de Impresión En Línea
          </Badge>
        </Flex>

        {/* 2-Column layout */}
        <Grid columns={{ initial: '1', lg: '12' }} gap="6">
          {/* Intake Form (7 cols) */}
          <Box className="lg:col-span-7">
            <Card size="3" className="shadow-xs p-6">
              <Flex direction="column" gap="5">
                <Flex align="center" gap="3" className="pb-3 border-b border-[var(--gray-a4)]">
                  <div className="w-9 h-9 rounded-lg bg-[var(--teal-a3)] flex items-center justify-center text-[var(--teal-11)]">
                    <TicketIcon className="w-5 h-5" />
                  </div>
                  <Box>
                    <Heading size="4" weight="bold" className="text-[#001428]">
                      Emisión Operativa de Ticket
                    </Heading>
                    <Text size="2" color="gray">
                      Seleccione la prioridad requerida para incorporar el turno a la cola central
                    </Text>
                  </Box>
                </Flex>

                <form onSubmit={handleIssueTicket} className="flex flex-col gap-5">
                  <Box>
                    <Text as="label" size="2" weight="bold" className="block text-[#001428] mb-2.5">
                      Selección de Tipo de Turno
                    </Text>
                    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                      {priorityOptions.map((opt) => {
                        const isSelected = selectedPriority === opt.id;
                        return (
                          <Card
                            key={opt.id}
                            variant={isSelected ? 'surface' : 'classic'}
                            onClick={() => setSelectedPriority(opt.id)}
                            className={`p-3.5 cursor-pointer transition-all ${
                              isSelected
                                ? 'ring-2 ring-[var(--teal-9)] bg-[var(--teal-a2)]'
                                : 'hover:border-[var(--teal-7)] hover:bg-[var(--gray-a2)]'
                            }`}
                          >
                            <Flex align="start" gap="3">
                              <Box className="mt-0.5">{opt.icon}</Box>
                              <Flex direction="column" gap="1">
                                <Flex align="center" gap="2">
                                  <Text size="2" weight="bold" className="text-[#001428]">
                                    {opt.label}
                                  </Text>
                                  {isSelected && (
                                    <Badge size="1" color={opt.color} variant="solid">
                                      Activo
                                    </Badge>
                                  )}
                                </Flex>
                                <Text size="1" color="gray">
                                  {opt.sublabel}
                                </Text>
                              </Flex>
                            </Flex>
                          </Card>
                        );
                      })}
                    </Grid>
                  </Box>

                  <Separator size="4" className="my-1" />

                  <Flex justify="between" align="center" wrap="wrap" gap="3">
                    <Text size="1" color="gray" className="max-w-xs">
                      El turno ingresa de forma automática a la cola central bajo algoritmo FIFO.
                    </Text>
                    <Button
                      type="submit"
                      size="3"
                      color="teal"
                      variant="solid"
                      className="cursor-pointer font-bold shadow-xs flex items-center gap-2 px-6"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Emitir Ticket</span>
                    </Button>
                  </Flex>
                </form>
              </Flex>
            </Card>
          </Box>

          {/* Queue preview (5 cols) */}
          <Box className="lg:col-span-5">
            <Card size="3" className="shadow-xs p-5">
              <Flex direction="column" gap="4">
                <Flex justify="between" align="center">
                  <Text size="2" weight="bold" className="text-[#001428] uppercase tracking-wider">
                    Turnos en Espera ({waitingQueue.length})
                  </Text>
                  <Badge color="blue" variant="soft" size="1">
                    Cola Activa
                  </Badge>
                </Flex>

                <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 380 }}>
                  <Flex direction="column" gap="2.5" className="pr-2">
                    {waitingQueue.length === 0 ? (
                      <Box className="p-8 text-center">
                        <Text size="2" color="gray">
                          No hay turnos pendientes en cola.
                        </Text>
                      </Box>
                    ) : (
                      waitingQueue.map((item, idx) => (
                        <Card
                          key={item.id}
                          variant="surface"
                          size="1"
                          className="p-3 transition-colors hover:bg-[var(--gray-a3)]"
                        >
                          <Flex justify="between" align="center">
                            <Flex align="center" gap="3">
                              <Badge
                                variant="solid"
                                color="gray"
                                radius="full"
                                size="1"
                                className="w-6 h-6 flex items-center justify-center font-mono font-bold"
                              >
                                {idx + 1}
                              </Badge>
                              <Flex direction="column">
                                <Text size="2" weight="bold" className="font-mono text-[#001428]">
                                  {item.id}
                                </Text>
                                <Text size="1" color="gray">
                                  Emisión:{' '}
                                  {item.issuedAt.toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </Flex>
                            </Flex>

                            <Badge
                              size="1"
                              color={
                                item.priority === 'preferencial'
                                  ? 'purple'
                                  : item.priority === 'urgente'
                                  ? 'red'
                                  : item.priority === 'especial'
                                  ? 'cyan'
                                  : 'gray'
                              }
                              variant="surface"
                              className="font-mono font-bold"
                            >
                              {item.priority.toUpperCase()}
                            </Badge>
                          </Flex>
                        </Card>
                      ))
                    )}
                  </Flex>
                </ScrollArea>
              </Flex>
            </Card>
          </Box>
        </Grid>
      </Flex>

      {/* Ticket Slip Printable Modal (Radix Dialog) */}
      <Dialog.Root open={!!printedTicket} onOpenChange={(open) => !open && setPrintedTicket(null)}>
        <Dialog.Content size="2" maxWidth="400px" className="p-6">
          <Dialog.Title size="4" weight="bold" className="text-center text-[#001428]">
            Comprobante de Turno
          </Dialog.Title>
          <Dialog.Description size="2" color="gray" className="text-center mb-4">
            Ticket emitido para dispensación farmacéutica
          </Dialog.Description>

          {printedTicket && (
            <Card variant="surface" className="p-5 border-2 border-dashed border-[var(--gray-a6)] text-center mb-4">
              <Text size="1" weight="bold" color="gray" className="tracking-widest uppercase block mb-1">
                DISPENSACIÓN CENTRAL
              </Text>
              <Text size="1" color="gray" className="block mb-3">
                {new Date().toLocaleDateString('es-ES')} · {new Date().toLocaleTimeString('es-ES')}
              </Text>

              <Card variant="classic" className="py-4 px-6 bg-white shadow-2xs mb-3">
                <Text size="8" weight="bold" className="font-mono text-[#001428] tracking-widest block">
                  {printedTicket.id}
                </Text>
                <Badge
                  color={
                    printedTicket.priority === 'preferencial'
                      ? 'purple'
                      : printedTicket.priority === 'urgente'
                      ? 'red'
                      : printedTicket.priority === 'especial'
                      ? 'cyan'
                      : 'gray'
                  }
                  variant="surface"
                  size="2"
                  className="mt-2 font-mono font-bold uppercase"
                >
                  PRIORIDAD: {printedTicket.priority}
                </Badge>
              </Card>

              <Flex align="center" justify="center" gap="3" className="pt-2 border-t border-[var(--gray-a4)]">
                <QrCode className="w-8 h-8 text-[#001428]" />
                <Text size="1" color="gray" className="text-left">
                  Aguarde su número en la pantalla de sala.
                </Text>
              </Flex>
            </Card>
          )}

          <Flex gap="3" justify="end" className="mt-4">
            <Button
              variant="surface"
              color="gray"
              onClick={() => window.print()}
              className="cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Dialog.Close>
              <Button color="teal" variant="solid" className="cursor-pointer px-5">
                Listo
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
};
