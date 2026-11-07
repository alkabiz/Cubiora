import { describe, it } from 'vitest';

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

const pairs: [string, string, string, string][] = [
  ['Texto slate-400 (deprecado)', '#94A3B8', '#FFFFFF', '1.4.3 Texto normal'],
  ['Texto slate-400 (deprecado)', '#94A3B8', '#F8FAFC', '1.4.3 Texto normal'],
  ['Texto slate-500', '#64748B', '#FFFFFF', '1.4.3 Texto normal'],
  ['Texto slate-500', '#64748B', '#F8FAFC', '1.4.3 Texto normal'],
  ['Texto slate-600', '#475569', '#FFFFFF', '1.4.3 Texto normal'],
  ['Texto slate-600', '#475569', '#F8FAFC', '1.4.3 Texto normal'],
  ['Texto slate-700', '#334155', '#FFFFFF', '1.4.3 Texto normal'],
  ['Texto slate-700', '#334155', '#F8FAFC', '1.4.3 Texto normal'],
  ['Texto slate-900', '#0F172A', '#FFFFFF', '1.4.3 Texto normal'],
  ['Texto slate-900', '#0F172A', '#F8FAFC', '1.4.3 Texto normal'],
  ['Borde input slate-300', '#CBD5E1', '#FFFFFF', '1.4.11 Componentes no textuales (min 3.0:1)'],
  ['Borde input slate-300', '#CBD5E1', '#F8FAFC', '1.4.11 Componentes no textuales (min 3.0:1)'],
  ['Anillo de foco #0B5793', '#0B5793', '#FFFFFF', '1.4.11 Indicador de foco (min 3.0:1)'],
  ['Anillo de foco #0B5793', '#0B5793', '#F8FAFC', '1.4.11 Indicador de foco (min 3.0:1)'],
  ['Anillo de foco #0B5793 contra slate-300', '#0B5793', '#CBD5E1', '1.4.11 Contraste foco vs borde adyacente'],
  ['Pantalla Sala: Blanco', '#FFFFFF', '#020B14', '1.4.3 Texto Sala'],
  ['Pantalla Sala: emerald-400', '#34D399', '#041527', '1.4.3 / 1.4.11 Hero Sala'],
  ['Pantalla Sala: slate-300', '#CBD5E1', '#020B14', '1.4.3 Texto secundario Sala'],
  ['Pantalla Sala: purple-300', '#D8B4FE', '#041527', '1.4.3 Badge Preferencial'],
];

describe('Cálculo exacto de contrastes WCAG 2.1 / 2.2', () => {
  it('Calcula y reporta ratios medidos', () => {
    console.log('\n--- REPORTE DE CONTRASTES CALCULADOS FORMALMENTE (W3C RELATIVE LUMINANCE) ---');
    for (const [elem, fg, bg, crit] of pairs) {
      const cr = contrastRatio(fg, bg);
      let status = 'FALLA';
      if (crit.includes('1.4.11')) {
        status = cr >= 3.0 ? 'CUMPLE AA (>= 3.0:1)' : 'FALLA (menor a 3.0:1)';
      } else {
        status = cr >= 7.0 ? 'CUMPLE AAA (>= 7.0:1)' : cr >= 4.5 ? 'CUMPLE AA (>= 4.5:1)' : 'FALLA (menor a 4.5:1)';
      }
      console.log(`  ${elem} [${fg} sobre ${bg}]: ${cr}:1 -> ${status}`);
    }
  });
});

