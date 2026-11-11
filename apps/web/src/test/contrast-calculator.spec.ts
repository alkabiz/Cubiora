import { describe, expect, it } from 'vitest';

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function toHex([r, g, b]: [number, number, number]): string {
  return (
    '#' +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function alphaBlend(fgHex: string, bgHex: string, alpha: number): string {
  const [fr, fg, fb] = parseHex(fgHex);
  const [br, bg, bb] = parseHex(bgHex);
  return toHex([
    fr * alpha + br * (1 - alpha),
    fg * alpha + bg * (1 - alpha),
    fb * alpha + bb * (1 - alpha),
  ]);
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(parseHex(hex1));
  const l2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

const pairs: [string, string, string, string, number][] = [
  ['Texto muted estándar slate-600', '#475569', '#FFFFFF', '1.4.3 Texto normal', 4.5],
  ['Texto muted slate-600 sobre surface', '#475569', '#F8FAFC', '1.4.3 Texto normal', 4.5],
  ['Texto slate-700', '#334155', '#FFFFFF', '1.4.3 Texto normal', 4.5],
  ['Texto slate-900', '#0F172A', '#FFFFFF', '1.4.3 Texto normal', 4.5],
  ['Primario Cubiora Cobalto (#2C73D2) botón sólido', '#FFFFFF', '#2C73D2', '1.4.3 Botón primario', 4.5],
  ['Enlace/acento Cobalto (#2C73D2) sobre blanco', '#2C73D2', '#FFFFFF', '1.4.3 Texto acento', 4.5],
  ['Confirmación sólida (#008F7A) con tinta oscura (#020617)', '#020617', '#008F7A', '1.4.3 Badge confirmación', 4.5],
  ['Tinta #0F172A sobre tinte #2C73D2/12', '#0F172A', alphaBlend('#2C73D2', '#FFFFFF', 0.12), '1.4.3 Píldora primaria', 4.5],
  ['Tinta #0F172A sobre tinte #0081CF/12', '#0F172A', alphaBlend('#0081CF', '#FFFFFF', 0.12), '1.4.3 Píldora activa', 4.5],
  ['Tinta #0F172A sobre tinte #0089BA/12', '#0F172A', alphaBlend('#0089BA', '#FFFFFF', 0.12), '1.4.3 Píldora info', 4.5],
  ['Tinta #0F172A sobre tinte #008E9B/12', '#0F172A', alphaBlend('#008E9B', '#FFFFFF', 0.12), '1.4.3 Píldora progreso', 4.5],
  ['Tinta #0F172A sobre tinte #008F7A/12', '#0F172A', alphaBlend('#008F7A', '#FFFFFF', 0.12), '1.4.3 Píldora confirmación', 4.5],
  ['Borde control slate-500 sobre blanco', '#64748B', '#FFFFFF', '1.4.11 Componentes no textuales (min 3.0:1)', 3.0],
  ['Borde control slate-500 sobre surface', '#64748B', '#F8FAFC', '1.4.11 Componentes no textuales (min 3.0:1)', 3.0],
  ['Anillo de foco Cobalto (#2C73D2 sobre blanco)', '#2C73D2', '#FFFFFF', '1.4.11 Indicador de foco (min 3.0:1)', 3.0],
  ['Anillo de foco Cobalto (#2C73D2 sobre surface)', '#2C73D2', '#F8FAFC', '1.4.11 Indicador de foco (min 3.0:1)', 3.0],
  ['Pantalla Sala: Blanco sobre fondo base (#020617)', '#FFFFFF', '#020617', '1.4.3 Texto Sala', 4.5],
  ['Pantalla Sala: Destino #008F7A sobre reposo (#0F172A, texto grande)', '#008F7A', '#0F172A', '1.4.3 Hero Sala reposo', 3.0],
  ['Pantalla Sala: Destino #008F7A sobre anuncio (#020617)', '#008F7A', '#020617', '1.4.3 / 1.4.11 Hero Sala activo', 4.5],
  ['Pantalla Sala: slate-300 sobre #020617', '#CBD5E1', '#020617', '1.4.3 Texto secundario Sala', 4.5],
  ['Pantalla Sala: Pill Confirmación (#FFFFFF sobre #008F7A/20)', '#FFFFFF', alphaBlend('#008F7A', '#0F172A', 0.2), '1.4.3 Pill turno llamado', 4.5],
  ['Pantalla Sala: Pill Preferencial (#FFFFFF sobre #0081CF/20)', '#FFFFFF', alphaBlend('#0081CF', '#0F172A', 0.2), '1.4.3 Badge Preferencial', 4.5],
  ['Pantalla Sala: Barra Aviso Info (#FFFFFF sobre #0089BA/20)', '#FFFFFF', alphaBlend('#0089BA', '#020617', 0.2), '1.4.3 Barra aviso sala', 4.5],
];

describe('Cálculo exacto de contrastes WCAG 2.1 / 2.2', () => {
  it('verifica que toda la paleta oficial Cubiora cumpla WCAG AA (4.5:1 texto / 3.0:1 UI)', () => {
    for (const [elem, fg, bg, crit, minRatio] of pairs) {
      const cr = contrastRatio(fg, bg);
      expect(cr, `${elem} [${fg} sobre ${bg}] (${crit}) = ${cr}:1 < ${minRatio}:1`).toBeGreaterThanOrEqual(
        minRatio,
      );
    }
  });
});
