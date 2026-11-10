/**
 * Tipos públicos compartidos entre api y web.
 *
 * REGLA DE PRIVACIDAD: Este archivo NUNCA debe exponer patientName
 * ni patientDocument. Estos campos son datos personales sensibles
 * y solo existen en el backend, nunca en tipos públicos.
 */

/**
 * Información de un llamado visible en la pantalla pública.
 * No contiene datos personales del paciente.
 * @see RF-005 — Pantalla Pública de Llamados
 * @see apps/web/src/features/display
 */
import {
  CubicleStatus,
  TicketStatus,
  QueueCategory,
  DispensationResolution,
  FacilityStatus,
  PharmacistOperationalRole,
  WorkShift,
  PharmacistStatus,
} from './enums.js';

export interface PublicCall {
  /** Código único del turno en formato TUR-XXXXXX-YY (ej: TUR-000123-A7) */
  publicCode: string;
  /** Nombre descriptivo del cubículo (ej: "Cubículo 03", "Cubículo 1") */
  cubicleDisplayName: string;
  /** Timestamp ISO 8601 del momento del llamado */
  calledAt: string;
  /** Número secuencial de llamado (1 = primer llamado, 2 = segundo, etc.) */
  callNumber: number;
}

/**
 * Snapshot del estado de la pantalla pública.
 * Cero PII: no contiene nombres de pacientes ni documentos.
 */
export interface PublicDisplaySnapshot {
  currentCall: PublicCall | null;
  recentCalls: PublicCall[];
}

/**
 * Evento emitido a través de SSE hacia la pantalla pública.
 */
export interface PublicDisplayEvent {
  type: 'ticket.called' | 'ticket.recalled';
  data: PublicCall;
}

/**
 * Información de turno activo en un cubículo (para operador de caja).
 */
export interface CubicleActiveTicket {
  id: string;
  publicId: string;
  publicCode: string;
  patientName: string;
  /**
   * Documento del paciente ya enmascarado por el backend.
   * El documento completo nunca sale del servidor.
   */
  maskedDocument?: string | null;
  status: TicketStatus;
  queueCategory?: QueueCategory;
  version: number;
  assignedAt?: string | null;
  calledAt?: string | null;
  serviceStartedAt?: string | null;
  callNumber: number;
}

/**
 * Snapshot del estado de un cubículo específico devuelto por GET /cubicles/:code/current
 */
export interface CubicleSnapshot {
  cubicle: {
    id: string;
    code: string;
    displayName: string;
    status: CubicleStatus;
    version: number;
  };
  activeTicket: CubicleActiveTicket | null;
  /** Pacientes pendientes de asignación al momento de construir el snapshot. */
  waitingCount: number;
  /** Hora del servidor usada como referencia para cronómetros y offsets de reloj. */
  serverTime: string;
}

/**
 * Rendimiento diario de un cubículo.
 * Se calcula exclusivamente con turnos CLOSED de la jornada actual.
 * No contiene datos personales de pacientes.
 */
export interface CubicleDailyPerformance {
  /** Código del cubículo consultado. */
  cubicleCode: string;
  /** Total de turnos CLOSED del cubículo durante la jornada actual. */
  completedTickets: number;
  /** Promedio de serviceStartedAt → closedAt en segundos; null si no hay datos. */
  averageServiceSeconds: number | null;
  /** Objetivo operativo configurado en backend, en segundos. */
  targetSeconds: number;
  /**
   * Porcentaje de turnos cerrados cuya duración fue ≤ targetSeconds.
   * null si no hay turnos cerrados con marcas de tiempo válidas.
   */
  targetCompliancePercentage: number | null;
  /** Timestamp ISO 8601 generado por el servidor al calcular la respuesta. */
  calculatedAt: string;
}

/**
 * Formato estándar de error devuelto por la API.
 * @see apps/api/src/common/filters/global-exception.filter.ts
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
}

/**
 * Respuesta envuelta estándar de la API para operaciones exitosas.
 */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Petición para actualizar el operador de un cubículo.
 * Campo vacío '' borra el operador asignado.
 * @see PATCH /api/v1/cubicles/:id/operator
 */
export interface UpdateCubicleOperatorRequest {
  operatorName: string;
  pharmacistId?: string | null | undefined;
}

