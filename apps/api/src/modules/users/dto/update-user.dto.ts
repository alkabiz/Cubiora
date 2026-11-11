import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@cubiora/shared';

function normalizeNullableId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value as string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'El nombre visible debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol operativo seleccionado no es válido.' })
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  cubicleId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

