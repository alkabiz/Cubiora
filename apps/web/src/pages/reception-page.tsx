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
  Calculator,
  CheckCircle2,
  Copy,
  FileText,
  Heart,
  ReceiptText,
  ScanBarcode,
  User,
} from 'lucide-react';
import { AppMain } from '../app/app-main';
import { PageHeader } from '../app/page-header';
import { apiClient } from '../lib/api';
import { TicketStatus, QueueCategory } from '@cubiora/shared';

export interface IssuedTicket {
  code: string;
  timeStr: string;
  assignedCubicle?: string;
  state: TicketStatus | 'PENDING' | 'ASSIGNED' | 'CALLED';
  queueCategory?: QueueCategory | 'GENERAL' | 'PREFERENTIAL' | 'HIGH_COST' | 'BILLING';
  patientName?: string;
  idDocument?: string;
}

type RadixBadgeColor = 'gray' | 'amber' | 'red';

const QUEUE_CATEGORY_META: Record<
  QueueCategory,
  {
    label: string;
    shortLabel: string;
    cardColor: RadixBadgeColor;
    tableColor: RadixBadgeColor;
    badgeClassName: string;
  }
> = {
  [QueueCategory.GENERAL]: {
    label: 'Turno general',
    shortLabel: 'General',
    cardColor: 'gray',
    tableColor: 'gray',
    badgeClassName: '!bg-[#2c73d2]/12 !text-[#0f172a] !border !border-[#2c73d2] !shadow-none',
  },
  [QueueCategory.PREFERENTIAL]: {
    label: 'Atención preferencial',
    shortLabel: 'Preferencial',
    cardColor: 'gray',
    tableColor: 'gray',
    badgeClassName: '!bg-[#0081cf]/12 !text-[#0f172a] !border !border-[#0081cf] !shadow-none',
  },
  [QueueCategory.HIGH_COST]: {
    label: 'Alto Costo / MIPRES',
    shortLabel: 'Alto Costo',
    cardColor: 'gray',
    tableColor: 'gray',
    badgeClassName: '!bg-[#0089ba]/12 !text-[#0f172a] !border !border-[#0089ba] !shadow-none',
  },
  [QueueCategory.BILLING]: {
    label: 'Facturación y Copagos',
    shortLabel: 'Facturación',
    cardColor: 'gray',
    tableColor: 'gray',
    badgeClassName: '!bg-[#008e9b]/12 !text-[#0f172a] !border !border-[#008e9b] !shadow-none',
  },
};

const TICKET_STATE_META: Record<
  TicketStatus,
  { label: string; color: RadixBadgeColor; className?: string }
> = {
  [TicketStatus.PENDING]: { label: 'En espera', color: 'gray' },
  [TicketStatus.ASSIGNED]: {
    label: 'Asignado',
    color: 'gray',
    className: '!bg-[#0089ba]/12 !text-[#0f172a] !border !border-[#0089ba] !shadow-none',
  },
  [TicketStatus.CALLED]: {
    label: 'Llamado',
    color: 'gray',
    className: '!bg-[#008f7a]/12 !text-[#0f172a] !border !border-[#008f7a] !shadow-none',
  },
  [TicketStatus.IN_SERVICE]: {
    label: 'En atención',
    color: 'gray',
    className: '!bg-[#0081cf]/12 !text-[#0f172a] !border !border-[#0081cf] !shadow-none',
  },
  [TicketStatus.CLOSED]: {
    label: 'Cerrado',
    color: 'gray',
    className: '!bg-[#008f7a]/12 !text-[#0f172a] !border !border-[#008f7a] !shadow-none',
  },
  [TicketStatus.NO_SHOW]: { label: 'No presentado', color: 'amber' },
  [TicketStatus.CANCELLED]: { label: 'Cancelado', color: 'red' },
};

function getQueueCategoryMeta(category?: IssuedTicket['queueCategory']) {
  return (
    QUEUE_CATEGORY_META[(category ?? QueueCategory.GENERAL) as QueueCategory] ??
    QUEUE_CATEGORY_META[QueueCategory.GENERAL]
  );
}

