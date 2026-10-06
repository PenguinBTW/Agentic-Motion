// Motion Analysis Configuration & Types
// Thresholds for rule-based flags F01–F16 and analysis parameters.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface MotionConfig {
  // Lyric sync & size (§1 F01, F02, F03)
  lyric_min_visible_pct: number;       // F01: lyric word visible < 90% of sung window
  lyric_min_peak_h_pct: number;        // F02: sung word peaks below 5% of 1080
  lyric_max_anticipation_s: number;    // F03: word shows > 0.4s before start
  // Text layout & collision (§1 F04, F05, F06, F07)
  text_collision_min_alpha: number;    // F04: alpha threshold
  text_collision_max_overlap_pct: number; // F04: overlap > 2% of smaller box
  text_clip_max_pct: number;           // F05: clipped by frame edge > 5%
  corner_x_pct: number;               // F06: outer 12% in X (x < 230.4 or x > 1689.6)
  corner_y_pct: number;               // F06: outer 14% in Y (y < 151.2 or y > 928.8)
  corner_persist_s: number;            // F06: persisting in corner > 3.0s
  static_digit_persist_s: number;      // F07: digits string unchanging in slot > 3.0s
  slot_dist_px: number;                // Slot grouping distance threshold (40 px)
  // Motion & cuts (§1 F08, F09, F10)
  eps_energy: number;                  // F08: motion energy < eps
  dead_motion_s: number;               // F08: dead motion duration (> 0.5s)
  kick_top_quartile_min_ratio: number; // F09: kick response ratio < 1.15
  cut_hard_diff_threshold: number;     // F10 / Cut classification threshold
  // Luma & palette (§1 F11, F12, F16)
  bone_bloom_bright_nonsignal_pct: number; // F11: > 0.5% bright non-signal
  bone_bloom_luma_threshold: number;   // F11: luma > 0.85
  palette_delta_e_threshold: number;   // F12: delta E threshold (12.0)
  palette_off_max_pct: number;         // F12: off-palette > 3.0%
  blank_max_run_s: number;             // F16: near-black / near-white run > 0.3s
  blank_black_luma: number;            // F16: near-black luma < 0.02
  blank_white_luma: number;            // F16: near-white luma > 0.98
  blank_white_max_contrast: number;    // F16: near-white contrast < 0.02
  // Perf & sampling (§1 F13, F14, F15)
  perf_max_frame_ms: number;           // F13: frame time > 25 ms
  sampler_max_spp: number;             // F14: sampler reached 324
  shimmer_threshold: number;           // F15: shimmer index threshold
}

export const CONFIG: MotionConfig = {
  lyric_min_visible_pct: 90.0,
  lyric_min_peak_h_pct: 5.0,
  lyric_max_anticipation_s: 0.40,
  text_collision_min_alpha: 0.15,
  text_collision_max_overlap_pct: 2.0,
  text_clip_max_pct: 5.0,
  corner_x_pct: 12.0,
  corner_y_pct: 14.0,
  corner_persist_s: 3.0,
  static_digit_persist_s: 3.0,
  slot_dist_px: 40.0,
  eps_energy: 0.001,
  dead_motion_s: 0.5,
  kick_top_quartile_min_ratio: 1.15,
  cut_hard_diff_threshold: 0.08,
  bone_bloom_bright_nonsignal_pct: 0.5,
  bone_bloom_luma_threshold: 0.85,
  palette_delta_e_threshold: 12.0,
  palette_off_max_pct: 3.0,
  blank_max_run_s: 0.3,
  blank_black_luma: 0.02,
  blank_white_luma: 0.98,
  blank_white_max_contrast: 0.02,
  perf_max_frame_ms: 25.0,
  sampler_max_spp: 324,
  shimmer_threshold: 0.025,
};

export type Severity = 'info' | 'warn' | 'fail';
export type FlagSource = 'objective' | 'calibrated' | 'guess';
export type FlagClass = 'blocking' | 'advisory' | 'info';
export type FlagTier = 'tier_a_objective' | 'tier_b_benchmark' | 'tier_c_proxy';

