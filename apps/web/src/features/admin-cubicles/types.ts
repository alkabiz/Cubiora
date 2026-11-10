// ─── [SCR-ADM-002] Configuración y Parametrización de Cubículos ──────────────
import type {
  PharmacistOperationalRole,
  PharmacistStatus,
  WorkShift,
} from '@cubiora/shared';

export type CubicleBadgeCode = 'BUSY' | 'EXCEEDED' | 'CALLING' | 'AVAILABLE' | 'INACTIVE';

export interface CubicleConfigurationItem {
  id: string;
  code?: string; // 'CUB-01' | 'CUB-02' ...
  numberCode: string; // '01' | '02' | '03' | '04' | '05'
  name: string; // 'Cubículo 01'
  moduleLabel: string; // 'Módulo MOD-A'
  badgeStatus: CubicleBadgeCode;
  assignedPharmacist: string;
  pharmacistId?: string | null;
  pharmacistLicenseNumber?: string | null;
  facilityId?: string | null;
  facilityCode?: string | null;
  facilityName?: string | null;
  slaThresholdMinutes: number; // 12
  dailyProcessedCount: number;
  isEnabled: boolean;
}

export interface PharmacistSelectOption {
  id: string;
  fullName: string;
  licenseNumber: string;
  operationalRole: PharmacistOperationalRole;
  shift: WorkShift;
  status: PharmacistStatus;
  facilityId: string | null;
}
