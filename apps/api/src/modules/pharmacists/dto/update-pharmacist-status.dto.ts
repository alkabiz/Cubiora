import { IsEnum } from 'class-validator';
import { PharmacistStatus } from '@cubiora/shared';

export class UpdatePharmacistStatusDto {
  @IsEnum(PharmacistStatus)
  status!: PharmacistStatus;
}

