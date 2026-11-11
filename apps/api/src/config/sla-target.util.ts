/** Objetivo operativo inicial por defecto: atenciones finalizadas en ≤ 12 minutos (720 s). */
export const DEFAULT_DAILY_TARGET_SECONDS = 12 * 60;

/**
 * Resuelve el umbral objetivo SLA en segundos desde `CUBICLE_DAILY_TARGET_SECONDS`.
 * Centralizado en backend para mantener consistencia entre módulos operativos y auditoría.
 */
export function resolveDailyTargetSeconds(
  rawValue: string | undefined = process.env['CUBICLE_DAILY_TARGET_SECONDS'],
): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_TARGET_SECONDS;
  }
  return Math.round(parsed);
}

