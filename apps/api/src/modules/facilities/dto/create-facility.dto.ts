import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { FacilityStatus } from '@cubiora/shared';

export class CreateFacilityDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @MinLength(2, { message: 'El código de la sede es obligatorio.' })
  @MaxLength(30)
  code!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'El nombre oficial de la sede es obligatorio.' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3, { message: 'La dirección física es obligatoria.' })
  @MaxLength(200)
  address!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'La ciudad o jurisdicción es obligatoria.' })
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(80)
  openingHours?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  enabledCubiclesCount?: number;

  @IsOptional()
  @IsEnum(FacilityStatus)
  status?: FacilityStatus;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