export interface FlagItem {
  id: string; // e.g. F04-001
  rule: string; // e.g. F04
  tier: FlagTier;
  source: FlagSource;
  class: FlagClass;
  severity: Severity;
  t0: number;
  t1: number;
  ruleDescription: string;
  evidence: string;
  calibrated?: boolean;
  limits: string;
  waived?: boolean;
  waiverReason?: string | null;
}

export interface FindingItem {
  id: string;
  tool: string;
  rule: string;
  tier: FlagTier;
  source: FlagSource;
  class: FlagClass;
  severity: Severity;
  t0: number;
  t1: number;
  evidenceFiles: string[];
  ruleDescription: string;
  evidence: string;
  calibrated: boolean;
  limits: string;
  waived: boolean;
  waiverReason: string | null;
}

export interface RuleMetadata {
  rule: string;
  name: string;
  source: FlagSource;
  class: FlagClass;
  tier: FlagTier;
  description: string;
  limits: string;
}

export const FLAG_RULES: Record<string, RuleMetadata> = {
  F01: {
    rule: 'F01',
    name: 'lyric_visibility',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: 'Lyric word visible for < 90% of sung window',
    limits: 'Canvas2D text probe only; text drawn via WebGL textures/shaders is invisible to probe.',
  },
  F02: {
    rule: 'F02',
    name: 'sung_word_height',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: 'Current sung word peaks below 5% of frame height',
    limits: 'Measured at 1080p canvas coordinates; 3D perspective foreshortening may reduce perceived size.',
  },
  F03: {
    rule: 'F03',
    name: 'word_anticipation',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: 'Word appears > 0.40s before sung start',
    limits: 'Persistent background typographic displays may legitimately share lyric tokens.',
  },
  F04: {
    rule: 'F04',
    name: 'text_collision',
    source: 'objective',
    class: 'blocking',
    tier: 'tier_a_objective',
    description: 'Two text bounding boxes (alpha > 0.15 each) overlap by > 2% of the smaller box',
    limits: 'Screen-space 2D bounding boxes without Z-buffer; pairs with >= 2.5x scale disparity or micro-text (< 0.4%) are excluded as 3D parallax.',
  },
  F05: {
    rule: 'F05',
    name: 'text_clipping',
    source: 'objective',
    class: 'blocking',
    tier: 'tier_a_objective',
    description: 'Text clipped outside viewport edges by > 5% of its box',
    limits: 'Canvas2D bounding box boundaries; does not detect shader margin clipping.',
  },
  F06: {
    rule: 'F06',
    name: 'corner_persistence',
    source: 'guess',
    class: 'info',
    tier: 'tier_c_proxy',
    description: 'Text persisting inside corner region (outer 12% × 14%) > 3.0s (uncalibrated heuristic)',
    limits: 'HUD indicators, timecodes, and persistent telemetry intentionally live in corner margins.',
  },
  F07: {
    rule: 'F07',
    name: 'static_digit_persistence',
    source: 'guess',
    class: 'info',
    tier: 'tier_c_proxy',
    description: 'Unchanging numeric string persisting in slot > 3.0s (uncalibrated heuristic)',
    limits: 'Constant status codes, fixed constants, and unchanging values intentionally persist.',
  },
  F08: {
    rule: 'F08',
    name: 'dead_motion',
    source: 'guess',
    class: 'info',
    tier: 'tier_c_proxy',
    description: 'Motion energy E < eps persisting > 0.5s (uncalibrated heuristic)',
    limits: 'Intentional dramatic pauses, musical holds, and static title cards register as dead motion.',
  },
  F09: {
    rule: 'F09',
    name: 'kick_response_ratio',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: 'Strong kick (top quartile) motion energy response ratio < 1.15',
    limits: 'Pixel-difference metric; subtle typographic/color shifts may not register as large pixel energy.',
  },
  F10: {
    rule: 'F10',
    name: 'cut_inside_sung_word',
    source: 'objective',
    class: 'blocking',
    tier: 'tier_a_objective',
    description: 'Hard visual cut lands inside an active sung vocal word',
    limits: 'Relies on word timestamps in lyrics.json; vocal melismas or unaligned breath timings not covered.',
  },
  F11: {
    rule: 'F11',
    name: 'bone_bloom_bright_nonsignal',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: '> 0.5% of pixels are bright (luma > 0.85) and non-signal hue outside flash frames',
    limits: 'Assumes Swiss dark-ink/bone-paper aesthetic; inverted plates or high-key plates legitimate variants.',
  },
  F12: {
    rule: 'F12',
    name: 'off_palette_wash',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: '> 3% of pixels are further than ΔE 12 from every palette swatch',
    limits: 'CIE Lab Euclidean distance; smooth gradient antialiasing fringes may be marked as other%.',
  },
  F13: {
    rule: 'F13',
    name: 'frame_time_budget',
    source: 'objective',
    class: 'advisory',
    tier: 'tier_a_objective',
    description: 'Frame render time > 25 ms (GPU-synced playback bottleneck)',
    limits: 'Includes Playwright readback overhead and headless Chrome software/hardware scheduling.',
  },
  F14: {
    rule: 'F14',
    name: 'sampler_max_spp',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: 'Adaptive sampler maxed out at 324 sub-frames (sampling stress)',
    limits: 'Only active when the engine exposes adaptive sampling spp telemetry.',
  },
  F15: {
    rule: 'F15',
    name: 'edge_shimmer_flicker',
    source: 'calibrated',
    class: 'advisory',
    tier: 'tier_b_benchmark',
    description: 'Edge shimmer index above threshold (sampler-chasing flicker)',
    limits: 'Temporal 2nd derivative on edges; intentional musical strobe/glitch will register as shimmer.',
  },
  F16: {
    rule: 'F16',
    name: 'unintended_blank_screen',
    source: 'objective',
    class: 'blocking',
    tier: 'tier_a_objective',
    description: 'Near-black or near-white screen run > 0.3s outside --allow-blank',
    limits: 'Cannot distinguish intentional blackout pauses from rendering failure without --allow-blank.',
  },
};

