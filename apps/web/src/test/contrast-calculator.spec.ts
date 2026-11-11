import { describe, expect, it } from 'vitest';

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
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
  ['Primario Cubiora Teal (#0F766E)', '#FFFFFF', '#0F766E', '1.4.3 Botón primario', 4.5],
  ['Primario Hover Cubiora (#115E59)', '#FFFFFF', '#115E59', '1.4.3 Botón primario hover', 4.5],
  ['Badge rol shell (#134E4A sobre #CCFBF1)', '#134E4A', '#CCFBF1', '1.4.3 Contexto de rol', 4.5],
  ['Borde control slate-500 sobre blanco', '#64748B', '#FFFFFF', '1.4.11 Componentes no textuales (min 3.0:1)', 3.0],
  ['Borde control slate-500 sobre surface', '#64748B', '#F8FAFC', '1.4.11 Componentes no textuales (min 3.0:1)', 3.0],
  ['Anillo de foco Teal (#0F766E sobre blanco)', '#0F766E', '#FFFFFF', '1.4.11 Indicador de foco (min 3.0:1)', 3.0],
  ['Anillo de foco Teal (#0F766E sobre surface)', '#0F766E', '#F8FAFC', '1.4.11 Indicador de foco (min 3.0:1)', 3.0],
  ['Pantalla Sala: Blanco', '#FFFFFF', '#020B14', '1.4.3 Texto Sala', 4.5],
  ['Pantalla Sala: emerald-400', '#34D399', '#041527', '1.4.3 / 1.4.11 Hero Sala', 4.5],
  ['Pantalla Sala: slate-300', '#CBD5E1', '#020B14', '1.4.3 Texto secundario Sala', 4.5],
  ['Pantalla Sala: purple-300', '#D8B4FE', '#041527', '1.4.3 Badge Preferencial', 4.5],
];

describe('Cálculo exacto de contrastes WCAG 2.1 / 2.2', () => {
  it('verifica que toda la paleta operativa Cubiora cumpla WCAG AA (4.5:1 texto / 3.0:1 UI)', () => {
    for (const [elem, fg, bg, crit, minRatio] of pairs) {
      const cr = contrastRatio(fg, bg);
      expect(cr, `${elem} [${fg} sobre ${bg}] (${crit}) = ${cr}:1 < ${minRatio}:1`).toBeGreaterThanOrEqual(
        minRatio,
      );
    }
  });
});

