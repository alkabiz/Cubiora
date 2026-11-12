import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QueueCategory } from '@cubiora/shared';

export class GetTicketHistoryQueryDto {
  @IsOptional()
  @IsString({ message: 'El filtro de búsqueda debe ser texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(80, { message: 'El filtro de búsqueda no puede exceder 80 caracteres' })
  search?: string;

  @IsOptional()
  @IsIn(['ALL', 'IN_NORM', 'EXCEEDED'], {
    message: 'slaFilter debe ser ALL, IN_NORM o EXCEEDED',
  })
  slaFilter?: 'ALL' | 'IN_NORM' | 'EXCEEDED';

  @IsOptional()
  @IsEnum(QueueCategory, {
    message: 'queueCategory debe ser un valor válido de QueueCategory',
  })
  queueCategory?: QueueCategory;

  @IsOptional()
  @IsString({ message: 'facilityId debe ser texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(40, { message: 'facilityId no puede exceder 40 caracteres' })
  facilityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser al menos 1' })
  @Max(1000, { message: 'page no puede exceder 1000' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;
}

