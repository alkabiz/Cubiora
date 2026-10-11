import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionTokenUtil } from '../src/modules/auth/session-token.util';
import { UserRole } from '@cubiora/shared';
import * as bcrypt from 'bcryptjs';

import { initEnv } from '../src/config/env.validation';

describe('Fase 3a — Autenticación y Autorización (D-01, D-09, RolesGuard)', () => {
  let authService: AuthService;
  let authController: AuthController;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockSecret = 'test_session_secret_at_least_32_characters_long_for_auth_spec';

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = mockSecret;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.DISPLAY_TOKEN = 'display_token_min_32_chars_local_test!';
    initEnv();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        RolesGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('SessionTokenUtil (D-01: Cookies firmadas sin tabla user_sessions)', () => {
    it('debe firmar y verificar tokens válidos con HMAC-SHA256', () => {
      const payload = {
        sub: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        publicId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        username: 'recepcion1',
        displayName: 'Operador Recepción',
        role: UserRole.RECEPTION,
        cubicleId: null,
      };

      const token = SessionTokenUtil.sign(payload, mockSecret, 3600);
      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const verified = SessionTokenUtil.verify(token, mockSecret);
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe(payload.sub);
      expect(verified?.role).toBe(UserRole.RECEPTION);
    });

    it('debe rechazar tokens con firma adulterada (tampering protection)', () => {
      const token = SessionTokenUtil.sign(
        {
          sub: 'user1',
          publicId: 'pub1',
          username: 'user1',
          displayName: 'User',
          role: UserRole.RECEPTION,
          cubicleId: null,
        },
        mockSecret,
      );

      const [payloadB64] = token.split('.');
      const forgedToken = `${payloadB64}.firma_falsa_invalida_totalmente`;

      const verified = SessionTokenUtil.verify(forgedToken, mockSecret);
      expect(verified).toBeNull();
    });
  });

  describe('AuthService.login y getMe', () => {
    it('debe autenticar exitosamente a un usuario con credenciales correctas', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_ulid_123',
        publicId: 'user_pub_123',
        username: 'cajero1',
        passwordHash: hashedPassword,
        displayName: 'Cajero 1',
        role: UserRole.CASHIER,
        cubicleId: 'cub_01',
        active: true,
      });

      const result = await authService.login('cajero1', 'CorrectPassword123!');
      expect(result.token).toBeDefined();
      expect(result.user.username).toBe('cajero1');
      expect(result.user.role).toBe(UserRole.CASHIER);
      expect(result.user.cubicleId).toBe('cub_01');
    });

    it('debe rechazar contraseñas incorrectas con UnauthorizedException', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_ulid_123',
        publicId: 'user_pub_123',
        username: 'cajero1',
        passwordHash: hashedPassword,
        active: true,
      });

      await expect(authService.login('cajero1', 'WrongPassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe rechazar usuarios inactivos con UnauthorizedException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_ulid_123',
        publicId: 'user_pub_123',
        username: 'inactivo',
        passwordHash: 'hash',
        active: false,
      });

      await expect(authService.login('inactivo', 'Password123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('RolesGuard (Denegación por defecto y caja limitada a su cubículo)', () => {
    function createMockContext(user: any, params: any = {}, body: any = {}, handlerRoles?: UserRole[]) {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === 'roles') return handlerRoles as any;
        if (key === 'isPublic') return false as any;
        return undefined as any;
      });

      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            params,
            body,
            query: {},
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('debe DENEGAR POR DEFECTO si el endpoint no tiene roles declarados ni es público', () => {
      const context = createMockContext({ role: UserRole.ADMIN }, {}, {}, undefined);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('debe PERMITIR acceso cuando el usuario tiene el rol requerido', () => {
      const context = createMockContext(
        { role: UserRole.RECEPTION },
        {},
        {},
        [UserRole.RECEPTION, UserRole.ADMIN],
      );
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('debe DENEGAR acceso cuando el usuario tiene un rol distinto al requerido', () => {
      const context = createMockContext(
        { role: UserRole.CASHIER },
        {},
        {},
        [UserRole.RECEPTION],
      );
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('REGLA CAJA: debe DENEGAR con 403 si un CASHIER intenta operar en un cubículo ajeno', () => {
      const context = createMockContext(
        { role: UserRole.CASHIER, cubicleId: 'cub_01' },
        { cubicleId: 'cub_02' }, // Intento de operar en cubículo 2
        {},
        [UserRole.CASHIER],
      );

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('REGLA CAJA: debe PERMITIR si el CASHIER opera sobre su propio cubículo asignado', () => {
      const context = createMockContext(
        { role: UserRole.CASHIER, cubicleId: 'cub_01' },
        { cubicleId: 'cub_01' }, // Mismo cubículo
        {},
        [UserRole.CASHIER],
      );

      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });
});
