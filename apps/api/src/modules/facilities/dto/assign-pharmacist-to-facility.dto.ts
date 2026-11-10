import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

function normalizeNullableId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value as string;
}

export class AssignPharmacistToFacilityDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Debe seleccionar un farmacéutico válido.' })
  @MaxLength(26)
  pharmacistId!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  cubicleId?: string | null;
}

