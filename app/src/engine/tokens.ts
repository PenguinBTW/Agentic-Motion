// Pluggable Brand Design Token System
// Replaces hardcoded single-project palettes with an extensible design system registry.
import { hexToLinear } from './util';

export interface DesignTokens {
  id: string;
  name: string;
  palette: {
    background: string;
    surface: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    accentSecondary?: string;
    alert?: string;
    [key: string]: string | undefined;
  };
  typography: {
    heroDisplay: string;
    title: string;
    body: string;
    mono: string;
  };
  motion?: {
    springBouncy?: [number, number]; // [frequency, damping]
    springSnappy?: [number, number];
  };
}

export const DefaultTokens: DesignTokens = {
  id: 'precision-dark',
  name: 'Precision Editorial Dark',
  palette: {
    // Semantic token names
    background: '#0A0A0B',
    surface: '#151517',
    primaryText: '#EEE9DF',
    secondaryText: '#9C978F',
    graphite: '#5E5B57',
    accent: '#FF4D12',
    accentSecondary: '#FF8A3D',
    alert: '#C21D0B',
    highlight: '#D8FF3C',
    // Backward-compatible palette aliases
    ink: '#0A0A0B',
    ink2: '#151517',
    ash: '#9C978F',
    bone: '#EEE9DF',
    signal: '#FF4D12',
    ember: '#FF8A3D',
    blood: '#C21D0B',
    acid: '#D8FF3C',
  },
  typography: {
    heroDisplay: 'Archivo, sans-serif',
    title: 'Archivo, sans-serif',
    body: 'Archivo, sans-serif',
    mono: 'IBMPlexMono, monospace',
  },
  motion: {
    springBouncy: [2.0, 0.6],
    springSnappy: [3.5, 0.85],
  },
};

let activeTokens: DesignTokens = { ...DefaultTokens };

export function setDesignTokens(tokens: Partial<Omit<DesignTokens, 'palette' | 'typography'>> & { palette?: Partial<DesignTokens['palette']>; typography?: Partial<DesignTokens['typography']> }) {
  // Validate hex to avoid NaN uniforms; fall back + warn.
  const isHex = (v?: string) => typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
  if (tokens.palette) {
    for (const [k, v] of Object.entries(tokens.palette)) {
      if (v !== undefined && !isHex(v)) console.warn(`[tokens] Invalid hex for '${k}': '${v}' — keeping previous value.`);
    }
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokens.palette)) if (v === undefined || isHex(v)) clean[k] = v as string;
    tokens = { ...tokens, palette: { ...(tokens as any).palette, ...clean } as any };
    // Drop invalid keys so spread below can't poison.
    for (const k of Object.keys(tokens.palette!)) if (!isHex((tokens.palette as any)[k])) delete (tokens.palette as any)[k];
  }
  activeTokens = {
    ...activeTokens,
    ...tokens,
    palette: {
      ...activeTokens.palette,
      ...(tokens.palette ?? {}),
    },
    typography: {
      ...activeTokens.typography,
      ...(tokens.typography ?? {}),
    },
  };
  // NOTE: GL shaders baked via buildGLSLCommon() do NOT hot-reload. Rebuild materials
  // via buildGLSLCommon() after this call, or restart. See glsl/common.ts.
}

export function getDesignTokens(): DesignTokens {
  return activeTokens;
}

/** Get linear RGB triplet from active palette token or raw hex */
export function tokenToLinear(key: string): [number, number, number] {
  const hex = activeTokens.palette[key] ?? (key.startsWith('#') ? key : activeTokens.palette.primaryText);
  return hexToLinear(hex);
}

/** Get CSS rgba from active palette token or raw hex */
export function tokenToRgba(key: string, a = 1): string {
  const rawHex = activeTokens.palette[key] ?? (key.startsWith('#') ? key : '#FFFFFF');
  let hex = rawHex.replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) hex = hex.split('').map((c) => c + c).join('');
  let n = parseInt(hex, 16);
  if (!Number.isFinite(n)) n = 0xffffff;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
