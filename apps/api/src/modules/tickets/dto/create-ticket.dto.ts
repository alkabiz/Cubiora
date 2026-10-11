import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
  @IsBoolean({ message: 'La bandera de prioridad debe ser booleana' })
  priority?: boolean;
}
