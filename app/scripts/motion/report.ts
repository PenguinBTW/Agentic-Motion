// Report generation: report.md, findings.json, summary.json, frames.csv, text.csv, events.json
// Generates fact-only visual telemetry, 3-tier findings, and calibrated benchmark comparisons.
import path from 'node:path';
import { CONFIG, type FrameMetrics, type FlagItem, type TextProbeRecord, type TextRun, type AudioEvent, type FindingItem, type CalibrationData } from './config';
import { normalizeText, type WordSyncMetric, type CollisionItem } from './text-analyzer';
import type { CutItem, HitItem } from './flags';

export interface ReportContext {
  command: string;
  plateId: string;
  windowFrom: number;
  windowTo: number;
  fps: number;
  scale: number;
  samples: number | string | { min: number; max: number; tol: number };
  shutter: number;
  frameCount: number;
  wallClockSec: number;
  paletteString: string;
  paletteNames: string[];
  topN: number;
  binSec: number;
  outDir: string;
  allowBlankRanges: [number, number][];
  comparePath?: string;
  calibrationData?: CalibrationData | null;
  evidenceFiles: { name: string; content: string; whenToOpen: string }[];
}

export function generateReportMarkdown(
  ctx: ReportContext,
  flags: FlagItem[],
  frames: FrameMetrics[],
  cuts: CutItem[],
  hits: HitItem[],
  words: WordSyncMetric[],
  runs: TextRun[],
  collisions: CollisionItem[],
  audioEvents: AudioEvent[],
  refSummary?: any
): { markdown: string; summaryJson: any; findingsJson: FindingItem[] } {
  const dur = Math.max(0.001, ctx.windowTo - ctx.windowFrom);

  // Group flags by tier
  const tierAFlags = flags.filter((f) => f.tier === 'tier_a_objective');
  const tierBFlags = flags.filter((f) => f.tier === 'tier_b_benchmark');
  const tierCFlags = flags.filter((f) => f.tier === 'tier_c_proxy');

  const blockingCount = flags.filter((f) => f.class === 'blocking').length;
  const advisoryCount = flags.filter((f) => f.class === 'advisory').length;
  const infoCount = flags.filter((f) => f.class === 'info').length;

  // Build findingsJson with timestamp proximity evidence linking
  const findingsJson: FindingItem[] = flags.map((f) => {
    const matchingEvidence = ctx.evidenceFiles
      .filter((ev) => {
        if (ev.name.toLowerCase().includes(f.id.toLowerCase())) return true;
        const match = ev.name.match(/_(\d+(?:\.\d+)?)\.(?:png|csv)$/);
        if (match) {
          const t = parseFloat(match[1]!);
          if (Math.abs(t - f.t0) < 0.50 || (t >= f.t0 - 0.50 && t <= f.t1 + 0.50)) return true;
        }
        return false;
      })
      .map((ev) => ev.name);

    if (f.tier === 'tier_a_objective') {
      if (ctx.evidenceFiles.some((ev) => ev.name === 'timeline.png') && !matchingEvidence.includes('timeline.png')) {
        matchingEvidence.unshift('timeline.png');
      }
      if (ctx.evidenceFiles.some((ev) => ev.name === 'slitscan.png') && !matchingEvidence.includes('slitscan.png')) {
        matchingEvidence.unshift('slitscan.png');
      }
    }

    return {
      id: f.id,
      tool: 'motion',
      rule: f.rule,
      tier: f.tier,
      source: f.source,
      class: f.class,
      severity: f.severity,
      t0: f.t0,
      t1: f.t1,
      evidenceFiles: matchingEvidence,
      ruleDescription: f.ruleDescription,
      evidence: f.evidence,
      calibrated: Boolean(f.calibrated),
      limits: f.limits,
      waived: Boolean(f.waived),
      waiverReason: f.waiverReason ?? null,
    };
  });

  // Top 5 Ranked Findings (Blocking first, then Advisory, then Info)
  const rankedTop5 = [...flags].slice(0, 5);
  let rankedSection = '';
  if (rankedTop5.length === 0) {
    rankedSection = '> **Top Findings**: Zero anomalies detected in window.\n\n';
  } else {
    rankedSection = '### Top 5 Findings (Ranked Priority)\n\n';
    rankedTop5.forEach((f, idx) => {
      const classTag = f.class === 'blocking' ? '**[BLOCKING]**' : f.class === 'advisory' ? '*[ADVISORY]*' : '[INFO]';
      rankedSection += `${idx + 1}. ${classTag} \`${f.id}\` (${f.t0.toFixed(2)}–${f.t1.toFixed(2)}s): ${f.evidence}\n   - *Limits*: ${f.limits}\n`;
    });
    rankedSection += '\n';
  }

  // 1. FLAGS table formatted by tiers
  let flagsTable = '';

  // Tier A Table
  flagsTable += '### 1.1 Tier A: Objective Findings\n';
  flagsTable += '> **Limits**: Canvas2D text bounds; does not detect shader margin clipping. Screen-space 2D coordinates ignore Z depth.\n';
  flagsTable += '> *Review policy: Only Tier A flags may be blocking. Hard bugs must be addressed before merge.*\n\n';
  flagsTable += '| id | class | severity | t0–t1 (s) | rule | evidence |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n';
  if (tierAFlags.length === 0) {
    flagsTable += '| - | - | - | - | Zero objective violations | No collision, clipping, dropout, or vocal cuts |\n';
  } else {
    for (const f of tierAFlags.slice(0, ctx.topN)) {
      flagsTable += `| ${f.id} | ${f.class} | ${f.severity} | ${f.t0.toFixed(2)}–${f.t1.toFixed(2)} | ${f.ruleDescription} | ${f.evidence} |\n`;
    }
    if (tierAFlags.length > ctx.topN) {
      flagsTable += `| ... | ... | ... | ... | ... | (+${tierAFlags.length - ctx.topN} more Tier A findings) |\n`;
    }
  }
  flagsTable += '\n';

  // Tier B Table
  flagsTable += '### 1.2 Tier B: Calibrated Benchmark Comparisons\n';
  flagsTable += '> **Limits**: Derived from Example project reference distributions (p10–p90). Does not impose creative uniformity.\n';
  flagsTable += '> *Review policy: Advisory only. Reviewers may waive any advisory finding with a one-line written reason in findings.json.*\n\n';
  flagsTable += '| id | class | t0–t1 (s) | rule | evidence (vs Example range) |\n| :--- | :--- | :--- | :--- | :--- |\n';
  if (tierBFlags.length === 0) {
    flagsTable += '| - | - | - | Within calibrated benchmark range | All metrics conform to Example project empirical bounds |\n';
  } else {
    for (const f of tierBFlags.slice(0, ctx.topN)) {
      flagsTable += `| ${f.id} | ${f.class} | ${f.t0.toFixed(2)}–${f.t1.toFixed(2)} | ${f.ruleDescription} | ${f.evidence} |\n`;
    }
    if (tierBFlags.length > ctx.topN) {
      flagsTable += `| ... | ... | ... | ... | (+${tierBFlags.length - ctx.topN} more Tier B findings) |\n`;
    }
  }
  flagsTable += '\n';

  // Tier C Table
  flagsTable += '### 1.3 Tier C: Perceptual Proxies (Uncalibrated)\n';
  flagsTable += '> **Limits**: Unvalidated heuristic proxies. Cannot see semantic intent, shader text, or intentional hold frames.\n';
  flagsTable += '> *Review policy: Informational only. DO NOT optimize or game code to satisfy these proxies.*\n\n';
  flagsTable += '| id | class | t0–t1 (s) | proxy heuristic | measured telemetry |\n| :--- | :--- | :--- | :--- | :--- |\n';
  if (tierCFlags.length === 0) {
    flagsTable += '| - | - | - | None triggered | No heuristic proxy triggers |\n';
  } else {
    for (const f of tierCFlags.slice(0, ctx.topN)) {
      flagsTable += `| ${f.id} | ${f.class} | ${f.t0.toFixed(2)}–${f.t1.toFixed(2)} | ${f.ruleDescription} | ${f.evidence} |\n`;
    }
    if (tierCFlags.length > ctx.topN) {
      flagsTable += `| ... | ... | ... | ... | (+${tierCFlags.length - ctx.topN} more Tier C findings) |\n`;
    }
  }

  // 2. Timeline bins (--bin s)
  const numBins = Math.max(1, Math.ceil(dur / ctx.binSec));
  const bins: any[] = [];
  for (let b = 0; b < numBins; b++) {
    const t0 = ctx.windowFrom + b * ctx.binSec;
    const t1 = Math.min(ctx.windowTo, t0 + ctx.binSec);
    const bFrames = frames.filter((f) => f.t >= t0 && f.t < t1);
    if (bFrames.length === 0) continue;

    const eMean = bFrames.reduce((acc, f) => acc + f.E, 0) / bFrames.length;
    const eP95 = bFrames.reduce((acc, f) => acc + f.E_p95, 0) / bFrames.length;
    const dxMean = bFrames.reduce((acc, f) => acc + f.flow_dx, 0) / bFrames.length;
    const dyMean = bFrames.reduce((acc, f) => acc + f.flow_dy, 0) / bFrames.length;
    const lumaMean = bFrames.reduce((acc, f) => acc + f.luma, 0) / bFrames.length;
    const contMean = bFrames.reduce((acc, f) => acc + f.contrast, 0) / bFrames.length;
    const sigMean = bFrames.reduce((acc, f) => acc + f.signal_pct, 0) / bFrames.length;
    const bnsMean = bFrames.reduce((acc, f) => acc + f.bright_nonsignal_pct, 0) / bFrames.length;
    const edgeMean = bFrames.reduce((acc, f) => acc + f.edge_density, 0) / bFrames.length;
    const segsMean = bFrames.reduce((acc, f) => acc + f.segs, 0) / bFrames.length;
    const msMean = bFrames.reduce((acc, f) => acc + f.ms, 0) / bFrames.length;
    const sppMean = bFrames.reduce((acc, f) => acc + f.spp, 0) / bFrames.length;

    // Associated texts in bin
    const bTexts = words.filter((w) => w.first_visible !== null && w.first_visible < t1 && w.last_visible! >= t0);
    const nTexts = bTexts.length;
    const maxTextH = bTexts.length ? Math.max(...bTexts.map((w) => w.peak_hPct)) : 0;
    const minTextH = bTexts.length ? Math.min(...bTexts.map((w) => w.peak_hPct)) : 0;

    // Palette class shares
    const pShares: Record<string, number> = {};
    for (const pName of ctx.paletteNames) {
      pShares[pName] = bFrames.reduce((acc, f) => acc + (f.palette_shares[pName] ?? 0), 0) / bFrames.length;
    }
    const otherPct = bFrames.reduce((acc, f) => acc + f.other_pct, 0) / bFrames.length;

    bins.push({
      t0,
      t1,
      eMean,
      eP95,
      dxMean,
      dyMean,
      lumaMean,
      contMean,
      sigMean,
      bnsMean,
      edgeMean,
      nTexts,
      maxTextH,
      minTextH,
      segsMean,
      msMean,
      sppMean,
      pShares,
      otherPct,
    });
  }

  const cappedBins = bins.slice(0, ctx.topN);
  const remBins = bins.length - cappedBins.length;
  let binsTable = '| t0 (s) | E_mean | E_p95 | flow_dx (px/s) | flow_dy (px/s) | luma | contrast | signal% | bright_nonsignal% | edge_density | n_texts | max_text_h% | min_text_h% | segs | ms | spp |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';
  for (const b of cappedBins) {
    binsTable += `| ${b.t0.toFixed(2)} | ${b.eMean.toFixed(4)} | ${b.eP95.toFixed(4)} | ${b.dxMean.toFixed(1)} | ${b.dyMean.toFixed(1)} | ${b.lumaMean.toFixed(3)} | ${b.contMean.toFixed(3)} | ${b.sigMean.toFixed(2)} | ${b.bnsMean.toFixed(2)} | ${b.edgeMean.toFixed(4)} | ${b.nTexts} | ${b.maxTextH.toFixed(1)} | ${b.minTextH.toFixed(1)} | ${Math.round(b.segsMean)} | ${b.msMean.toFixed(1)} | ${Math.round(b.sppMean)} |\n`;
  }
  if (remBins > 0) binsTable += `| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | (+${remBins} more bins) |\n`;

  // 3. Cuts
  const cappedCuts = cuts.slice(0, ctx.topN);
  const remCuts = cuts.length - cappedCuts.length;
  let cutsTable = '| t (s) | diff_before→after | type | nearest_downbeat_Δms (ms) | inside_word? |\n| :--- | :--- | :--- | :--- | :--- |\n';
  if (cappedCuts.length === 0) {
    cutsTable += '| - | - | none | - | false |\n';
  } else {
    for (const c of cappedCuts) {
      cutsTable += `| ${c.t.toFixed(2)} | ${c.diff_before_after.toFixed(4)} | ${c.type} | ${c.nearest_downbeat_Δms.toFixed(1)} | ${c.inside_word} |\n`;
    }
  }
  if (remCuts > 0) cutsTable += `| ... | ... | ... | ... | (+${remCuts} more cuts) |\n`;

  // 4. Hits (top N by strength)
  hits.sort((a, b) => b.strength - a.strength);
  const cappedHits = hits.slice(0, ctx.topN);
  const remHits = hits.length - cappedHits.length;
  let hitsTable = '| t (s) | strength | E_base | E_peak | ratio | latency (ms) | luma_jump | shake (px) |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';
  if (cappedHits.length === 0) {
    hitsTable += '| - | - | - | - | - | - | - | - |\n';
  } else {
    for (const h of cappedHits) {
      hitsTable += `| ${h.t.toFixed(2)} | ${h.strength.toFixed(3)} | ${h.E_base.toFixed(4)} | ${h.E_peak.toFixed(4)} | ${h.ratio.toFixed(2)} | ${h.latency_ms.toFixed(1)} | ${h.luma_jump.toFixed(3)} | ${h.shake_px.toFixed(1)} |\n`;
    }
  }
  if (remHits > 0) hitsTable += `| ... | ... | ... | ... | ... | ... | ... | (+${remHits} more hits) |\n`;

  // 5. Words
  const cappedWords = words.slice(0, ctx.topN);
  const remWords = words.length - cappedWords.length;
  let wordsTable = '| word | line | start (s) | end (s) | first_visible (s) | last_visible (s) | appear_Δms (ms) | visible_during_sung% | peak_h% | mean_h% | travel (px/s) | clip% | match |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';
  if (cappedWords.length === 0) {
    wordsTable += '| - | - | - | - | - | - | - | - | - | - | - | - | none |\n';
  } else {
    for (const w of cappedWords) {
      const fv = w.first_visible !== null ? w.first_visible.toFixed(2) : '-';
      const lv = w.last_visible !== null ? w.last_visible.toFixed(2) : '-';
      const app = w.appear_Δms !== null ? w.appear_Δms.toFixed(0) : '-';
      wordsTable += `| ${w.word} | ${w.line.slice(0, 24)}... | ${w.start.toFixed(2)} | ${w.end.toFixed(2)} | ${fv} | ${lv} | ${app} | ${w.visible_during_sung_pct.toFixed(1)} | ${w.peak_hPct.toFixed(1)} | ${w.mean_hPct.toFixed(1)} | ${w.travel_px_s.toFixed(1)} | ${w.clip_pct.toFixed(1)} | ${w.match} |\n`;
    }
  }
  if (remWords > 0) wordsTable += `| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | (+${remWords} more words) |\n`;

  // 6. Text runs (non-lyric)
  const nonLyricRuns = runs.filter((r) => !words.some((w) => normalizeText(w.word) === r.normalizedText));
  const cappedNonLyric = nonLyricRuns.slice(0, ctx.topN);
  const remNL = nonLyricRuns.length - cappedNonLyric.length;
  let nlTable = '| string | slot | t0–t1 (s) | dur (s) | h% | distinct_strings_in_slot | notes |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';
  if (cappedNonLyric.length === 0) {
    nlTable += '| - | - | - | - | - | - | none |\n';
  } else {
    for (const r of cappedNonLyric) {
      nlTable += `| "${r.rawText}" | ${r.slotId} | ${r.first_t.toFixed(2)}–${r.last_t.toFixed(2)} | ${r.dur.toFixed(2)} | ${r.mean_hPct.toFixed(1)} | 1 | alpha ${r.min_alpha.toFixed(2)}–${r.max_alpha.toFixed(2)} |\n`;
    }
  }
  if (remNL > 0) nlTable += `| ... | ... | ... | ... | ... | ... | (+${remNL} more runs) |\n`;

  // 7. Collisions and clipping
  const cappedCollisions = collisions.slice(0, ctx.topN);
  const remCol = collisions.length - cappedCollisions.length;
  let colTable = '| pair | t0–t1 (s) | intersection% | clip% |\n| :--- | :--- | :--- | :--- |\n';
  if (cappedCollisions.length === 0) {
    colTable += '| - | - | 0.0 | 0.0 |\n';
  } else {
    for (const c of cappedCollisions) {
      colTable += `| ${c.pair} | ${c.t0.toFixed(2)}–${c.t1.toFixed(2)} | ${c.intersection_pct.toFixed(1)} | ${c.clip_pct.toFixed(1)} |\n`;
    }
  }
  if (remCol > 0) colTable += `| ... | ... | ... | (+${remCol} more collisions) |\n`;

  // 8. Static and blank segments
  const staticSegments: { t0: number; t1: number; kind: string; eMean: number }[] = [];
  let sStart = -1, eSum = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (f.E < CONFIG.eps_energy) {
      if (sStart < 0) { sStart = i; eSum = f.E; } else eSum += f.E;
    } else {
      if (sStart >= 0) {
        const durSeg = frames[i - 1]!.t - frames[sStart]!.t;
        if (durSeg >= CONFIG.dead_motion_s) staticSegments.push({ t0: frames[sStart]!.t, t1: frames[i - 1]!.t, kind: 'dead-motion', eMean: eSum / (i - sStart) });
        sStart = -1;
      }
    }
  }
  if (sStart >= 0 && frames.length > 0) {
    const durSeg = frames[frames.length - 1]!.t - frames[sStart]!.t;
    if (durSeg >= CONFIG.dead_motion_s) staticSegments.push({ t0: frames[sStart]!.t, t1: frames[frames.length - 1]!.t, kind: 'dead-motion', eMean: eSum / (frames.length - sStart) });
  }

  // Blank runs (thresholds from CONFIG to avoid drift; reset on kind change)
  let bStart = -1, bKind = '';
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const isBlk = f.luma < CONFIG.blank_black_luma, isWht = f.luma > CONFIG.blank_white_luma && f.contrast < CONFIG.blank_white_max_contrast;
    if (isBlk || isWht) {
      const k = isBlk ? 'blank-dark' : 'blank-light';
      if (bStart < 0) { bStart = i; bKind = k; }
      else if (k !== bKind) {
        // Kind changed without gap (black→white) — close previous run, start new.
        const durPrev = frames[i - 1]!.t - frames[bStart]!.t;
        if (durPrev >= CONFIG.blank_max_run_s) staticSegments.push({ t0: frames[bStart]!.t, t1: frames[i - 1]!.t, kind: bKind, eMean: 0.0 });
        bStart = i; bKind = k;
      }
    } else {
      if (bStart >= 0) {
        const durSeg = frames[i - 1]!.t - frames[bStart]!.t;
        if (durSeg >= CONFIG.blank_max_run_s) staticSegments.push({ t0: frames[bStart]!.t, t1: frames[i - 1]!.t, kind: bKind, eMean: 0.0 });
        bStart = -1;
      }
    }
  }
  if (bStart >= 0) {
    const durSeg = frames[frames.length - 1]!.t - frames[bStart]!.t;
    if (durSeg >= CONFIG.blank_max_run_s) staticSegments.push({ t0: frames[bStart]!.t, t1: frames[frames.length - 1]!.t, kind: bKind, eMean: 0.0 });
  }

  const cappedStatic = staticSegments.slice(0, ctx.topN);
  const remStatic = staticSegments.length - cappedStatic.length;
  let staticTable = '| t0–t1 (s) | kind | E_mean |\n| :--- | :--- | :--- |\n';
  if (cappedStatic.length === 0) {
    staticTable += '| - | none | 0.0000 |\n';
  } else {
    for (const s of cappedStatic) {
      staticTable += `| ${s.t0.toFixed(2)}–${s.t1.toFixed(2)} | ${s.kind} | ${s.eMean.toFixed(5)} |\n`;
    }
  }
  if (remStatic > 0) staticTable += `| ... | ... | (+${remStatic} more segments) |\n`;

  // 9. Palette
  let palTable = '| t0 (s) | ' + ctx.paletteNames.map((p) => `${p}%`).join(' | ') + ' | other% |\n| :--- | ' + ctx.paletteNames.map(() => ':---').join(' | ') + ' | :--- |\n';
  for (const b of cappedBins) {
    const palCols = ctx.paletteNames.map((p) => (b.pShares[p] ?? 0).toFixed(1)).join(' | ');
    palTable += `| ${b.t0.toFixed(2)} | ${palCols} | ${b.otherPct.toFixed(1)} |\n`;
  }
  if (remBins > 0) palTable += `| ... | ` + ctx.paletteNames.map(() => '...').join(' | ') + ` | (+${remBins} more bins) |\n`;

  // 10. Perf and sampling
  const msList = frames.map((f) => f.ms).sort((a, b) => a - b);
  const p50Ms = msList[Math.floor(msList.length * 0.50)] ?? 0;
  const p95Ms = msList[Math.floor(msList.length * 0.95)] ?? 0;
  const maxMs = msList[msList.length - 1] ?? 0;
  const framesOver25 = frames.filter((f) => f.ms > 25.0).length;

  const sppHist: Record<number, number> = {};
  for (const f of frames) sppHist[f.spp] = (sppHist[f.spp] ?? 0) + 1;
  const sppStr = Object.entries(sppHist).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${k}:${v}`).join(' ');

  const sortedByPerf = [...frames].sort((a, b) => b.ms - a.ms);
  const worst5 = sortedByPerf.slice(0, 5);
  let worst5Table = '| t (s) | ms | spp |\n| :--- | :--- | :--- |\n';
  for (const w of worst5) {
    worst5Table += `| ${w.t.toFixed(2)} | ${w.ms.toFixed(1)} | ${w.spp} |\n`;
  }

  // 11. Benchmark comparison (calibrated against Example project distribution or ref summary)
  let compareSection = '';
  const calData = ctx.calibrationData;
  if (calData || (ctx.comparePath && refSummary)) {
    const curCutRate = dur > 0 ? cuts.length / dur : 0;
    const curEMean = frames.length ? frames.reduce((a, b) => a + b.E, 0) / frames.length : 0;
    const curEP95 = frames.length ? frames.reduce((a, b) => a + b.E_p95, 0) / frames.length : 0;
    const hitRatios = hits.map((h) => h.ratio).sort((a, b) => a - b);
    const curHitRatio = hitRatios.length ? hitRatios[Math.floor(hitRatios.length / 2)]! : 1.0;
    const textSizes = words.map((w) => w.peak_hPct).filter((h) => h > 0).sort((a, b) => a - b);
    const curTextRatio = textSizes.length > 1 ? textSizes[textSizes.length - 1]! / Math.max(0.1, textSizes[0]!) : 1.0;
    const curSig = frames.length ? frames.reduce((a, b) => a + b.signal_pct, 0) / frames.length : 0;
    const curEdge = frames.length ? frames.reduce((a, b) => a + b.edge_density, 0) / frames.length : 0;
    const deadFrames = frames.filter((f) => f.E < 0.001).length;
    const curDeadFrac = frames.length ? deadFrames / frames.length : 0;

    const metricsToCompare: { name: string; key?: string; val: number; refVal?: number }[] = [
      { name: 'cut rate/s', key: 'cutRatePerSec', val: curCutRate, refVal: refSummary?.metrics?.cutRatePerSec },
      { name: 'E_mean', key: 'energyMean', val: curEMean, refVal: refSummary?.metrics?.energyMean },
      { name: 'E_p95', key: 'energyP95', val: curEP95, refVal: refSummary?.metrics?.energyP95 },
      { name: 'kick response ratio median', key: 'kickResponseRatioMedian', val: curHitRatio, refVal: refSummary?.metrics?.kickResponseRatioMedian },
      { name: 'max/min text size ratio median', key: 'textMaxSizeRatioMedian', val: curTextRatio, refVal: refSummary?.metrics?.textMaxSizeRatioMedian },
      { name: 'signal%', key: 'signalPct', val: curSig, refVal: refSummary?.metrics?.signalPct },
      { name: 'edge_density', key: 'edgeDensity', val: curEdge, refVal: refSummary?.metrics?.edgeDensity },
      { name: 'dead-motion fraction', key: 'deadMotionFraction', val: curDeadFrac, refVal: refSummary?.metrics?.deadMotionFraction },
    ];

    compareSection = `## 11. Compare to Benchmark (Example Project Reference)\n\n`;
    compareSection += `> **Limits**: Example project represents a distinct pacing and density aesthetic; stylistic differences from benchmark are advisory context, not quality grades.\n\n`;
    compareSection += `| metric | this plate | Example range (p10–p90) | status |\n| :--- | :--- | :--- | :--- |\n`;

    for (const m of metricsToCompare) {
      const dist = calData?.[m.key ?? ''];
      if (dist && dist.n > 0) {
        let status = 'within range';
        if (m.val < dist.p10) status = 'below range';
        else if (m.val > dist.p90) status = 'above range';
        compareSection += `| ${m.name} | ${m.val.toFixed(3)} | ${dist.p10.toFixed(3)}–${dist.p90.toFixed(3)} (min ${dist.min.toFixed(3)}, max ${dist.max.toFixed(3)}) | ${status} |\n`;
      } else if (m.refVal !== undefined) {
        const ratio = m.refVal > 0.0001 ? m.val / m.refVal : 1.0;
        const status = ratio < 0.70 ? 'below range' : ratio > 1.30 ? 'above range' : 'within range';
        compareSection += `| ${m.name} | ${m.val.toFixed(3)} | ref: ${m.refVal.toFixed(3)} | ${status} |\n`;
      } else {
        compareSection += `| ${m.name} | ${m.val.toFixed(3)} | no reference | no reference |\n`;
      }
    }
    compareSection += '\n';
  }

  // 12. Evidence index
  let evidenceTable = '| file | content | when to open |\n| :--- | :--- | :--- |\n';
  for (const ev of ctx.evidenceFiles) {
    evidenceTable += `| [\`${ev.name}\`](file:///${path.resolve(ctx.outDir, ev.name).replace(/\\/g, '/')}) | ${ev.content} | ${ev.whenToOpen} |\n`;
  }

  // Assemble full report.md
  const markdown = `# Motion Analysis Telemetry Report

## 0. Header & Run Context
- **Command**: \`${ctx.command}\`
- **Plate ID**: \`${ctx.plateId}\`
- **Window**: \`${ctx.windowFrom.toFixed(2)}–${ctx.windowTo.toFixed(2)} s\` (duration: \`${dur.toFixed(2)} s\`)
- **Framerate**: \`${ctx.fps} fps\`
- **Scale**: \`${ctx.scale}\`
- **Samples / Shutter**: \`${ctx.samples} / ${ctx.shutter}\`
- **Frame Count**: \`${ctx.frameCount}\`
- **Wall-clock**: \`${ctx.wallClockSec.toFixed(1)} s\`
- **Palette**: \`${ctx.paletteString}\`
- **Probe Coverage**: \`canvas2d-only\` (Known limit: text rendered inside WebGL shaders or atlases is invisible to probe. Pixel metrics cover all frames.)
- **Findings Summary**: \`${blockingCount} blocking\`, \`${advisoryCount} advisory\`, \`${infoCount} info\`

${rankedSection}## 1. Diagnostic Findings & Flags

${flagsTable}
## 2. Timeline Bins (${ctx.binSec.toFixed(2)} s)
> **Limits**: Time-averaged metrics smooth out micro-spikes shorter than the bin duration.

${binsTable}
## 3. Visual Cuts & Scene Transitions
> **Limits**: Detects frame-to-frame pixel-difference discontinuities. Smooth wipes and gradual morphs register as continuous flow.

${cutsTable}
## 4. Audio Hit Responses (Kicks & Snares)
> **Limits**: Relies on acoustic events in audio.json. Acoustic syncopations or polyrhythms not annotated in data will not trigger hit probes.

${hitsTable}
## 5. Lyric Typographic Synchronization
> **Limits**: Intercepts Canvas2D text rendering. Custom 3D glyph geometries and shader text do not produce Canvas2D probe events.

${wordsTable}
## 6. Non-Lyric Text Runs & Slots
> **Limits**: Canvas2D only. Single-frame ephemeral strings do not register as persistent spatial slots.

${nlTable}
## 7. Spatial Collisions & Frame Clipping
> **Limits**: Evaluates 2D screen-space bounding boxes. Overlapping text separated along the camera Z axis will trigger 2D overlap.

${colTable}
## 8. Static & Blank Segments
> **Limits**: Cannot distinguish intentional dramatic blackout holds from rendering stalls without \`--allow-blank\`.

${staticTable}
## 9. Palette Distribution & Swatch Adherence
> **Limits**: CIE Lab distance ΔE 12 on downsampled buffer. Subtle gradient anti-aliasing fringes may register as other%.

${palTable}
## 10. Frame Render Durations & Sampling
> **Limits**: Headless Chrome pixel readback introduces CPU/IPC latency. In-engine runtime frame times are lower.

| metric | value |
| :--- | :--- |
| ms p50 | ${p50Ms.toFixed(1)} ms |
| ms p95 | ${p95Ms.toFixed(1)} ms |
| ms max | ${maxMs.toFixed(1)} ms |
| frames over 25 ms | ${framesOver25} |
| spp histogram | ${sppStr} |

### Worst 5 frames
${worst5Table}
${compareSection}## 12. Evidence Index
> **Limits**: Visual diagnostic artifacts are targeted proxies to assist human and model inspection.

${evidenceTable}
`;

  // summary.json structure
  const summaryJson = {
    plate: ctx.plateId,
    from: ctx.windowFrom,
    to: ctx.windowTo,
    fps: ctx.fps,
    frameCount: ctx.frameCount,
    wallClockSec: ctx.wallClockSec,
    calibrated: Boolean(calData),
    tierCounts: {
      tierA_objective: tierAFlags.length,
      tierB_benchmark: tierBFlags.length,
      tierC_proxy: tierCFlags.length,
      blocking: blockingCount,
      advisory: advisoryCount,
      info: infoCount,
    },
    metrics: {
      cutRatePerSec: dur > 0 ? cuts.length / dur : 0,
      cutCount: cuts.length,
      energyMean: frames.length ? frames.reduce((a, b) => a + b.E, 0) / frames.length : 0,
      energyP95: frames.length ? frames.reduce((a, b) => a + b.E_p95, 0) / frames.length : 0,
      kickResponseRatioMedian: hits.length ? (hits.map((h) => h.ratio).sort((a, b) => a - b)[Math.floor(hits.length / 2)] ?? 1.0) : 1.0,
      textMaxSizeRatioMedian: (() => {
        const sized = words.filter((w) => w.peak_hPct > 0).map((w) => w.peak_hPct);
        if (sized.length < 2) return 1.0;
        return Math.max(...sized)! / Math.max(0.1, Math.min(...sized)!);
      })(),
      signalPct: frames.length ? frames.reduce((a, b) => a + b.signal_pct, 0) / frames.length : 0,
      brightNonsignalPct: frames.length ? frames.reduce((a, b) => a + b.bright_nonsignal_pct, 0) / frames.length : 0,
      otherPct: frames.length ? frames.reduce((a, b) => a + (b.other_pct ?? 0), 0) / frames.length : 0,
      edgeDensity: frames.length ? frames.reduce((a, b) => a + b.edge_density, 0) / frames.length : 0,
      deadMotionFraction: frames.length ? frames.filter((f) => f.E < CONFIG.eps_energy).length / frames.length : 0,
      perfP50Ms: p50Ms,
      perfP95Ms: p95Ms,
      perfMaxMs: maxMs,
      framesOver25ms: framesOver25,
    },
    flags: flags.map((f) => ({
      id: f.id,
      rule: f.rule,
      tier: f.tier,
      source: f.source,
      class: f.class,
      severity: f.severity,
      t0: f.t0,
      t1: f.t1,
      ruleDescription: f.ruleDescription,
      evidence: f.evidence,
      limits: f.limits,
      calibrated: Boolean(f.calibrated),
      waived: Boolean(f.waived),
    })),
    findings: findingsJson,
    cuts: cuts.map((c) => ({
      t: c.t,
      diff: c.diff_before_after,
      type: c.type,
      nearest_downbeat_Δms: c.nearest_downbeat_Δms,
      inside_word: c.inside_word,
    })),
    hits: hits.map((h) => ({
      t: h.t,
      strength: h.strength,
      type: h.type,
      ratio: h.ratio,
      latency_ms: h.latency_ms,
      shake_px: h.shake_px,
    })),
  };

  return { markdown, summaryJson, findingsJson };
}

