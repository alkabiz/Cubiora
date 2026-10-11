import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@cubiora/shared';
import { getEnv } from '../../config/env.validation';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto.username, loginDto.password);
    const env = getEnv();

    // Establecer cookie HttpOnly protegida conforme a D-01
    response.cookie('cubiora_session', result.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
      path: '/',
    });

    return {
      success: true,
      data: result.user,
    };
  }

  @Roles(UserRole.RECEPTION, UserRole.CASHIER, UserRole.ADMIN)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('cubiora_session', {
      httpOnly: true,
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
