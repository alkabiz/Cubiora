import * as fs from 'fs';
import * as path from 'path';

/**
 * Normaliza certificados PEM entregados como variables de entorno inline
 * (por ejemplo, valores entrecomillados o con saltos de línea escapados `\n` en Coolify/Compose).
 */
export function normalizePemCertificate(rawCert: string): string {
  let normalized = rawCert.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function hasPemCertificateMarkers(cert: string): boolean {
  const normalized = normalizePemCertificate(cert);
  return (
    normalized.includes('-----BEGIN CERTIFICATE-----') &&
    normalized.includes('-----END CERTIFICATE-----')
  );
}

/**
 * Carga y normaliza el certificado CA institucional desde variables de entorno o ruta por defecto.
 * Orden de prioridad:
 * 1. Ruta explícita (`DATABASE_CA_CERT_PATH` / `CA_CERT_PATH`) si existe en disco.
 * 2. Contenido PEM inline (`DATABASE_CA_CERT` / `CA_CERT`) normalizado.
 * 3. Archivo local por defecto (`ca-cert.crt` o `apps/api/ca-cert.crt`), únicamente si no se
 *    especificó una ruta explícita inválida/inexistente.
 */
export function loadInstitutionalCaCert(): string | undefined {
  const explicitCaPath = (
    process.env['DATABASE_CA_CERT_PATH'] ||
    process.env['CA_CERT_PATH'] ||
    ''
  ).trim();
  const explicitCaCert = (
    process.env['DATABASE_CA_CERT'] ||
    process.env['CA_CERT'] ||
    ''
  ).trim();

  if (explicitCaPath && fs.existsSync(explicitCaPath)) {
    const filePem = normalizePemCertificate(fs.readFileSync(explicitCaPath, 'utf8'));
    if (filePem.length > 0) {
      return filePem;
    }
  }

  if (explicitCaCert) {
    const inlinePem = normalizePemCertificate(explicitCaCert);
    if (inlinePem.length > 0) {
      return inlinePem;
    }
  }

  if (!explicitCaPath) {
    const defaultCandidates = [
      path.resolve(process.cwd(), 'ca-cert.crt'),
      path.resolve(process.cwd(), 'apps/api/ca-cert.crt'),
    ];
    for (const candidate of defaultCandidates) {
      if (fs.existsSync(candidate)) {
        const defaultPem = normalizePemCertificate(fs.readFileSync(candidate, 'utf8'));
        if (defaultPem.length > 0) {
          return defaultPem;
        }
      }
    }
  }

  return undefined;
}

