import { Controller, Get, Param } from '@nestjs/common';
import { CubiclesService } from './cubicles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, CubicleSnapshot } from '@cubiora/shared';

@Controller('cubicles')
export class CubiclesController {
  constructor(private readonly cubiclesService: CubiclesService) {}

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