function getTicketStateMeta(state: IssuedTicket['state']) {
  return (
    TICKET_STATE_META[state as TicketStatus] ?? {
      label: String(state),
      color: 'gray' as RadixBadgeColor,
      className: undefined,
    }
  );
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
  const [showKeypad, setShowKeypad] = useState(false);
  const [queueCategory, setQueueCategory] = useState<QueueCategory>(QueueCategory.GENERAL);
  const [operationalReason, setOperationalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<IssuedTicket | null>(null);
  const [recentTickets, setRecentTickets] = useState<IssuedTicket[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copyAnnouncement, setCopyAnnouncement] = useState('');
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

  const handleKeypadPress = (digit: string) => {
    setIdDocument((prev) => (prev.length < 15 ? prev + digit : prev));
  };

  const handleKeypadBackspace = () => {
    setIdDocument((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setIdDocument('');
  };

  const handleScanBarcodeDemo = () => {
    setIdDocument('1023456789');
  };

  const isNameValid = patientName.trim().length >= 2;
  const isReasonValid =
    queueCategory !== QueueCategory.PREFERENTIAL || !!operationalReason;
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
    setCopyAnnouncement(`Código ${lastTicket.code} copiado al portapapeles`);
    setTimeout(() => {
      setCopiedCode(false);
      setCopyAnnouncement('');
    }, 2000);
  };

  const handleClear = () => {
    if (isSubmitting) return;
    setPatientName('');
    setIdDocument('');
    setShowKeypad(false);
    setQueueCategory(QueueCategory.GENERAL);
    setOperationalReason('');
    setErrorMessage(null);
    nameInputRef.current?.focus();
  };

  return (
    <AppMain
      header={
        <PageHeader
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
            <Heading as="h2" size="4" weight="bold" className="mb-4">
              Datos del paciente
            </Heading>

            {errorMessage && (
              <Box className="p-3 mb-4 rounded-md bg-red-50 border border-red-200">
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
                  <Flex justify="between" align="center" className="mb-1.5 flex-wrap gap-1">
                    <label htmlFor="patientDocument" className="text-sm font-semibold text-[var(--gray-12)]">
                      Documento <Text size="1" color="gray" weight="regular">(Opcional)</Text>
                    </label>
                    <Flex gap="2" align="center" wrap="wrap">
                      <Button
                        type="button"
                        size="1"
                        variant="soft"
                        onClick={handleScanBarcodeDemo}
                        className="min-h-[44px] px-3 cursor-pointer text-xs"
                        title="Simular escaneo de código de barras PDF417 de cédula"
                      >
                        <ScanBarcode size={13} className="mr-1 inline" aria-hidden="true" />
                        Escanear Cédula / Código de Barras
                      </Button>
                      <Button
                        type="button"
                        size="1"
                        variant={showKeypad ? 'solid' : 'soft'}
                        color="gray"
                        aria-expanded={showKeypad}
                        aria-controls="touch-numeric-keypad"
                        onClick={() => setShowKeypad((prev) => !prev)}
                        className="min-h-[44px] px-3 cursor-pointer text-xs"
                        title="Mostrar teclado numérico táctil"
                      >
                        <Calculator size={13} className="mr-1 inline" aria-hidden="true" />
                        Teclado táctil
                      </Button>
                    </Flex>
                  </Flex>
                  <TextField.Root
                    id="patientDocument"
                    placeholder="Ej. 1023456789"
                    size="3"
                    value={idDocument}
                    disabled={isSubmitting}
                    onChange={(e) => setIdDocument(e.target.value)}
                  />

                  {/* Teclado numérico táctil desplegable para quiosco */}
                  {showKeypad && (
                    <Box
                      id="touch-numeric-keypad"
                      className="mt-3 p-3 bg-slate-50 border border-slate-500 rounded-xl shadow-xs"
                      data-testid="touch-numeric-keypad"
                    >
                      <Flex justify="between" align="center" className="mb-2">
                        <Text size="1" weight="bold" color="gray">
                          Teclado táctil en pantalla (Quiosco)
                        </Text>
                        <Button
                          type="button"
                          size="1"
                          variant="ghost"
                          color="gray"
                          onClick={() => setShowKeypad(false)}
                          className="min-h-[44px] px-3 cursor-pointer text-xs"
                        >
                          Ocultar
                        </Button>
                      </Flex>
                      <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => handleKeypadPress(digit)}
                            className="py-3 bg-white border border-slate-500 hover:bg-slate-100 active:scale-95 text-slate-900 font-bold text-lg rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2]"
                          >
                            {digit}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleKeypadClear}
                          className="py-3 bg-slate-100 border border-slate-500 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2]"
                        >
                          Limpiar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKeypadPress('0')}
                          className="py-3 bg-white border border-slate-500 hover:bg-slate-100 active:scale-95 text-slate-900 font-bold text-lg rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c73d2]"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={handleKeypadBackspace}
                          className="py-3 bg-red-50 border border-red-400 hover:bg-red-100 active:scale-95 text-red-800 font-semibold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                        >
                          Borrar
                        </button>
                      </div>
                    </Box>
                  )}
                </Box>

                {/* ─── Sección Tipo de Turno ───────────────────────────────── */}
                <Box className="pt-2 border-t border-[var(--gray-a4)]">
                  <span id="queue-category-label" className="block text-sm font-semibold mb-2 text-[var(--gray-12)]">
                    Tipo de turno
                  </span>
                  <RadioCards.Root
                    value={queueCategory}
                    onValueChange={(val) => {
                      setQueueCategory(val as QueueCategory);
                      if (val === QueueCategory.GENERAL) {
                        setOperationalReason('');
                      }
                    }}
                    columns={{ initial: '1', sm: '2' }}
                    gap="3"
                    aria-labelledby="queue-category-label"
                  >
                    <RadioCards.Item
                      value={QueueCategory.GENERAL}
                      className="cursor-pointer p-3.5 border border-[var(--gray-a6)] rounded-lg text-left"
                    >
                      <Flex direction="column" gap="1.5" width="100%">
                        <Flex align="center" gap="2">
                          <User size={18} className="text-[#2c73d2]" aria-hidden="true" />
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
                            <Heart size={18} className="text-[#0081cf]" aria-hidden="true" />
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

                    <RadioCards.Item
                      value={QueueCategory.HIGH_COST}
                      className="cursor-pointer p-3.5 border border-[var(--gray-a6)] rounded-lg text-left"
                    >
                      <Flex direction="column" gap="1.5" width="100%">
                        <Flex align="center" gap="2">
                          <FileText size={18} className="text-[#0089ba]" aria-hidden="true" />
                          <Text weight="bold" size="2">
                            Alto Costo / MIPRES
                          </Text>
                        </Flex>
                        <Text size="1" color="gray">
                          Medicamentos especializados, tutelas y no financiados por UPC.
                        </Text>
                      </Flex>
                    </RadioCards.Item>

                    <RadioCards.Item
                      value={QueueCategory.BILLING}
                      className="cursor-pointer p-3.5 border border-[var(--gray-a6)] rounded-lg text-left"
                    >
                      <Flex direction="column" gap="1.5" width="100%">
                        <Flex align="center" gap="2">
                          <ReceiptText size={18} className="text-[#008e9b]" />
                          <Text weight="bold" size="2">
                            Facturación y Copagos
                          </Text>
                        </Flex>
                        <Text size="1" color="gray">
                          Liquidación de cuotas moderadoras y trámites administrativos.
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
                    className="self-center min-h-[44px] px-4 cursor-pointer text-xs"
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
          {/* Región de estado para anuncios a lectores de pantalla montada de forma permanente (WCAG 4.1.3 Nivel AA) */}
          <div role="status" aria-live="polite" className="sr-only">
            {copyAnnouncement}
          </div>

          {/* Panel Último Turno Generado */}
          <Card size="3" className="p-6">
            <Flex justify="between" align="center" className="pb-3 mb-4 border-b border-[var(--gray-a4)]">
              <Text size="1" weight="bold" className="text-[#2c73d2] uppercase tracking-wider">
                Último turno generado
              </Text>
              {lastTicket && (() => {
                const categoryMeta = getQueueCategoryMeta(lastTicket.queueCategory);
                const stateMeta = getTicketStateMeta(lastTicket.state);
                return (
                  <Flex gap="2" align="center">
                    <Badge
                      size="1"
                      variant="soft"
                      color={categoryMeta.cardColor}
                      className={categoryMeta.badgeClassName}
                    >
                      {categoryMeta.label}
                    </Badge>
                    <Badge
                      size="1"
                      variant="soft"
                      color={stateMeta.color}
                      className={stateMeta.className}
                    >
                      {stateMeta.label}
                    </Badge>
                  </Flex>
                );
              })()}
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
                      variant="soft"
                      onClick={handleCopyCode}
                      className="min-h-[44px] cursor-pointer"
                      aria-label="Copiar número de turno"
                    >
                      {copiedCode ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : (
                        <Copy size={16} aria-hidden="true" />
                      )}
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
                  <Box className="p-3 rounded-md bg-[#0089ba]/12 border border-[#0089ba]">
                    <Text size="2" weight="bold" className="text-[#0f172a] block">
                      Cubículo asignado
                    </Text>
                    <Text size="1" color="gray">
                      Observe la pantalla de llamados
                    </Text>
                  </Box>
                )}

                {lastTicket.state === 'CALLED' && (
                  <Box className="p-3 rounded-md bg-[#008f7a]/12 border border-[#008f7a]">
                    <Text size="2" weight="bold" className="text-[#0f172a] block">
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
              <Heading as="h2" size="2" weight="bold" className="mb-3 uppercase tracking-wider text-[var(--gray-11)]">
                Últimos turnos generados (máximo 3)
              </Heading>
              <div className="overflow-x-auto">
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
                  {recentTickets.slice(0, 3).map((t, idx) => {
                    const categoryMeta = getQueueCategoryMeta(t.queueCategory);
                    const stateMeta = getTicketStateMeta(t.state);
                    return (
                      <Table.Row key={t.code + idx}>
                        <Table.RowHeaderCell className="font-mono font-bold">
                          <Flex align="center" gap="2">
                            <span>{t.code}</span>
                            <Badge
                              size="1"
                              variant="soft"
                              color={categoryMeta.tableColor}
                              className={categoryMeta.badgeClassName}
                            >
                              {categoryMeta.shortLabel}
                            </Badge>
                          </Flex>
                        </Table.RowHeaderCell>
                        <Table.Cell>{t.timeStr}</Table.Cell>
                        <Table.Cell>{t.assignedCubicle || 'Sin asignar'}</Table.Cell>
                        <Table.Cell>
                          <Badge
                            size="1"
                            variant="soft"
                            color={stateMeta.color}
                            className={stateMeta.className}
                          >
                            {stateMeta.label}
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppMain>
  );
};
