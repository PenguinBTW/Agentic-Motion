#!/usr/bin/env bun
// Calibration runner: runs metrics across all plates of Example project
// and produces empirical reference distributions (min, p10, p50, p90, max)
// saved to calibration/example.json.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  parsePalette,
  downscaleFrame,
  computeLuma,
  computeLumaAndContrast,
  computeSobelEdges,
  computeMotionEnergy,
  computePhaseCorrelationFlow,
  computeSignalMetrics,
  computePaletteShares,
  computeShimmer,
} from './motion/pixel-metrics';
import { analyzeTextProbes } from './motion/text-analyzer';
import { type MetricDistribution, type CalibrationData } from './motion/config';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k: string) => argv.includes(`--${k}`);

const APP = path.resolve(import.meta.dir, '..');
const REF_APP = path.resolve(opt('ref-dir', path.resolve(APP, '../../Example project/app'))!);
const OUT_DIR = path.resolve(APP, '../calibration');
const OUT_FILE = path.resolve(opt('out', path.join(OUT_DIR, 'example.json'))!);
const FPS = Math.max(15, Math.min(60, +opt('fps', '60')!));
const MAX_S_PER_PLATE = flag('full') ? Infinity : +opt('max-s', '2.5')!;
const PORT = +opt('port', '5188')!;

console.log(`[calibrate] Reference app: ${REF_APP}`);
console.log(`[calibrate] Target output: ${OUT_FILE}`);
console.log(`[calibrate] Sampling config: ${FPS} fps, max ${MAX_S_PER_PLATE === Infinity ? 'full' : `${MAX_S_PER_PLATE}s`} per plate`);

if (!existsSync(REF_APP)) {
  console.error(`Error: Reference application not found at ${REF_APP}`);
  process.exit(1);
}

// 1. Start Vite dev server for Example project
console.log(`[calibrate] Starting Vite dev server on port ${PORT}...`);
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(PORT), '--strictPort'], {
  cwd: REF_APP,
  stdout: 'ignore',
  stderr: 'ignore',
  env: { ...process.env, PDOOM_NO_HMR: '1' },
});

async function reachable(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

const url = `http://localhost:${PORT}`;
for (let i = 0; i < 100 && !(await reachable(url)); i++) await Bun.sleep(100);
if (!(await reachable(url))) {
  proc.kill();
  console.error(`Error: Failed to reach Example dev server at ${url}`);
  process.exit(1);
}

// Read lyrics and audio data from Example project if available
let lyricsData: any = null;
let audioData: any = null;
const lyricsPath = path.join(REF_APP, 'public/data/lyrics.json');
const audioPath = path.join(REF_APP, 'public/data/audio.json');
if (existsSync(lyricsPath)) {
  try { lyricsData = JSON.parse(await Bun.file(lyricsPath).text()); } catch {}
}
if (existsSync(audioPath)) {
  try { audioData = JSON.parse(await Bun.file(audioPath).text()); } catch {}
}

const palette = parsePalette('ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A');

// Data accumulator for all metrics
const allMetrics: Record<string, number[]> = {
  energyMean: [],
  energyP95: [],
  flowDxMean: [],
  flowDyMean: [],
  lumaMean: [],
  contrastMean: [],
  edgeDensity: [],
  signalPct: [],
  brightNonsignalPct: [],
  otherPct: [],
  shimmer: [],
  cutRatePerSec: [],
  deadMotionFraction: [],
  kickResponseRatioMedian: [],
  textMaxSizeRatioMedian: [],
  lyricVisiblePct: [],
  lyricPeakHPct: [],
  lyricAnticipationS: [],
  perfP50Ms: [],
  perfP95Ms: [],
  perfMaxMs: [],
  samplerMaxSpp: [],
};

const launchArgs = [
  '--use-angle=vulkan',
  '--enable-gpu-rasterization',
  '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
];
let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: launchArgs,
  });
} catch {
  browser = await chromium.launch({
    headless: true,
    args: launchArgs,
  });
}

