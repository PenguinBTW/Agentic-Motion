import { hexToLinear } from './util';
import { getDesignTokens, tokenToLinear, tokenToRgba } from './tokens';

// Backward-compatible fallback palette
export const HEX = {
  ink: '#0A0A0B', // background black (slightly warm)
  ink2: '#151517', // raised black (panels, paper-in-the-dark)
  graphite: '#5E5B57', // dim lines, secondary text
  ash: '#9C978F', // mid grey
  bone: '#EEE9DF', // paper white, primary text
  signal: '#FF4D12', // hazard orange: the spark, the fuse
  ember: '#FF8A3D', // hotter, lighter orange for cores/highlights
  blood: '#C21D0B', // deep red-orange for shadows of signal
  acid: '#D8FF3C', // acid accent
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. Evaluated dynamically from active tokens.
 * Typed as PaletteKey|string so semantic token names (surface/accent/primaryText)
 * used in docs also typecheck — falls back to tokenToLinear at runtime. */
export const LIN: Record<PaletteKey | string, [number, number, number]> = new Proxy({} as any, {
  get: (_, prop: string) => tokenToLinear(prop),
});

/** CSS rgba() for Canvas2D, evaluating dynamically from active tokens. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const tokens = getDesignTokens();
  const hex = tokens.palette[key] ?? (HEX as Record<string, string>)[key] ?? (key.startsWith('#') ? key : '#FFFFFF');
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
