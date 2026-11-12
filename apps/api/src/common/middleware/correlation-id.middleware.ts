import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware de Correlation ID.
 *
 * Comportamiento:
 * - Si la petición incluye X-Correlation-ID, se propaga tal cual.
 * - Si no, se genera un UUID v4 nuevo.
 * - El ID se añade a la respuesta para trazabilidad end-to-end.
 *
 * El correlationId queda disponible en req.headers['x-correlation-id']
 * para ser leído por el filtro de excepciones y el interceptor de logging.
 */
const SAFE_CORRELATION_ID_RE = /^[A-Za-z0-9._-]{1,36}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers['x-correlation-id'];
    const trimmed = typeof existing === 'string' ? existing.trim() : '';
    const correlationId = SAFE_CORRELATION_ID_RE.test(trimmed) ? trimmed : uuidv4();

    // Normalizar: siempre string acotado a VarChar(36) sin caracteres de control
    req.headers['x-correlation-id'] = correlationId;

    // Propagar en la respuesta
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}
