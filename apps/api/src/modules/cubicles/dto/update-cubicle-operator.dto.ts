import { IsString, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para actualizar el nombre del operador de un cubículo.
 * Campo vacío ('') es válido para borrar el operador asignado.
 */
export class UpdateCubicleOperatorDto {
  /**
   * Nombre del operador asignado al cubículo.
   * Permite letras (incluidas acentuadas), espacios, puntos y guiones.
   * Cadena vacía '' para borrar el operador.
   * Máximo 120 caracteres después de trim.
   */
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(120)
  @Matches(/^[a-zA-ZÀ-ÿ\s.\-]*$/, {
    message:
      'operatorName solo puede contener letras, espacios, puntos y guiones.',
  })
  operatorName!: string;
}
