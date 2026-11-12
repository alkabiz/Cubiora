/**
 * Utilidades compartidas de validación de orígenes CORS/CSRF para despliegue dual:
 * - Orígenes explícitos definidos en `CORS_ORIGINS` (p. ej. dominio HTTPS detrás de Cloudflare/Coolify y localhost)
 * - Cualquier origen HTTP de la subred LAN local `192.168.1.*` (con cualquier puerto válido)
 */

export function parseConfiguredOrigins(rawOrigins: string): Set<string> {
  const result = new Set<string>();
  for (const entry of rawOrigins.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed === '*') continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.origin && parsed.origin !== 'null') {
        result.add(parsed.origin);
      }
    } catch {
      // Ignorar entradas malformadas
    }
  }
  return result;
}

export function isLocalSubnetOrigin(rawOrigin: string): boolean {
  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol !== 'http:') {
      return false;
    }
    const ipv4Match = /^192\.168\.1\.(\d{1,3})$/.exec(parsed.hostname);
    if (!ipv4Match) {
      return false;
    }
    const lastOctet = Number(ipv4Match[1]);
    return lastOctet >= 0 && lastOctet <= 255;
  } catch {
    return false;
  }
}

export function isOriginAllowed(rawOrigin: string, corsOriginsCsv: string): boolean {
  let normalizedOrigin: string;
  try {
    const parsed = new URL(rawOrigin);
    if (
      !parsed.origin ||
      parsed.origin === 'null' ||
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    ) {
      return false;
    }
    normalizedOrigin = parsed.origin;
  } catch {
    return false;
  }

  const configured = parseConfiguredOrigins(corsOriginsCsv);
  if (configured.has(normalizedOrigin)) {
    return true;
  }

  return isLocalSubnetOrigin(normalizedOrigin);
}

