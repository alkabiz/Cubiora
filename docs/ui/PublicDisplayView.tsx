import React, { useState } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  Theme,
  Box,
  Flex,
  Grid,
  Card,
  Heading,
  Text,
  Badge,
  IconButton,
  Callout,
} from '@radix-ui/themes';
import {
  Volume2,
  Maximize2,
  Minimize2,
  Clock,
  ArrowRight,
  Building,
  Bell,
  Sparkles,
} from 'lucide-react';

export const PublicDisplayView: React.FC = () => {
  const {
    cubicles,
    callingTickets,
    waitingQueue,
    currentTimeString,
    broadcastAlertText,
    triggerChime,
  } = usePharmacy();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const primaryCallingTicket = callingTickets.length > 0 ? callingTickets[0] : null;
  const primaryCallingCubicle = primaryCallingTicket?.assignedCubicleId
    ? cubicles.find((c) => c.id === primaryCallingTicket.assignedCubicleId)
    : cubicles.find((c) => c.status === 'calling');

  return (
    <Theme appearance="dark" accentColor="teal" grayColor="slate" radius="large" className="w-full min-h-screen">
      <Box
        className={`w-full min-h-screen bg-[#001428] text-white flex flex-col justify-between selection:bg-[#39b8fd] ${
          isFullscreen ? 'p-6 fixed inset-0 z-50 overflow-auto' : 'p-4 lg:p-8'
        }`}
      >
        {/* Top Banner on TV Monitor */}
        <Flex justify="between" align="center" className="pb-4 border-b border-white/10" gap="4">
          <Flex align="center" gap="3">
            <img
              alt="Cubiora"
              className="h-10 w-10 rounded-lg object-contain shadow-sm"
              src="/cubiora-logo.svg"
            />
            <Box>
              <Flex align="center" gap="2.5">
                <Heading size="6" weight="bold" className="text-white tracking-tight">
                  Punto de Dispensación Central
                </Heading>
                <Badge size="1" color="cyan" variant="surface" className="font-mono">
                  SALA DE ESPERA
                </Badge>
              </Flex>
              <Text size="1" color="gray" className="text-white/60">
                Sistema de Llamado y Flujo Operativo de Turnos
              </Text>
            </Box>
          </Flex>

          <Flex align="center" gap="3">
            <Card variant="surface" size="1" className="px-4 py-2 border border-white/15">
              <Flex align="center" gap="2.5">
                <Clock className="w-5 h-5 text-[var(--teal-9)]" />
                <Text size="4" weight="bold" className="font-mono text-white tabular-nums">
                  {currentTimeString}
                </Text>
              </Flex>
            </Card>

            <IconButton
              size="3"
              variant="surface"
              color="gray"
              onClick={triggerChime}
              title="Probar señal sonora"
              className="cursor-pointer"
            >
              <Volume2 className="w-5 h-5 text-[var(--teal-9)]" />
            </IconButton>

            <IconButton
              size="3"
              variant="surface"
              color="gray"
              onClick={toggleFullscreen}
              title="Modo pantalla completa para televisor"
              className="cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </IconButton>
          </Flex>
        </Flex>

        {/* Broadcast Alert Ticker if active */}
        {broadcastAlertText && (
          <Callout.Root color="purple" variant="surface" size="2" className="my-3 animate-pulse border border-[var(--purple-8)]">
            <Callout.Icon>
              <Bell className="w-5 h-5 text-[var(--purple-9)]" />
            </Callout.Icon>
            <Callout.Text size="2" weight="bold" className="tracking-wide">
              AVISO A SALA: {broadcastAlertText}
            </Callout.Text>
          </Callout.Root>
        )}

        {/* Main Split Grid: High-Impact Calling Box (Left) + Upcoming Queue (Right) */}
        <Grid columns={{ initial: '1', lg: '12' }} gap="6" className="my-auto py-4">
          {/* Left: LLAMANDO AHORA (Iris Purple accent card) - 7 cols */}
          <Box className="lg:col-span-7">
            <Card
              size="4"
              variant="surface"
              className="h-full border-2 border-[var(--purple-9)] p-6 md:p-8 flex flex-col justify-between shadow-[0_0_50px_rgba(139,92,246,0.25)] relative overflow-hidden bg-[#0f2942]"
            >
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-[var(--purple-9)]/15 rounded-full blur-3xl pointer-events-none" />

              <Flex direction="column" justify="between" className="h-full gap-6">
                <Flex justify="between" align="center" className="pb-4 border-b border-white/15">
                  <Flex align="center" gap="3">
                    <span className="relative flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--purple-9)] opacity-90" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--purple-9)]" />
                    </span>
                    <Text size="3" weight="bold" className="uppercase tracking-widest text-[var(--purple-9)]">
                      Llamando Ahora a Ventanilla
                    </Text>
                  </Flex>
                  <Badge size="2" color="purple" variant="solid" className="font-mono font-bold tracking-wider">
                    PROYECCIÓN EN VIVO
                  </Badge>
                </Flex>

                {primaryCallingTicket ? (
                  <Flex direction="column" align="center" justify="center" gap="6" className="py-8 md:py-12 text-center">
                    <Text size="2" weight="bold" className="uppercase tracking-widest text-white/70">
                      Turno Convocado
                    </Text>

                    {/* Big Token Display */}
                    <Text
                      size="9"
                      weight="bold"
                      className="font-mono text-6xl md:text-8xl lg:text-9xl tracking-widest text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                    >
                      {primaryCallingTicket.id}
                    </Text>

                    <Badge size="2" color="cyan" variant="surface" className="font-mono font-bold">
                      PRIORIDAD {primaryCallingTicket.priority.toUpperCase()}
                    </Badge>

                    {/* Arrow to target cubicle */}
                    <Card
                      variant="surface"
                      className="w-full p-5 md:p-6 rounded-xl flex items-center justify-center gap-4 text-white shadow-xl bg-[var(--purple-9)] border-0"
                    >
                      <Flex align="center" justify="center" gap="4">
                        <ArrowRight className="w-8 h-8 md:w-10 md:h-10 animate-bounce text-white" />
                        <Heading size="7" weight="bold" className="text-white tracking-wide">
                          DIRÍJASE AL {primaryCallingCubicle?.name.toUpperCase() || 'CUBÍCULO 03'}
                        </Heading>
                      </Flex>
                    </Card>
                  </Flex>
                ) : (
                  <Flex direction="column" align="center" justify="center" gap="4" className="py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[var(--teal-9)]">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <Heading size="5" weight="bold" className="text-white">
                      Aguarde su turno en sala
                    </Heading>
                    <Text size="2" color="gray" className="max-w-sm text-white/60">
                      Los próximos turnos serán anunciados en esta pantalla por orden de llamado.
                    </Text>
                  </Flex>
                )}

                <Flex justify="between" align="center" className="pt-4 border-t border-white/15 text-xs text-white/60">
                  <Text size="1" color="gray">
                    Punto de Dispensación Central
                  </Text>
                  <Text size="1" color="gray">
                    Atención según orden de turno emitido
                  </Text>
                </Flex>
              </Flex>
            </Card>
          </Box>

          {/* Right: PRÓXIMOS TURNOS & VENTANILLAS ACTIVAS - 5 cols */}
          <Box className="lg:col-span-5">
            <Flex direction="column" gap="5">
              {/* Next in line */}
              <Card size="3" variant="surface" className="p-6 bg-[#0f2942] border border-white/15 shadow-md">
                <Flex direction="column" gap="4">
                  <Flex justify="between" align="center" className="pb-3 border-b border-white/15">
                    <Text size="3" weight="bold" className="uppercase tracking-wider text-white">
                      Próximos Turnos en Fila
                    </Text>
                    <Badge size="1" color="cyan" variant="soft" className="font-mono font-bold">
                      {waitingQueue.length} en espera
                    </Badge>
                  </Flex>

                  <Flex direction="column" gap="2.5">
                    {waitingQueue.length === 0 ? (
                      <Text size="2" color="gray" className="py-4 text-center text-white/50 block">
                        No hay turnos pendientes.
                      </Text>
                    ) : (
                      waitingQueue.slice(0, 5).map((w, index) => (
                        <Card
                          key={w.id}
                          variant="surface"
                          size="1"
                          className={`p-3 transition-colors ${
                            index === 0
                              ? 'bg-white/15 border-white/25'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <Flex justify="between" align="center">
                            <Flex align="center" gap="3">
                              <Badge
                                size="1"
                                radius="full"
                                color="gray"
                                variant="solid"
                                className="w-7 h-7 flex items-center justify-center font-mono font-bold"
                              >
                                {index + 1}
                              </Badge>
                              <Text size="4" weight="bold" className="font-mono text-white">
                                {w.id}
                              </Text>
                            </Flex>
                            <Badge size="1" color="cyan" variant="surface" className="font-mono font-bold uppercase">
                              {w.priority}
                            </Badge>
                          </Flex>
                        </Card>
                      ))
                    )}
                  </Flex>
                </Flex>
              </Card>

              {/* Currently at desk stations */}
              <Card size="3" variant="surface" className="p-6 bg-[#0f2942] border border-white/15 shadow-md">
                <Flex direction="column" gap="3">
                  <Text size="2" weight="bold" className="uppercase tracking-wider text-white/80 pb-2 border-b border-white/15">
                    Puestos en Atención Actual
                  </Text>

                  <Grid columns="2" gap="3">
                    {cubicles
                      .filter((c) => c.status !== 'inactive')
                      .map((c) => (
                        <Card key={c.id} variant="surface" size="1" className="p-3 bg-white/5 border border-white/10">
                          <Flex direction="column" gap="1.5">
                            <Flex justify="between" align="center">
                              <Text size="2" weight="bold" className="text-white">
                                {c.name}
                              </Text>
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  c.status === 'calling'
                                    ? 'bg-[var(--purple-9)]'
                                    : c.status === 'available'
                                    ? 'bg-[var(--teal-9)]'
                                    : 'bg-[var(--blue-9)]'
                                }`}
                              />
                            </Flex>
                            <Text size="2" weight="bold" className="font-mono text-[var(--teal-9)]">
                              {c.currentTicketId || 'Despejado'}
                            </Text>
                          </Flex>
                        </Card>
                      ))}
                  </Grid>
                </Flex>
              </Card>
            </Flex>
          </Box>
        </Grid>

        {/* Bottom ticker footer */}
        <Flex
          direction={{ initial: 'column', sm: 'row' }}
          justify="between"
          align="center"
          gap="2"
          className="pt-4 border-t border-white/10 text-xs text-white/60"
        >
          <Flex align="center" gap="2">
            <Building className="w-4 h-4 text-[var(--teal-9)]" />
            <Text size="1" color="gray">
              Servicio Central · Horario Operativo: 07:00 a 20:00 hs
            </Text>
          </Flex>
          <Text size="1" color="gray">
            Por favor aguarde a ser convocado para dirigirse al cubículo correspondiente
          </Text>
        </Flex>
      </Box>
    </Theme>
  );
};
