import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { CashierMetricsController } from '../src/modules/cashier-metrics/cashier-metrics.controller';
import { CashierMetricsService } from '../src/modules/cashier-metrics/cashier-metrics.service';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '@cubiora/shared';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Tests de autorización (RBAC) y Cero PII para el endpoint de resumen operativo.
 * Valida los decoradores reales de CashierMetricsController:
 * - Permite acceso a roles CASHIER y ADMIN.
 * - Retorna 403 Forbidden a RECEPTION y usuarios sin rol asignado.
 * - Garantiza Cero PII en la respuesta real del controlador y servicio.
 */
describe('Resumen operativo — control de acceso (RBAC)', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  function createMockContext(
    userRole: UserRole | null,
  ): ExecutionContext {
    const req: Record<string, unknown> = userRole
      ? { user: { id: `user_${userRole.toLowerCase()}`, role: userRole, cubicleId: null } }
      : {};

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      // Vinculamos directamente el handler y clase reales del controlador
      getHandler: () => CashierMetricsController.prototype.getOperativeSummary,
      getClass: () => CashierMetricsController,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CASHIER puede acceder al resumen operativo (autorizado)', () => {
    const context = createMockContext(UserRole.CASHIER);
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('ADMIN puede acceder al resumen operativo (autorizado)', () => {
    const context = createMockContext(UserRole.ADMIN);
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('RECEPTION recibe 403 Forbidden al intentar acceder al resumen operativo', () => {
    const context = createMockContext(UserRole.RECEPTION);
    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);

    try {
      rolesGuard.canActivate(context);
    } catch (e: unknown) {
      const err = e as { getResponse: () => { code: string; message: string } };
      const response = err.getResponse();
      expect(response.code).toBe('FORBIDDEN');
      expect(response.message).toContain('CASHIER');
      expect(response.message).toContain('ADMIN');
    }
  });

  it('Usuario sin rol autenticado recibe 403 Forbidden', () => {
    const context = createMockContext(null);
    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('El endpoint requiere autenticación y no está marcado como @Public()', () => {
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      CashierMetricsController.prototype.getOperativeSummary,
      CashierMetricsController,
    ]);
    expect(isPublic).toBeFalsy();
  });

  it('El resumen operativo no expone datos personales en su respuesta real (Cero PII)', async () => {
    const mockPrisma = {
      ticket: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date('2026-10-24T10:00:00Z'),
            calledAt: new Date('2026-10-24T10:03:00Z'),
            serviceStartedAt: new Date('2026-10-24T10:04:00Z'),
          },
        ]),
      },
    };

    const service = new CashierMetricsService(mockPrisma as unknown as PrismaService);
    const controller = new CashierMetricsController(service);
    const result = await controller.getOperativeSummary();

    expect(result.success).toBe(true);
    expect(result.data.activeCount).toBe(3);
    expect(result.data.avgWaitSeconds).toBe(180);
    expect(result.data.slaCompliancePct).toBe(100);

    // Verificar que el payload devuelto no contenga ningún campo de datos personales
    const keys = Object.keys(result.data);
    const forbiddenFields = [
      'patientName',
      'patientDocument',
      'document',
      'name',
      'cedula',
      'nit',
      'phone',
      'email',
      'patient',
    ];
    for (const field of forbiddenFields) {
      expect(keys).not.toContain(field);
    }
  });
});