export function generateFramesCsv(frames: FrameMetrics[]): string {
  const header = 'n,t,E,E_p95,flow_dx,flow_dy,luma,contrast,edge_density,signal_pct,bright_nonsignal_pct,other_pct,shimmer,segs,ms,spp\n';
  let rows = '';
  for (const f of frames) {
    rows += `${f.n},${f.t.toFixed(4)},${f.E.toFixed(5)},${f.E_p95.toFixed(5)},${f.flow_dx.toFixed(2)},${f.flow_dy.toFixed(2)},${f.luma.toFixed(4)},${f.contrast.toFixed(4)},${f.edge_density.toFixed(5)},${f.signal_pct.toFixed(3)},${f.bright_nonsignal_pct.toFixed(3)},${(f.other_pct ?? 0).toFixed(3)},${f.shimmer.toFixed(5)},${f.segs},${f.ms.toFixed(2)},${f.spp}\n`;
  }
  return header + rows;
}

export function generateTextCsv(records: TextProbeRecord[]): string {
  const header = 'frameIdx,t,text,fontFamily,fontPx,fillStyle,globalAlpha,layerId,minX,minY,maxX,maxY,w,h,cx,cy,hPct,isStroke\n';
  let rows = '';
  for (const r of records) {
    const safeText = `"${r.text.replace(/"/g, '""')}"`;
    rows += `${r.frameIdx},${r.t.toFixed(4)},${safeText},"${r.fontFamily}",${r.fontPx},"${r.fillStyle}",${r.globalAlpha.toFixed(3)},"${r.layerId}",${r.bbox[0].toFixed(1)},${r.bbox[1].toFixed(1)},${r.bbox[2].toFixed(1)},${r.bbox[3].toFixed(1)},${r.w.toFixed(1)},${r.h.toFixed(1)},${r.cx.toFixed(1)},${r.cy.toFixed(1)},${r.hPct.toFixed(2)},${r.isStroke ? 1 : 0}\n`;
  }
  return header + rows;
}

export function generateEventsCsv(framesAroundEvent: FrameMetrics[], eventT: number): string {
  const header = 'frame,t,dt_to_event,E,E_p95,flow_dx,flow_dy,luma,contrast,edge_density,signal_pct,bright_nonsignal_pct,shimmer,segs,ms,spp\n';
  let rows = '';
  for (const f of framesAroundEvent) {
    const dt = f.t - eventT;
    rows += `${f.n},${f.t.toFixed(4)},${dt.toFixed(4)},${f.E.toFixed(5)},${f.E_p95.toFixed(5)},${f.flow_dx.toFixed(2)},${f.flow_dy.toFixed(2)},${f.luma.toFixed(4)},${f.contrast.toFixed(4)},${f.edge_density.toFixed(5)},${f.signal_pct.toFixed(3)},${f.bright_nonsignal_pct.toFixed(3)},${f.shimmer.toFixed(5)},${f.segs},${f.ms.toFixed(2)},${f.spp}\n`;
  }
  return header + rows;
}