export interface MetricDistribution {
  min: number;
  p10: number;
  p50: number;
  p90: number;
  max: number;
  n: number;
}

export type CalibrationData = Record<string, MetricDistribution>;

export function loadCalibrationData(customPath?: string): CalibrationData | null {
  const candidatePaths = [
    customPath,
    path.resolve(import.meta.dir, '../../../calibration/example.json'),
    path.resolve(import.meta.dir, '../../calibration/example.json'),
    path.resolve(import.meta.dir, '../calibration/example.json'),
    path.resolve(process.cwd(), 'calibration/example.json'),
    path.resolve(process.cwd(), '../calibration/example.json'),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      } catch {}
    }
  }
  return null;
}

export interface FrameMetrics {
  n: number;
  t: number;
  E: number;
  E_p95: number;
  flow_dx: number; // px/s at 1920 scale
  flow_dy: number; // px/s at 1920 scale
  flow_invalid?: boolean;
  luma: number;
  contrast: number;
  edge_density: number;
  signal_pct: number;
  bright_nonsignal_pct: number;
  palette_shares: Record<string, number>; // class -> percentage
  other_pct: number;
  shimmer: number;
  segs: number;
  ms: number;
  spp: number;
  sceneProbe?: Record<string, number> | null;
}

export interface TextProbeRecord {
  frameIdx: number;
  t: number;
  text: string;
  fontFamily: string;
  fontPx: number;
  fillStyle: string;
  globalAlpha: number;
  layerId: string;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  w: number;
  h: number;
  cx: number;
  cy: number;
  hPct: number;
  isStroke?: boolean;
}

export interface TextRun {
  id: number;
  normalizedText: string;
  rawText: string;
  first_t: number;
  last_t: number;
  dur: number;
  peak_hPct: number;
  mean_hPct: number;
  min_alpha: number;
  max_alpha: number;
  travel_px_s: number;
  slotId: number;
  max_clip_pct: number;
  records: TextProbeRecord[];
}

export interface TextSlot {
  id: number;
  cx: number;
  cy: number;
  runs: TextRun[];
  distinctStrings: string[];
}

export interface AudioEvent {
  type: 'downbeat' | 'beat' | 'kick' | 'snare' | 'cut' | 'word' | 'custom';
  t: number;
  strength?: number;
  source: string;
  word?: string;
  line?: string;
  end?: number;
  details?: any;
}
