import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QueueCategory } from '@cubiora/shared';

export class CreateTicketDto {
  @IsString({ message: 'El nombre del paciente debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del paciente es obligatorio' })
  @MinLength(2, { message: 'El nombre debe contener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  patientName!: string;

  @IsOptional()
  @IsString({ message: 'El documento del paciente debe ser texto' })
  @MinLength(3, { message: 'El documento debe contener al menos 3 caracteres' })
  @MaxLength(30, { message: 'El documento no puede exceder 30 caracteres' })
  patientDocument?: string;

  @IsOptional()
  @IsEnum(QueueCategory, { message: 'La categoría de cola debe ser GENERAL o PREFERENTIAL' })
  queueCategory?: QueueCategory;

  @IsOptional()
  @IsString({ message: 'El motivo operacional debe ser texto' })
  @MaxLength(100, { message: 'El motivo no puede exceder 100 caracteres' })
  operationalReason?: string;

  @IsOptional()
  @IsBoolean({ message: 'La bandera de prioridad debe ser booleana' })
  priority?: boolean;
}
