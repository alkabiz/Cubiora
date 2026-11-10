import { IsBoolean } from 'class-validator';

/**
 * DTO para habilitar o deshabilitar operativamente un cubículo desde SCR-ADM-002.
 */
export class UpdateAdminCubicleStatusDto {
  @IsBoolean()
  active!: boolean;
}

