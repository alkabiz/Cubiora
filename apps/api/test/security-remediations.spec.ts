import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { AuthController } from '../src/modules/auth/auth.controller';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { SessionTokenUtil } from '../src/modules/auth/session-token.util';
import * as envModule from '../src/config/env.validation';
import { UserRole, TicketStatus, CubicleStatus } from '@cubiora/shared';

describe('Seguridad — Verificación de Remediaciones de Auditoría', () => {
  const sessionSecret = 's'.repeat(64);

  beforeAll(() => {
    vi.spyOn(envModule, 'getEnv').mockReturnValue({
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cubiora_app:pass@localhost:5432/cubiora_db_test',
      DIRECT_URL: 'postgresql://cubiora_migrator:pass@localhost:5432/cubiora_db_test',
      SESSION_SECRET: sessionSecret,
      DISPLAY_TOKEN: 'token_display_test_min_32_chars_123',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: 'info',
      NO_SHOW_MAX_CALLS: 3,
    });
  });

  describe('SEC-01: Mitigación BOLA/IDOR en TicketsService', () => {
    it('debe denegar con 403 Forbidden cuando un CASHIER intenta operar un ticket de otro cubículo', async () => {
      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-123',
            publicId: '01JEXAMPLEPUBLICID00000000',
            version: 1,
            status: TicketStatus.ASSIGNED,
            cubicleId: 'cubicle_assigned_to_other_cashier',
          }),
        },
      };

      const mockPublicDisplay: any = { emitEvent: vi.fn() };
      const mockCubiclesService: any = {};

      const ticketsService = new TicketsService(
        mockPrisma,
        mockPublicDisplay,
        mockCubiclesService,
      );

      // El cajero pertenece a 'my_cubicle', pero el ticket está asignado a 'cubicle_assigned_to_other_cashier'
      await expect(
        ticketsService.callTicket(
          '01JEXAMPLEPUBLICID00000000',
          'cashier-user-id',
          'corr-123',
          undefined,
          1,
          UserRole.CASHIER,
          'my_cubicle',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir la operación cuando el CASHIER opera sobre su propio cubículo', async () => {
      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ticket-123',
            publicId: '01JEXAMPLEPUBLICID00000000',
            publicCode: 'TUR-000001-GE',
            version: 1,
            status: TicketStatus.ASSIGNED,
            cubicleId: 'my_cubicle',
          }),
        },
        idempotencyKey: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          return cb({
            $executeRaw: vi.fn(),
            idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null) },
            ticket: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'ticket-123',
                status: TicketStatus.ASSIGNED,
              }),
              update: vi.fn().mockResolvedValue({}),
            },
            ticketCall: {
              count: vi.fn().mockResolvedValue(0),
              create: vi.fn().mockResolvedValue({}),
            },
            ticketStatusHistory: { create: vi.fn() },
            cubicle: {
              update: vi.fn().mockResolvedValue({ id: 'my_cubicle', displayName: 'Cubículo 01' }),
            },
          });
        }),
      };

      const mockPublicDisplay: any = { emitEvent: vi.fn() };
      const mockCubiclesService: any = {
        buildCubicleSnapshot: vi.fn().mockResolvedValue({
          cubicle: { id: 'my_cubicle', code: 'CUB-01', status: CubicleStatus.CALLING },
        }),
      };

      const ticketsService = new TicketsService(
        mockPrisma,
        mockPublicDisplay,
        mockCubiclesService,
      );

      const result = await ticketsService.callTicket(
        '01JEXAMPLEPUBLICID00000000',
        'cashier-user-id',
        'corr-123',
        undefined,
        1,
        UserRole.CASHIER,
        'my_cubicle',
      );

      expect(result.statusCode).toBe(200);
    });
  });

  describe('SEC-02: Idempotencia en GET cubicles/:code/current', () => {
    it('debe lanzar NotFoundException si el cubículo no existe sin crear registros', async () => {
      const mockPrisma: any = {
        cubicle: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      };

      const cubiclesService = new CubiclesService(mockPrisma);

      await expect(
        cubiclesService.getCubicleSnapshotByCode('GHOST-CODE'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.cubicle.create).not.toHaveBeenCalled();
    });
  });

  describe('SEC-03: Revocación de usuarios inactivos en AuthGuard', () => {
    it('debe rechazar con 401 si el usuario está inactivo en la base de datos', async () => {
      const token = SessionTokenUtil.sign(
        {
          sub: 'user-deactivated',
          publicId: 'pub-deactivated',
          username: 'ex_empleado',
          displayName: 'Ex Empleado',
          role: UserRole.CASHIER,
          cubicleId: 'cub_01',
        },
        sessionSecret,
      );

      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-deactivated',
            active: false, // Usuario administrativamente desactivado
          }),
        },
      };

      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false); // No es público

      const authGuard = new AuthGuard(reflector, mockPrisma);

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { cubiora_session: token },
            signedCookies: {},
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('SEC-05: Directiva Secure en logout', () => {
    it('debe llamar a clearCookie con secure: true en entorno de producción', async () => {
      const authService: any = {};
      const authController = new AuthController(authService);

      const clearCookieSpy = vi.fn();
      const mockResponse: any = {
        clearCookie: clearCookieSpy,
      };

      await authController.logout(mockResponse);

      expect(clearCookieSpy).toHaveBeenCalledWith('cubiora_session', {
        httpOnly: true,
        secure: true, // Debe ser true en production
        sameSite: 'strict',
        path: '/',
      });
    });
  });
});
