import { Controller, Get, Param } from '@nestjs/common';
import { CubiclesService } from './cubicles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole, CubicleDailyPerformance, CubicleSnapshot } from '@cubiora/shared';

@Controller('cubicles')
export class CubiclesController {
  constructor(private readonly cubiclesService: CubiclesService) {}

  /**
   * GET /api/v1/cubicles/:code/daily-performance
   * Rendimiento diario del cubículo calculado desde PostgreSQL.
   * CASHIER solo puede consultar su cubículo asignado; ADMIN puede consultar cualquier cubículo.
   * No expone datos personales.
   */
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Get(':code/daily-performance')
  async getDailyPerformance(
    @Param('code') code: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: CubicleDailyPerformance }> {
    const data = await this.cubiclesService.getDailyPerformance(code, user);
    return {
      success: true,
      data,
    };
  }

  /**
   * GET /api/v1/cubicles/:code/current
   * Retorna el snapshot actual del cubículo (estado del cubículo y turno activo si existe).
   */
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Get(':code/current')
  async getCurrentSnapshot(
    @Param('code') code: string,
  ): Promise<{ success: boolean; data: CubicleSnapshot }> {
    const data = await this.cubiclesService.getOrCreateCubicleByCode(code);
    return {
      success: true,
      data,
    };
  }
}
