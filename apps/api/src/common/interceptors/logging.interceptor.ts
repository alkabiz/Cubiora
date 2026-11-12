import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interceptor de logging estructurado.
 * Registra método, ruta, status code, duración en ms y Correlation ID.
 *
 * REGLAS DE SEGURIDAD Y PRIVACIDAD:
 * - NUNCA registrar payloads con contraseñas, tokens ni datos personales (nombre o documento del paciente).
 * - Solo registra metadatos de la petición y respuesta.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (typeof context.getType === 'function' && context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const method = req.method;
    const rawUrl = req.originalUrl || req.url || '';
    const url = rawUrl.split('?')[0] ?? rawUrl;
    const rawCorrelationId = req.headers['x-correlation-id'];
    const correlationId =
      typeof rawCorrelationId === 'string' && rawCorrelationId.length > 0
        ? rawCorrelationId.slice(0, 36)
        : 'none';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          this.logger.log(
            JSON.stringify({
              method,
              url,
              statusCode,
              durationMs: duration,
              correlationId,
            }),
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;
          this.logger.warn(
            JSON.stringify({
              method,
              url,
              statusCode,
              durationMs: duration,
              correlationId,
              error: err?.message || 'Error en petición',
            }),
          );
        },
      }),
    );
  }
}