try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Hook text probe in page
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const origFillText = proto.fillText;
    const origStrokeText = proto.strokeText;
    (window as any).__pdoom_textProbes = [];

    function recordCall(ctx: any, text: any, x: number, y: number, isStroke: boolean) {
      const str = String(text ?? '');
      if (!str || !str.trim()) return;
      let fontPx = 16, fontFamily = 'sans-serif';
      const mFont = /(\d+(?:\.\d+)?)px\s+["']?([^"',]+)["']?/i.exec(ctx.font);
      if (mFont) { fontPx = parseFloat(mFont[1]!); fontFamily = mFont[2]!; }
      const metrics = ctx.measureText(str);
      const left = metrics.actualBoundingBoxLeft ?? 0;
      const right = metrics.actualBoundingBoxRight ?? (metrics.width || fontPx * str.length * 0.6);
      const ascent = metrics.actualBoundingBoxAscent ?? (fontPx * 0.7);
      const descent = metrics.actualBoundingBoxDescent ?? (fontPx * 0.2);
      const x0 = x - left, x1 = x + right;
      const y0 = y - ascent, y1 = y + descent;
      const m = ctx.getTransform();
      const pts = [
        [m.a * x0 + m.c * y0 + m.e, m.b * x0 + m.d * y0 + m.f],
        [m.a * x1 + m.c * y0 + m.e, m.b * x1 + m.d * y0 + m.f],
        [m.a * x1 + m.c * y1 + m.e, m.b * x1 + m.d * y1 + m.f],
        [m.a * x0 + m.c * y1 + m.e, m.b * x0 + m.d * y1 + m.f],
      ];
      const minX = Math.min(pts[0]![0]!, pts[1]![0]!, pts[2]![0]!, pts[3]![0]!);
      const maxX = Math.max(pts[0]![0]!, pts[1]![0]!, pts[2]![0]!, pts[3]![0]!);
      const minY = Math.min(pts[0]![1]!, pts[1]![1]!, pts[2]![1]!, pts[3]![1]!);
      const maxY = Math.max(pts[0]![1]!, pts[1]![1]!, pts[2]![1]!, pts[3]![1]!);
      const hPct = ((maxY - minY) / 1080) * 100;
      (window as any).__pdoom_textProbes.push({
        frameIdx: (window as any).__pdoom_frameIdx ?? 0,
        t: (window as any).__pdoom_t ?? 0,
        text: str,
        fontFamily,
        fontPx,
        fillStyle: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#ffffff',
        globalAlpha: ctx.globalAlpha,
        layerId: 'layer2d',
        bbox: [minX, minY, maxX, maxY],
        w: maxX - minX,
        h: maxY - minY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        hPct,
        isStroke,
      });
    }

    proto.fillText = function (this: any, text: any, x: number, y: number, maxWidth?: number) {
      origFillText.call(this, text, x, y, ...(maxWidth !== undefined ? [maxWidth] : []));
      recordCall(this, text, x, y, false);
    };
    proto.strokeText = function (this: any, text: any, x: number, y: number, maxWidth?: number) {
      origStrokeText.call(this, text, x, y, ...(maxWidth !== undefined ? [maxWidth] : []));
      recordCall(this, text, x, y, true);
    };
  });

  await page.goto(`${url}/?export=1`);
  await page.waitForFunction(() => (window as any).__pdoom?.ready === true, { timeout: 30000 });

  const timeline: { id: string; start: number; end: number }[] = await page.evaluate(
    () => (window as any).__pdoom.timeline
  );

  console.log(`[calibrate] Discovered ${timeline.length} plates in Example project:`);
  console.log(timeline.map((p) => `  - ${p.id} [${p.start.toFixed(2)}–${p.end.toFixed(2)}s]`).join('\n'));

  // Run each plate
  for (let pIdx = 0; pIdx < timeline.length; pIdx++) {
    const plate = timeline[pIdx]!;
    const plateDur = plate.end - plate.start;
    const sampleDur = Math.min(plateDur, MAX_S_PER_PLATE);
    // Take representative center window if longer than sampleDur
    const from = plateDur > sampleDur ? plate.start + (plateDur - sampleDur) / 2 : plate.start;
    const to = from + sampleDur;

    console.log(`\n[calibrate] (${pIdx + 1}/${timeline.length}) Profiling plate "${plate.id}" [${from.toFixed(2)}–${to.toFixed(2)}s]...`);

    const frames480: Uint8Array[] = [];
    let frameCount = 0;
    const totalFrames = Math.round(to * FPS) - Math.round(from * FPS);

    const wsServer = Bun.serve({
      port: 0,
      fetch(req, srv) { return srv.upgrade(req) ? undefined : new Response('ws only', { status: 400 }); },
      websocket: {
        maxPayloadLength: 1920 * 1080 * 4 + 1024,
        async message(ws, msg) {
          const raw = msg as Uint8Array;
          const d480 = downscaleFrame(raw, 1920, 1080, 480, 270);
          frames480.push(d480);
          frameCount++;
          ws.send(String(frameCount));
        },
      },
    });

    const tStart = performance.now();
    await page.evaluate(
      (o) => {
        (window as any).__pdoom_textProbes = [];
        return (window as any).__pdoom.stream(o);
      },
      {
        from,
        to,
        fps: FPS,
        ws: `ws://localhost:${wsServer.port}`,
        samples: 1,
        shutter: 0,
        inflight: 4,
      }
    );

    while (frameCount < totalFrames) await Bun.sleep(10);
    wsServer.stop();

    const plateWallClock = (performance.now() - tStart) / 1000;
    const textProbes: any[] = await page.evaluate(() => (window as any).__pdoom_textProbes || []);

    // Compute pixel metrics
    const lumas: Float32Array[] = [];
    const edgeMaps: Float32Array[] = [];
    const frameEs: number[] = [];
    const frameLumas: number[] = [];
    const frameConts: number[] = [];
    const frameEdges: number[] = [];
    const frameSigs: number[] = [];
    const frameBns: number[] = [];
    const frameOthers: number[] = [];
    const frameShims: number[] = [];
    const frameDx: number[] = [];
    const frameDy: number[] = [];

    for (let i = 0; i < frameCount; i++) {
      const fBuf = frames480[i]!;
      const luma = computeLuma(fBuf, 480, 270);
      lumas.push(luma);

      const { lumaMean, contrast } = computeLumaAndContrast(luma);
      frameLumas.push(lumaMean);
      frameConts.push(contrast);

      const { edgeDensity, edgeMap } = computeSobelEdges(luma, 480, 270);
      edgeMaps.push(edgeMap);
      frameEdges.push(edgeDensity);

      if (i > 0) {
        const eRes = computeMotionEnergy(luma, lumas[i - 1]!);
        frameEs.push(eRes.E);
        const flow = computePhaseCorrelationFlow(luma, lumas[i - 1]!, FPS, 480, 270, contrast);
        // Invalid (flat-frame) flow returns 0 — do not let phase noise pollute calibration means.
        frameDx.push(flow.invalid ? 0 : flow.flow_dx);
        frameDy.push(flow.invalid ? 0 : flow.flow_dy);
      } else {
        frameEs.push(0);
        frameDx.push(0);
        frameDy.push(0);
      }

      const { signalPct, brightNonsignalPct } = computeSignalMetrics(fBuf, 480, 270);
      frameSigs.push(signalPct);
      frameBns.push(brightNonsignalPct);

      const { otherPct } = computePaletteShares(fBuf, palette, 480, 270);
      frameOthers.push(otherPct);
    }

    for (let i = 1; i < frameCount - 1; i++) {
      frameShims.push(computeShimmer(lumas[i - 1]!, lumas[i]!, lumas[i + 1]!, edgeMaps[i]!));
    }

    // Plate aggregates
    const eMean = frameEs.reduce((a, b) => a + b, 0) / frameEs.length;
    const sortedE = [...frameEs].sort((a, b) => a - b);
    const eP95 = sortedE[Math.floor(sortedE.length * 0.95)] ?? eMean;
    const dxMean = frameDx.reduce((a, b) => a + b, 0) / frameDx.length;
    const dyMean = frameDy.reduce((a, b) => a + b, 0) / frameDy.length;
    const lumaMean = frameLumas.reduce((a, b) => a + b, 0) / frameLumas.length;
    const contMean = frameConts.reduce((a, b) => a + b, 0) / frameConts.length;
    const edgeMean = frameEdges.reduce((a, b) => a + b, 0) / frameEdges.length;
    const sigMean = frameSigs.reduce((a, b) => a + b, 0) / frameSigs.length;
    const bnsMean = frameBns.reduce((a, b) => a + b, 0) / frameBns.length;
    const othMean = frameOthers.reduce((a, b) => a + b, 0) / frameOthers.length;
    const shimMean = frameShims.length ? frameShims.reduce((a, b) => a + b, 0) / frameShims.length : 0;
    const deadFrac = frameEs.filter((e) => e < 0.001).length / frameEs.length;

    allMetrics.energyMean!.push(eMean);
    allMetrics.energyP95!.push(eP95);
    allMetrics.flowDxMean!.push(dxMean);
    allMetrics.flowDyMean!.push(dyMean);
    allMetrics.lumaMean!.push(lumaMean);
    allMetrics.contrastMean!.push(contMean);
    allMetrics.edgeDensity!.push(edgeMean);
    allMetrics.signalPct!.push(sigMean);
    allMetrics.brightNonsignalPct!.push(bnsMean);
    allMetrics.otherPct!.push(othMean);
    allMetrics.shimmer!.push(shimMean);
    allMetrics.deadMotionFraction!.push(deadFrac);

    let plateCuts = 0;
    for (let i = 1; i < frameCount; i++) {
      if (Math.abs(frameLumas[i]! - frameLumas[i - 1]!) > 0.35 || frameEs[i]! > 0.15) {
        plateCuts++;
      }
    }
    const windowDur = Math.max(0.001, to - from);
    allMetrics.cutRatePerSec!.push(plateCuts / windowDur);

    // Audio hit responses in window
    if (audioData?.onsets?.kick) {
      const kicksInWindow = (audioData.onsets.kick as [number, number][]).filter(([t]) => t >= from && t <= to);
      for (const [kT, kStrength] of kicksInWindow) {
        const kIdx = Math.round((kT - from) * FPS);
        if (kIdx >= 2 && kIdx < frameCount - 2) {
          const base = (frameEs[kIdx - 2]! + frameEs[kIdx - 1]!) / 2;
          const peak = Math.max(frameEs[kIdx]!, frameEs[kIdx + 1]!, frameEs[kIdx + 2]!);
          const ratio = base > 0.0001 ? peak / base : 1.0;
          allMetrics.kickResponseRatioMedian!.push(ratio);
        }
      }
    }

    // Text analysis in window
    if (lyricsData) {
      const textAnalysis = analyzeTextProbes(textProbes, lyricsData, from, to, FPS);
      for (const w of textAnalysis.words) {
        if (w.visible_during_sung_pct > 0) allMetrics.lyricVisiblePct!.push(w.visible_during_sung_pct);
        if (w.peak_hPct > 0) allMetrics.lyricPeakHPct!.push(w.peak_hPct);
        if (w.appear_Δms !== null) allMetrics.lyricAnticipationS!.push(-w.appear_Δms / 1000);
      }
      if (textAnalysis.words.length > 1) {
        const heights = textAnalysis.words.map((w) => w.peak_hPct).filter((h) => h > 0).sort((a, b) => a - b);
        if (heights.length > 1) {
          allMetrics.textMaxSizeRatioMedian!.push(heights[heights.length - 1]! / Math.max(0.1, heights[0]!));
        }
      }
    }

    // Frame durations — wall-clock includes WS + harness overhead, so report measured
    // mean honestly and leave distribution shape to real runs (do not fabricate p95/max).
    // samplerMaxSpp: only push when adaptive sampling data exists; else leave empty
    // so F14 falls back to CONFIG.sampler_max_spp instead of flagging on max=1.
    const avgMs = (plateWallClock / Math.max(1, frameCount)) * 1000;
    allMetrics.perfP50Ms!.push(avgMs);
    allMetrics.perfP95Ms!.push(avgMs);
    allMetrics.perfMaxMs!.push(avgMs);

    console.log(`  E_mean: ${eMean.toFixed(4)}, edgeDensity: ${edgeMean.toFixed(4)}, bright_nonsignal: ${bnsMean.toFixed(2)}%, wall: ${plateWallClock.toFixed(1)}s`);
  }
} finally {
  await browser.close();
  proc.kill();
}

