import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { ApiErrorCode, isValidTicketCode, isValidPublicId } from '@cubiora/shared';

/**
 * Pipe de validación estricta para parámetros de ruta que deben ser publicId.
 * Rechaza expresamente si se envía un publicCode (ej: TUR-000123-GE)
 * o cualquier identificador no conforme con ULID o UUID.
 */
@Injectable()
export class ParsePublicIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException({
        code: ApiErrorCode.REQUEST_INVALID,
        message: 'El identificador publicId es obligatorio en la ruta.',
      });
    }

    const trimmed = value.trim();

    // Si coincide con el formato de código público de turno, rechazar con mensaje específico
    if (isValidTicketCode(trimmed)) {
      throw new BadRequestException({
        code: ApiErrorCode.REQUEST_INVALID,
        message:
          'Identificador inválido: los comandos de turno (/call, /start-service, /close, /no-show) requieren publicId, no publicCode.',
      });
    }

    // Debe ser un ULID o UUID válido
    if (!isValidPublicId(trimmed)) {
      throw new BadRequestException({
        code: ApiErrorCode.REQUEST_INVALID,
        message: `El parámetro '${trimmed}' no es un publicId válido (se requiere formato ULID o UUID).`,
      });
    }

    return trimmed;
  }
}
