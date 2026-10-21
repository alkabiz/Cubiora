import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Heading,
  Text,
  TextField,
  Button,
  Badge,
  Flex,
  Box,
  Table,
} from '@radix-ui/themes';
import { CheckCircledIcon, CopyIcon, PersonIcon, ExitIcon } from '@radix-ui/react-icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { TicketStatus } from '@cubiora/shared';
import { useAuth } from '../context/auth-context';

export interface IssuedTicket {
  code: string;
  timeStr: string;
  assignedCubicle?: string;
  state: TicketStatus | 'PENDING' | 'ASSIGNED' | 'CALLED';
  patientName?: string;
  idDocument?: string;
}

export const ReceptionPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState('');
  const [idDocument, setIdDocument] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<IssuedTicket | null>(null);
  const [recentTickets, setRecentTickets] = useState<IssuedTicket[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();

    const fetchRecentTickets = async () => {
      try {
        const res = await apiClient<{
          success: boolean;
          data: Array<{
            publicCode: string;
            status: TicketStatus;
            cubicleDisplayName?: string;
            createdAt: string;
          }>;
        }>('/tickets/recent');

        if (res.data && res.data.length > 0) {
          const mapped: IssuedTicket[] = res.data.map((t) => {
            const createdAt = new Date(t.createdAt);
            const timeStr = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
            return {
              code: t.publicCode,
              timeStr,
              state: t.status,
              assignedCubicle: t.cubicleDisplayName,
            };
          });
          setRecentTickets(mapped);
          setLastTicket((prev) => prev || mapped[0]);
        }
      } catch {
        // Silencioso ante arranque inicial sin datos
      }
    };

    fetchRecentTickets();
  }, []);

  const isNameValid = patientName.trim().length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNameValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;

    const correlationId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-1111-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;

    try {
      // POST real a la API sin calcular códigos ni secuencias localmente
      const response = await apiClient<{
        success: boolean;
        data: {
          publicId: string;
          publicCode: string;
          sequenceNumber: number;
          patientName: string;
          status: TicketStatus;
          createdAt: string | Date;
        };
      }>('/tickets', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientDocument: idDocument.trim() || undefined,
        }),
      });

      const serverTicket = response.data;
      const createdAt = new Date(serverTicket.createdAt || Date.now());
      const timeStr = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;

      const newTicket: IssuedTicket = {
        code: serverTicket.publicCode,
        timeStr,
        state: serverTicket.status,
        assignedCubicle: undefined, // El backend asigna el cubículo, no inventar
        patientName: serverTicket.patientName,
      };

      setLastTicket(newTicket);
      setRecentTickets((prev) => [newTicket, ...prev].slice(0, 3));
      setPatientName('');
      setIdDocument('');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error de conexión con el servidor al emitir el turno.',
      );
    } finally {
      setIsSubmitting(false);
      nameInputRef.current?.focus();
    }
  };

  const handleCopyCode = () => {
    if (!lastTicket) return;
    navigator.clipboard?.writeText(lastTicket.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleClear = () => {
    if (isSubmitting) return;
    setPatientName('');
    setIdDocument('');
    setErrorMessage(null);
    nameInputRef.current?.focus();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* ─── Encabezado institucional de Recepción ─────────────────────── */}
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
              Recepción
            </Badge>
          </Flex>

          <Flex align="center" gap="3">
            <Flex align="center" gap="1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <Text size="1" color="gray" weight="medium">
                En línea
              </Text>
            </Flex>

            <Flex align="center" gap="1.5" className="px-2.5 py-1 rounded-md bg-[var(--gray-a3)]">
              <PersonIcon width={14} height={14} />
              <Text size="1" weight="medium">
                {user?.displayName || user?.username || 'recepcion'}
              </Text>
            </Flex>

            <Button
              id="btn-logout-reception"
              size="1"
              variant="ghost"
              color="gray"
              onClick={handleLogout}
              style={{ cursor: 'pointer' }}
            >
              <ExitIcon width={14} height={14} />
              Cerrar sesión
            </Button>
          </Flex>
        </Flex>
      </header>

      {/* ─── Contenido Principal: Dos Columnas ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario (5 columnas) */}
        <div className="lg:col-span-5">
          <Card size="3" className="p-6">
            <Heading size="4" weight="bold" className="mb-4">
              Generar turno
            </Heading>

            {errorMessage && (
              <Box className="p-3 mb-4 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <Text size="2" color="red" weight="medium">
                  {errorMessage}
                </Text>
              </Box>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <Flex direction="column" gap="4">
                {/* Nombre del paciente */}
                <Box>
                  <label htmlFor="patientName" className="block text-sm font-semibold mb-1.5 text-[var(--gray-12)]">
                    Nombre del paciente <span className="text-red-500">*</span>
                  </label>
                  <TextField.Root
                    ref={nameInputRef}
                    id="patientName"
                    placeholder="Ingrese nombre y apellido"
                    size="3"
                    value={patientName}
                    disabled={isSubmitting}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </Box>

                {/* Documento (Opcional) */}
                <Box>
                  <Flex justify="between" align="center" className="mb-1.5">
                    <label htmlFor="patientDocument" className="text-sm font-semibold text-[var(--gray-12)]">
                      Documento
                    </label>
                    <Text size="1" color="gray">
                      (Opcional)
                    </Text>
                  </Flex>
                  <TextField.Root
                    id="patientDocument"
                    placeholder="Ej. 1023456789"
                    size="3"
                    value={idDocument}
                    disabled={isSubmitting}
                    onChange={(e) => setIdDocument(e.target.value)}
                  />
                </Box>

                {/* Botón de envío principal */}
                <Button
                  id="btn-generar-turno"
                  type="submit"
                  size="3"
                  color="teal"
                  variant="solid"
                  disabled={!isNameValid || isSubmitting}
                  className="mt-2 w-full cursor-pointer"
                >
                  {isSubmitting ? 'Generando turno…' : 'Generar turno'}
                </Button>

                {/* Limpiar formulario */}
                {(patientName || idDocument) && !isSubmitting && (
                  <Button
                    type="button"
                    size="1"
                    variant="ghost"
                    color="gray"
                    onClick={handleClear}
                    className="self-center cursor-pointer text-xs"
                  >
                    Limpiar
                  </Button>
                )}
              </Flex>
            </form>
          </Card>
        </div>

        {/* Columna Derecha: Último Turno y Tabla (7 columnas) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Panel Último Turno Generado */}
          <Card size="3" className="p-6" role="status" aria-live="polite">
            <Flex justify="between" align="center" className="pb-3 mb-4 border-b border-[var(--gray-a4)]">
              <Text size="1" weight="bold" color="teal" className="uppercase tracking-wider">
                Último turno generado
              </Text>
              {lastTicket && (
                <Badge
                  size="1"
                  variant="surface"
                  color={
                    lastTicket.state === 'PENDING'
                      ? 'gray'
                      : lastTicket.state === 'ASSIGNED'
                      ? 'teal'
                      : 'green'
                  }
                >
                  {lastTicket.state === 'PENDING'
                    ? 'En espera'
                    : lastTicket.state === 'ASSIGNED'
                    ? 'Asignado'
                    : 'Llamado'}
                </Badge>
              )}
            </Flex>

            {!lastTicket ? (
              <Box className="py-8 text-center flex flex-col items-center justify-center gap-2">
                <Text size="2" color="gray">
                  Aún no has generado ningún turno en esta sesión.
                </Text>
              </Box>
            ) : (
              <Flex direction="column" gap="4">
                <Box className="p-4 rounded-lg bg-[var(--gray-a2)] border border-[var(--gray-a4)]">
                  <Flex justify="between" align="center" wrap="wrap" gap="2">
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
                        {lastTicket.code}
                      </Text>
                    </Box>

                    <Button
                      size="2"
                      variant="ghost"
                      color="teal"
                      onClick={handleCopyCode}
                      style={{ cursor: 'pointer' }}
                      aria-label="Copiar número de turno"
                    >
                      {copiedCode ? <CheckCircledIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
                      {copiedCode ? 'Número de turno copiado' : 'Copiar número de turno'}
                    </Button>
                  </Flex>
                </Box>

                {/* Mensaje contextual por estado */}
                {lastTicket.state === 'PENDING' && (
                  <Box className="p-3 rounded-md bg-[var(--gray-a3)]">
                    <Text size="2" weight="bold" className="block text-[var(--gray-12)]">
                      En espera de asignación
                    </Text>
                    <Text size="1" color="gray">
                      Observe la pantalla de llamados
                    </Text>
                  </Box>
                )}

                {lastTicket.state === 'ASSIGNED' && (
                  <Box className="p-3 rounded-md bg-[var(--teal-a3)]">
                    <Text size="2" weight="bold" color="teal" className="block">
                      Cubículo asignado
                    </Text>
                    <Text size="1" color="gray">
                      Observe la pantalla de llamados
                    </Text>
                  </Box>
                )}

                {lastTicket.state === 'CALLED' && (
                  <Box className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                    <Text size="2" weight="bold" className="text-emerald-800 dark:text-emerald-200 block">
                      Diríjase al {lastTicket.assignedCubicle || 'Cubículo 03'}
                    </Text>
                  </Box>
                )}
              </Flex>
            )}
          </Card>

          {/* Tabla de Últimos Turnos Generados (Máximo 3, SIN Columna Paciente) */}
          {recentTickets.length > 0 && (
            <Card size="2" className="p-4">
              <Heading size="2" weight="bold" className="mb-3 uppercase tracking-wider text-[var(--gray-11)]">
                Últimos turnos generados (máximo 3)
              </Heading>
              <Table.Root size="1">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Turno</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Hora</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Cubículo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Estado</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {recentTickets.slice(0, 3).map((t, idx) => (
                    <Table.Row key={t.code + idx}>
                      <Table.RowHeaderCell className="font-mono font-bold">
                        {t.code}
                      </Table.RowHeaderCell>
                      <Table.Cell>{t.timeStr}</Table.Cell>
                      <Table.Cell>{t.assignedCubicle || 'Sin asignar'}</Table.Cell>
                      <Table.Cell>
                        <Badge
                          size="1"
                          variant="surface"
                          color={
                            t.state === 'PENDING'
                              ? 'gray'
                              : t.state === 'ASSIGNED'
                              ? 'teal'
                              : 'green'
                          }
                        >
                          {t.state === 'PENDING'
                            ? 'En espera'
                            : t.state === 'ASSIGNED'
                            ? 'Asignado'
                            : 'Llamado'}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
          )}
        </div>
      </div>
    </Box>
  );
};
