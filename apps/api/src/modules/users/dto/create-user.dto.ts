import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
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

export class CreateUserDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MinLength(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres.' })
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      'El nombre de usuario solo admite letras minúsculas, números, puntos, guiones y guiones bajos.',
  })
  username!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'El nombre visible es obligatorio.' })
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;

  @IsEnum(UserRole, { message: 'El rol operativo seleccionado no es válido.' })
  role!: UserRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNullableId(value))
  @IsString()
  @MaxLength(26)
  cubicleId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

