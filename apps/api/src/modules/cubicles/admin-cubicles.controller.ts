import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminCubicleConfigDto, UserRole } from '@cubiora/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CubiclesService } from './cubicles.service';
import { AssignCubiclePharmacistDto } from './dto/assign-cubicle-pharmacist.dto';
import { UpdateAdminCubicleStatusDto } from './dto/update-admin-cubicle-status.dto';

@Controller('admin/cubicles')
export class AdminCubiclesController {
  constructor(private readonly cubiclesService: CubiclesService) {}

  /**
   * GET /api/v1/admin/cubicles
   * Lista los cubículos parametrizados (de la sede primaria o facilityId indicado)
   * junto con el farmacéutico asignado y métricas operativas del día.
   */
  @Roles(UserRole.ADMIN)
  @Get()
  async listAdminCubicles(
    @Query('facilityId') facilityId?: string,
  ): Promise<{ success: true; data: AdminCubicleConfigDto[] }> {
    const data = await this.cubiclesService.getAdminCubicles(facilityId);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/admin/cubicles/:id/assign-pharmacist
   * Asigna o desvincula un farmacéutico registrado en la base de datos a un cubículo
   * manteniendo sincronizado Cubicle.operatorName y Pharmacist.cubicleId.
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/assign-pharmacist')
  async assignPharmacist(
    @Param('id') id: string,
    @Body() body: AssignCubiclePharmacistDto,
  ): Promise<{ success: true; data: AdminCubicleConfigDto }> {
    const data = await this.cubiclesService.assignPharmacistToCubicle(
      id,
      body.pharmacistId ?? null,
      body.operatorName,
    );
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/admin/cubicles/:id/status
   * Habilita o desactiva operativamente un cubículo.
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  async updateCubicleStatus(
    @Param('id') id: string,
    @Body() body: UpdateAdminCubicleStatusDto,
  ): Promise<{ success: true; data: AdminCubicleConfigDto }> {
    const data = await this.cubiclesService.updateAdminCubicleStatus(id, body.active);
    return { success: true, data };
  }
}

