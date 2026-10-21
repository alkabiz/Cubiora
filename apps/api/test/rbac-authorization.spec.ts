import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { SessionTokenUtil } from '../src/modules/auth/session-token.util';
import * as envModule from '../src/config/env.validation';
import { UserRole } from '@cubiora/shared';

describe('Demostración de Autorización y Control de Acceso (RBAC)', () => {
  const sessionSecret = 'a'.repeat(64); // 64 caracteres válidos
  let reflector: Reflector;
  let authGuard: AuthGuard;
  let rolesGuard: RolesGuard;

  beforeAll(() => {
    vi.spyOn(envModule, 'getEnv').mockReturnValue({
      NODE_ENV: 'test',
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

  beforeEach(() => {
    process.env['SESSION_SECRET'] = sessionSecret;
    reflector = new Reflector();
    authGuard = new AuthGuard(reflector);
    rolesGuard = new RolesGuard(reflector);
  });

  function createMockContext(req: Record<string, unknown>, handlerRoles?: UserRole[], isPublic = false): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('1. Endpoint privado sin sesión debe arrojar 401 Unauthorized', () => {
    const context = createMockContext({
      headers: {},
      cookies: {},
      signedCookies: {},
    });

    expect(() => authGuard.canActivate(context)).toThrow(UnauthorizedException);
    try {
      authGuard.canActivate(context);
    } catch (e: unknown) {
      const err = e as { getResponse: () => { code: string; message: string } };
      expect(err.getResponse().code).toBe('AUTH_REQUIRED');
    }
  });

  it('2. Recepción intentando cerrar turno debe arrojar 403 Forbidden', () => {
    const context = createMockContext({
      user: {
        id: 'user_recepcion_1',
        role: UserRole.RECEPTION,
      },
    });

    // Endpoint de cerrar turno requiere CASHIER o ADMIN
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'roles') return [UserRole.CASHIER, UserRole.ADMIN];
      return false; // no public
    });

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('3. Operador de CUB-02 intentando operar en CUB-01 debe arrojar 403 Forbidden', () => {
    const context = createMockContext({
      user: {
        id: 'cajero_cub2',
        role: UserRole.CASHIER,
        cubicleId: 'CUB-02',
      },
      params: {
        cubicleId: 'CUB-01', // intento de operar cubículo ajeno
      },
    });

    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'roles') return [UserRole.CASHIER, UserRole.ADMIN];
      return false;
    });

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    try {
      rolesGuard.canActivate(context);
    } catch (e: unknown) {
      const err = e as { getResponse: () => { message: string } };
      expect(err.getResponse().message).toContain('restringido a su cubículo');
    }
  });

  it('4. Pantalla pública no accede a paciente ni a endpoints privados (401/403)', () => {
    // Petición anónima o con token de display intentando acceder a ruta de paciente
    const context = createMockContext({
      headers: { authorization: 'Bearer invalid_or_display_only_token' },
      cookies: {},
      signedCookies: {},
    });

    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false); // endpoint privado

    expect(() => authGuard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('5. Usuario inactivo debe ser rechazado con 401 Unauthorized', () => {
    const inactiveToken = SessionTokenUtil.sign(
      {
        sub: 'inactive_user_1',
        publicId: '01J9X1K4M5N6P7Q8R9S0T1V2W3',
        username: 'desactivado',
        displayName: 'Usuario Desactivado',
        role: UserRole.CASHIER,
        cubicleId: 'CUB-01',
        status: 'INACTIVE',
      } as unknown as Parameters<typeof SessionTokenUtil.sign>[0],
      sessionSecret,
      3600,
    );

    const context = createMockContext({
      headers: { authorization: `Bearer ${inactiveToken}` },
      cookies: {},
      signedCookies: {},
    });

    expect(() => authGuard.canActivate(context)).toThrow(UnauthorizedException);
    try {
      authGuard.canActivate(context);
    } catch (e: unknown) {
      const err = e as { getResponse: () => { message: string } };
      expect(err.getResponse().message).toContain('usuario se encuentra inactivo');
    }
  });

  it('6. Sesión expirada debe ser rechazada con 401 Unauthorized', () => {
    // Token con tiempo de expiración negativo (-10 segundos)
    const expiredToken = SessionTokenUtil.sign(
      {
        sub: 'user_expired',
        publicId: '01J9X1K4M5N6P7Q8R9S0T1V2W3',
        username: 'expirado',
        displayName: 'Usuario Expirado',
        role: UserRole.RECEPTION,
        cubicleId: null,
      },
      sessionSecret,
      -10, // expiró hace 10 segundos
    );

    const context = createMockContext({
      headers: { authorization: `Bearer ${expiredToken}` },
      cookies: {},
      signedCookies: {},
    });

    expect(() => authGuard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('7. Rol administrador está limitado según matriz (denegación por defecto si endpoint carece de roles)', () => {
    const context = createMockContext({
      user: {
        id: 'admin_1',
        role: UserRole.ADMIN,
      },
    });

    // Endpoint sin roles definidos: la denegación por defecto debe rechazar a todos
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'roles') return []; // sin roles
      return false;
    });

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });
});
