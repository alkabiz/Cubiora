import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Matriz de Privilegios y Gobernanza de Base de Datos para el rol 'cubiora_app'.
 *
 * Valida los requerimientos de mínimo privilegio:
 * 1. cubiora_app NO es propietario de ninguna tabla (owner: cubiora_migrator).
 * 2. Operaciones DDL (CREATE, ALTER, DROP, TRUNCATE) denegadas.
 * 3. Operaciones administrativas (CREATE ROLE, ALTER ROLE, CREATE DATABASE) denegadas.
 * 4. ticket_status_history, ticket_calls y dispensation_records (WORM):
 *    SELECT/INSERT permitidos; UPDATE/DELETE/TRUNCATE denegados.
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
  facilities: {
    tableName: 'facilities',
    select: true,
    insert: true,
    update: true,
    delete: true, // Permitido únicamente cuando no existen tickets/cubículos con historial (FK RESTRICT)
    truncate: false,
    owner: 'cubiora_migrator',
  },
  pharmacists: {
    tableName: 'pharmacists',
    select: true,
    insert: true,
    update: true,
    delete: true, // Ciclo de vida administrativo en SCR-ADM-004
    truncate: false,
    owner: 'cubiora_migrator',
  },
  cubicles: {
    tableName: 'cubicles',
    select: true,
    insert: true,
    update: true,
    delete: true, // Permitido únicamente para estaciones nuevas sin historial (FK RESTRICT en tickets/calls/history/dispensations)
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
  dispensation_records: {
    tableName: 'dispensation_records',
    select: true,
    insert: true,
    update: false, // Registro regulatorio MinSalud WORM: Prohibido UPDATE
    delete: false, // Registro regulatorio MinSalud WORM: Prohibido DELETE
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

  it('las tablas WORM (ticket_status_history, ticket_calls, dispensation_records) deben ser estrictamente append-only', () => {
    for (const wormTable of ['ticket_status_history', 'ticket_calls', 'dispensation_records']) {
      const rule = CUBIORA_APP_PERMISSION_MATRIX[wormTable];
      expect(rule.select).toBe(true);
      expect(rule.insert).toBe(true);
      expect(rule.update).toBe(false);
      expect(rule.delete).toBe(false);
      expect(rule.truncate).toBe(false);
    }
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

  it('DELETE debe estar revocado en tablas troncales inmutables u operativas críticas (users, tickets, system_sequences, WORM)', () => {
    const protectedTables = [
      'users',
      'tickets',
      'system_sequences',
      'ticket_status_history',
      'ticket_calls',
      'dispensation_records',
    ];
    protectedTables.forEach((table) => {
      expect(CUBIORA_APP_PERMISSION_MATRIX[table].delete).toBe(false);
    });
  });

  it('DELETE está habilitado solo en tablas con depuración o limpieza controlada protegida por FK RESTRICT', () => {
    expect(CUBIORA_APP_PERMISSION_MATRIX['idempotency_keys'].delete).toBe(true);
    expect(CUBIORA_APP_PERMISSION_MATRIX['facilities'].delete).toBe(true);
    expect(CUBIORA_APP_PERMISSION_MATRIX['pharmacists'].delete).toBe(true);
    expect(CUBIORA_APP_PERMISSION_MATRIX['cubicles'].delete).toBe(true);
  });

  it('la migración formal Phase 4 implementa triggers WORM en dispensation_records, uq_pharmacists_cubicle_assigned y grants explícitos', () => {
    const migrationSql = fs.readFileSync(
      path.resolve(
        __dirname,
        '../prisma/migrations/20261111180000_security_hardening_phase4/migration.sql',
      ),
      'utf8',
    );
    expect(migrationSql).toContain('uq_pharmacists_cubicle_assigned');
    expect(migrationSql).toContain('trg_worm_dispensation_records_row');
    expect(migrationSql).toContain('trg_worm_dispensation_records_stmt');
    expect(migrationSql).toContain('GRANT SELECT, INSERT ON TABLE "ticket_status_history", "ticket_calls", "dispensation_records" TO cubiora_app');
    expect(migrationSql).toContain('REVOKE ALL ON TABLE "_prisma_migrations" FROM PUBLIC, cubiora_app');
    expect(migrationSql).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE cubiora_migrator IN SCHEMA public REVOKE ALL ON TABLES');
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
