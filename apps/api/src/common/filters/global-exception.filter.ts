import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorCode } from '@cubiora/shared';

/**
 * Formato de error estándar de la API.
 * NUNCA incluir stacktrace ni detalles internos.
 */
interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
}

/**
 * Mapa de HttpStatus a ApiErrorCode para garantizar respuestas consistentes.
 */
const HTTP_STATUS_TO_ERROR_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ApiErrorCode.REQUEST_INVALID,
  [HttpStatus.UNAUTHORIZED]: ApiErrorCode.AUTH_REQUIRED,
  [HttpStatus.FORBIDDEN]: ApiErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ApiErrorCode.RESOURCE_NOT_FOUND,
  [HttpStatus.CONFLICT]: ApiErrorCode.STATE_CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ApiErrorCode.BUSINESS_RULE_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ApiErrorCode.DEPENDENCY_UNAVAILABLE,
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Leer correlationId inyectado por el middleware
    const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';

    let statusCode: number;
    let errorCode: ApiErrorCode;
    let message: string;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      errorCode =
        HTTP_STATUS_TO_ERROR_CODE[statusCode] ?? ApiErrorCode.INTERNAL_ERROR;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? exception.message;

        // ValidationPipe devuelve array de mensajes — los estructuramos en details
        if (Array.isArray(resp['message'])) {
          message = 'La solicitud contiene datos inválidos';
          details = { validationErrors: resp['message'] };
        }
      } else {
        message = String(exceptionResponse);
      }
    } else {
      // Error interno no controlado
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = ApiErrorCode.INTERNAL_ERROR;
      message = 'Ha ocurrido un error interno. Por favor intente más tarde.';

      // Registrar el error completo en el log (nunca en la respuesta)
      this.logger.error(
        {
          correlationId,
          path: request.url,
          method: request.method,
        },
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      correlationId,
    };

    response.status(statusCode).json(body);
  }
}
