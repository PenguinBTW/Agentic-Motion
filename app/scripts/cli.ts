// Shared CLI arg helpers — single source of truth for isFlagVal/opt/numOpt.
// Visual parsers + render.ts + calibrate.ts should import from here to avoid drift.
export function isFlagVal(val?: string): boolean {
  return typeof val === 'string' && !val.startsWith('--');
}

export function makeOpt(argv: string[]) {
  const opt = (k: string, d?: string) => {
    const i = argv.indexOf(`--${k}`);
    const v = i >= 0 ? argv[i + 1] : d;
    return isFlagVal(v) ? v : (i >= 0 ? undefined : d);
  };
  return opt;
}

export function makeNumOpt(argv: string[], mode = 'cli') {
  const opt = makeOpt(argv);
  return (k: string, def: number, min?: number, max?: number): number => {
    const raw = opt(k);
    if (raw === undefined) return def;
    const v = +raw;
    if (!Number.isFinite(v)) { console.warn(`[${mode}] Invalid --${k} '${raw}', defaulting to ${def}`); return def; }
    if (min !== undefined && v < min) { console.warn(`[${mode}] --${k} ${v} < min ${min}, clamping`); return min; }
    if (max !== undefined && v > max) { console.warn(`[${mode}] --${k} ${v} > max ${max}, clamping`); return max; }
    return v;
  };
}
