import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para asignar o desvincular un farmacéutico registrado a un cubículo desde SCR-ADM-002.
 */
export class AssignCubiclePharmacistDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(26)
  pharmacistId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  @Matches(/^(?!-)[a-zA-ZÀ-ÿ\s.-]*$/, {
    message:
      'operatorName solo puede contener letras, espacios, puntos y guiones, y no puede iniciar con guión.',
  })
  operatorName?: string;
}

