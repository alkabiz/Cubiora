import 'reflect-metadata';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  ArgumentsHost,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { of, lastValueFrom } from 'rxjs';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { CsrfOriginGuard } from '../src/common/guards/csrf-origin.guard';
import { CorrelationIdMiddleware } from '../src/common/middleware/correlation-id.middleware';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AuthController, resolveCookieSecure } from '../src/modules/auth/auth.controller';
import { isOriginAllowed } from '../src/common/utils/cors-origin.util';
import { LoginDto } from '../src/modules/auth/dto/login.dto';
import { CubiclesService } from '../src/modules/cubicles/cubicles.service';
import { TicketsController } from '../src/modules/tickets/tickets.controller';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { GetTicketHistoryQueryDto } from '../src/modules/tickets/dto/get-ticket-history-query.dto';
import { TicketCommandDto, assertValidPendingDetailsJson } from '../src/modules/tickets/dto/ticket-command.dto';
import { CashierMetricsService } from '../src/modules/cashier-metrics/cashier-metrics.service';
import { OperationalTelemetryService } from '../src/modules/operational-telemetry/operational-telemetry.service';
import { PublicDisplayService } from '../src/modules/public-display/public-display.service';
import { WmsIntegrationService } from '../src/modules/wms-integration/wms-integration.service';
import { UsersService } from '../src/modules/users/users.service';
import { PharmacistsService } from '../src/modules/pharmacists/pharmacists.service';
import { FacilitiesService } from '../src/modules/facilities/facilities.service';
import { lockCubicleRows } from '../src/common/utils/cubicle-assignment-sync.util';
import { SessionTokenUtil } from '../src/modules/auth/session-token.util';
import { Prisma } from '../src/generated/prisma/client';
import * as envModule from '../src/config/env.validation';
import {
  UserRole,
  TicketStatus,
  CubicleStatus,
  DispensationResolution,
  PharmacistStatus,
  PharmacistOperationalRole,
  WorkShift,
  FacilityStatus,
} from '@cubiora/shared';

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
      COOKIE_SECURE: 'auto',
      LOG_LEVEL: 'info',
      NO_SHOW_MAX_CALLS: 3,
      CUBICLE_DAILY_TARGET_SECONDS: 720,
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
                cubicleId: 'my_cubicle',
                version: 1,
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
        secure: true, // Debe ser true en production sin req (fallback) o bajo HTTPS
        sameSite: 'strict',
        path: '/',
      });
    });

    it('debe respetar X-Forwarded-Proto=https vs http en logout cuando COOKIE_SECURE=auto', async () => {
      const authService: any = {};
      const authController = new AuthController(authService);
      const clearCookieSpy = vi.fn();
      const mockResponse: any = { clearCookie: clearCookieSpy };

      await authController.logout(mockResponse, {
        secure: false,
        headers: { 'x-forwarded-proto': 'http' },
      } as any);

      expect(clearCookieSpy).toHaveBeenCalledWith('cubiora_session', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/',
      });
    });

    it('evalúa el primer proxy en X-Forwarded-Proto y revoca sesiones en BD durante logout', async () => {
      const revokeSessions = vi.fn().mockResolvedValue(undefined);
      const authController = new AuthController({ revokeSessions } as any);
      const clearCookieSpy = vi.fn();
      const mockResponse: any = { clearCookie: clearCookieSpy };

      expect(
        resolveCookieSecure(
          { secure: false, headers: { 'x-forwarded-proto': 'http, https' } } as any,
          { NODE_ENV: 'production', COOKIE_SECURE: 'auto' },
        ),
      ).toBe(false);
      expect(
        resolveCookieSecure(
          { secure: false, headers: { 'x-forwarded-proto': 'https, http' } } as any,
          { NODE_ENV: 'production', COOKIE_SECURE: 'auto' },
        ),
      ).toBe(true);

      await authController.logout(
        mockResponse,
        { secure: false, headers: { 'x-forwarded-proto': 'https' } } as any,
        {
          id: 'usr-logout-1',
          publicId: 'pub-logout-1',
          username: 'admin',
          displayName: 'Admin',
          role: UserRole.ADMIN,
          cubicleId: null,
        },
      );

      expect(revokeSessions).toHaveBeenCalledWith('usr-logout-1');
    });
  });

  describe('FASE-1: Revocación por tokenVersion, fallo cerrado, RolesGuard, CSRF y BOLA Cubículos', () => {
    it('AuthGuard rechaza tokenVersion revocado, usuario eliminado, falta de Prisma en prod y Bearer en prod; actualiza rol en vivo', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const token = SessionTokenUtil.sign(
        {
          sub: 'usr-tv-1',
          publicId: 'pub-tv-1',
          username: 'operador1',
          displayName: 'Operador 1',
          role: UserRole.ADMIN,
          cubicleId: null,
          tokenVersion: 2,
        },
        sessionSecret,
      );

      const makeHttpCtx = (reqObj: Record<string, unknown>) =>
        ({
          switchToHttp: () => ({ getRequest: () => reqObj }),
          getHandler: () => ({}),
          getClass: () => ({}),
        }) as unknown as ExecutionContext;

      // 1. tokenVersion desactualizado -> 401
      const guardRevoked = new AuthGuard(reflector, {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            active: true,
            role: UserRole.ADMIN,
            tokenVersion: 3,
            cubicleId: null,
            cubicle: null,
          }),
        },
      } as any);
      await expect(
        guardRevoked.canActivate(makeHttpCtx({ cookies: { cubiora_session: token }, headers: {} })),
      ).rejects.toThrow(UnauthorizedException);

      // 2. Usuario eliminado (null) -> 401
      const guardDeleted = new AuthGuard(reflector, {
        user: { findUnique: vi.fn().mockResolvedValue(null) },
      } as any);
      await expect(
        guardDeleted.canActivate(makeHttpCtx({ cookies: { cubiora_session: token }, headers: {} })),
      ).rejects.toThrow(UnauthorizedException);

      // 3. Prisma ausente en production -> fallo cerrado 401
      const guardNoPrisma = new AuthGuard(reflector, undefined);
      expect(() =>
        guardNoPrisma.canActivate(makeHttpCtx({ cookies: { cubiora_session: token }, headers: {} })),
      ).toThrow(UnauthorizedException);

      // 4. Bearer header ignorado en production -> 401
      expect(() =>
        guardRevoked.canActivate(
          makeHttpCtx({ cookies: {}, headers: { authorization: `Bearer ${token}` } }),
        ),
      ).toThrow(UnauthorizedException);

      // 5. Token válido pero rol degradado en BD -> actualiza request.user.role en vivo
      const reqLive: Record<string, any> = {
        cookies: { cubiora_session: token },
        headers: {},
      };
      const guardDemoted = new AuthGuard(reflector, {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            active: true,
            role: UserRole.CASHIER,
            tokenVersion: 2,
            cubicleId: 'cub-1',
            cubicle: { code: 'CUB-01' },
          }),
        },
      } as any);
      await expect(guardDemoted.canActivate(makeHttpCtx(reqLive))).resolves.toBe(true);
      expect(reqLive.user.role).toBe(UserRole.CASHIER);
      expect(reqLive.user.cubicleId).toBe('cub-1');
    });

    it('RolesGuard deniega con 403 a CASHIER sin cubículo asignado cuando la ruta especifica cubicleId', () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === 'roles' ? [UserRole.CASHIER, UserRole.ADMIN] : false,
      );
      const rolesGuard = new RolesGuard(reflector);

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'cashier-unassigned', role: UserRole.CASHIER, cubicleId: null },
            params: { cubicleId: 'cub-01' },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('CsrfOriginGuard e isOriginAllowed soportan dual HTTP LAN 192.168.1.* + HTTPS dominio y bloquean orígenes externos', () => {
      const guard = new CsrfOriginGuard();
      const makeCtx = (method: string, headers: Record<string, string>) =>
        ({
          getType: () => 'http',
          switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
        }) as unknown as ExecutionContext;

      expect(guard.canActivate(makeCtx('GET', { 'sec-fetch-site': 'cross-site' }))).toBe(true);
      expect(guard.canActivate(makeCtx('POST', { origin: 'http://localhost:5173' }))).toBe(true);
      expect(guard.canActivate(makeCtx('POST', { origin: 'http://192.168.1.45:5173' }))).toBe(true);
      expect(guard.canActivate(makeCtx('POST', { origin: 'http://192.168.1.33' }))).toBe(true);
      expect(guard.canActivate(makeCtx('POST', {}))).toBe(true);

      const dualCors =
        'https://cubiora.samlapspeed.com,https://coolify.samlapspeed.com,http://localhost:5173,http://localhost,http://127.0.0.1';
      expect(isOriginAllowed('https://cubiora.samlapspeed.com', dualCors)).toBe(true);
      expect(isOriginAllowed('http://192.168.1.99:8080', dualCors)).toBe(true);
      expect(isOriginAllowed('http://192.168.2.99:8080', dualCors)).toBe(false);
      expect(isOriginAllowed('https://attacker.example', dualCors)).toBe(false);

      expect(() =>
        guard.canActivate(makeCtx('POST', { 'sec-fetch-site': 'cross-site', origin: 'http://evil.test' })),
      ).toThrow(ForbiddenException);
      expect(() => guard.canActivate(makeCtx('POST', { origin: 'null' }))).toThrow(
        ForbiddenException,
      );
      expect(() =>
        guard.canActivate(makeCtx('PATCH', { origin: 'https://attacker.example' })),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(makeCtx('POST', { origin: 'http://192.168.2.50:5173' })),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(makeCtx('POST', { 'sec-fetch-site': 'same-site' })),
      ).toThrow(ForbiddenException);
    });

    it('CubiclesService.updateOperator bloquea BOLA y modificación de pharmacistId para CASHIER', async () => {
      const mockPrisma: any = {
        cubicle: { findUnique: vi.fn().mockResolvedValue({ id: 'cub-02' }) },
      };
      const service = new CubiclesService(mockPrisma);

      await expect(
        service.updateOperator('cub-02', 'Otro Operador', undefined, {
          id: 'usr-c1',
          publicId: 'pub-c1',
          username: 'cajero1',
          displayName: 'Cajero 1',
          role: UserRole.CASHIER,
          cubicleId: 'cub-01',
        }),
      ).rejects.toThrow(ForbiddenException);

      mockPrisma.cubicle.findUnique.mockResolvedValueOnce({ id: 'cub-01' });
      await expect(
        service.updateOperator('cub-01', 'Mi Nombre', 'pharm-99', {
          id: 'usr-c1',
          publicId: 'pub-c1',
          username: 'cajero1',
          displayName: 'Cajero 1',
          role: UserRole.CASHIER,
          cubicleId: 'cub-01',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TicketsService bloquea a un CASHIER sin cubículo asignado incluso ante tickets sin cubículo', async () => {
      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tick-unassigned',
            publicId: '01JUNASSIGNED00000000000',
            version: 1,
            status: TicketStatus.ASSIGNED,
            cubicleId: null,
          }),
        },
      };
      const service = new TicketsService(mockPrisma, { emitEvent: vi.fn() } as any, {} as any);

      await expect(
        service.callTicket(
          '01JUNASSIGNED00000000000',
          'cashier-no-cubicle',
          'corr-1',
          undefined,
          1,
          UserRole.CASHIER,
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('LoginDto rechaza contraseñas > 128 chars y UsersService incrementa tokenVersion en resetPassword/desactivación', async () => {
      const dtoTooLong = plainToInstance(LoginDto, {
        username: 'admin_cubiora',
        password: 'A'.repeat(129),
      });
      const errs = await validate(dtoTooLong);
      expect(errs.length).toBeGreaterThan(0);

      const mockPrisma: any = {
        user: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'usr-1',
            publicId: 'pub-1',
            username: 'cajero1',
            role: UserRole.CASHIER,
            cubicleId: null,
            active: true,
          }),
          update: vi.fn().mockResolvedValue({
            id: 'usr-1',
            publicId: 'pub-1',
            username: 'cajero1',
            displayName: 'Cajero 1',
            role: UserRole.CASHIER,
            cubicleId: null,
            active: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            cubicle: null,
          }),
        },
      };
      const usersService = new UsersService(mockPrisma);

      await usersService.resetPassword('usr-1', 'NewPass2026!');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );

      await usersService.update('usr-1', { active: false });
      expect(mockPrisma.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe('FASE-2: Aislamiento multisede, privacidad de historial, cancelación acotada y logs', () => {
    it('TicketsController.getTicketHistory queda restringido exclusivamente a ADMIN y GetTicketHistoryQueryDto valida cotas', async () => {
      const roles = Reflect.getMetadata('roles', TicketsController.prototype.getTicketHistory);
      expect(roles).toEqual([UserRole.ADMIN]);

      const invalidQuery = plainToInstance(GetTicketHistoryQueryDto, {
        page: 5000,
        limit: 500,
        slaFilter: 'INVALID_SLA',
        search: 'x'.repeat(81),
      });
      const errs = await validate(invalidQuery);
      expect(errs.length).toBeGreaterThanOrEqual(4);

      const validQuery = plainToInstance(GetTicketHistoryQueryDto, {
        page: '2',
        limit: '50',
        slaFilter: 'EXCEEDED',
        search: '  TUR-0001  ',
      });
      expect(await validate(validQuery)).toHaveLength(0);
      expect(validQuery.page).toBe(2);
      expect(validQuery.limit).toBe(50);
      expect(validQuery.search).toBe('TUR-0001');
    });

    it('TicketsService.getTicketHistory elimina ILIKE parcial sobre patientDocument, pagina SLA en SQL y propaga fallos de BD', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          id: 'tick-sql-1',
          publicId: '01JSQL0001',
          publicCode: 'TUR-000111-GE',
          patientName: 'María Test',
          patientDocument: '1020304050',
          status: TicketStatus.CLOSED,
          queueCategory: 'GENERAL',
          createdAt: new Date('2026-11-11T10:00:00Z'),
          calledAt: new Date('2026-11-11T10:01:00Z'),
          serviceStartedAt: new Date('2026-11-11T10:01:00Z'),
          closedAt: new Date('2026-11-11T10:03:00Z'),
          cubicle: null,
          dispensation: null,
        },
      ]);
      const queryRaw = vi
        .fn()
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([{ id: 'tick-sql-1' }]);

      const mockPrisma: any = {
        $queryRaw: queryRaw,
        ticket: { count: vi.fn().mockResolvedValue(0), findMany },
      };

      const service = new TicketsService(mockPrisma, {} as any, {} as any);

      // Búsqueda corta (prefijo '102') no debe emitir contains sobre patientDocument
      await service.getTicketHistory({ search: '102', page: 1, limit: 10 });
      const countArgs = mockPrisma.ticket.count.mock.calls[0][0];
      const serializedWhere = JSON.stringify(countArgs.where);
      expect(serializedWhere).not.toContain('patientDocument');

      // slaFilter IN_NORM debe ejecutar COUNT(*) y SELECT id LIMIT/OFFSET vía $queryRaw
      const sqlPaged = await service.getTicketHistory({
        slaFilter: 'IN_NORM',
        page: 1,
        limit: 10,
      });
      expect(queryRaw).toHaveBeenCalledTimes(2);
      expect(sqlPaged.total).toBe(1);
      expect(sqlPaged.items[0]?.publicCode).toBe('TUR-000111-GE');

      // Fallo de BD no debe silenciarse como lista vacía 200 OK
      mockPrisma.ticket.count.mockRejectedValueOnce(new Error('DB unreachable'));
      await expect(service.getTicketHistory({ page: 1, limit: 10 })).rejects.toThrow('DB unreachable');
    });

    it('TicketsService.cancelTicket acota RECEPTION a creador propio y estado PENDING', async () => {
      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn(),
        },
      };
      const service = new TicketsService(mockPrisma, {} as any, {} as any);

      // Otro recepcionista -> 403
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({
        id: 't-rec-1',
        publicId: '01JREC001',
        publicCode: 'TUR-0001-GE',
        status: TicketStatus.PENDING,
        cubicleId: null,
        createdBy: 'rec-owner',
        version: 1,
      });
      await expect(
        service.cancelTicket(
          '01JREC001',
          'rec-intruder',
          'corr-1',
          undefined,
          1,
          UserRole.RECEPTION,
          null,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Propio creador pero turno ya ASSIGNED -> 403
      mockPrisma.ticket.findFirst.mockResolvedValueOnce({
        id: 't-rec-2',
        publicId: '01JREC002',
        publicCode: 'TUR-0002-GE',
        status: TicketStatus.ASSIGNED,
        cubicleId: 'cub-1',
        createdBy: 'rec-owner',
        version: 2,
      });
      await expect(
        service.cancelTicket(
          '01JREC002',
          'rec-owner',
          'corr-2',
          undefined,
          2,
          UserRole.RECEPTION,
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Aislamiento por sede: closeTicket auto-asigna solo turnos de la misma sede y CubiclesService acota waitingCount', async () => {
      const capturedSqlFragments: string[] = [];
      const mockPrisma: any = {
        ticket: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'tick-fac-a',
              publicId: '01JFA001',
              publicCode: 'TUR-001-GE',
              status: TicketStatus.IN_SERVICE,
              cubicleId: 'cub-sede-nor',
              version: 1,
              createdAt: new Date(),
            })
            .mockResolvedValueOnce(null),
          findUnique: vi.fn().mockResolvedValue({
            id: 'tick-fac-a',
            publicId: '01JFA001',
            publicCode: 'TUR-001-GE',
            status: TicketStatus.IN_SERVICE,
            cubicleId: 'cub-sede-nor',
            version: 1,
          }),
          update: vi.fn().mockResolvedValue({}),
          count: vi.fn().mockResolvedValue(4),
        },
        cubicle: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'cub-sede-nor',
            code: 'CUB-N1',
            displayName: 'Cubículo Norte 1',
            status: CubicleStatus.AVAILABLE,
            version: 1,
            facilityId: 'fac-norte',
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        dispensationRecord: { create: vi.fn() },
        pharmacist: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
        ticketStatusHistory: { create: vi.fn() },
        $transaction: vi.fn(async (cb) => cb(mockPrisma)),
        $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
          capturedSqlFragments.push(Array.isArray(strings) ? strings.join('?') : String(strings));
          return [];
        }),
      };

      const cubiclesService = new CubiclesService(mockPrisma);
      const ticketsService = new TicketsService(mockPrisma, { emitEvent: vi.fn() } as any, cubiclesService);

      const snapshot = await ticketsService.closeTicket(
        '01JFA001',
        'usr-n1',
        'corr-fac',
        undefined,
        1,
        UserRole.CASHIER,
        'cub-sede-nor',
      );

      expect(snapshot.data.waitingCount).toBe(4);
      expect(capturedSqlFragments.some((sql) => sql.includes('facility_id'))).toBe(true);
      expect(mockPrisma.ticket.count).toHaveBeenCalledWith({
        where: {
          status: TicketStatus.PENDING,
          facilityId: 'fac-norte',
        },
      });
    });

    it('CashierMetricsService y OperationalTelemetryService aplican aislamiento estricto de cubículo y sede', async () => {
      const mockPrismaMetrics: any = {
        ticket: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([]),
        },
      };
      const metricsService = new CashierMetricsService(mockPrismaMetrics);

      const unassignedSummary = await metricsService.getOperativeSummary({
        id: 'c-unassigned',
        publicId: 'pub-cu',
        username: 'c_unassigned',
        displayName: 'Sin Cubículo',
        role: UserRole.CASHIER,
        cubicleId: null,
      });
      expect(unassignedSummary).toEqual({
        activeCount: 0,
        avgWaitSeconds: null,
        slaCompliancePct: null,
      });
      expect(mockPrismaMetrics.ticket.count).not.toHaveBeenCalled();

      await metricsService.getOperativeSummary({
        id: 'c-1',
        publicId: 'pub-c1',
        username: 'cajero1',
        displayName: 'Cajero 1',
        role: UserRole.CASHIER,
        cubicleId: 'cub-own-1',
      });
      expect(mockPrismaMetrics.ticket.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cubicleId: 'cub-own-1' }),
        }),
      );

      const mockPrismaTelemetry: any = {
        facility: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'fac-sec-9',
            code: 'SEDE-SEC-09',
            name: 'Sede Secundaria',
          }),
        },
        cubicle: { findMany: vi.fn().mockResolvedValue([]) },
        ticket: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
        $queryRaw: vi.fn().mockResolvedValue([{ awt_seconds: 10, tmm_seconds: 20 }]),
      };
      const telemetryService = new OperationalTelemetryService(mockPrismaTelemetry);
      await telemetryService.buildSnapshot();

      expect(mockPrismaTelemetry.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ facilityId: 'fac-sec-9' }),
        }),
      );
      expect(mockPrismaTelemetry.ticket.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ facilityId: 'fac-sec-9' }),
        }),
      );
    });

    it('CorrelationIdMiddleware, LoggingInterceptor y GlobalExceptionFilter sanean headers, query strings y contextos no-HTTP', async () => {
      const middleware = new CorrelationIdMiddleware();
      const setHeader = vi.fn();
      const reqLong: any = { headers: { 'x-correlation-id': 'X'.repeat(80) } };
      middleware.use(reqLong, { setHeader } as any, vi.fn());
      expect(reqLong.headers['x-correlation-id'].length).toBeLessThanOrEqual(36);
      expect(reqLong.headers['x-correlation-id']).not.toContain('X'.repeat(40));

      const reqValid: any = { headers: { 'x-correlation-id': 'trace_abc-123.4' } };
      middleware.use(reqValid, { setHeader } as any, vi.fn());
      expect(reqValid.headers['x-correlation-id']).toBe('trace_abc-123.4');

      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const interceptor = new LoggingInterceptor();
      const httpCtx = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            originalUrl: '/api/v1/tickets/history?search=1020304050&token=secret',
            headers: { 'x-correlation-id': 'corr-1' },
          }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as unknown as ExecutionContext;
      await lastValueFrom(interceptor.intercept(httpCtx, { handle: () => of({ ok: true }) }));
      const loggedPayload = logSpy.mock.calls.at(-1)?.[0] as string;
      expect(loggedPayload).toContain('/api/v1/tickets/history');
      expect(loggedPayload).not.toContain('1020304050');
      expect(loggedPayload).not.toContain('secret');

      const filter = new GlobalExceptionFilter();
      const statusFn = vi.fn();
      // Si headersSent = true, no intenta reenviar status
      filter.catch(new Error('late err'), {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ headers: {}, url: '/api/v1/test?q=secret', method: 'GET' }),
          getResponse: () => ({ headersSent: true, status: statusFn }),
        }),
      } as unknown as ArgumentsHost);
      expect(statusFn).not.toHaveBeenCalled();

      // Contexto WebSocket es ignorado limpiamente
      filter.catch(new Error('ws err'), {
        getType: () => 'ws',
        switchToHttp: () => {
          throw new Error('Must not access HTTP on WS context');
        },
      } as unknown as ArgumentsHost);

      logSpy.mockRestore();
    });
  });

  describe('FASE-3: Concurrencia, Idempotencia, Límites DoS/SSRF y Sincronización BCNF', () => {
    it('Detecta TOCTOU en expectedVersion después de adquirir SELECT FOR UPDATE en transacción (#6)', async () => {
      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 't-toctou',
            publicId: '01JTOCTOU001',
            publicCode: 'TUR-000100-GE',
            version: 2,
            status: TicketStatus.ASSIGNED,
            cubicleId: 'cub-1',
          }),
        },
        idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation(async (cb) =>
          cb({
            $queryRaw: vi.fn().mockResolvedValue([]),
            idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null) },
            ticket: {
              // Entre la lectura inicial y el lock FOR UPDATE, otra petición incrementó version a 3
              findUnique: vi.fn().mockResolvedValue({
                id: 't-toctou',
                publicId: '01JTOCTOU001',
                publicCode: 'TUR-000100-GE',
                version: 3,
                status: TicketStatus.ASSIGNED,
                cubicleId: 'cub-1',
              }),
            },
          }),
        ),
      };

      const ticketsService = new TicketsService(mockPrisma, { emitEvent: vi.fn() } as any, {} as any);
      await expect(
        ticketsService.callTicket('01JTOCTOU001', 'u-1', 'corr-1', undefined, 2, UserRole.CASHIER, 'cub-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('Valida Idempotency-Key <= 100, hashea SHA-256 (64 chars), purga expiradas y redacta PII (#7, #22)', async () => {
      const longKey = 'K'.repeat(85); // 65..100 caracteres (antes causaba 22001 por VarChar(64))
      const createdIdemRecords: any[] = [];
      const deleteManySpy = vi.fn().mockResolvedValue({ count: 1 });
      const emitEventSpy = vi.fn();

      const expiredRow = {
        id: 'idem-old',
        requestHash: 'old-hash',
        expiresAt: new Date(Date.now() - 60_000),
        responseStatus: 200,
        responseBody: { stale: true },
      };

      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 't-idem-1',
            publicId: '01JIDEM001',
            publicCode: 'TUR-000101-GE',
            queueCategory: 'GENERAL',
            version: 1,
            status: TicketStatus.ASSIGNED,
            cubicleId: 'cub-1',
            prescriptionBarcode: 'RX-777',
          }),
        },
        idempotencyKey: {
          findUnique: vi.fn().mockResolvedValue(expiredRow),
          deleteMany: deleteManySpy,
        },
        $transaction: vi.fn().mockImplementation(async (cb) =>
          cb({
            $queryRaw: vi.fn().mockResolvedValue([]),
            idempotencyKey: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdIdemRecords.push(data);
                return data;
              }),
            },
            ticket: {
              findUnique: vi.fn().mockResolvedValue({
                id: 't-idem-1',
                publicId: '01JIDEM001',
                publicCode: 'TUR-000101-GE',
                queueCategory: 'GENERAL',
                version: 1,
                status: TicketStatus.ASSIGNED,
                cubicleId: 'cub-1',
                prescriptionBarcode: 'RX-777',
              }),
              update: vi.fn().mockResolvedValue({}),
            },
            ticketCall: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
            ticketStatusHistory: { create: vi.fn() },
            cubicle: { update: vi.fn().mockResolvedValue({ id: 'cub-1', code: 'CUB-01', displayName: 'Cubículo 01' }) },
          }),
        ),
      };

      const mockCubiclesService: any = {
        buildCubicleSnapshot: vi.fn().mockResolvedValue({
          cubicle: { id: 'cub-1', code: 'CUB-01', displayName: 'Cubículo 01', status: CubicleStatus.CALLING },
          activeTicket: {
            publicId: '01JIDEM001',
            publicCode: 'TUR-000101-GE',
            patientName: 'Paciente Confidencial PII',
            maskedDocument: '****5678',
          },
          waitingCount: 0,
        }),
      };

      const ticketsService = new TicketsService(mockPrisma, { emitEvent: emitEventSpy } as any, mockCubiclesService);

      // Llave > 100 chars rechazada con 400
      await expect(
        ticketsService.callTicket('01JIDEM001', 'u-1', 'corr', 'X'.repeat(101), 1, UserRole.CASHIER, 'cub-1'),
      ).rejects.toThrow(BadRequestException);

      const res = await ticketsService.callTicket('01JIDEM001', 'u-1', 'corr', longKey, 1, UserRole.CASHIER, 'cub-1');
      expect(res.statusCode).toBe(200);
      expect(deleteManySpy).toHaveBeenCalled();
      expect(createdIdemRecords).toHaveLength(1);
      expect(createdIdemRecords[0].idempotencyKey).toBe(longKey);
      expect(createdIdemRecords[0].requestHash).toMatch(/^[a-f0-9]{64}$/);
      // PII redactada en response_body persistido en DB
      expect(createdIdemRecords[0].responseBody.activeTicket.patientName).toBe('');
      expect(createdIdemRecords[0].responseBody.activeTicket.maskedDocument).toBeNull();

      // Reuso concurrente in-tx duplicado NO re-emite SSE y rechaza hash distinto con 409
      mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockImplementationOnce(async (cb: any) =>
        cb({
          $queryRaw: vi.fn().mockResolvedValue([]),
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue({
              requestHash: createdIdemRecords[0].requestHash,
              expiresAt: new Date(Date.now() + 60_000),
              responseBody: createdIdemRecords[0].responseBody,
            }),
          },
        }),
      );
      emitEventSpy.mockClear();
      await ticketsService.callTicket('01JIDEM001', 'u-1', 'corr', longKey, 1, UserRole.CASHIER, 'cub-1');
      expect(emitEventSpy).not.toHaveBeenCalled();

      // Misma Idempotency-Key pero expectedVersion distinto -> 409 STATE_CONFLICT incluso con clave activa
      mockPrisma.idempotencyKey.findUnique.mockResolvedValueOnce({
        requestHash: createdIdemRecords[0].requestHash,
        expiresAt: new Date(Date.now() + 60_000),
        responseBody: createdIdemRecords[0].responseBody,
      });
      await expect(
        ticketsService.callTicket('01JIDEM001', 'u-1', 'corr', longKey, 2, UserRole.CASHIER, 'cub-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('Acota pendingDetailsJson contra DoS/prototype pollution, lo omite fuera de PENDING_48H y preserva prescriptionBarcode (#9)', async () => {
      // DTO validation: >8KB, profundidad >4, >50 nodos y claves prohibidas (__proto__)
      expect(() => assertValidPendingDetailsJson('a'.repeat(8200))).toThrow();
      expect(() => assertValidPendingDetailsJson({ a: { b: { c: { d: { e: 1 } } } } })).toThrow();
      expect(() =>
        assertValidPendingDetailsJson(Array.from({ length: 51 }, (_, i) => i)),
      ).toThrow();
      const protoPayload = JSON.parse('{"__proto__":{"polluted":true}}');
      expect(() => assertValidPendingDetailsJson(protoPayload)).toThrow();

      const invalidDto = plainToInstance(TicketCommandDto, {
        resolution: DispensationResolution.PENDING_48H,
        pendingDetailsJson: { nested: { l2: { l3: { l4: { l5: 'too-deep' } } } } },
      });
      const dtoErrors = await validate(invalidDto);
      expect(dtoErrors.length).toBeGreaterThan(0);

      // Servicio closeTicket preserva prescriptionBarcode previo y limpia pendingDetailsJson si no es PENDING_48H
      const updatedTicketArgs: any[] = [];
      const createdDispensations: any[] = [];
      const mockPrisma: any = {
        ticket: {
          findFirst: vi.fn().mockResolvedValue({
            id: 't-close-9',
            publicId: '01JCLOSE009',
            publicCode: 'TUR-000109-GE',
            version: 4,
            status: TicketStatus.IN_SERVICE,
            cubicleId: 'cub-1',
            prescriptionBarcode: 'RX-BARCODE-ORIGINAL',
          }),
          count: vi.fn().mockResolvedValue(0),
        },
        idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn().mockImplementation(async (cb) =>
          cb({
            $queryRaw: vi.fn().mockResolvedValue([]),
            idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
            ticket: {
              findUnique: vi.fn().mockResolvedValue({
                id: 't-close-9',
                publicId: '01JCLOSE009',
                publicCode: 'TUR-000109-GE',
                version: 4,
                status: TicketStatus.IN_SERVICE,
                cubicleId: 'cub-1',
                facilityId: 'fac-1',
                patientName: 'Ana Pérez',
                prescriptionBarcode: 'RX-BARCODE-ORIGINAL',
                serviceStartedAt: new Date(Date.now() - 60_000),
              }),
              update: vi.fn().mockImplementation(async (args) => {
                updatedTicketArgs.push(args);
                return {};
              }),
              findFirst: vi.fn().mockResolvedValue(null),
            },
            cubicle: {
              findUnique: vi.fn().mockResolvedValue({ facilityId: 'fac-1' }),
              update: vi.fn().mockResolvedValue({}),
            },
            pharmacist: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
            dispensationRecord: {
              create: vi.fn().mockImplementation(async ({ data }) => {
                createdDispensations.push(data);
                return data;
              }),
            },
            ticketStatusHistory: { create: vi.fn() },
          }),
        ),
      };

      const mockCubiclesService: any = {
        buildCubicleSnapshot: vi.fn().mockResolvedValue({ cubicle: { id: 'cub-1' }, activeTicket: null, waitingCount: 0 }),
      };

      const ticketsService = new TicketsService(mockPrisma, { emitEvent: vi.fn() } as any, mockCubiclesService);
      await ticketsService.closeTicket(
        '01JCLOSE009',
        'usr-c1',
        'corr-close',
        undefined,
        4,
        UserRole.CASHIER,
        'cub-1',
        {
          expectedVersion: 4,
          resolution: DispensationResolution.TOTAL_DELIVERED,
          prescriptionCode: 'RX-BARCODE-ORIGINAL',
          pendingDetailsJson: { shouldBeStripped: true },
        },
      );

      expect(updatedTicketArgs[0].data.prescriptionBarcode).toBe('RX-BARCODE-ORIGINAL');
      expect(createdDispensations[0].pendingDetailsJson).toBe(Prisma.JsonNull);
    });

    it('Adquiere bloqueos determinísticos en cubículos y valida reglas BCNF en Users, Pharmacists y Facilities (#12-#15)', async () => {
      const lockedOrder: string[] = [];
      await lockCubicleRows(
        {
          $queryRaw: vi.fn().mockImplementation(async (_strings: TemplateStringsArray, id: string) => {
            lockedOrder.push(id);
            return [];
          }),
        },
        ['cub-z', 'cub-a', 'cub-z', null, 'cub-m'],
      );
      expect(lockedOrder).toEqual(['cub-a', 'cub-m', 'cub-z']);

      // PharmacistsService bloquea vinculación con cuenta no-CASHIER o inactiva, y valida cruce de sede
      const mockPrismaPharm: any = {
        pharmacist: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null) },
        facility: { findUnique: vi.fn().mockResolvedValue({ id: 'fac-1' }) },
        cubicle: { findUnique: vi.fn().mockResolvedValue({ id: 'cub-1', facilityId: 'fac-1' }) },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'u-adm', role: UserRole.ADMIN, active: true }),
        },
      };
      const pharmService = new PharmacistsService(mockPrismaPharm);
      await expect(
        pharmService.create({
          fullName: 'Farm. Test',
          licenseNumber: 'MN-9900',
          operationalRole: PharmacistOperationalRole.TITULAR,
          shift: WorkShift.MORNING,
          status: PharmacistStatus.ACTIVE,
          email: 'farm.test@cubiora.local',
          phone: '3001234567',
          facilityId: 'fac-1',
          cubicleId: 'cub-1',
          userId: 'u-adm',
        }),
      ).rejects.toThrow(ConflictException);

      // UsersService impide asignar cubículo a cuentas no-CASHIER y auto-desvincula al cambiar rol / desactivar
      const usersService = new UsersService(mockPrismaPharm);
      await expect(
        usersService.create({
          username: 'admin_con_cubiculo',
          displayName: 'Admin Inválido',
          password: 'PasswordSegura2026!',
          role: UserRole.ADMIN,
          cubicleId: 'cub-1',
          active: true,
        }),
      ).rejects.toThrow(ConflictException);

      // FacilitiesService impide desactivar sede primaria activa
      const mockPrismaFac: any = {
        facility: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'fac-prim',
            code: 'SEDE-CEN-01',
            isPrimary: true,
            status: FacilityStatus.ACTIVE,
            enabledCubiclesCount: 4,
            cubicles: [],
          }),
        },
      };
      const facService = new FacilitiesService(mockPrismaFac);
      await expect(
        facService.update('fac-prim', { status: FacilityStatus.INACTIVE }),
      ).rejects.toThrow(ConflictException);
    });

    it('Aplica límites SSE globales/por-IP con liberación y protege WmsIntegrationService contra SSRF y secreto débil (#26, #27)', async () => {
      const prevEnv = {
        NODE_ENV: process.env['NODE_ENV'],
        WMS_WEBHOOK_SECRET: process.env['WMS_WEBHOOK_SECRET'],
        WMS_WEBHOOK_URL: process.env['WMS_WEBHOOK_URL'],
      };

      try {
        vi.stubEnv('SSE_MAX_SUBSCRIBERS', '3');
        vi.stubEnv('SSE_MAX_SUBSCRIBERS_PER_IP', '2');

        const displayService = new PublicDisplayService({} as any);
        const sub1 = displayService.getEventStream('10.0.0.10').subscribe();
        const sub2 = displayService.getEventStream('10.0.0.10').subscribe();

        // Exceso por IP -> 429 TOO_MANY_REQUESTS
        expect(() => displayService.getEventStream('10.0.0.10')).toThrow(HttpException);

        // Otra IP alcanza tope global = 3 -> siguiente falla con 429
        const sub3 = displayService.getEventStream('10.0.0.20').subscribe();
        expect(() => displayService.getEventStream('10.0.0.30')).toThrow(HttpException);

        // Al desuscribirse, libera cuota correctamente
        sub1.unsubscribe();
        const sub4 = displayService.getEventStream('10.0.0.10').subscribe();
        sub2.unsubscribe();
        sub3.unsubscribe();
        sub4.unsubscribe();

        // WmsIntegrationService (#27)
        vi.unstubAllEnvs();
        const wms = new WmsIntegrationService();
        const samplePayload = {
          ticketId: 't-1',
          publicCode: 'TUR-000001-GE',
          queueCategory: 'GENERAL',
          cubicleCode: 'CUB-01',
          calledAt: new Date().toISOString(),
        };

        // Sin secreto configurado falla cerrado
        delete process.env['WMS_WEBHOOK_SECRET'];
        expect(() => wms.signPayload(samplePayload)).toThrow();

        // Secreto corto en producción falla
        process.env['NODE_ENV'] = 'production';
        process.env['WMS_WEBHOOK_SECRET'] = 'secreto_corto_12345';
        expect(() => wms.signPayload(samplePayload)).toThrow();

        // Rechaza URLs SSRF / no-HTTPS (http://, localhost, IP privada, .internal)
        process.env['WMS_WEBHOOK_SECRET'] = 'w'.repeat(40);
        for (const badUrl of [
          'http://wms.ejemplo.com/hook',
          'https://192.168.1.33/hook',
          'https://localhost/hook',
          'https://metadata.google.internal/computeMetadata',
        ]) {
          process.env['WMS_WEBHOOK_URL'] = badUrl;
          await expect(wms.notifyPrePickingOnCall(samplePayload)).rejects.toThrow();
        }
      } finally {
        vi.unstubAllEnvs();
        if (prevEnv.NODE_ENV === undefined) delete process.env['NODE_ENV'];
        else process.env['NODE_ENV'] = prevEnv.NODE_ENV;
        if (prevEnv.WMS_WEBHOOK_SECRET === undefined) delete process.env['WMS_WEBHOOK_SECRET'];
        else process.env['WMS_WEBHOOK_SECRET'] = prevEnv.WMS_WEBHOOK_SECRET;
        if (prevEnv.WMS_WEBHOOK_URL === undefined) delete process.env['WMS_WEBHOOK_URL'];
        else process.env['WMS_WEBHOOK_URL'] = prevEnv.WMS_WEBHOOK_URL;
      }
    });
  });
});
