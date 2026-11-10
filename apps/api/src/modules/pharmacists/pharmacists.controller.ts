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
  Query,
} from '@nestjs/common';
import {
  PharmacistDto,
  PharmacistsListResponseDto,
  UserRole,
} from '@cubiora/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { PharmacistsService } from './pharmacists.service';
import { CreatePharmacistDto } from './dto/create-pharmacist.dto';
import { UpdatePharmacistDto } from './dto/update-pharmacist.dto';
import { UpdatePharmacistStatusDto } from './dto/update-pharmacist-status.dto';

@Controller('admin/pharmacists')
export class PharmacistsController {
  constructor(private readonly pharmacistsService: PharmacistsService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('facilityId') facilityId?: string,
    @Query('operationalRole') operationalRole?: string,
    @Query('status') status?: string,
  ): Promise<{ success: true; data: PharmacistsListResponseDto }> {
    const data = await this.pharmacistsService.findAll({
      search,
      facilityId,
      operationalRole,
      status,
    });
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePharmacistDto,
  ): Promise<{ success: true; data: PharmacistDto }> {
    const data = await this.pharmacistsService.create(dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePharmacistDto,
  ): Promise<{ success: true; data: PharmacistDto }> {
    const data = await this.pharmacistsService.update(id, dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePharmacistStatusDto,
  ): Promise<{ success: true; data: PharmacistDto }> {
    const data = await this.pharmacistsService.updateStatus(id, dto.status);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<{ success: true; data: { deleted: true; id: string } }> {
    const data = await this.pharmacistsService.remove(id);
    return { success: true, data };
  }
}

