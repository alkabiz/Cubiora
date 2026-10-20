/**
 * Tipos de estado y modelo de datos para la pantalla de atención en cubículo (CubicleScreen).
 */

/**
 * Estados del ciclo de atención de un turno en el cubículo.
 */
export type TurnoEstado =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'CALLED'
  | 'IN_SERVICE'
  | 'CLOSED';

/**
 * Estado de conectividad de la aplicación con el servidor central.
 */
export type ConexionEstado = 'ONLINE' | 'OFFLINE' | 'VERIFYING';

/**
 * Modelo de datos del turno manipulado en la consola de atención.
 */
export interface Turno {
  codigo: string;
  paciente: string;
  horaAsignacion: string;
  horaLlamado?: string;
  horaInicio?: string;
}
