import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CubiclesService } from './cubicles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  UserRole,
  CubicleDailyPerformance,
  CubicleOptionDto,
  CubicleSnapshot,
  UpdateCubicleOperatorResponse,
} from '@cubiora/shared';
import { UpdateCubicleOperatorDto } from './dto/update-cubicle-operator.dto';

@Controller('cubicles')
export class CubiclesController {
  constructor(private readonly cubiclesService: CubiclesService) {}

  /**
   * GET /api/v1/cubicles
   * Lista los cubículos seleccionables según rol (ADMIN ve los cubículos activos;
   * CASHIER ve únicamente su cubículo asignado si posee uno).
   */
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @Get()
  async listSelectableCubicles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('facilityId') facilityId?: string,
  ): Promise<{ success: true; data: CubicleOptionDto[] }> {
    const data = await this.cubiclesService.listSelectableCubicles(user, facilityId);
    return {
      success: true,
      data,
    };
  }

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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: CubicleSnapshot }> {
    const data = await this.cubiclesService.getCubicleSnapshotByCode(code, user);
    return {
      success: true,
      data,
    };
  }

  /**
   * PATCH /api/v1/cubicles/:id/operator
   * Actualiza el operador asignado a un cubículo (texto o farmacéutico vinculado).
   * ADMIN y CASHIER pueden actualizar.
   * Campo vacío '' borra el operador.
   */
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  @Patch(':id/operator')
  async updateOperator(
    @Param('id') id: string,
    @Body() body: UpdateCubicleOperatorDto,
  ): Promise<{ success: true; data: UpdateCubicleOperatorResponse }> {
    const data =
      body.pharmacistId !== undefined
        ? await this.cubiclesService.updateOperator(
            id,
            body.operatorName,
            body.pharmacistId,
          )
        : await this.cubiclesService.updateOperator(id, body.operatorName);
    return { success: true, data };
  }
}
