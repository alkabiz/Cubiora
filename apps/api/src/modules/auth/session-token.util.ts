import * as crypto from 'crypto';
import { UserRole } from '@cubiora/shared';

export interface SessionPayload {
  sub: string;
  publicId: string;
  username: string;
  displayName: string;
  role: UserRole;
  cubicleId: string | null;
  cubicleCode?: string | null;
  tokenVersion?: number;
  iat: number;
  exp: number;
}

export class SessionTokenUtil {
  private static readonly ALGORITHM = 'sha256';

  /**
   * Genera un token firmado con HMAC-SHA256 para la sesión del operador.
   * Por defecto expira en 8 horas (28800 segundos).
   */
  static sign(
    payload: Omit<SessionPayload, 'iat' | 'exp'>,
    secret: string,
    expiresInSeconds = 28800,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: SessionPayload = {
      ...payload,
      tokenVersion: payload.tokenVersion ?? 0,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac(this.ALGORITHM, secret)
      .update(payloadB64)
      .digest('base64url');

    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifica la integridad, firma y vigencia del token de sesión.
   * Utiliza crypto.timingSafeEqual para prevenir ataques de temporización.
   */
  static verify(token: string, secret: string): SessionPayload | null {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, providedSig] = parts;
    if (!payloadB64 || !providedSig) return null;

    const expectedSig = crypto
      .createHmac(this.ALGORITHM, secret)
      .update(payloadB64)
      .digest('base64url');

    const providedSigBuf = Buffer.from(providedSig);
    const expectedSigBuf = Buffer.from(expectedSig);

    if (providedSigBuf.length !== expectedSigBuf.length) return null;
    if (!crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)) return null;

    try {
      const decodedJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload = JSON.parse(decodedJson) as SessionPayload;

      if (
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        typeof payload.role !== 'string' ||
        payload.role.length === 0
      ) {
        return null;
      }

      if (
        payload.tokenVersion !== undefined &&
        (typeof payload.tokenVersion !== 'number' ||
          !Number.isInteger(payload.tokenVersion) ||
          payload.tokenVersion < 0)
      ) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp < now) {
        return null; // Token inválido o expirado
      }

      return payload;
    } catch {
      return null;
    }
  }
}
