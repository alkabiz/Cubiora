import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { FacilityDto, UserRole } from '@cubiora/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignPharmacistToFacilityDto } from './dto/assign-pharmacist-to-facility.dto';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { FacilitiesService } from './facilities.service';

@Controller('admin/facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(): Promise<{ success: true; data: FacilityDto[] }> {
    const data = await this.facilitiesService.findAll();
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateFacilityDto,
  ): Promise<{ success: true; data: FacilityDto }> {
    const data = await this.facilitiesService.create(dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFacilityDto,
  ): Promise<{ success: true; data: FacilityDto }> {
    const data = await this.facilitiesService.update(id, dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id') id: string,
  ): Promise<{ success: true; data: FacilityDto }> {
    const data = await this.facilitiesService.activate(id);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/assign-pharmacist')
  @HttpCode(HttpStatus.OK)
  async assignPharmacist(
    @Param('id') id: string,
    @Body() dto: AssignPharmacistToFacilityDto,
  ): Promise<{ success: true; data: FacilityDto }> {
    const data = await this.facilitiesService.assignPharmacist(id, dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<{ success: true; data: { deleted: true; id: string } }> {
    const data = await this.facilitiesService.remove(id);
    return { success: true, data };
  }
}

