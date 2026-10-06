// Flag evaluation engine for F01–F16
// Calibrated telemetry instrument: categorizes flags into 3 strict tiers
// (Tier A: Objective / Blocking, Tier B: Benchmark / Advisory, Tier C: Proxies / Info).
import {
  CONFIG,
  FLAG_RULES,
  type FlagItem,
  type FrameMetrics,
  type AudioEvent,
  type CalibrationData,
  type Severity,
} from './config';
import type { TextAnalysisResult } from './text-analyzer';
import { normalizeText } from './text-analyzer';

export interface CutItem {
  t: number;
  diff_before_after: number;
  type: 'hard' | 'soft' | 'flash';
  nearest_downbeat_Δms: number;
  inside_word: boolean;
  wordName?: string;
  wStart?: number;
  wEnd?: number;
}

export interface HitItem {
  t: number;
  strength: number;
  type: 'kick' | 'snare';
  E_base: number;
  E_peak: number;
  ratio: number;
  latency_ms: number;
  luma_jump: number;
  shake_px: number;
}

export function evaluateFlags(
  frames: FrameMetrics[],
  textAnalysis: TextAnalysisResult,
  cuts: CutItem[],
  hits: HitItem[],
  allowBlankRanges: [number, number][],
  audioEvents: AudioEvent[] = [],
  calibration: CalibrationData | null = null,
  waivers: Record<string, string> = {},
  fps = 60
): FlagItem[] {
  if (frames.length === 0) return [];
  // k consecutive frames at fps occupy k/fps seconds (frame times span (k-1)/fps).
  const frameDt = 1 / Math.max(1, fps);
  const runDur = (startIdx: number, endIdx: number) => (endIdx - startIdx + 1) * frameDt;

  const flags: FlagItem[] = [];
  const flagCounters: Record<string, number> = {};

  function addFlag(
    rule: string,
    severity: Severity,
    t0: number,
    t1: number,
    evidence: string,
    calibrated = false,
    overrideDesc?: string
  ) {
    const meta = FLAG_RULES[rule]!;
    const count = (flagCounters[rule] ?? 0) + 1;
    flagCounters[rule] = count;
    // Stable content-addressed ID (rule + quantized window) so prior-findings waivers
    // survive reordering; positional counter kept as tiebreak suffix.
    const q = (t: number) => Math.round(t * 100);
    const id = `${rule}-${q(t0)}-${q(t1)}-${String(count).padStart(3, '0')}`;
    // Waiver match: exact ID, legacy positional (F08-001), rule-wide, or content key.
    const waiverReason = waivers[id] ?? waivers[`${rule}-${String(count).padStart(3, '0')}`] ?? waivers[`${rule}-${q(t0)}-${q(t1)}`] ?? waivers[rule] ?? null;
    const waived = Boolean(waiverReason);
    flags.push({
      id,
      rule,
      tier: meta.tier,
      source: meta.source,
      class: meta.class,
      severity,
      t0,
      t1,
      ruleDescription: overrideDesc ?? meta.description,
      evidence,
      calibrated,
      limits: meta.limits,
      waived,
      waiverReason,
    });
  }

  // Helper to check musical snap (intentional cut on a beat)
  const isNearBeat = (t: number, tolS = 0.05): boolean => {
    return audioEvents.some((a) => (a.type === 'downbeat' || a.type === 'beat' || a.type === 'kick') && Math.abs(a.t - t) <= tolS);
  };

  // Identify flash & invert windows (energy E is invalid across these boundaries)
  const flashWindows: [number, number][] = cuts
    .filter((c) => c.type === 'flash')
    .map((c) => [c.t - 0.05, c.t + 0.15] as [number, number]);

  // Also catch large sudden luma jumps > 0.35 as invert/flash transitions
  for (let i = 1; i < frames.length; i++) {
    const fPrev = frames[i - 1]!;
    const fCur = frames[i]!;
    if (Math.abs(fCur.luma - fPrev.luma) > 0.35) {
      flashWindows.push([fCur.t - 0.05, fCur.t + 0.15]);
    }
  }

  // Helper to check if frame is within flash/invert transition
  const isInFlashWindow = (t: number): boolean => {
    return flashWindows.some(([t0, t1]) => t >= t0 && t <= t1);
  };

  // -------------------------------------------------------------
  // TIER B (Calibrated): F01, F02, F03 (Lyric synchronization & sizing)
  // -------------------------------------------------------------

  // F01: lyric word visible for < 90% of its sung window (or calibrated min)
  const calF01 = (calibration?.lyricVisiblePct && calibration.lyricVisiblePct.n > 0) ? calibration.lyricVisiblePct : null;
  const threshF01 = calF01 ? calF01.min : CONFIG.lyric_min_visible_pct;
  const isCalF01 = Boolean(calF01);
  for (const w of textAnalysis.words) {
    if (w.visible_during_sung_pct < threshF01) {
      const sev: Severity = w.visible_during_sung_pct < 50.0 ? 'warn' : 'info';
      const calTag = calF01
        ? `(Example min: ${calF01.min.toFixed(1)}%, p10–p90: ${calF01.p10.toFixed(1)}–${calF01.p90.toFixed(1)}%)`
        : `(default threshold: ${threshF01.toFixed(1)}%)`;
      addFlag(
        'F01',
        sev,
        w.start,
        w.end,
        `word "${w.word}" (${w.start.toFixed(2)}–${w.end.toFixed(2)}s) visible for ${w.visible_during_sung_pct.toFixed(1)}% of sung window ${calTag}`,
        isCalF01
      );
    }
  }

  // F02: current sung word peaks below min of Example project (or CONFIG default)
  const calF02 = (calibration?.lyricPeakHPct && calibration.lyricPeakHPct.n > 0) ? calibration.lyricPeakHPct : null;
  const threshF02 = calF02 ? calF02.min : CONFIG.lyric_min_peak_h_pct;
  const isCalF02 = Boolean(calF02);
  for (const w of textAnalysis.words) {
    if (w.peak_hPct < threshF02) {
      const calTag = calF02
        ? `(Example min: ${calF02.min.toFixed(1)}%, p10–p90: ${calF02.p10.toFixed(1)}–${calF02.p90.toFixed(1)}%)`
        : `(default threshold: ${threshF02.toFixed(1)}%)`;
      addFlag(
        'F02',
        'info',
        w.start,
        w.end,
        `word "${w.word}" peaked at ${w.peak_hPct.toFixed(1)}% of frame height ${calTag}`,
        isCalF02
      );
    }
  }

  // F03: word shows > max anticipation of Example project (or CONFIG default)
  const calF03 = (calibration?.lyricAnticipationS && calibration.lyricAnticipationS.n > 0) ? calibration.lyricAnticipationS : null;
  const threshF03 = calF03 ? calF03.max : CONFIG.lyric_max_anticipation_s;
  const isCalF03 = Boolean(calF03);
  for (const w of textAnalysis.words) {
    if (w.appear_Δms !== null && w.first_visible !== null) {
      const leadS = -w.appear_Δms / 1000;
      if (leadS > threshF03) {
        const calTag = calF03
          ? `(Example max: ${calF03.max.toFixed(2)}s, p10–p90: ${calF03.p10.toFixed(2)}–${calF03.p90.toFixed(2)}s)`
          : `(default threshold: ${threshF03.toFixed(2)}s)`;
        addFlag(
          'F03',
          'info',
          w.first_visible,
          w.start,
          `word "${w.word}" appeared at ${w.first_visible.toFixed(2)}s, ${leadS.toFixed(2)}s before sung start at ${w.start.toFixed(2)}s ${calTag}`,
          isCalF03
        );
      }
    }
  }

  // -------------------------------------------------------------
  // TIER A (Objective / Blocking): F04, F05 (Text collisions & clipping)
  // -------------------------------------------------------------

  // F04: two text boxes (alpha > 0.15 each) overlap by > 2% of the smaller box
  for (const c of textAnalysis.collisions) {
    if (c.intersection_pct > CONFIG.text_collision_max_overlap_pct) {
      addFlag(
        'F04',
        'fail',
        c.t0,
        c.t1,
        `text boxes ${c.pair} overlap by ${c.intersection_pct.toFixed(1)}% of smaller box (> ${CONFIG.text_collision_max_overlap_pct.toFixed(1)}%)`,
        false
      );
    }
  }

  // F05: text clipped by the frame edge by > 5% of its box
  // Checks active sung lyric words during their sung window, and static UI text runs.
  // Dynamic 3D world elements moving through the camera frustum (velocity >= 50 px/s)
  // or entering/exiting offscreen are valid frustum transit, not layout bugs.
  for (const w of textAnalysis.words) {
    if (w.clip_pct > CONFIG.text_clip_max_pct) {
      addFlag(
        'F05',
        'fail',
        w.start,
        w.end,
        `sung lyric word "${w.word}" clipped by ${w.clip_pct.toFixed(1)}% during its active sung window (> ${CONFIG.text_clip_max_pct.toFixed(1)}%)`,
        false
      );
    }
  }

  for (const r of textAnalysis.runs) {
    const isLyric = textAnalysis.words.some((w) => normalizeText(w.word) === r.normalizedText);
    if (isLyric) continue;
    // World text moving through camera frustum is not a static layout clipping error
    if (r.travel_px_s >= 50.0) continue;
    if (r.dur >= 0.3 && r.max_alpha > CONFIG.text_collision_min_alpha) {
      const onScreenClippedRec = r.records.find(
        (rec) =>
          rec.cx >= 0 &&
          rec.cx <= 1920 &&
          rec.cy >= 0 &&
          rec.cy <= 1080 &&
          (rec.bbox[0] < 0 || rec.bbox[2] > 1920 || rec.bbox[1] < 0 || rec.bbox[3] > 1080)
      );
      if (onScreenClippedRec && r.max_clip_pct > CONFIG.text_clip_max_pct) {
        addFlag(
          'F05',
          'fail',
          r.first_t,
          r.last_t,
          `static text "${r.rawText}" clipped by ${r.max_clip_pct.toFixed(1)}% outside frame edges (> ${CONFIG.text_clip_max_pct.toFixed(1)}%)`,
          false
        );
      }
    }
  }

  // -------------------------------------------------------------
  // TIER C (Perceptual Proxies / Info): F06, F07, F08
  // -------------------------------------------------------------

  // F06: text inside a corner region (outer 12% × 14%) persisting > 3 s (uncalibrated proxy)
  for (const r of (textAnalysis.cornerRuns ?? [])) {
    addFlag(
      'F06',
      'info',
      r.first_t,
      r.last_t,
      `text "${r.rawText}" persisted in corner region for ${r.dur.toFixed(2)}s (uncalibrated proxy; info only)`,
      false
    );
  }

  // F07: a string containing digits that doesn't change for > 3 s in the same slot (uncalibrated proxy)
  for (const s of (textAnalysis.staticDigitRuns ?? [])) {
    addFlag(
      'F07',
      'info',
      s.run.first_t,
      s.run.last_t,
      `numeric string "${s.run.rawText}" unchanged in slot ${s.slot.id} for ${s.dur.toFixed(2)}s (uncalibrated proxy; info only)`,
      false
    );
  }

  // F08: dead motion: motion energy < eps for > 0.5 s (uncalibrated proxy, excluding flash/invert windows)
  // Flash-interrupted runs are closed+emitted (not silently discarded); report §8 documents raw unfiltered.
  const emitDeadRun = (startIdx: number, endIdx: number) => {
    const dur = runDur(startIdx, endIdx);
    if (dur < CONFIG.dead_motion_s) return;
    let sumE = 0;
    for (let k = startIdx; k <= endIdx; k++) sumE += frames[k]!.E;
    addFlag(
      'F08',
      'info',
      frames[startIdx]!.t,
      frames[endIdx]!.t,
      `motion energy E < ${CONFIG.eps_energy} for ${dur.toFixed(2)}s (mean E = ${(sumE / (endIdx - startIdx + 1)).toFixed(5)}; uncalibrated proxy)`,
      false
    );
  };
  let deadStartIdx = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (isInFlashWindow(f.t)) {
      if (deadStartIdx >= 0) { emitDeadRun(deadStartIdx, i - 1); deadStartIdx = -1; }
      continue;
    }
    if (f.E < CONFIG.eps_energy) {
      if (deadStartIdx < 0) deadStartIdx = i;
    } else {
      if (deadStartIdx >= 0) { emitDeadRun(deadStartIdx, i - 1); deadStartIdx = -1; }
    }
  }
  if (deadStartIdx >= 0) emitDeadRun(deadStartIdx, frames.length - 1);

  // -------------------------------------------------------------
  // TIER B (Calibrated): F09 (Audio hit response ratio)
  // -------------------------------------------------------------

  // F09: strong kick (top quartile by strength) with response ratio < p10 of Example project (or CONFIG default)
  const kicks = hits.filter((h) => h.type === 'kick');
  if (kicks.length > 0) {
    const calF09 = (calibration?.kickResponseRatioMedian && calibration.kickResponseRatioMedian.n > 0) ? calibration.kickResponseRatioMedian : null;
    const threshF09 = calF09 ? calF09.p10 : CONFIG.kick_top_quartile_min_ratio;
    const isCalF09 = Boolean(calF09);
    const sortedStrengths = kicks.map((k) => k.strength).sort((a, b) => a - b);
    const q75 = sortedStrengths[Math.floor(sortedStrengths.length * 0.75)] ?? 0;
    for (const k of kicks) {
      if (k.strength >= q75 && k.ratio < threshF09) {
        const calTag = calF09
          ? `(Example p10: ${calF09.p10.toFixed(2)}, min: ${calF09.min.toFixed(2)}, p50: ${calF09.p50.toFixed(2)})`
          : `(default threshold: ${threshF09.toFixed(2)})`;
        addFlag(
          'F09',
          'warn',
          k.t,
          k.t + 0.15,
          `kick at ${k.t.toFixed(2)}s (strength ${k.strength.toFixed(2)}) had response ratio ${k.ratio.toFixed(2)} ${calTag}`,
          isCalF09
        );
      }
    }
  }

  // -------------------------------------------------------------
  // TIER A (Objective / Blocking): F10 (Cut inside active sung word)
  // -------------------------------------------------------------

  // F10: a hard cut falls inside a sung word
  for (const c of cuts) {
    if (c.type === 'hard' && c.inside_word) {
      addFlag(
        'F10',
        'fail',
        c.t,
        c.t,
        `hard cut at ${c.t.toFixed(2)}s occurred inside sung word "${c.wordName}" (${c.wStart?.toFixed(2)}–${c.wEnd?.toFixed(2)}s)`,
        false
      );
    }
  }

  // -------------------------------------------------------------
  // TIER B (Calibrated): F11 (Bright non-signal bloom)
  // -------------------------------------------------------------

  // F11: > p90 % of pixels are bright (luma > 0.85) and non-signal hue, outside flash frames
  const calF11 = (calibration?.brightNonsignalPct && calibration.brightNonsignalPct.n > 0) ? calibration.brightNonsignalPct : null;
  const threshF11 = calF11 ? calF11.p90 : CONFIG.bone_bloom_bright_nonsignal_pct;
  const isCalF11 = Boolean(calF11);
  let bRunStart = -1, maxPctB = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const inFlash = isInFlashWindow(f.t);
    if (!inFlash && f.bright_nonsignal_pct > threshF11) {
      if (bRunStart < 0) { bRunStart = i; maxPctB = f.bright_nonsignal_pct; }
      else maxPctB = Math.max(maxPctB, f.bright_nonsignal_pct);
    } else {
      if (bRunStart >= 0) {
        const calTag = calF11
          ? `(Example p90: ${calF11.p90.toFixed(2)}%, max: ${calF11.max.toFixed(2)}%)`
          : `(default threshold: ${threshF11.toFixed(2)}%)`;
        addFlag(
          'F11',
          'warn',
          frames[bRunStart]!.t,
          frames[i - 1]!.t,
          `${maxPctB.toFixed(2)}% bright non-signal pixels (luma > 0.85) ${calTag}`,
          isCalF11
        );
        bRunStart = -1;
      }
    }
  }
  if (bRunStart >= 0) {
    const calTag = calF11
      ? `(Example p90: ${calF11.p90.toFixed(2)}%, max: ${calF11.max.toFixed(2)}%)`
      : `(default threshold: ${threshF11.toFixed(2)}%)`;
    addFlag(
      'F11',
      'warn',
      frames[bRunStart]!.t,
      frames[frames.length - 1]!.t,
      `${maxPctB.toFixed(2)}% bright non-signal pixels (luma > 0.85) ${calTag}`,
      isCalF11
    );
  }

  // -------------------------------------------------------------
  // TIER B (Calibrated): F12 (Off-palette wash)
  // -------------------------------------------------------------

  // F12: > p90 % of pixels are further than ΔE 12 from every palette entry
  const calF12 = (calibration?.otherPct && calibration.otherPct.n > 0) ? calibration.otherPct : null;
  const threshF12 = calF12 ? calF12.p90 : CONFIG.palette_off_max_pct;
  const isCalF12 = Boolean(calF12);
  let oRunStart = -1, maxPctO = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.other_pct > threshF12) {
      if (oRunStart < 0) { oRunStart = i; maxPctO = f.other_pct; }
      else maxPctO = Math.max(maxPctO, f.other_pct);
    } else {
      if (oRunStart >= 0) {
        const calTag = calF12
          ? `(Example p90: ${calF12.p90.toFixed(2)}%, max: ${calF12.max.toFixed(2)}%)`
          : `(default threshold: ${threshF12.toFixed(2)}%)`;
        addFlag(
          'F12',
          'warn',
          frames[oRunStart]!.t,
          frames[i - 1]!.t,
          `${maxPctO.toFixed(2)}% off-palette pixels (ΔE > 12.0) ${calTag}`,
          isCalF12
        );
        oRunStart = -1;
      }
    }
  }
  if (oRunStart >= 0) {
    const calTag = calF12
      ? `(Example p90: ${calF12.p90.toFixed(2)}%, max: ${calF12.max.toFixed(2)}%)`
      : `(default threshold: ${threshF12.toFixed(2)}%)`;
    addFlag(
      'F12',
      'warn',
      frames[oRunStart]!.t,
      frames[frames.length - 1]!.t,
      `${maxPctO.toFixed(2)}% off-palette pixels (ΔE > 12.0) ${calTag}`,
      isCalF12
    );
  }

  // -------------------------------------------------------------
  // TIER A (Objective / Advisory): F13 (GPU frame time budget)
  // -------------------------------------------------------------

  // F13: frame time > 25 ms (GPU-synced playback budget)
  let perfStart = -1, maxMs = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.ms > CONFIG.perf_max_frame_ms) {
      if (perfStart < 0) { perfStart = i; maxMs = f.ms; }
      else maxMs = Math.max(maxMs, f.ms);
    } else {
      if (perfStart >= 0) {
        addFlag(
          'F13',
          'warn',
          frames[perfStart]!.t,
          frames[i - 1]!.t,
          `frame time ${maxMs.toFixed(1)}ms exceeded ${CONFIG.perf_max_frame_ms.toFixed(1)}ms budget`,
          false
        );
        perfStart = -1;
      }
    }
  }
  if (perfStart >= 0) {
    addFlag(
      'F13',
      'warn',
      frames[perfStart]!.t,
      frames[frames.length - 1]!.t,
      `frame time ${maxMs.toFixed(1)}ms exceeded ${CONFIG.perf_max_frame_ms.toFixed(1)}ms budget`,
      false
    );
  }

  // -------------------------------------------------------------
  // TIER B (Calibrated): F14 (Adaptive sampler saturation)
  // -------------------------------------------------------------

  // F14: adaptive sampler reached max spp of Example project (or CONFIG default)
  // Ignore degenerate calibration (max<=1 means calibrator never sampled adaptively).
  const calF14Raw = (calibration?.samplerMaxSpp && calibration.samplerMaxSpp.n > 0) ? calibration.samplerMaxSpp : null;
  const calF14 = calF14Raw && calF14Raw.max > 1 ? calF14Raw : null;
  const threshF14 = calF14 ? calF14.max : CONFIG.sampler_max_spp;
  const isCalF14 = Boolean(calF14);
  let sppStart = -1, maxRunSpp = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.spp >= threshF14) {
      if (sppStart < 0) { sppStart = i; maxRunSpp = f.spp; }
      else maxRunSpp = Math.max(maxRunSpp, f.spp);
    } else {
      if (sppStart >= 0) {
        addFlag(
          'F14',
          'warn',
          frames[sppStart]!.t,
          frames[i - 1]!.t,
          `adaptive sampler reached ${maxRunSpp} sub-frames (sampling saturation >= ${threshF14})`,
          isCalF14
        );
        sppStart = -1;
      }
    }
  }
  if (sppStart >= 0) {
    addFlag(
      'F14',
      'warn',
      frames[sppStart]!.t,
      frames[frames.length - 1]!.t,
      `adaptive sampler reached ${maxRunSpp} sub-frames (sampling saturation >= ${threshF14})`,
      isCalF14
    );
  }

  // -------------------------------------------------------------
  // TIER B (Calibrated): F15 (Shimmer index flicker)
  // -------------------------------------------------------------

  // F15: shimmer index above p90 of Example project (or CONFIG default)
  const calF15 = (calibration?.shimmer && calibration.shimmer.n > 0) ? calibration.shimmer : null;
  const threshF15 = calF15 ? calF15.p90 : CONFIG.shimmer_threshold;
  const isCalF15 = Boolean(calF15);
  let shimStart = -1, maxShim = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.shimmer > threshF15) {
      if (shimStart < 0) { shimStart = i; maxShim = f.shimmer; }
      else maxShim = Math.max(maxShim, f.shimmer);
    } else {
      if (shimStart >= 0) {
        const calTag = calF15
          ? `(Example p90: ${calF15.p90.toFixed(4)}, max: ${calF15.max.toFixed(4)})`
          : `(default threshold: ${threshF15.toFixed(4)})`;
        addFlag(
          'F15',
          'warn',
          frames[shimStart]!.t,
          frames[i - 1]!.t,
          `shimmer index ${maxShim.toFixed(4)} exceeded threshold ${calTag}`,
          isCalF15
        );
        shimStart = -1;
      }
    }
  }
  if (shimStart >= 0) {
    const calTag = calF15
      ? `(Example p90: ${calF15.p90.toFixed(4)}, max: ${calF15.max.toFixed(4)})`
      : `(default threshold: ${threshF15.toFixed(4)})`;
    addFlag(
      'F15',
      'warn',
      frames[shimStart]!.t,
      frames[frames.length - 1]!.t,
      `shimmer index ${maxShim.toFixed(4)} exceeded threshold ${calTag}`,
      isCalF15
    );
  }

  // -------------------------------------------------------------
  // TIER A (Objective / Blocking): F16 (Unintended blank screen / dropout)
  // -------------------------------------------------------------

  // F16: near-black or near-white run > 0.3 s outside --allow-blank
  // allow-blank is an overlap whitelist (not full containment); kind resets on change.
  const blankAllowed = (t0: number, t1: number) =>
    allowBlankRanges.some(([b0, b1]) => t0 <= b1 + 0.05 && t1 >= b0 - 0.05);
  const emitBlank = (startIdx: number, endIdx: number, kind: string) => {
    const t0 = frames[startIdx]!.t, t1 = frames[endIdx]!.t;
    const dur = runDur(startIdx, endIdx);
    if (dur < CONFIG.blank_max_run_s) return;
    if (blankAllowed(t0, t1)) return;
    addFlag(
      'F16',
      'fail',
      t0,
      t1,
      `near-${kind} segment of ${dur.toFixed(2)}s outside --allow-blank (> ${CONFIG.blank_max_run_s}s)`,
      false
    );
  };
  let blankStart = -1;
  let blankKind = '';
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const isBlack = f.luma < CONFIG.blank_black_luma;
    const isWhite = f.luma > CONFIG.blank_white_luma && f.contrast < CONFIG.blank_white_max_contrast;

    if (isBlack || isWhite) {
      const curKind = isBlack ? 'black' : 'white';
      if (blankStart < 0) { blankStart = i; blankKind = curKind; }
      else if (curKind !== blankKind) { emitBlank(blankStart, i - 1, blankKind); blankStart = i; blankKind = curKind; }
    } else {
      if (blankStart >= 0) { emitBlank(blankStart, i - 1, blankKind); blankStart = -1; }
    }
  }
  if (blankStart >= 0) emitBlank(blankStart, frames.length - 1, blankKind);

  // Sort flags: Tier A first (blocking before advisory), then Tier B, then Tier C, then t0
  const tierOrder: Record<string, number> = {
    tier_a_objective: 0,
    tier_b_benchmark: 1,
    tier_c_proxy: 2,
  };
  const classOrder: Record<string, number> = {
    blocking: 0,
    advisory: 1,
    info: 2,
  };
  const sevOrder: Record<string, number> = {
    fail: 0,
    warn: 1,
    info: 2,
  };

  flags.sort((a, b) => {
    const tDiff = (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9);
    if (tDiff !== 0) return tDiff;
    const cDiff = (classOrder[a.class] ?? 9) - (classOrder[b.class] ?? 9);
    if (cDiff !== 0) return cDiff;
    const sDiff = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
    if (sDiff !== 0) return sDiff;
    if (Math.abs(a.t0 - b.t0) > 0.001) return a.t0 - b.t0;
    return a.id.localeCompare(b.id);
  });

  return flags;
}