/**
 * Respuesta al actualizar el operador de un cubículo.
 * @see PATCH /api/v1/cubicles/:id/operator
 */
export interface UpdateCubicleOperatorResponse {
  id: string;
  operatorName: string | null;
  pharmacistId?: string | null | undefined;
}

/**
 * Registro de dispensación farmacéutica y trazabilidad de pendientes 48h.
 */
export interface DispensationRecordDto {
  id: string;
  ticketId: string;
  cubicleId: string;
  operatorUserId: string;
  resolution: DispensationResolution;
  prescriptionCode?: string | null;
  mipresNumber?: string | null;
  itemsDeliveredCount: number;
  itemsPendingCount: number;
  pendingDetailsJson?: unknown | null;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  deliveryDeadline?: string | null;
  createdAt: string;
}

/**
 * Payload para el cierre de turno en ventanilla del dispensador.
 * @see POST /api/v1/tickets/:publicId/close
 */
export interface CloseTicketRequest {
  expectedVersion?: number;
  resolution?: DispensationResolution;
  prescriptionCode?: string;
  mipresNumber?: string;
  itemsDeliveredCount?: number;
  itemsPendingCount?: number;
  pendingDetailsJson?: unknown;
  deliveryAddress?: string;
  deliveryPhone?: string;
}

/**
 * Registro de turno en el historial operativo y de auditoría diaria.
 * @see GET /api/v1/tickets/history
 */
export interface TicketHistoryItem {
  id: string;
  publicId: string;
  publicCode: string;
  patientName: string;
  maskedDocument?: string | null;
  status: TicketStatus;
  queueCategory: QueueCategory;
  assignedStation: string;
  cubicleCode: string;
  operatorName: string;
  serviceDurationSeconds: number;
  waitingDurationSeconds: number;
  slaCompliant: boolean;
  createdAt: string;
  calledAt?: string | null;
  serviceStartedAt?: string | null;
  closedAt?: string | null;
  dispensation?: DispensationRecordDto | null;
}

/**
 * Respuesta paginada de auditoría histórica.
 * @see GET /api/v1/tickets/history
 */
