import { PharmacistStatus, UserRole } from '@cubiora/shared';

export interface SyncTxClient {
  pharmacist?: {
    findUnique?: (...args: any[]) => Promise<any>;
    findFirst?: (...args: any[]) => Promise<any>;
    findMany?: (...args: any[]) => Promise<any[]>;
    update?: (...args: any[]) => Promise<any>;
    updateMany?: (...args: any[]) => Promise<any>;
  };
  cubicle?: {
    findUnique?: (...args: any[]) => Promise<any>;
    count?: (...args: any[]) => Promise<number>;
    update?: (...args: any[]) => Promise<any>;
    updateMany?: (...args: any[]) => Promise<any>;
  };
  facility?: {
    update?: (...args: any[]) => Promise<any>;
    updateMany?: (...args: any[]) => Promise<any>;
  };
  user?: {
    findFirst?: (...args: any[]) => Promise<any>;
    findUnique?: (...args: any[]) => Promise<any>;
    update?: (...args: any[]) => Promise<any>;
    updateMany?: (...args: any[]) => Promise<any>;
  };
  $queryRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

/**
 * Adquiere bloqueos pesimistas (SELECT ... FOR UPDATE) en orden lexicográfico
 * determinístico sobre las filas de cubículos involucradas dentro de la transacción.
 */
export async function lockCubicleRows(
  tx: SyncTxClient | unknown,
  cubicleIds: Array<string | null | undefined>,
): Promise<void> {
  if (!tx || typeof tx !== 'object') {
    return;
  }
  const queryRawFn = (tx as SyncTxClient).$queryRaw;
  if (typeof queryRawFn !== 'function') {
    return;
  }

  const orderedIds = Array.from(
    new Set(cubicleIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ).sort();

  for (const cubicleId of orderedIds) {
    try {
      await queryRawFn`SELECT id FROM cubicles WHERE id = ${cubicleId} FOR UPDATE`;
    } catch (err: unknown) {
      const errObj = err as { code?: string; meta?: { code?: string } } | null;
      if (errObj?.code || errObj?.meta?.code) {
        throw err;
      }
    }
  }
}

export interface OperatorResolutionInput {
  pharmacists?: Array<{ fullName?: string | null; status?: string | null }> | null | undefined;
  currentOperator?: {
    displayName?: string | null;
    role?: string | null;
    active?: boolean | null;
  } | null | undefined;
  legacyOperatorName?: string | null | undefined;
}

/**
 * Deriva el nombre visible del operador de un cubículo priorizando las relaciones
 * normalizadas en 3FN:
 * 1. Farmacéutico asignado activo (`Pharmacist.fullName`).
 * 2. Usuario de caja activo asignado al cubículo (`User.displayName` con rol CASHIER).
 * 3. Columna desnormalizada heredada (`Cubicle.operatorName`) únicamente como respaldo.
 */
export function resolveEffectiveOperatorName(input: OperatorResolutionInput): string | null {
  const assignedPharmacist = input.pharmacists?.[0] ?? null;
  const activeCashierName =
    input.currentOperator &&
    input.currentOperator.active !== false &&
    (!input.currentOperator.role || input.currentOperator.role === UserRole.CASHIER) &&
    typeof input.currentOperator.displayName === 'string' &&
    input.currentOperator.displayName.length > 0
      ? input.currentOperator.displayName
      : null;

  if (assignedPharmacist) {
    if (assignedPharmacist.status !== PharmacistStatus.INACTIVE) {
      if (typeof assignedPharmacist.fullName === 'string' && assignedPharmacist.fullName.length > 0) {
        return assignedPharmacist.fullName;
      }
      return activeCashierName ?? input.legacyOperatorName ?? null;
    }
    return activeCashierName;
  }

  return activeCashierName ?? input.legacyOperatorName ?? null;
}

/**
 * Mantiene sincronizada la columna `users.cubicle_id` dentro de la misma transacción
 * al asignar, mover o desvincular un puesto operativo, respetando la unicidad 1:1.
 */
export async function syncUserCubicleLink(
  tx: SyncTxClient,
  params: {
    targetCubicleId: string | null;
    linkedUserId?: string | null | undefined;
    shouldOccupyCubicle?: boolean | undefined;
    clearTargetCubicleOtherUsers?: boolean | undefined;
    previousCubicleIdToClear?: string | null | undefined;
  },
): Promise<void> {
  if (!tx.user?.updateMany) {
    return;
  }

  const {
    targetCubicleId,
    linkedUserId = null,
    shouldOccupyCubicle = Boolean(targetCubicleId),
    clearTargetCubicleOtherUsers = true,
    previousCubicleIdToClear = null,
  } = params;

  if (targetCubicleId && clearTargetCubicleOtherUsers) {
    await tx.user.updateMany({
      where: {
        cubicleId: targetCubicleId,
        ...(linkedUserId && shouldOccupyCubicle ? { id: { not: linkedUserId } } : {}),
      },
      data: { cubicleId: null },
    });
  }

  if (previousCubicleIdToClear && previousCubicleIdToClear !== targetCubicleId) {
    await tx.user.updateMany({
      where: {
        cubicleId: previousCubicleIdToClear,
        ...(linkedUserId ? { id: linkedUserId } : {}),
      },
      data: { cubicleId: null },
    });
  }

  if (linkedUserId) {
    await tx.user.updateMany({
      where: { id: linkedUserId },
      data: {
        cubicleId: shouldOccupyCubicle && targetCubicleId ? targetCubicleId : null,
      },
    });
  }
}

/**
 * Recalcula y sincroniza `facilities.enabled_cubicles_count` a partir del conteo real
 * de cubículos con `active = true` dentro de la sede indicada.
 */
export async function syncFacilityEnabledCubiclesCount(
  tx: SyncTxClient,
  facilityId: string | null | undefined,
): Promise<number | null> {
  if (!facilityId || !tx.cubicle?.count || !tx.facility?.update) {
    return null;
  }

  const activeCount = await tx.cubicle.count({
    where: { facilityId, active: true },
  });

  await tx.facility.update({
    where: { id: facilityId },
    data: { enabledCubiclesCount: activeCount },
  });

  return activeCount;
}

