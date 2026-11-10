import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  PharmacistOperationalRole,
  PharmacistStatus,
  WorkShift,
} from '@cubiora/shared';

function normalizeNullableId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value as string;
}

export class UpdatePharmacistDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @MinLength(2)
  @MaxLength(40)
  licenseNumber?: string;

  @IsOptional()
  @IsEnum(PharmacistOperationalRole)
  operationalRole?: PharmacistOperationalRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  facilityId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  cubicleId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  defaultCubicleId?: string | null;

  @IsOptional()
  @IsEnum(WorkShift)
  shift?: WorkShift;

  @IsOptional()
  @IsEnum(PharmacistStatus)
  status?: PharmacistStatus;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  userId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  dispatchesCount?: number;
}