export interface TicketHistoryResponse {
  items: TicketHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── [SCR-ADM-004] & [SCR-ADM-005] Contratos de Sedes y Farmacéuticos ────────

/**
 * Resumen de ventanilla física / cubículo perteneciente a una sede.
 * @see [SCR-ADM-005] Gestión de Sedes y Usuarios Asociados
 */
export interface FacilityCubicleSummaryDto {
  id: string;
  code: string;
  shortCode: string;
  displayName: string;
  status: CubicleStatus;
  active: boolean;
  operatorName: string | null;
  assignedPharmacistId?: string | null | undefined;
}

/**
 * Resumen de profesional farmacéutico asociado a una sede hospitalaria.
 * @see [SCR-ADM-005] Gestión de Sedes y Usuarios Asociados
 */
export interface FacilityAssignedPharmacistSummaryDto {
  id: string;
  fullName: string;
  licenseNumber: string;
  operationalRole: PharmacistOperationalRole;
  shift: WorkShift;
  status: PharmacistStatus;
  defaultCubicleId: string | null;
  defaultCubicleName: string | null;
}

/**
 * Contrato completo de una sede o punto de dispensación.
 * @see GET /api/v1/admin/facilities
 */
export interface FacilityDto {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  openingHours: string;
  enabledCubiclesCount: number;
  status: FacilityStatus;
  isPrimary: boolean;
  cubiclesCount: number;
  pharmacistsCount: number;
  cubicles: FacilityCubicleSummaryDto[];
  pharmacists: FacilityAssignedPharmacistSummaryDto[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

/**
 * Perfil completo de un profesional farmacéutico registrado.
 * @see GET /api/v1/admin/pharmacists
 */
export interface PharmacistDto {
  id: string;
  userId: string | null;
  fullName: string;
  licenseNumber: string;
  operationalRole: PharmacistOperationalRole;
  facilityId: string | null;
  facilityName: string | null;
  facilityCode: string | null;
  defaultCubicleId: string | null;
  defaultCubicleName: string | null;
  shift: WorkShift;
  status: PharmacistStatus;
  email: string;
  phone: string;
  dispatchesCount: number;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

/**
 * Resumen KPI de personal farmacéutico registrado para [SCR-ADM-004].
 */
export interface PharmacistMetricsSummaryDto {
  totalRegistered: number;
  activeToday: number;
  onLeaveCount: number;
  totalDispatches: number;
  averageServiceMinutes: number;
  assignedFacilitiesCount: number;
}

/**
 * Respuesta combinada de listado y métricas para GET /api/v1/admin/pharmacists.
 */
export interface PharmacistsListResponseDto {
  items: PharmacistDto[];
  metrics: PharmacistMetricsSummaryDto;
}

/**
 * DTO para registrar un nuevo farmacéutico.
 * @see POST /api/v1/admin/pharmacists
 */
export interface CreatePharmacistDto {
  fullName: string;
  licenseNumber: string;
  operationalRole: PharmacistOperationalRole;
  facilityId?: string | null | undefined;
  cubicleId?: string | null | undefined;
  defaultCubicleId?: string | null | undefined;
  shift: WorkShift;
  status?: PharmacistStatus | undefined;
  email: string;
  phone: string;
  userId?: string | null | undefined;
  dispatchesCount?: number | undefined;
}

/**
 * DTO para editar los datos de un farmacéutico registrado.
 * @see PATCH /api/v1/admin/pharmacists/:id
 */
export interface UpdatePharmacistDto {
  fullName?: string | undefined;
  licenseNumber?: string | undefined;
  operationalRole?: PharmacistOperationalRole | undefined;
  facilityId?: string | null | undefined;
  cubicleId?: string | null | undefined;
  defaultCubicleId?: string | null | undefined;
  shift?: WorkShift | undefined;
  status?: PharmacistStatus | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  userId?: string | null | undefined;
}

/**
 * DTO para conmutación rápida de estado operativo de un farmacéutico.
 * @see PATCH /api/v1/admin/pharmacists/:id/status
 */
export interface UpdatePharmacistStatusDto {
  status: PharmacistStatus;
}

/**
 * DTO para registrar una nueva sede hospitalaria.
 * @see POST /api/v1/admin/facilities
 */
export interface CreateFacilityDto {
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  openingHours: string;
  enabledCubiclesCount?: number | undefined;
  status?: FacilityStatus | undefined;
  isPrimary?: boolean | undefined;
}

/**
 * DTO para actualizar la información técnica de una sede.
 * @see PATCH /api/v1/admin/facilities/:id
 */
export interface UpdateFacilityDto {
  code?: string | undefined;
  name?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  phone?: string | undefined;
  openingHours?: string | undefined;
  enabledCubiclesCount?: number | undefined;
  status?: FacilityStatus | undefined;
  isPrimary?: boolean | undefined;
}

/**
 * DTO para asociar o reasignar un farmacéutico a una sede (y cubículo opcional).
 * @see POST /api/v1/admin/facilities/:id/assign-pharmacist
 */
export interface AssignPharmacistToFacilityDto {
  pharmacistId: string;
  cubicleId?: string | null | undefined;
}

/**
 * Configuración administrativa completa de un cubículo para [SCR-ADM-002].
 * @see GET /api/v1/admin/cubicles
 */
export interface AdminCubicleConfigDto {
  id: string;
  code: string;
  displayName: string;
  operatorName: string | null;
  status: CubicleStatus;
  active: boolean;
  allowedCategories: QueueCategory[];
  facilityId: string | null;
  facilityCode: string | null;
  facilityName: string | null;
  pharmacistId: string | null;
  pharmacistName: string | null;
  pharmacistLicenseNumber: string | null;
  dailyCompletedCount: number;
  slaThresholdSeconds: number;
  version: number;
}

/**
 * DTO para asignar o desasignar un farmacéutico registrado a un cubículo desde SCR-ADM-002.
 */
export interface AssignCubiclePharmacistDto {
  pharmacistId: string | null;
  operatorName?: string | undefined;
}

/**
 * DTO para habilitar o desactivar un cubículo desde SCR-ADM-002.
 */
export interface UpdateAdminCubicleStatusDto {
  active: boolean;
}
