import React from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  Box,
  Flex,
  Grid,
  Card,
  Heading,
  Text,
  Badge,
  Button,
  Separator,
  ScrollArea,
} from '@radix-ui/themes';
import {
  Volume2,
  CheckCircle2,
  UserX,
  Play,
  RotateCcw,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export const CubicleView: React.FC = () => {
  const {
    cubicles,
    selectedCubicleId,
    setSelectedCubicleId,
    activeTicketsMap,
    waitingQueue,
    callNextInQueue,
    repeatCall,
    startServiceForCubicle,
    completeServiceForCubicle,
    markTicketAbandoned,
  } = usePharmacy();

  const currentCubicle =
    cubicles.find((c) => c.id === selectedCubicleId) || cubicles[0];

  const currentTicket = currentCubicle.currentTicketId
    ? activeTicketsMap[currentCubicle.currentTicketId]
    : undefined;

  const minutes = Math.floor(currentCubicle.sessionElapsedSeconds / 60);
  const seconds = currentCubicle.sessionElapsedSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} min`;

  const handleFinish = () => {
    completeServiceForCubicle(currentCubicle.id);
  };

  const handleNoShow = () => {
    markTicketAbandoned(currentCubicle.id);
  };

  const statusColorMap: Record<string, 'teal' | 'purple' | 'blue' | 'red' | 'gray'> = {
    available: 'teal',
    calling: 'purple',
    busy: 'blue',
    exceeded: 'red',
    inactive: 'gray',
  };

  const statusLabelMap: Record<string, string> = {
    available: 'DISPONIBLE',
    calling: 'LLAMANDO A SALA',
    busy: 'ATENDIENDO',
    exceeded: 'SLA EXCEDIDO',
    inactive: 'INACTIVO',
  };

  return (
    <Box className="w-full" data-component="CMP-CAJ-001">
      <Flex direction="column" gap="6" className="px-4 lg:px-8 py-6">
        {/* Top bar with Station Selector */}
        <Flex
          direction={{ initial: 'column', sm: 'row' }}
          justify="between"
          align={{ initial: 'start', sm: 'center' }}
          gap="4"
        >
          <Box>
            <Flex align="center" gap="2" className="mb-1">
              <Badge variant="surface" color="blue" size="1">
                SCR-CAJ-001
              </Badge>
              <Text size="1" color="gray">
                · CMP-CAJ-001 · Puesto de Atención y Despacho
              </Text>
            </Flex>
            <Flex align="center" gap="2.5">
              <Heading size="6" weight="bold" className="text-[#001428] tracking-tight">
                [SCR-CAJ-001] {currentCubicle.name} · Estación de Despacho
              </Heading>
              <Badge size="1" color="gray" variant="surface" className="font-mono">
                {currentCubicle.moduleType}
              </Badge>
            </Flex>
          </Box>

          {/* Switch active cubicle */}
          <Flex align="center" gap="2">
            <Text size="2" color="gray" weight="medium" className="hidden sm:inline">
              Cambiar Puesto:
            </Text>
            <Card size="1" variant="surface" className="p-1 shadow-2xs">
              <Flex gap="1">
                {cubicles
                  .filter((c) => c.status !== 'inactive')
                  .map((c) => {
                    const isSelected = selectedCubicleId === c.id;
                    return (
                      <Button
                        key={c.id}
                        size="1"
                        variant={isSelected ? 'solid' : 'ghost'}
                        color={isSelected ? 'teal' : 'gray'}
                        onClick={() => setSelectedCubicleId(c.id)}
                        className="cursor-pointer font-bold px-3"
                      >
                        {c.id}
                      </Button>
                    );
                  })}
              </Flex>
            </Card>
          </Flex>
        </Flex>

        {/* Operational status card */}
        <Grid columns={{ initial: '1', lg: '12' }} gap="6">
          {/* Main Work Area (8 cols) */}
          <Box className="lg:col-span-8">
            <Flex direction="column" gap="5">
              {/* Station State Bar */}
              <Card size="3" className="shadow-xs p-5">
                <Flex
                  direction={{ initial: 'column', sm: 'row' }}
                  justify="between"
                  align={{ initial: 'start', sm: 'center' }}
                  gap="4"
                >
                  <Flex align="center" gap="3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                        currentCubicle.status === 'calling'
                          ? 'bg-[var(--purple-a3)] text-[var(--purple-11)] ring-2 ring-[var(--purple-7)]'
                          : currentCubicle.status === 'busy'
                          ? 'bg-[var(--blue-a3)] text-[var(--blue-11)] ring-2 ring-[var(--blue-7)]'
                          : currentCubicle.status === 'exceeded'
                          ? 'bg-[var(--red-a3)] text-[var(--red-11)] ring-2 ring-[var(--red-7)]'
                          : 'bg-[var(--teal-a3)] text-[var(--teal-11)] ring-2 ring-[var(--teal-7)]'
                      }`}
                    >
                      {currentCubicle.id}
                    </div>
                    <Box>
                      <Flex align="center" gap="2.5">
                        <Text size="3" weight="bold" className="text-[#001428]">
                          {currentCubicle.name}
                        </Text>
                        <Badge
                          size="2"
                          color={statusColorMap[currentCubicle.status] || 'teal'}
                          variant="surface"
                          className="font-mono font-bold"
                        >
                          {statusLabelMap[currentCubicle.status] || 'DISPONIBLE'}
                        </Badge>
                      </Flex>
                      <Text size="2" color="gray" className="block mt-0.5">
                        Operador a cargo: <strong>{currentCubicle.operator}</strong>
                      </Text>
                    </Box>
                  </Flex>

                  {/* Action Trigger based on state */}
                  <Flex align="center" gap="2">
                    {currentCubicle.status === 'available' ? (
                      <Button
                        size="3"
                        color="purple"
                        variant="solid"
                        onClick={() => callNextInQueue(currentCubicle.id)}
                        className="cursor-pointer font-bold shadow-xs flex items-center gap-2 px-5"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>Llamar Siguiente Turno</span>
                      </Button>
                    ) : currentCubicle.status === 'calling' ? (
                      <Flex align="center" gap="2">
                        <Button
                          size="2"
                          color="purple"
                          variant="surface"
                          onClick={() => repeatCall(currentCubicle.id)}
                          className="cursor-pointer font-semibold flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Re-llamar
                        </Button>
                        <Button
                          size="2"
                          color="teal"
                          variant="solid"
                          onClick={() => startServiceForCubicle(currentCubicle.id)}
                          className="cursor-pointer font-bold flex items-center gap-1.5 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Iniciar Atención
                        </Button>
                      </Flex>
                    ) : (
                      <Card variant="surface" size="1" className="px-3 py-1.5 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--teal-9)]" />
                        <Text
                          size="2"
                          weight="bold"
                          className={`font-mono tabular-nums ${
                            currentCubicle.status === 'exceeded'
                              ? 'text-[var(--red-11)]'
                              : 'text-[var(--teal-11)]'
                          }`}
                        >
                          {timeFormatted}
                        </Text>
                      </Card>
                    )}
                  </Flex>
                </Flex>
              </Card>

              {/* Current Active Turn Workspace */}
              {currentTicket ? (
                <Card size="3" className="shadow-xs p-6">
                  <Flex direction="column" gap="5">
                    <Flex
                      direction={{ initial: 'column', sm: 'row' }}
                      justify="between"
                      align={{ initial: 'start', sm: 'center' }}
                      className="pb-4 border-b border-[var(--gray-a4)]"
                      gap="2"
                    >
                      <Flex align="center" gap="3">
                        <div className="w-12 h-12 rounded-xl bg-[var(--teal-a3)] flex items-center justify-center text-[var(--teal-11)] font-mono font-bold text-lg">
                          {currentTicket.id.split('-')[1] || 'TUR'}
                        </div>
                        <Box>
                          <Text size="5" weight="bold" className="font-mono text-[#001428] block">
                            {currentTicket.id}
                          </Text>
                          <Text size="2" color="gray">
                            Emisión:{' '}
                            {currentTicket.issuedAt.toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </Text>
                        </Box>
                      </Flex>

                      <Badge
                        size="2"
                        color={
                          currentTicket.priority === 'preferencial'
                            ? 'purple'
                            : currentTicket.priority === 'urgente'
                            ? 'red'
                            : currentTicket.priority === 'especial'
                            ? 'cyan'
                            : 'gray'
                        }
                        variant="surface"
                        className="font-mono font-bold uppercase self-start sm:self-auto"
                      >
                        PRIORIDAD {currentTicket.priority}
                      </Badge>
                    </Flex>

                    <Card variant="surface" className="p-4">
                      <Flex justify="between" align="center">
                        <Box>
                          <Text size="1" color="gray" className="block">
                            Tiempo de atención transcurrido:
                          </Text>
                          <Text
                            size="5"
                            weight="bold"
                            className={`font-mono tabular-nums ${
                              currentCubicle.status === 'exceeded'
                                ? 'text-[var(--red-11)]'
                                : 'text-[var(--teal-11)]'
                            }`}
                          >
                            {timeFormatted}
                          </Text>
                        </Box>
                        <Box className="text-right">
                          <Text size="1" color="gray" className="block">
                            Límite de SLA:
                          </Text>
                          <Text size="2" weight="bold" className="font-mono text-[#001428]">
                            12:00 min
                          </Text>
                        </Box>
                      </Flex>
                    </Card>

                    {/* Bottom Action Controls */}
                    <Flex
                      direction={{ initial: 'column', sm: 'row' }}
                      justify="between"
                      align="center"
                      gap="3"
                      className="pt-3 border-t border-[var(--gray-a4)]"
                    >
                      <Button
                        size="2"
                        color="red"
                        variant="soft"
                        onClick={handleNoShow}
                        className="cursor-pointer font-bold flex items-center gap-1.5"
                      >
                        <UserX className="w-4 h-4" />
                        Turno No Presentado
                      </Button>

                      <Button
                        size="3"
                        color="teal"
                        variant="solid"
                        onClick={handleFinish}
                        className="cursor-pointer font-bold flex items-center gap-2 shadow-xs px-6"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Finalizar Atención y Liberar Puesto</span>
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              ) : (
                <Card size="3" className="shadow-xs p-12 text-center">
                  <Flex direction="column" align="center" justify="center" gap="4">
                    <div className="w-16 h-16 rounded-full bg-[var(--teal-a3)] flex items-center justify-center text-[var(--teal-10)]">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <Box>
                      <Heading size="4" weight="bold" className="text-[#001428]">
                        Cubículo Disponible y Despejado
                      </Heading>
                      <Text size="2" color="gray" className="max-w-sm mt-1 block">
                        No hay ningún turno en atención en este puesto. Pulse el botón para convocar al siguiente turno de la cola central.
                      </Text>
                    </Box>
                    <Button
                      size="3"
                      color="purple"
                      variant="solid"
                      onClick={() => callNextInQueue(currentCubicle.id)}
                      className="cursor-pointer font-bold shadow-md flex items-center gap-2 px-6"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Llamar Siguiente Turno en Cola</span>
                    </Button>
                  </Flex>
                </Card>
              )}
            </Flex>
          </Box>

          {/* Side Info & Waiting Queue (4 cols) */}
          <Box className="lg:col-span-4">
            <Flex direction="column" gap="4">
              <Card size="3" className="shadow-xs p-5">
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center" className="pb-2 border-b border-[var(--gray-a4)]">
                    <Text size="2" weight="bold" className="text-[#001428] uppercase tracking-wider">
                      Próximos en Cola ({waitingQueue.length})
                    </Text>
                    <Badge size="1" color="blue" variant="soft">
                      Modo FIFO
                    </Badge>
                  </Flex>

                  {waitingQueue.length === 0 ? (
                    <Text size="2" color="gray" className="py-2 text-center block">
                      No hay turnos en espera.
                    </Text>
                  ) : (
                    <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: 220 }}>
                      <Flex direction="column" gap="2" className="pr-1">
                        {waitingQueue.slice(0, 5).map((w, idx) => (
                          <Card key={w.id} variant="surface" size="1" className="p-2.5">
                            <Flex justify="between" align="center">
                              <Flex align="center" gap="2">
                                <Badge
                                  radius="full"
                                  size="1"
                                  variant="solid"
                                  color="gray"
                                  className="w-5 h-5 flex items-center justify-center font-mono font-bold"
                                >
                                  {idx + 1}
                                </Badge>
                                <Text size="2" weight="bold" className="font-mono text-[#001428]">
                                  {w.id}
                                </Text>
                              </Flex>
                              <Badge size="1" color="teal" variant="soft" className="font-mono uppercase">
                                {w.priority}
                              </Badge>
                            </Flex>
                          </Card>
                        ))}
                      </Flex>
                    </ScrollArea>
                  )}
                </Flex>
              </Card>

              {/* Shift metrics for this station */}
              <Card variant="surface" size="2" className="p-4 shadow-2xs">
                <Flex direction="column" gap="2.5">
                  <Text size="2" weight="bold" className="text-[#001428] mb-1">
                    Rendimiento de la Estación Hoy
                  </Text>
                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">
                      Turnos completados:
                    </Text>
                    <Text size="2" weight="bold" className="font-mono text-[#001428]">
                      {currentCubicle.assignedTicketsCountToday} turnos
                    </Text>
                  </Flex>
                  <Separator size="4" />
                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">
                      Tiempo promedio:
                    </Text>
                    <Text size="2" weight="bold" className="font-mono text-[var(--teal-11)]">
                      4m 45s
                    </Text>
                  </Flex>
                  <Separator size="4" />
                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">
                      Cumplimiento SLA (&lt;12m):
                    </Text>
                    <Text size="2" weight="bold" className="font-mono text-[var(--teal-11)]">
                      97.4%
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            </Flex>
          </Box>
        </Grid>
      </Flex>
    </Box>
  );
};
