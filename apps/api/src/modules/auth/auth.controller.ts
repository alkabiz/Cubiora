import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@cubiora/shared';
import { AppEnv, getEnv } from '../../config/env.validation';

export function resolveCookieSecure(
  request: Request | undefined,
  env: Pick<AppEnv, 'NODE_ENV' | 'COOKIE_SECURE'>,
): boolean {
  const mode = env.COOKIE_SECURE ?? 'auto';
  if (mode === 'true') {
    return true;
  }
  if (mode === 'false') {
    return false;
  }

  if (request) {
    if (request.secure) {
      return true;
    }

    const forwardedProto = request.headers?.['x-forwarded-proto'];
    if (typeof forwardedProto === 'string') {
      const firstProto = forwardedProto.split(',')[0]?.trim().toLowerCase();
      return firstProto === 'https';
    }
    if (Array.isArray(forwardedProto)) {
      const firstEntry = forwardedProto[0];
      const firstProto = typeof firstEntry === 'string'
        ? firstEntry.split(',')[0]?.trim().toLowerCase()
        : undefined;
      return firstProto === 'https';
    }

    return false;
  }

  return env.NODE_ENV === 'production';
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request?: Request,
  ) {
    try {
      const result = await this.authService.login(loginDto.username, loginDto.password);
      const env = getEnv();
      const isSecureCookie = resolveCookieSecure(request, env);

      // Establecer cookie HttpOnly protegida conforme a D-01 y protocolo detectado detrás de proxy
      response.cookie('cubiora_session', result.token, {
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000, // 8 horas
        path: '/',
      });

      return {
        success: true,
        data: result.user,
      };
    } catch (err) {
      if (!(err instanceof HttpException)) {
        this.logger.error(
          `Excepción inesperada durante POST /auth/login para '${loginDto?.username ?? 'desconocido'}': ${
            err instanceof Error ? err.message : String(err)
          }`,
          err instanceof Error ? err.stack : undefined,
        );
      }
      throw err;
    }
  }

  @Roles(UserRole.RECEPTION, UserRole.CASHIER, UserRole.ADMIN)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) response: Response,
    @Req() request?: Request,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (user?.id && typeof this.authService?.revokeSessions === 'function') {
      await this.authService.revokeSessions(user.id);
    }

    const env = getEnv();
    const isSecureCookie = resolveCookieSecure(request, env);

    response.clearCookie('cubiora_session', {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'strict',
      path: '/',
    });

    return {
      success: true,
      message: 'Sesión finalizada exitosamente',
    };
  }

  @Roles(UserRole.RECEPTION, UserRole.CASHIER, UserRole.ADMIN)
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const freshUser = await this.authService.getMe(user.id);
    return {
      success: true,
      data: freshUser,
    };
  }
}
