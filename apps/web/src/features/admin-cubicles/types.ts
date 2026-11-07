// ─── [SCR-ADM-002] Configuración y Parametrización de Cubículos ──────────────

export type CubicleBadgeCode = 'BUSY' | 'EXCEEDED' | 'CALLING' | 'AVAILABLE' | 'INACTIVE';

export interface CubicleConfigurationItem {
  id: string;
  numberCode: string; // '01' | '02' | '03' | '04' | '05'
  name: string; // 'Cubículo 01'
  moduleLabel: string; // 'Módulo MOD-A'
  badgeStatus: CubicleBadgeCode;
  assignedPharmacist: string;
  slaThresholdMinutes: number; // 12
  dailyProcessedCount: number;
  isEnabled: boolean;
}
