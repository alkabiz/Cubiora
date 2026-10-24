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
  RadioCards,
  Select,
} from '@radix-ui/themes';
import {
  CheckCircledIcon,
  CopyIcon,
  PersonIcon,
  HeartIcon,
} from '@radix-ui/react-icons';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';
import { apiClient } from '../lib/api';
import { TicketStatus, QueueCategory } from '@cubiora/shared';

export interface IssuedTicket {
  code: string;
  timeStr: string;
  assignedCubicle?: string;
  state: TicketStatus | 'PENDING' | 'ASSIGNED' | 'CALLED';
  queueCategory?: QueueCategory | 'GENERAL' | 'PREFERENTIAL';
  patientName?: string;
  idDocument?: string;
}

export interface ReceptionPageProps {
  /**
   * Permite activar la política institucional para pruebas o configuración explícita.
   * Por defecto es falso según directiva PMV (Pendiente de habilitación institucional).
   */
  allowPreferentialPolicy?: boolean;
}

export const ReceptionPage: React.FC<ReceptionPageProps> = ({
  allowPreferentialPolicy = false,
}) => {
  const [patientName, setPatientName] = useState('');
  const [idDocument, setIdDocument] = useState('');
  const [queueCategory, setQueueCategory] = useState<QueueCategory>(QueueCategory.GENERAL);
  const [operationalReason, setOperationalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<IssuedTicket | null>(null);
  const [recentTickets, setRecentTickets] = useState<IssuedTicket[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPreferentialPolicyEnabled =
    allowPreferentialPolicy ||
    (typeof import.meta !== 'undefined' &&
      Boolean(import.meta.env?.['VITE_PREFERENTIAL_POLICY_ENABLED'] === 'true'));

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
            queueCategory?: QueueCategory;
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
              queueCategory: t.queueCategory || QueueCategory.GENERAL,
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
  const isReasonValid =
    queueCategory === QueueCategory.GENERAL ||
    (queueCategory === QueueCategory.PREFERENTIAL && !!operationalReason);
  const isFormValid = isNameValid && isReasonValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

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
      // POST real a la API enviando categoría operativa
      const response = await apiClient<{
        success: boolean;
        data: {
          publicId: string;
          publicCode: string;
          sequenceNumber: number;
          patientName: string;
          status: TicketStatus;
          queueCategory: QueueCategory;
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
          queueCategory,
          operationalReason:
            queueCategory === QueueCategory.PREFERENTIAL ? operationalReason : undefined,
        }),
      });

      const serverTicket = response.data;
      const createdAt = new Date(serverTicket.createdAt || Date.now());
      const timeStr = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;

      const newTicket: IssuedTicket = {
        code: serverTicket.publicCode,
        timeStr,
        state: serverTicket.status,
        queueCategory: serverTicket.queueCategory || queueCategory,
        assignedCubicle: undefined, // El backend asigna el cubículo
        patientName: serverTicket.patientName,
      };

      setLastTicket(newTicket);
      setRecentTickets((prev) => [newTicket, ...prev].slice(0, 3));
      setPatientName('');
      setIdDocument('');
      setQueueCategory(QueueCategory.GENERAL);
      setOperationalReason('');
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
    setQueueCategory(QueueCategory.GENERAL);
    setOperationalReason('');
    setErrorMessage(null);
    nameInputRef.current?.focus();
  };

  return (
    <AppMain
      header={
        <PageHeader
          code="SCR-REC-001"
          section="Recepción"
          title="Generar turno"
          description="Registra los datos mínimos del paciente para generar un turno."
        />
      }
    >
      {/* ─── Contenido Principal: Dos Columnas ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Formulario (5 columnas) */}
        <div className="lg:col-span-5">
          <Card size="3" className="p-6">
            <Heading size="4" weight="bold" className="mb-4">
              Datos del paciente
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

                {/* ─── Sección Tipo de Turno ───────────────────────────────── */}
                <Box className="pt-2 border-t border-[var(--gray-a4)]">
                  <label htmlFor="queue-category-group" className="block text-sm font-semibold mb-2 text-[var(--gray-12)]">
                    Tipo de turno
                  </label>
                  <RadioCards.Root
                    id="queue-category-group"
                    value={queueCategory}
                    onValueChange={(val) => {
                      setQueueCategory(val as QueueCategory);
                      if (val === QueueCategory.GENERAL) {
                        setOperationalReason('');
                      }
                    }}
                    columns={{ initial: '1', sm: '2' }}
                    gap="3"
                    aria-label="Tipo de turno"
                  >
                    <RadioCards.Item
                      value={QueueCategory.GENERAL}
                      className="cursor-pointer p-3.5 border border-[var(--gray-a6)] rounded-lg text-left"
                    >
                      <Flex direction="column" gap="1.5" width="100%">
                        <Flex align="center" gap="2">
                          <PersonIcon width={18} height={18} className="text-[var(--teal-10)]" />
                          <Text weight="bold" size="2">
                            Turno general
                          </Text>
                        </Flex>
                        <Text size="1" color="gray">
                          Atención según el orden de llegada.
                        </Text>
                      </Flex>
                    </RadioCards.Item>

                    <RadioCards.Item
                      value={QueueCategory.PREFERENTIAL}
                      disabled={!isPreferentialPolicyEnabled}
                      className="p-3.5 border border-[var(--gray-a6)] rounded-lg text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Flex direction="column" gap="1.5" width="100%">
                        <Flex align="center" justify="between" gap="2" wrap="wrap">
                          <Flex align="center" gap="2">
                            <HeartIcon width={18} height={18} className="text-[var(--amber-10)]" />
                            <Text weight="bold" size="2">
                              Atención preferencial
                            </Text>
                          </Flex>
                          {!isPreferentialPolicyEnabled && (
                            <Badge size="1" color="gray" variant="surface">
                              Pendiente de habilitación institucional
                            </Badge>
                          )}
                        </Flex>
                        <Text size="1" color="gray">
                          Disponible únicamente cuando exista un criterio institucional autorizado.
                        </Text>
                      </Flex>
                    </RadioCards.Item>
                  </RadioCards.Root>

                  {/* Motivo operacional cerrado cuando la política preferencial está habilitada */}
                  {isPreferentialPolicyEnabled && queueCategory === QueueCategory.PREFERENTIAL && (
                    <Box className="mt-3 p-3 rounded-md bg-[var(--gray-a2)] border border-[var(--gray-a4)]">
                      <label htmlFor="operationalReason" className="block text-xs font-semibold mb-1.5 text-[var(--gray-12)]">
                        Motivo operacional institucional <span className="text-red-500">*</span>
                      </label>
                      <Select.Root
                        value={operationalReason}
                        onValueChange={(val) => setOperationalReason(val)}
                      >
                        <Select.Trigger
                          id="operationalReason"
                          placeholder="Seleccione motivo operacional..."
                          className="w-full"
                        />
                        <Select.Content>
                          <Select.Item value="OPERATIONAL_MOBILITY_SUPPORT">
                            Asistencia de movilidad en sala
                          </Select.Item>
                          <Select.Item value="OPERATIONAL_INSTITUTIONAL_CRITERION">
                            Criterio institucional autorizado
                          </Select.Item>
                          <Select.Item value="OPERATIONAL_ESCORT_SUPPORT">
                            Acompañamiento prioritario institucional
                          </Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </Box>
                  )}
                </Box>

                {/* Botón de envío principal */}
                <Button
                  id="btn-generar-turno"
                  type="submit"
                  size="3"
                  color="teal"
                  variant="solid"
                  disabled={!isFormValid}
                  className="mt-2 w-full cursor-pointer"
                >
                  {isSubmitting ? 'Generando turno…' : 'Generar turno'}
                </Button>

                {/* Limpiar formulario */}
                {(patientName || idDocument || queueCategory !== QueueCategory.GENERAL) && !isSubmitting && (
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
                <Flex gap="2" align="center">
                  <Badge
                    size="1"
                    variant="surface"
                    color={lastTicket.queueCategory === QueueCategory.PREFERENTIAL ? 'amber' : 'blue'}
                  >
                    {lastTicket.queueCategory === QueueCategory.PREFERENTIAL
                      ? 'Atención preferencial'
                      : 'Turno general'}
                  </Badge>
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
                </Flex>
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
                        <Flex align="center" gap="2">
                          <span>{t.code}</span>
                          <Badge
                            size="1"
                            variant="soft"
                            color={t.queueCategory === QueueCategory.PREFERENTIAL ? 'amber' : 'gray'}
                          >
                            {t.queueCategory === QueueCategory.PREFERENTIAL ? 'Preferencial' : 'General'}
                          </Badge>
                        </Flex>
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
    </AppMain>
  );
};
