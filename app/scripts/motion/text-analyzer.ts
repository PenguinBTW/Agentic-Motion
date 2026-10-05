// Text probe analysis: runs, lyric join, slots, collisions, clipping.
import { CONFIG, type TextProbeRecord, type TextRun, type TextSlot } from './config';

export function normalizeText(str: string): string {
  return str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export interface LyricWord {
  w: string;
  start: number;
  end: number;
  lineIdx: number;
  lineText: string;
}

export interface WordSyncMetric {
  word: string;
  line: string;
  start: number;
  end: number;
  first_visible: number | null;
  last_visible: number | null;
  appear_Δms: number | null;
  visible_during_sung_pct: number;
  peak_hPct: number;
  mean_hPct: number;
  travel_px_s: number;
  clip_pct: number;
  match: 'word' | 'line' | 'none';
}

export interface CollisionItem {
  pair: string;
  t0: number;
  t1: number;
  intersection_pct: number;
  clip_pct: number;
}

export interface TextAnalysisResult {
  records: TextProbeRecord[];
  runs: TextRun[];
  slots: TextSlot[];
  words: WordSyncMetric[];
  collisions: CollisionItem[];
  cornerRuns: TextRun[];
  staticDigitRuns: { run: TextRun; slot: TextSlot; dur: number }[];
}

export function analyzeTextProbes(
  records: TextProbeRecord[],
  lyricsData: any,
  windowFrom: number,
  windowTo: number,
  fps = 60
): TextAnalysisResult {
  // Sort records by frameIdx then y/x
  records.sort((a, b) => a.frameIdx - b.frameIdx || a.cy - b.cy || a.cx - b.cx);

  // Group into runs
  // A run connects consecutive frames with same normalized string and centre moving < 200px
  const runs: TextRun[] = [];
  const activeRuns: TextRun[] = [];
  let nextRunId = 1;

  // Group records by frameIdx
  const recordsByFrame = new Map<number, TextProbeRecord[]>();
  for (const r of records) {
    let arr = recordsByFrame.get(r.frameIdx);
    if (!arr) { arr = []; recordsByFrame.set(r.frameIdx, arr); }
    arr.push(r);
  }

  const frameIndices = Array.from(recordsByFrame.keys()).sort((a, b) => a - b);
  for (const fIdx of frameIndices) {
    const frameRecs = recordsByFrame.get(fIdx)!;
    const remainingActive = [...activeRuns];

    for (const rec of frameRecs) {
      const norm = normalizeText(rec.text);
      let matchedRunIdx = -1;
      let minDist = 200.0;

      for (let i = 0; i < remainingActive.length; i++) {
        const ar = remainingActive[i]!;
        const lastRec = ar.records[ar.records.length - 1]!;
        // Allow a small gap (gap <= 2) to prevent transient frame drops from splitting runs
        if (ar.normalizedText === norm && fIdx >= lastRec.frameIdx + 1 && fIdx <= lastRec.frameIdx + 2) {
          const d = Math.hypot(rec.cx - lastRec.cx, rec.cy - lastRec.cy);
          if (d < minDist) {
            minDist = d;
            matchedRunIdx = i;
          }
        }
      }

      // Compute clipping for this record
      const area = Math.max(1, rec.w * rec.h);
      const inW = Math.max(0, Math.min(rec.bbox[2], 1920) - Math.max(rec.bbox[0], 0));
      const inH = Math.max(0, Math.min(rec.bbox[3], 1080) - Math.max(rec.bbox[1], 0));
      const clipPct = (1 - (inW * inH) / area) * 100;

      if (matchedRunIdx >= 0) {
        const ar = remainingActive[matchedRunIdx]!;
        ar.records.push(rec);
        ar.last_t = rec.t;
        ar.dur = ar.last_t - ar.first_t;
        ar.peak_hPct = Math.max(ar.peak_hPct, rec.hPct);
        ar.min_alpha = Math.min(ar.min_alpha, rec.globalAlpha);
        ar.max_alpha = Math.max(ar.max_alpha, rec.globalAlpha);
        ar.max_clip_pct = Math.max(ar.max_clip_pct, clipPct);
        remainingActive.splice(matchedRunIdx, 1);
      } else {
        const newRun: TextRun = {
          id: nextRunId++,
          normalizedText: norm,
          rawText: rec.text,
          first_t: rec.t,
          last_t: rec.t,
          dur: 0,
          peak_hPct: rec.hPct,
          mean_hPct: rec.hPct,
          min_alpha: rec.globalAlpha,
          max_alpha: rec.globalAlpha,
          travel_px_s: 0,
          slotId: 0,
          max_clip_pct: clipPct,
          records: [rec],
        };
        runs.push(newRun);
        activeRuns.push(newRun);
      }
    }

    // Retire inactive runs — only if gap exceeds tolerance (fIdx > last+2),
    // so a 1-2 frame probe dropout does not split the run.
    for (const ar of remainingActive) {
      const lastRec = ar.records[ar.records.length - 1]!;
      if (fIdx <= lastRec.frameIdx + 2) continue;
      const idx = activeRuns.indexOf(ar);
      if (idx >= 0) activeRuns.splice(idx, 1);
    }
  }

  // Finalize run statistics
  for (const r of runs) {
    let sumH = 0;
    for (const rec of r.records) sumH += rec.hPct;
    r.mean_hPct = sumH / r.records.length;
    const firstRec = r.records[0]!, lastRec = r.records[r.records.length - 1]!;
    const travel = Math.hypot(lastRec.cx - firstRec.cx, lastRec.cy - firstRec.cy);
    r.travel_px_s = r.dur > 0 ? travel / r.dur : 0;
  }

  // Assign spatial slots (bbox centres within 40 px)
  const slots: TextSlot[] = [];
  let nextSlotId = 1;

  for (const r of runs) {
    let meanCx = 0, meanCy = 0;
    for (const rec of r.records) { meanCx += rec.cx; meanCy += rec.cy; }
    meanCx /= r.records.length;
    meanCy /= r.records.length;

    let matchedSlot: TextSlot | null = null;
    let minD = CONFIG.slot_dist_px;
    for (const s of slots) {
      const d = Math.hypot(meanCx - s.cx, meanCy - s.cy);
      if (d < minD) { minD = d; matchedSlot = s; }
    }

    if (!matchedSlot) {
      matchedSlot = {
        id: nextSlotId++,
        cx: meanCx,
        cy: meanCy,
        runs: [],
        distinctStrings: [],
      };
      slots.push(matchedSlot);
    }

    r.slotId = matchedSlot.id;
    matchedSlot.runs.push(r);
    if (!matchedSlot.distinctStrings.includes(r.rawText)) {
      matchedSlot.distinctStrings.push(r.rawText);
    }
  }

  // Flatten lyrics words
  const allWords: LyricWord[] = [];
  if (lyricsData?.lines) {
    lyricsData.lines.forEach((line: any, lIdx: number) => {
      if (line.words) {
        for (const w of line.words) {
          allWords.push({
            w: w.w,
            start: w.start,
            end: w.end,
            lineIdx: lIdx,
            lineText: line.text,
          });
        }
      }
    });
  }

  // Filter words to the window (with 1s padding)
  const targetWords = allWords.filter((w) => w.end >= windowFrom - 0.2 && w.start <= windowTo + 0.2);

  // Lyric join
  const wordMetrics: WordSyncMetric[] = [];
  for (const tw of targetWords) {
    const normWord = normalizeText(tw.w);
    const normLine = normalizeText(tw.lineText);

    // Look for exact word match within ±1s of start
    let matchedRun: TextRun | null = null;
    let matchType: 'word' | 'line' | 'none' = 'none';

    for (const r of runs) {
      if (Math.abs(r.first_t - tw.start) <= 1.0) {
        if (r.normalizedText === normWord) {
          matchedRun = r;
          matchType = 'word';
          break;
        }
      }
    }

    // Substring fallback
    if (!matchedRun) {
      for (const r of runs) {
        if (r.first_t <= tw.end + 0.5 && r.last_t >= tw.start - 0.5) {
          if (r.normalizedText.length > 1 && normLine.includes(r.normalizedText)) {
            matchedRun = r;
            matchType = 'line';
            break;
          }
        }
      }
    }

    let firstVis: number | null = null, lastVis: number | null = null;
    let peakH = 0, meanH = 0, travel = 0, clip = 0;
    let visibleSungCount = 0;

    const totalSungFrames = Math.max(1, Math.round((tw.end - tw.start) * fps) + 1);

    if (matchedRun) {
      firstVis = matchedRun.first_t;
      lastVis = matchedRun.last_t;
      peakH = matchedRun.peak_hPct;
      meanH = matchedRun.mean_hPct;
      travel = matchedRun.travel_px_s;

      // Count sung window overlap and measure clipping strictly while word is being sung
      const visibleFrames = new Set<number>();
      let maxSungClip = 0;
      for (const rec of matchedRun.records) {
        if (rec.t >= tw.start && rec.t <= tw.end && rec.globalAlpha > 0.15) {
          visibleFrames.add(rec.frameIdx);
          const area = Math.max(1, rec.w * rec.h);
          const inW = Math.max(0, Math.min(rec.bbox[2], 1920) - Math.max(rec.bbox[0], 0));
          const inH = Math.max(0, Math.min(rec.bbox[3], 1080) - Math.max(rec.bbox[1], 0));
          const cPct = (1 - (inW * inH) / area) * 100;
          if (cPct > maxSungClip) maxSungClip = cPct;
        }
      }
      clip = maxSungClip;
      visibleSungCount = visibleFrames.size;
    }

    const appear_Δms = firstVis !== null ? Math.round((firstVis - tw.start) * 1000) : null;
    const visPct = Math.min(100, Math.max(0, (visibleSungCount / totalSungFrames) * 100));

    wordMetrics.push({
      word: tw.w,
      line: tw.lineText,
      start: tw.start,
      end: tw.end,
      first_visible: firstVis,
      last_visible: lastVis,
      appear_Δms,
      visible_during_sung_pct: visPct,
      peak_hPct: peakH,
      mean_hPct: meanH,
      travel_px_s: travel,
      clip_pct: clip,
      match: matchType,
    });
  }

  // Collisions: pairwise overlap > 2% with alpha > 0.15
  const collisions: CollisionItem[] = [];
  for (const fIdx of frameIndices) {
    const frameRecs = recordsByFrame.get(fIdx)!.filter((r) => r.globalAlpha > CONFIG.text_collision_min_alpha);
    for (let i = 0; i < frameRecs.length; i++) {
      for (let j = i + 1; j < frameRecs.length; j++) {
        const A = frameRecs[i]!, B = frameRecs[j]!;

        // Typographic collisions occur between elements on comparable hierarchy tiers.
        // Disregard pairs where:
        // 1. One text is micro-geometry text (< 0.4% screen height, e.g. distant door indices / plaques)
        // 2. Extreme scale disparity (ratio >= 2.5x), which represents 3D depth parallax (e.g. foreground
        //    lyrics floating in front of distant corridor architecture), not a 2D typography defect.
        const minH = Math.min(A.hPct, B.hPct);
        const maxH = Math.max(A.hPct, B.hPct);
        if (minH < 0.4) continue;
        if (minH > 0 && maxH / minH >= 2.5) continue;

        const ix0 = Math.max(A.bbox[0], B.bbox[0]), ix1 = Math.min(A.bbox[2], B.bbox[2]);
        const iy0 = Math.max(A.bbox[1], B.bbox[1]), iy1 = Math.min(A.bbox[3], B.bbox[3]);

        if (ix1 > ix0 && iy1 > iy0) {
          const interArea = (ix1 - ix0) * (iy1 - iy0);
          const smallerArea = Math.min(Math.max(1, A.w * A.h), Math.max(1, B.w * B.h));
          const overlapPct = (interArea / smallerArea) * 100;

          if (overlapPct > CONFIG.text_collision_max_overlap_pct) {
            const sortedTexts = [A.text, B.text].sort();
            const pairName = `"${sortedTexts[0]}" ∩ "${sortedTexts[1]}"`;
            const clipPct = Math.max(
              (1 - (Math.max(0, Math.min(A.bbox[2], 1920) - Math.max(A.bbox[0], 0)) * Math.max(0, Math.min(A.bbox[3], 1080) - Math.max(A.bbox[1], 0))) / (A.w * A.h)) * 100,
              (1 - (Math.max(0, Math.min(B.bbox[2], 1920) - Math.max(B.bbox[0], 0)) * Math.max(0, Math.min(B.bbox[3], 1080) - Math.max(B.bbox[1], 0))) / (B.w * B.h)) * 100
            );

            // Merge into existing contiguous collision
            const lastCol = collisions[collisions.length - 1];
            if (lastCol && lastCol.pair === pairName && Math.abs(A.t - lastCol.t1) <= 1.5 / fps) {
              lastCol.t1 = A.t;
              lastCol.intersection_pct = Math.max(lastCol.intersection_pct, overlapPct);
              lastCol.clip_pct = Math.max(lastCol.clip_pct, clipPct);
            } else {
              collisions.push({
                pair: pairName,
                t0: A.t,
                t1: A.t,
                intersection_pct: overlapPct,
                clip_pct: clipPct,
              });
            }
          }
        }
      }
    }
  }

  // F06: Corner region persisting > 3s
  const cornerX0 = (CONFIG.corner_x_pct / 100) * 1920;
  const cornerX1 = (1 - CONFIG.corner_x_pct / 100) * 1920;
  const cornerY0 = (CONFIG.corner_y_pct / 100) * 1080;
  const cornerY1 = (1 - CONFIG.corner_y_pct / 100) * 1080;

  const cornerRuns: TextRun[] = [];
  for (const r of runs) {
    if (r.dur >= CONFIG.corner_persist_s) {
      let allInCorner = true;
      for (const rec of r.records) {
        const inCorner = (rec.cx < cornerX0 || rec.cx > cornerX1) && (rec.cy < cornerY0 || rec.cy > cornerY1);
        if (!inCorner) { allInCorner = false; break; }
      }
      if (allInCorner) cornerRuns.push(r);
    }
  }

  // F07: String containing digits unchanging for > 3s in same slot
  const staticDigitRuns: { run: TextRun; slot: TextSlot; dur: number }[] = [];
  for (const s of slots) {
    for (const r of s.runs) {
      if (/\d/.test(r.rawText) && r.dur >= CONFIG.static_digit_persist_s) {
        staticDigitRuns.push({ run: r, slot: s, dur: r.dur });
      }
    }
  }

  return {
    records,
    runs,
    slots,
    words: wordMetrics,
    collisions,
    cornerRuns,
    staticDigitRuns,
  };
}
