import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Heading,
  Text,
  Button,
  Badge,
  Flex,
  Box,
  Callout,
  Dialog,
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
import { apiClient, ApiClientError } from '../lib/api';
import { CubicleSnapshot, TicketStatus } from '@cubiora/shared';

export type CubicleState = 'AVAILABLE' | 'ASSIGNED' | 'CALLED' | 'IN_SERVICE';

export interface ActiveTicketModel {
  id: string;
  publicId: string;
  code: string;
  patientName: string;
  assignedTime: string;
  status: TicketStatus;
  version: number;
  callNumber: number;
}

export const CashierPage: React.FC = () => {
  const [cubicleCode] = useState('CUB-03');
  const [cubicleDisplayName, setCubicleDisplayName] = useState('Cubículo 03');
  const [cubicleState, setCubicleState] = useState<CubicleState>('AVAILABLE');
  const [currentTicket, setCurrentTicket] = useState<ActiveTicketModel | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [serviceTimer, setServiceTimer] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // Función para sincronizar con la API real el snapshot de cubículo
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: CubicleSnapshot }>(
        `/cubicles/${cubicleCode}/current`,
      );
      const snapshot = res.data;
      setCubicleDisplayName(snapshot.cubicle.displayName || 'Cubículo 03');
      setIsOnline(true);

      if (snapshot.activeTicket) {
        const ticket = snapshot.activeTicket;
        const assignedDate = ticket.assignedAt ? new Date(ticket.assignedAt) : new Date();
        const timeStr = `${String(assignedDate.getHours()).padStart(2, '0')}:${String(assignedDate.getMinutes()).padStart(2, '0')}`;

        setCurrentTicket({
          id: ticket.id,
          publicId: ticket.publicId,
          code: ticket.publicCode,
          patientName: ticket.patientName,
          assignedTime: timeStr,
          status: ticket.status,
          version: ticket.version,
          callNumber: ticket.callNumber,
        });

        if (ticket.status === TicketStatus.ASSIGNED) {
          setCubicleState('ASSIGNED');
        } else if (ticket.status === TicketStatus.CALLED) {
          setCubicleState('CALLED');
        } else if (ticket.status === TicketStatus.IN_SERVICE) {
          setCubicleState('IN_SERVICE');
        }
      } else {
        setCurrentTicket(null);
        setCubicleState('AVAILABLE');
      }
    } catch {
      setIsOnline(false);
    }
  }, [cubicleCode]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

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

  const applySnapshotData = (snapshot: CubicleSnapshot) => {
    if (snapshot.activeTicket) {
      const ticket = snapshot.activeTicket;
      const assignedDate = ticket.assignedAt ? new Date(ticket.assignedAt) : new Date();
      const timeStr = `${String(assignedDate.getHours()).padStart(2, '0')}:${String(assignedDate.getMinutes()).padStart(2, '0')}`;

      setCurrentTicket({
        id: ticket.id,
        publicId: ticket.publicId,
        code: ticket.publicCode,
        patientName: ticket.patientName,
        assignedTime: timeStr,
        status: ticket.status,
        version: ticket.version,
        callNumber: ticket.callNumber,
      });

      if (ticket.status === TicketStatus.ASSIGNED) {
        setCubicleState('ASSIGNED');
      } else if (ticket.status === TicketStatus.CALLED) {
        setCubicleState('CALLED');
      } else if (ticket.status === TicketStatus.IN_SERVICE) {
        setCubicleState('IN_SERVICE');
      }
    } else {
      setCurrentTicket(null);
      setCubicleState('AVAILABLE');
    }
  };

  const handleCommand = async (command: 'call' | 'start-service' | 'close' | 'no-show') => {
    if (!currentTicket || isActionPending) return;

    setIsActionPending(true);
    setConflictMessage(null);

    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-2222-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
    const correlationId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-3333-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;

    try {
      const res = await apiClient<{ success: boolean; data: CubicleSnapshot }>(
        `/tickets/${currentTicket.id}/${command}`,
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKey,
            'expected-version': String(currentTicket.version),
            'X-Correlation-ID': correlationId,
          },
          body: JSON.stringify({
            expectedVersion: currentTicket.version,
          }),
        },
      );

      // Renderizar el resultado confirmado del servidor
      applySnapshotData(res.data);
      if (command === 'call') {
        setCallTimer(0);
      } else if (command === 'start-service') {
        setServiceTimer(0);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        setConflictMessage(
          'El estado del turno fue actualizado por otro operador o proceso concurrente. Se ha sincronizado el cubículo con el estado vigente.',
        );
        await fetchSnapshot();
      } else if (err instanceof Error) {
        setConflictMessage(err.message);
      } else {
        setConflictMessage('Error al ejecutar el comando en el servidor.');
      }
    } finally {
      setIsActionPending(false);
    }
  };

  const handleLogoutClick = () => {
    // Bloquear cierre de sesión en ASSIGNED, CALLED, IN_SERVICE
    if (
      currentTicket !== null &&
      (cubicleState === 'ASSIGNED' || cubicleState === 'CALLED' || cubicleState === 'IN_SERVICE')
    ) {
      setLogoutModalOpen(true);
      return;
    }

    // Permitido únicamente en AVAILABLE o sin turno activo
    window.location.href = '/login';
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
              id="btn-logout-cashier"
              size="1"
              variant="ghost"
              color="gray"
              onClick={handleLogoutClick}
              style={{ cursor: 'pointer' }}
            >
              <ExitIcon width={14} height={14} />
              Cerrar sesión
            </Button>
          </Flex>
        </Flex>

        {conflictMessage && (
          <Callout.Root color="amber" size="1" className="mt-3">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{conflictMessage}</Callout.Text>
          </Callout.Root>
        )}
      </header>

      {/* ─── Modal Bloqueo de Cierre de Sesión en Turno Activo ──────────── */}
      <Dialog.Root open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <Dialog.Content size="2" style={{ maxWidth: 450 }}>
          <Dialog.Title>Turno activo en progreso</Dialog.Title>
          <Dialog.Description size="2" className="my-3 text-[var(--gray-11)]">
            No puedes cerrar sesión durante un turno activo. Finaliza la atención antes de salir.
          </Dialog.Description>

          <Flex justify="end" mt="4">
            <Button
              size="2"
              color="teal"
              variant="solid"
              onClick={() => setLogoutModalOpen(false)}
              style={{ cursor: 'pointer' }}
            >
              Volver al turno
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* ─── Tarjeta Principal de Mi Cubículo ──────────────────────────── */}
      <Card size="3" className="p-6">
        <Flex justify="between" align="center" className="pb-4 mb-6 border-b border-[var(--gray-a4)]" wrap="wrap" gap="3">
          <Box>
            <Text size="1" color="gray" className="uppercase tracking-wider font-semibold block">
              Mi cubículo
            </Text>
            <Heading size="6" weight="bold">
              {cubicleDisplayName}
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

        {/* Estado 1: AVAILABLE */}
        {cubicleState === 'AVAILABLE' && (
          <Box className="py-12 text-center flex flex-col items-center justify-center gap-2">
            <Text size="3" color="gray" weight="medium">
              Cubículo disponible. Esperando asignación de turno...
            </Text>
          </Box>
        )}

        {/* Estado 2: ASSIGNED */}
        {cubicleState === 'ASSIGNED' && currentTicket && (
          <Flex direction="column" gap="5">
            <Box className="p-4 rounded-lg bg-[var(--gray-a2)] border border-[var(--gray-a4)]">
              <Text size="1" color="gray" className="uppercase tracking-wider font-semibold block mb-1">
                Turno asignado
              </Text>
              <Text
                size="8"
                weight="bold"
                className="font-mono"
                style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
              >
                {currentTicket.code}
              </Text>

              <Flex gap="4" mt="3" wrap="wrap" align="center">
                <Text size="2" weight="medium" className="text-[var(--gray-12)]">
                  Paciente: <span className="font-semibold">{currentTicket.patientName}</span>
                </Text>
                <Text size="2" color="gray">
                  Hora: {currentTicket.assignedTime}
                </Text>
              </Flex>
            </Box>

            <Flex justify="end">
              <Button
                id="btn-llamar-turno"
                size="3"
                color="teal"
                variant="solid"
                disabled={isActionPending}
                onClick={() => handleCommand('call')}
                className="cursor-pointer px-6"
              >
                <PlayIcon width={16} height={16} />
                Llamar turno
              </Button>
            </Flex>
          </Flex>
        )}

        {/* Estado 3: CALLED */}
        {cubicleState === 'CALLED' && currentTicket && (
          <Flex direction="column" gap="5">
            <Box className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <Flex justify="between" align="start" wrap="wrap" gap="2">
                <Box>
                  <Text size="1" color="amber" className="uppercase tracking-wider font-semibold block mb-1">
                    Turno en llamado {currentTicket.callNumber > 1 && `(Llamado #${currentTicket.callNumber})`}
                  </Text>
                  <Text
                    size="8"
                    weight="bold"
                    className="font-mono text-amber-900 dark:text-amber-200"
                    style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
                  >
                    {currentTicket.code}
                  </Text>
                  <Text size="2" className="mt-2 text-amber-800 dark:text-amber-300 font-medium">
                    Paciente: {currentTicket.patientName}
                  </Text>
                </Box>

                <Box className="text-right">
                  <Text size="1" color="gray" className="block">
                    Tiempo de espera
                  </Text>
                  <Text size="5" weight="bold" className="font-mono text-amber-900 dark:text-amber-200">
                    {formatSecs(callTimer)}
                  </Text>
                </Box>
              </Flex>
            </Box>

            <Flex justify="between" align="center" wrap="wrap" gap="3">
              <Flex gap="2">
                <Button
                  id="btn-repetir-llamado"
                  size="2"
                  variant="surface"
                  color="amber"
                  disabled={isActionPending}
                  onClick={() => handleCommand('call')}
                  className="cursor-pointer"
                >
                  <ReloadIcon width={14} height={14} />
                  Repetir llamado
                </Button>

                <Button
                  id="btn-no-show"
                  size="2"
                  variant="soft"
                  color="red"
                  disabled={isActionPending}
                  onClick={() => handleCommand('no-show')}
                  className="cursor-pointer"
                >
                  <Cross2Icon width={14} height={14} />
                  Paciente no presentado
                </Button>
              </Flex>

              <Button
                id="btn-iniciar-atencion"
                size="3"
                color="teal"
                variant="solid"
                disabled={isActionPending}
                onClick={() => handleCommand('start-service')}
                className="cursor-pointer px-6"
              >
                <CheckIcon width={16} height={16} />
                Iniciar atención
              </Button>
            </Flex>
          </Flex>
        )}

        {/* Estado 4: IN_SERVICE */}
        {cubicleState === 'IN_SERVICE' && currentTicket && (
          <Flex direction="column" gap="5">
            <Box className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <Flex justify="between" align="start" wrap="wrap" gap="2">
                <Box>
                  <Text size="1" color="green" className="uppercase tracking-wider font-semibold block mb-1">
                    Atención en curso
                  </Text>
                  <Text
                    size="8"
                    weight="bold"
                    className="font-mono text-emerald-900 dark:text-emerald-200"
                    style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
                  >
                    {currentTicket.code}
                  </Text>
                  <Text size="2" className="mt-2 text-emerald-800 dark:text-emerald-300 font-medium">
                    Paciente: {currentTicket.patientName}
                  </Text>
                </Box>

                <Box className="text-right">
                  <Text size="1" color="gray" className="block">
                    Tiempo de atención
                  </Text>
                  <Text size="5" weight="bold" className="font-mono text-emerald-900 dark:text-emerald-200">
                    {formatSecs(serviceTimer)}
                  </Text>
                </Box>
              </Flex>
            </Box>

            <Flex justify="end">
              <Button
                id="btn-cerrar-turno"
                size="3"
                color="green"
                variant="solid"
                disabled={isActionPending}
                onClick={() => handleCommand('close')}
                className="cursor-pointer px-6"
              >
                <CheckIcon width={16} height={16} />
                Cerrar turno
              </Button>
            </Flex>
          </Flex>
        )}
      </Card>
    </Box>
  );
};