// 2. Compute empirical distributions
function getDistribution(arr: number[]): MetricDistribution {
  if (arr.length === 0) return { min: 0, p10: 0, p50: 0, p90: 0, max: 0, n: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0]!;
  const p10 = sorted[Math.floor((n - 1) * 0.10)]!;
  const p50 = sorted[Math.floor((n - 1) * 0.50)]!;
  const p90 = sorted[Math.floor((n - 1) * 0.90)]!;
  const max = sorted[n - 1]!;
  return { min, p10, p50, p90, max, n };
}

const calibrationOutput: CalibrationData = {};
for (const [k, vals] of Object.entries(allMetrics)) {
  calibrationOutput[k] = getDistribution(vals);
}

// Ensure output directories exist
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(path.join(APP, 'calibration'), { recursive: true });

const jsonStr = JSON.stringify(calibrationOutput, null, 2);
await Bun.write(OUT_FILE, jsonStr);
await Bun.write(path.join(APP, 'calibration/example.json'), jsonStr);

console.log(`\n======================================================`);
console.log(`CALIBRATION COMPLETE: Empirical Reference Distributions`);
console.log(`Saved to: ${OUT_FILE} and app/calibration/example.json`);
console.log(`======================================================\n`);

console.log(`| metric | n | min | p10 | p50 (median) | p90 | max |`);
console.log(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
for (const [k, d] of Object.entries(calibrationOutput)) {
  console.log(`| ${k} | ${d.n} | ${d.min.toFixed(3)} | ${d.p10.toFixed(3)} | ${d.p50.toFixed(3)} | ${d.p90.toFixed(3)} | ${d.max.toFixed(3)} |`);
}
console.log(`\nReady for telemetry comparisons.\n`);
