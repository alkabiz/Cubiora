import {
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DispensationResolution } from '@cubiora/shared';

const MAX_PENDING_DETAILS_BYTES = 8192;
const MAX_PENDING_DETAILS_DEPTH = 4;
const MAX_PENDING_DETAILS_NODES = 50;
const FORBIDDEN_JSON_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

export function assertValidPendingDetailsJson(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string') {
    if (value.includes('\u0000') || Buffer.byteLength(value, 'utf8') > MAX_PENDING_DETAILS_BYTES) {
      throw new Error('pendingDetailsJson supera el tamaño máximo permitido (8 KB) o contiene bytes nulos.');
    }
    return;
  }

  if (typeof value !== 'object') {
    throw new Error('pendingDetailsJson debe ser una cadena o estructura JSON válida.');
  }

  let totalNodes = 0;
  const visited = new WeakSet<object>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_PENDING_DETAILS_DEPTH) {
      throw new Error('pendingDetailsJson excede la profundidad máxima permitida.');
    }
    if (node === null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      if (typeof node === 'string' && node.includes('\u0000')) {
        throw new Error('pendingDetailsJson contiene bytes nulos no permitidos.');
      }
      if (typeof node === 'number' && !Number.isFinite(node)) {
        throw new Error('pendingDetailsJson contiene valores numéricos inválidos.');
      }
      return;
    }
    if (typeof node !== 'object') {
      throw new Error('pendingDetailsJson contiene tipos no serializables en JSON.');
    }
    if (visited.has(node)) {
      throw new Error('pendingDetailsJson contiene referencias circulares.');
    }
    visited.add(node);

    if (Array.isArray(node)) {
      if (node.length > MAX_PENDING_DETAILS_NODES) {
        throw new Error('pendingDetailsJson excede la cantidad máxima de elementos.');
      }
      totalNodes += node.length;
      if (totalNodes > MAX_PENDING_DETAILS_NODES) {
        throw new Error('pendingDetailsJson excede la complejidad máxima permitida.');
      }
      for (const item of node) {
        walk(item, depth + 1);
      }
      return;
    }

    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length > MAX_PENDING_DETAILS_NODES) {
      throw new Error('pendingDetailsJson excede el número máximo de claves.');
    }
    totalNodes += entries.length;
    if (totalNodes > MAX_PENDING_DETAILS_NODES) {
      throw new Error('pendingDetailsJson excede la complejidad máxima permitida.');
    }
    for (const [key, child] of entries) {
      if (FORBIDDEN_JSON_KEYS.has(key) || key.length > 64) {
        throw new Error('pendingDetailsJson contiene claves prohibidas o demasiado largas.');
      }
      walk(child, depth + 1);
    }
  };

  walk(value, 1);

  const serialized = JSON.stringify(value);
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_PENDING_DETAILS_BYTES) {
    throw new Error('pendingDetailsJson excede el límite serializado de 8 KB.');
  }
}

@ValidatorConstraint({ name: 'pendingDetailsBoundedJson', async: false })
export class PendingDetailsBoundedJsonConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      assertValidPendingDetailsJson(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'pendingDetailsJson debe ser texto o JSON simple acotado (<= 8 KB, profundidad <= 4, <= 50 nodos).';
  }
}

export class TicketCommandDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsEnum(DispensationResolution)
  resolution?: DispensationResolution;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  prescriptionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mipresNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  itemsDeliveredCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  itemsPendingCount?: number;

  @IsOptional()
  @Validate(PendingDetailsBoundedJsonConstraint)
  pendingDetailsJson?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  deliveryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
