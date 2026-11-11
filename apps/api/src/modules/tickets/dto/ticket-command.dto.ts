import { IsOptional, IsInt, Min, IsEnum, IsString, MaxLength } from 'class-validator';
import { DispensationResolution } from '@cubiora/shared';

export class TicketCommandDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsEnum(DispensationResolution)
  resolution?: DispensationResolution;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  prescriptionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mipresNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  itemsDeliveredCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  itemsPendingCount?: number;

  @IsOptional()
  pendingDetailsJson?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  deliveryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
