import React, { useState, useEffect } from 'react';
import {
  Card,
  Heading,
  Text,
  Button,
  Badge,
  Flex,
  Box,
  Callout,
} from '@radix-ui/themes';
import {
  PersonIcon,
  ExitIcon,
  PlayIcon,
  CheckIcon,
  ReloadIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';

export type CubicleState = 'AVAILABLE' | 'ASSIGNED' | 'CALLED' | 'IN_SERVICE';

export interface TicketDetail {
  code: string;
  patientName: string;
  documentId: string;
  assignedTime: string;
}

const INITIAL_TICKET: TicketDetail = {
  code: 'TUR-000124-C3',
  patientName: 'Carlos Pérez',
  documentId: 'C.C. 79.438.212',
  assignedTime: '10:24',
};

export const CashierPage: React.FC = () => {
  const [cubicleState, setCubicleState] = useState<CubicleState>('ASSIGNED');
  const [currentTicket, setCurrentTicket] = useState<TicketDetail | null>(INITIAL_TICKET);
  const [callTimer, setCallTimer] = useState(0);
  const [serviceTimer, setServiceTimer] = useState(0);
  const [isOnline] = useState(true);
  const [logoutWarning, setLogoutWarning] = useState<string | null>(null);

  // Cronómetro durante llamado
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (cubicleState === 'CALLED') {
      interval = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cubicleState]);

  // Cronómetro durante atención activa
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (cubicleState === 'IN_SERVICE') {
      interval = setInterval(() => {
        setServiceTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cubicleState]);

  const handleCallTurn = () => {
    setCallTimer(0);
    setCubicleState('CALLED');
    setLogoutWarning(null);
  };

  const handleRepeatCall = () => {
    setCallTimer(0);
  };

  const handleStartService = () => {
    setServiceTimer(0);
    setCubicleState('IN_SERVICE');
    setLogoutWarning(null);
  };

  const handleCloseTurn = () => {
    setCurrentTicket(null);
    setCubicleState('AVAILABLE');
    setLogoutWarning(null);
  };

  const handleNoShow = () => {
    setCurrentTicket(null);
    setCubicleState('AVAILABLE');
    setLogoutWarning(null);
  };

  const handleLogoutAttempt = () => {
    if (cubicleState === 'IN_SERVICE' || cubicleState === 'CALLED') {
      setLogoutWarning('Cierre de sesión bloqueado: debe finalizar o cancelar la atención activa antes de salir.');
    } else {
      setLogoutWarning('Sesión cerrada correctamente.');
    }
  };

  const formatSecs = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Box className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* ─── Encabezado institucional de Caja / Mi Cubículo ────────────── */}
      <header className="border-b border-[var(--gray-a4)] pb-4 mb-6">
        <Flex justify="between" align="center" wrap="wrap" gap="3">
          <Flex align="center" gap="3">
            <Badge size="2" variant="solid" color="teal" className="w-8 h-8 flex items-center justify-center font-bold">
              C
            </Badge>
            <Heading size="4" weight="bold">
              Cubiora
            </Heading>
            <Badge size="1" variant="surface" color="teal">
              Mi cubículo
            </Badge>
          </Flex>

          <Flex align="center" gap="3">
            <Flex align="center" gap="1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${
                  isOnline ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <Text size="1" color="gray" weight="medium">
                {isOnline ? 'En línea' : 'Sin conexión'}
              </Text>
            </Flex>

            <Flex align="center" gap="1.5" className="px-2.5 py-1 rounded-md bg-[var(--gray-a3)]">
              <PersonIcon width={14} height={14} />
              <Text size="1" weight="medium">
                Usuario
              </Text>
            </Flex>

            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={handleLogoutAttempt}
              style={{ cursor: 'pointer' }}
            >
              <ExitIcon width={14} height={14} />
              Cerrar sesión
            </Button>
          </Flex>
        </Flex>

        {logoutWarning && (
          <Callout.Root color="amber" size="1" className="mt-3">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{logoutWarning}</Callout.Text>
          </Callout.Root>
        )}
      </header>

      {/* ─── Tarjeta Principal de Mi Cubículo ──────────────────────────── */}
      <Card size="3" className="p-6">
        <Flex justify="between" align="center" className="pb-4 mb-6 border-b border-[var(--gray-a4)]" wrap="wrap" gap="3">
          <Box>
            <Text size="1" color="gray" className="uppercase tracking-wider font-semibold block">
              Mi cubículo
            </Text>
            <Heading size="6" weight="bold">
              Cubículo 03
            </Heading>
          </Box>

          <Badge
            size="2"
            variant="solid"
            color={
              cubicleState === 'AVAILABLE'
                ? 'gray'
                : cubicleState === 'ASSIGNED'
                ? 'teal'
                : cubicleState === 'CALLED'
                ? 'amber'
                : 'green'
            }
          >
            {cubicleState === 'AVAILABLE'
              ? 'Disponible'
              : cubicleState === 'ASSIGNED'
              ? 'Asignado'
              : cubicleState === 'CALLED'
              ? 'Llamando'
              : 'En atención'}
          </Badge>
        </Flex>

        {/* ─── Estado: AVAILABLE (Disponible sin acción principal) ──────── */}
        {cubicleState === 'AVAILABLE' && (
          <Box className="py-12 text-center flex flex-col items-center justify-center gap-3">
            <Badge size="3" variant="surface" color="gray" className="px-4 py-2">
              Esperando asignación automática de paciente...
            </Badge>
            <Text size="2" color="gray">
              El sistema asignará el siguiente turno de la cola FIFO a este cubículo.
            </Text>
            {/* Opción para simular siguiente turno en entorno PMV */}
            <Button
              size="2"
              variant="soft"
              color="teal"
              className="mt-4 cursor-pointer"
              onClick={() => {
                setCurrentTicket({
                  code: 'TUR-000125-D4',
                  patientName: 'María Ortiz',
                  documentId: 'C.C. 52.891.442',
                  assignedTime: '10:29',
                });
                setCubicleState('ASSIGNED');
              }}
            >
              Simular asignación de turno
            </Button>
          </Box>
        )}

        {/* ─── Estado: ASSIGNED, CALLED o IN_SERVICE ────────────────────── */}
        {currentTicket && cubicleState !== 'AVAILABLE' && (
          <Flex direction="column" gap="5">
            {/* Panel de datos del turno y paciente */}
            <Box className="p-5 rounded-xl bg-[var(--gray-a2)] border border-[var(--gray-a4)]">
              <Flex justify="between" align="start" wrap="wrap" gap="4">
                <Box>
                  <Text size="1" color="gray" className="uppercase tracking-wider font-semibold block">
                    Número de turno
                  </Text>
                  <Text
                    size="8"
                    weight="bold"
                    className="font-mono mt-1 block"
                    style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
                  >
                    {currentTicket.code}
                  </Text>
                  <Text size="1" color="gray" className="mt-2 block">
                    Asignado a las {currentTicket.assignedTime}
                  </Text>
                </Box>

                <Box className="text-right sm:text-left">
                  <Text size="1" color="gray" className="uppercase tracking-wider font-semibold block">
                    Paciente actual
                  </Text>
                  <Text size="4" weight="bold" className="mt-1 block">
                    {currentTicket.patientName}
                  </Text>
                  <Text size="2" color="gray" className="block">
                    {currentTicket.documentId}
                  </Text>
                </Box>
              </Flex>

              {/* Cronómetros visuales */}
              {cubicleState === 'CALLED' && (
                <Box className="mt-4 pt-3 border-t border-[var(--gray-a4)]">
                  <Flex align="center" gap="2">
                    <ReloadIcon className="animate-spin text-amber-600" />
                    <Text size="2" weight="bold" color="amber">
                      Llamando al paciente · Tiempo en espera: {formatSecs(callTimer)}
                    </Text>
                  </Flex>
                </Box>
              )}

              {cubicleState === 'IN_SERVICE' && (
                <Box className="mt-4 pt-3 border-t border-[var(--gray-a4)]">
                  <Flex align="center" gap="2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Text size="2" weight="bold" color="green">
                      Atención en curso · Tiempo transcurrido: {formatSecs(serviceTimer)}
                    </Text>
                  </Flex>
                </Box>
              )}
            </Box>

            {/* ─── Barra de Acciones según el estado del turno ───────────── */}
            <Box className="pt-2">
              {cubicleState === 'ASSIGNED' && (
                <Button
                  id="btn-llamar-turno"
                  size="3"
                  color="teal"
                  variant="solid"
                  onClick={handleCallTurn}
                  disabled={!isOnline}
                  className="w-full cursor-pointer font-bold"
                >
                  <PlayIcon width={16} height={16} />
                  Llamar turno
                </Button>
              )}

              {cubicleState === 'CALLED' && (
                <Flex direction={{ initial: 'column', sm: 'row' }} gap="3">
                  <Button
                    id="btn-iniciar-atencion"
                    size="3"
                    color="teal"
                    variant="solid"
                    onClick={handleStartService}
                    disabled={!isOnline}
                    className="flex-1 cursor-pointer font-bold"
                  >
                    <PlayIcon width={16} height={16} />
                    Iniciar atención
                  </Button>

                  <Button
                    id="btn-repetir-llamado"
                    size="3"
                    color="teal"
                    variant="surface"
                    onClick={handleRepeatCall}
                    disabled={!isOnline}
                    className="cursor-pointer"
                  >
                    <ReloadIcon width={16} height={16} />
                    Repetir llamado
                  </Button>

                  <Button
                    id="btn-no-presentado"
                    size="3"
                    color="ruby"
                    variant="soft"
                    onClick={handleNoShow}
                    disabled={!isOnline}
                    className="cursor-pointer"
                  >
                    <Cross2Icon width={16} height={16} />
                    Paciente no presentado
                  </Button>
                </Flex>
              )}

              {cubicleState === 'IN_SERVICE' && (
                <Button
                  id="btn-cerrar-turno"
                  size="3"
                  color="green"
                  variant="solid"
                  onClick={handleCloseTurn}
                  disabled={!isOnline}
                  className="w-full cursor-pointer font-bold"
                >
                  <CheckIcon width={16} height={16} />
                  Cerrar turno
                </Button>
              )}
            </Box>
          </Flex>
        )}
      </Card>
    </Box>
  );
};
