import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminUserDto, UserRole } from '@cubiora/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('active') active?: string,
  ): Promise<{ success: true; data: AdminUserDto[] }> {
    const parsedActive =
      active === 'true' ? true : active === 'false' ? false : undefined;
    const data = await this.usersService.findAll({
      search,
      role,
      active: parsedActive,
    });
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateUserDto,
  ): Promise<{ success: true; data: AdminUserDto }> {
    const data = await this.usersService.create(dto);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ success: true; data: AdminUserDto }> {
    const data = await this.usersService.update(id, dto, actor);
    return { success: true, data };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/password')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
  ): Promise<{ success: true; data: { reset: true; id: string; username: string } }> {
    const data = await this.usersService.resetPassword(id, dto.newPassword);
    return { success: true, data };
  }
}

