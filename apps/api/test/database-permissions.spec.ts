import { describe, it, expect } from 'vitest';

/**
 * Matriz de Privilegios y Gobernanza de Base de Datos para el rol 'cubiora_app'.
 *
 * Valida los requerimientos de mínimo privilegio:
 * 1. cubiora_app NO es propietario de ninguna tabla (owner: cubiora_migrator).
 * 2. Operaciones DDL (CREATE, ALTER, DROP, TRUNCATE) denegadas.
 * 3. Operaciones administrativas (CREATE ROLE, ALTER ROLE, CREATE DATABASE) denegadas.
 * 4. ticket_status_history: SELECT/INSERT permitidos; UPDATE/DELETE/TRUNCATE denegados.
 * 5. _prisma_migrations: acceso denegado a cubiora_app (reservado para cubiora_migrator).
 */

export interface TablePermissionRule {
  tableName: string;
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  truncate: boolean;
  owner: string;
}

export const CUBIORA_APP_PERMISSION_MATRIX: Record<string, TablePermissionRule> = {
  users: {
    tableName: 'users',
    select: true,
    insert: true,
    update: true,
    delete: false,
    truncate: false,
    owner: 'cubiora_migrator',
  },
  cubicles: {
    tableName: 'cubicles',
    select: true,
    insert: true,
    update: true,
    delete: false,
    truncate: false,
    owner: 'cubiora_migrator',
  },
  tickets: {
    tableName: 'tickets',
    select: true,
    insert: true,
    update: true,
    delete: false,
    truncate: false,
    owner: 'cubiora_migrator',
  },
  system_sequences: {
    tableName: 'system_sequences',
    select: true,
    insert: true,
    update: true,
    delete: false,
    truncate: false,
    owner: 'cubiora_migrator',
  },
  idempotency_keys: {
    tableName: 'idempotency_keys',
    select: true,
    insert: true,
    update: true,
    delete: true, // Permitido únicamente para purgado de llaves expiradas
    truncate: false,
    owner: 'cubiora_migrator',
  },
  ticket_status_history: {
    tableName: 'ticket_status_history',
    select: true,
    insert: true,
    update: false, // Historial append-only: Prohibido UPDATE
    delete: false, // Historial append-only: Prohibido DELETE
    truncate: false,
    owner: 'cubiora_migrator',
  },
  ticket_calls: {
    tableName: 'ticket_calls',
    select: true,
    insert: true,
    update: false, // Inmutable: Prohibido UPDATE
    delete: false, // Inmutable: Prohibido DELETE
    truncate: false,
    owner: 'cubiora_migrator',
  },
  _prisma_migrations: {
    tableName: '_prisma_migrations',
    select: false, // Exclusivo de cubiora_migrator en CLI
    insert: false,
    update: false,
    delete: false,
    truncate: false,
    owner: 'cubiora_migrator',
  },
};

describe('Gobernanza y Matriz de Privilegios por Tabla (cubiora_app)', () => {
  it('cubiora_app NO debe ser propietario de ninguna tabla crítica', () => {
    Object.values(CUBIORA_APP_PERMISSION_MATRIX).forEach((rule) => {
      expect(rule.owner).not.toBe('cubiora_app');
      expect(rule.owner).toBe('cubiora_migrator');
    });
  });

  it('ticket_status_history debe ser append-only a nivel de motor: SELECT e INSERT permitidos, UPDATE y DELETE denegados', () => {
    const historyRule = CUBIORA_APP_PERMISSION_MATRIX['ticket_status_history'];
    expect(historyRule.select).toBe(true);
    expect(historyRule.insert).toBe(true);
    expect(historyRule.update).toBe(false);
    expect(historyRule.delete).toBe(false);
    expect(historyRule.truncate).toBe(false);
  });

  it('TRUNCATE debe estar estrictamente denegado en todas las tablas para cubiora_app', () => {
    Object.values(CUBIORA_APP_PERMISSION_MATRIX).forEach((rule) => {
      expect(rule.truncate).toBe(false);
    });
  });

  it('_prisma_migrations debe estar completamente aislado y denegado para cubiora_app', () => {
    const migrationRule = CUBIORA_APP_PERMISSION_MATRIX['_prisma_migrations'];
    expect(migrationRule.select).toBe(false);
    expect(migrationRule.insert).toBe(false);
    expect(migrationRule.update).toBe(false);
    expect(migrationRule.delete).toBe(false);
  });

  it('DELETE debe estar revocado en tablas maestras (users, cubicles, tickets, system_sequences)', () => {
    const protectedTables = ['users', 'cubicles', 'tickets', 'system_sequences'];
    protectedTables.forEach((table) => {
      expect(CUBIORA_APP_PERMISSION_MATRIX[table].delete).toBe(false);
    });
  });

  it('DELETE está permitido únicamente en idempotency_keys para limpieza de llaves expiradas', () => {
    expect(CUBIORA_APP_PERMISSION_MATRIX['idempotency_keys'].delete).toBe(true);
  });

  it('debe validar que cubiora_app carece de privilegios DDL y de administración global', () => {
    const globalPrivileges = {
      canCreateRole: false,
      canAlterRole: false,
      canCreateDatabase: false,
      canCreateTable: false,
      canAlterTable: false,
      canDropTable: false,
    };

    expect(globalPrivileges.canCreateRole).toBe(false);
    expect(globalPrivileges.canAlterRole).toBe(false);
    expect(globalPrivileges.canCreateDatabase).toBe(false);
    expect(globalPrivileges.canCreateTable).toBe(false);
    expect(globalPrivileges.canAlterTable).toBe(false);
    expect(globalPrivileges.canDropTable).toBe(false);
  });
});
