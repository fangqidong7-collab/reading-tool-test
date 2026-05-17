export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type CefrColorPaletteId = 'standard' | 'nightContrast' | 'colorblind';

export type CefrLevelColors = Record<CEFRLevel, string>;

export interface CefrColorPaletteOption {
  id: CefrColorPaletteId;
  name: string;
  description: string;
}

export const CEFR_COLOR_PALETTE_OPTIONS: CefrColorPaletteOption[] = [
  { id: 'standard', name: '标准', description: '随阅读主题自动切换日间/夜间色' },
  { id: 'nightContrast', name: '夜间高对比', description: '深色背景下更亮、更易辨认' },
  { id: 'colorblind', name: '色弱友好', description: '减少红绿依赖，六级更易区分' },
];

const PALETTES: Record<CefrColorPaletteId, { light: CefrLevelColors; dark: CefrLevelColors }> = {
  standard: {
    light: {
      A1: '#22c55e',
      A2: '#15803d',
      B1: '#3b82f6',
      B2: '#f59e0b',
      C1: '#a855f7',
      C2: '#6d28d9',
    },
    dark: {
      A1: '#4ade80',
      A2: '#86efac',
      B1: '#60a5fa',
      B2: '#fbbf24',
      C1: '#e879f9',
      C2: '#c4b5fd',
    },
  },
  nightContrast: {
    light: {
      A1: '#16a34a',
      A2: '#0d9488',
      B1: '#2563eb',
      B2: '#ca8a04',
      C1: '#9333ea',
      C2: '#c2410c',
    },
    dark: {
      A1: '#6ee7b7',
      A2: '#5eead4',
      B1: '#7dd3fc',
      B2: '#fde047',
      C1: '#f0abfc',
      C2: '#fda4af',
    },
  },
  colorblind: {
    light: {
      A1: '#0072B2',
      A2: '#56B4E9',
      B1: '#009E73',
      B2: '#E69F00',
      C1: '#CC79A7',
      C2: '#D55E00',
    },
    dark: {
      A1: '#6BAED6',
      A2: '#9ECAE1',
      B1: '#66C2A5',
      B2: '#FDB863',
      C1: '#FC8DAC',
      C2: '#FD8D3C',
    },
  },
};

/** @deprecated 请使用 getLevelColors；保留以兼容旧引用 */
export const LEVEL_COLORS: CefrLevelColors = PALETTES.standard.light;

export function isCefrColorPaletteId(value: unknown): value is CefrColorPaletteId {
  return value === 'standard' || value === 'nightContrast' || value === 'colorblind';
}

export function parseCefrColorPaletteId(value: unknown): CefrColorPaletteId {
  return isCefrColorPaletteId(value) ? value : 'standard';
}

export function getLevelColors(
  paletteId: CefrColorPaletteId = 'standard',
  isDark = false,
): CefrLevelColors {
  const palette = PALETTES[paletteId] ?? PALETTES.standard;
  return isDark ? palette.dark : palette.light;
}

export function getLevelColor(
  level: CEFRLevel,
  paletteId: CefrColorPaletteId = 'standard',
  isDark = false,
): string {
  return getLevelColors(paletteId, isDark)[level];
}
