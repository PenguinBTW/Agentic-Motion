#!/usr/bin/env bun
// Offline renderer. Drives the app in headless Chrome (?export=1) and either
//   stills:  bun scripts/render.ts stills --t 1.5,23,40.2 [--only id1,id2] [--out dir]
//   sheet:   bun scripts/render.ts sheet --from 20 --to 35 [--n 12] [--cols 4] [--only ids] [--out file.png]   (or --times a,b,c | --cuts)
//   plates:  bun scripts/render.ts plates   (renders one representative JPEG per plate into public/plates/ (used by the outro's rewind), times from plates.json or entry midpoints)
//   perf:    bun scripts/render.ts perf --from 20 --to 25 [--only ids] [--samples 1] [--shutter 0.5]   (avg ms per frame incl. GPU sync and the export's pixel readback)
//   video:   bun scripts/render.ts video [--from 0] [--to 156.65] [--fps 60] [--crf 16] [--x264 aq-mode=3] [--gpu] [--gpu-encoder h264_amf] [--samples 1] [--shutter 0.5] [--out ../out/pdoom.mp4] [--noaudio]
//            --gpu enables AMD AMF hardware video encoding (h264_amf, hevc_amf, av1_amf), offloading CPU load;
//            --samples N averages N sub-frames per frame over shutter×(1/fps): motion blur + temporal AA;
//            --samples auto picks the count per frame (4, 12, 36, 108 or 324, see Engine.render)
//   motion:  bun scripts/render.ts motion [--from 0] [--to 30] [--samples 1] [--shutter 0] [--calibrate]
//            motion defaults shutter 0 (sharp) for metrics; stills/sheet/video/perf default 0.5 (blurred).
//   onion:   bun scripts/render.ts onion --scene demo --from 1.0 --to 2.0 [--frames 10]
//   godview: bun scripts/render.ts godview --scene demo [--corridor]
//   stitch:  bun scripts/render.ts stitch --from-scene sceneA --to-scene sceneB [--window 300ms|0.3s|--window-ms 300|--window-s 0.3]
//   compare: bun scripts/render.ts compare --active-scene demo --ref-scene loss
//   --scale N (all modes): render at N× the 1920x1080 layout (--scale 2 = true 3840x2160); stills are then saved
//            full-res from the pixel buffer, videos are encoded at the physical size.
// Uses the Vite dev server at --url (default http://localhost:5173); starts a private one if unreachable.
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CONFIG, loadCalibrationData, type FrameMetrics, type AudioEvent } from './motion/config';
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
import { evaluateFlags, type CutItem, type HitItem } from './motion/flags';
import {
  renderTimelinePlot,
  renderSlitscan,
  renderRgbTimeComposite,
  renderEventStrip,
} from './motion/visuals';
import {
  generateReportMarkdown,
  generateFramesCsv,
  generateTextCsv,
  generateEventsCsv,
} from './motion/report';

const argv = process.argv.slice(2);
const mode = argv[0] ?? 'stills';
const isFlagVal = (v?: string) => v !== undefined && !v.startsWith('--');
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); const v = i >= 0 ? argv[i + 1] : d; return isFlagVal(v) ? v : (i >= 0 ? undefined : d); };
const numOpt = (k: string, def: number, min?: number, max?: number): number => {
  const raw = opt(k);
  if (raw === undefined) return def;
  const v = +raw;
  if (!Number.isFinite(v)) { console.warn(`[${mode}] Invalid --${k} '${raw}', defaulting to ${def}`); return def; }
  if (min !== undefined && v < min) { console.warn(`[${mode}] --${k} ${v} < min ${min}, clamping`); return min; }
  if (max !== undefined && v > max) { console.warn(`[${mode}] --${k} ${v} > max ${max}, clamping`); return max; }
  return v;
};
const flag = (k: string) => argv.includes(`--${k}`);
const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const hist = (h: Record<string, number>) => Object.entries(h).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${k}:${v}`).join(' ');
const resolveOut = (p?: string, def?: string) => {
  const raw = p ?? def!;
  return path.isAbsolute(raw) ? path.resolve(raw) : path.join(ROOT, raw);
};
const SCALE = Math.max(1, Math.round(numOpt('scale', 1, 1, 4)));
const OW = 1920 * SCALE, OH = 1080 * SCALE; // output size
// --samples N (fixed) or --samples auto [--min-samples 4] [--max-samples 324] [--tol 3] (adaptive, see Engine.render)
const SAMPLES = opt('samples', '1') === 'auto'
  ? { min: numOpt('min-samples', 4, 1, 324), max: numOpt('max-samples', 324, 1, 972), tol: numOpt('tol', 3, 0.1, 50) }
  : numOpt('samples', 1, 1, 324);

async function reachable(url: string) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

async function ensureServer(): Promise<{ url: string; stop: () => void }> {
  if (typeof (globalThis as any).Bun === 'undefined') {
    throw new Error('[server] Bun runtime required (Bun.spawn + Bun.serve). Run with: bun scripts/render.ts ...');
  }
  const url = opt('url', 'http://localhost:5173')!;
  if (await reachable(url)) return { url, stop: () => {} };
  const port = 5300 + Math.floor(Math.random() * 500);
  // no live reload: a file saved mid-render must not reload the page
  const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, PDOOM_NO_HMR: '1' } });
  const u = `http://localhost:${port}`;
  for (let i = 0; i < 100 && !(await reachable(u)); i++) await Bun.sleep(100);
  if (!(await reachable(u))) {
    try { proc.kill(); } catch {}
    throw new Error(`[server] Vite failed to start at ${u} (port busy or missing dep) — killed proc`);
  }
  return { url: u, stop: () => { try { proc.kill(); } catch {} } };
}

async function openPage(url: string) {
  const launchOpts = {
    headless: !flag('headed'),
    args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  };
  let browser;
  try {
    browser = await chromium.launch({
      ...launchOpts,
      channel: 'chrome',
    });
  } catch {
    try {
      browser = await chromium.launch(launchOpts);
    } catch (e: any) {
      throw new Error(`[browser] No Chromium/Chrome found (playwright-core ships no browsers). Install system Chrome or run: bunx playwright install chromium. Underlying: ${e?.message ?? e}`);
    }
  }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const logs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  const onlyRaw = opt('only');
  let only = onlyRaw;
  if (onlyRaw) {
    const rawParts = onlyRaw.split(',');
    const expanded = new Set<string>(rawParts);
    // plates.json override shape {id:seconds} — both legacy paths absent (verified); warn once.
    const platesPath = path.resolve(APP, '../analysis/plates.json');
    const platesAlt = path.join(APP, 'plates.json');
    if (existsSync(platesPath) || existsSync(platesAlt)) {
      try {
        const pList = JSON.parse(await Bun.file(existsSync(platesPath) ? platesPath : platesAlt).text());
        for (const part of rawParts) {
          for (const p of pList) {
            if (p.id === part || p.file === part) {
              expanded.add(p.id);
              expanded.add(p.file);
            }
          }
        }
      } catch {}
    } else {
      console.warn('[plates] No plates.json override found (checked analysis/ + app/); using --only ids directly.');
    }
    only = Array.from(expanded).join(',');
  }
  await page.goto(`${url}/?export=1${only ? `&only=${only}` : ''}${SCALE !== 1 ? `&scale=${SCALE}` : ''}`);
  await page.waitForFunction(() => (window as any).__pdoom?.ready || (window as any).__pdoom?.error, null, { timeout: 120000 });
  const err = await page.evaluate(() => (window as any).__pdoom.error);
  if (err) throw new Error(`app failed to boot:\n${err}\n${logs.join('\n')}`);
  const size: [number, number] = await page.evaluate(() => [(window as any).__pdoom.width ?? 1920, (window as any).__pdoom.height ?? 1080]);
  if (size[0] !== OW || size[1] !== OH) throw new Error(`app renders ${size[0]}x${size[1]}, expected ${OW}x${OH} (--scale ${SCALE})`);
  const sceneErrors: string[] = await page.evaluate(() => (window as any).__pdoom.errors);
  if (sceneErrors.length) console.error('SCENE ERRORS:\n' + sceneErrors.join('\n'));
  return { browser, page, logs };
}

async function stills(page: Page, times: number[], outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  for (const t of times) {
    const k: number = await page.evaluate(([t, s, sh]) => (window as any).__pdoom.still(t, s, sh), [t, SAMPLES, numOpt('shutter', 0.5, 0, 1)] as const);
    const f = path.join(outDir, `f_${t.toFixed(2).padStart(7, '0')}.png`);
    if (typeof SAMPLES !== 'number') console.log(`t=${t}: ${k} sub-frames`);
    // at scale > 1 the canvas is shown downscaled on the page: save the full-res pixel buffer instead
    if (SCALE !== 1) await Bun.write(f, Buffer.from(await page.evaluate(() => (window as any).__pdoom.png()), 'base64'));
    else await page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    files.push(f);
  }
  return files;
}

async function sheet(page: Page, times: number[], cols: number, out: string) {
  const shutter = numOpt('shutter', 0.5, 0, 1);
  const dataUrl: string = await page.evaluate(async ({ times, cols, samples, shutter }: any) => {
    const P = (window as any).__pdoom;
    const cw = 480, ch = 270, pad = 4, lab = 18;
    const rows = Math.ceil(times.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * (cw + pad) + pad; cv.height = rows * (ch + lab + pad) + pad;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#222'; c.fillRect(0, 0, cv.width, cv.height);
    const src = document.getElementById('c') as HTMLCanvasElement;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      await P.still(t, samples, shutter);
      const x = pad + (i % cols) * (cw + pad), y = pad + Math.floor(i / cols) * (ch + lab + pad);
      c.drawImage(src, x, y + lab, cw, ch);
      c.fillStyle = '#ddd'; c.font = '13px monospace'; c.fillText(`${t.toFixed(2)}s`, x + 2, y + 13);
    }
    return cv.toDataURL('image/png');
  }, { times, cols, samples: SAMPLES, shutter });
  const outDir = path.dirname(path.resolve(out));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  await Bun.write(out, Buffer.from(dataUrl.split(',')[1]!, 'base64'));
}

async function video(page: Page, from: number, to: number, fps: number, out: string) {
  const outDir = path.dirname(path.resolve(out));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const gpuEncode = flag('gpu-encode') || (mode === 'video' && flag('gpu'));
  const crf = opt('crf', gpuEncode ? '22' : '16')!;
  const audio = path.join(ROOT, 'audio/whos-holding-on-to-who.mp3');
  const hasAudio = !flag('noaudio') && existsSync(audio);
  const args = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${OW}x${OH}`, '-r', String(fps), '-i', 'pipe:0'];
  if (hasAudio) args.push('-ss', String(from), '-t', String(to - from), '-i', audio);
  if (gpuEncode) {
    const enc = opt('gpu-encoder', 'h264_amf')!;
    args.push('-vf', 'vflip', '-c:v', enc, '-quality', 'quality', '-rc', 'cqp', '-qp_i', crf, '-qp_p', crf, '-pix_fmt', 'yuv420p');
  } else {
    args.push('-vf', 'vflip', '-c:v', 'libx264', '-preset', opt('preset', 'slow')!, '-crf', crf, '-pix_fmt', 'yuv420p', '-tune', 'grain', '-x264-params', opt('x264', 'aq-mode=3')!);
  }
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '320k', '-shortest');
  args.push('-movflags', '+faststart', out);
  const ff = Bun.spawn(args, { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit' });
  let frames = 0;
  const total = Math.round(to * fps) - Math.round(from * fps);
  const t0 = performance.now();
  const server = Bun.serve({
    port: 0,
    fetch(req, srv) { return srv.upgrade(req) ? undefined : new Response('ws only', { status: 400 }); },
    websocket: {
      maxPayloadLength: Math.max(64 * 1024 * 1024, OW * OH * 4 + 1024),
      async message(ws, msg) {
        ff.stdin.write(msg as Uint8Array);
        await ff.stdin.flush();
        frames++;
        ws.send(String(frames)); // ack: the page keeps at most a few frames ahead of ffmpeg (bounded memory at 4K)
        if (frames % 60 === 0 || frames === total) {
          const el = (performance.now() - t0) / 1000;
          process.stdout.write(`\r${frames}/${total} frames  ${(frames / el).toFixed(1)} fps  eta ${((total - frames) / (frames / el)).toFixed(0)}s   `);
        }
      },
    },
  });
  const used: Record<string, number> = await page.evaluate((o) => (window as any).__pdoom.stream(o), { from, to, fps, ws: `ws://localhost:${server.port}`, samples: SAMPLES, shutter: numOpt('shutter', 0.5, 0, 1), inflight: 4 });
  // wait for all frames to arrive (bounded: 60s + 2s/frame, cleanup on timeout)
  const deadline = performance.now() + 60000 + total * 2000;
  try {
    while (frames < total) {
      if (performance.now() > deadline) throw new Error(`[video] stream timeout: ${frames}/${total} frames (WS drop or fps rounding mismatch)`);
      await Bun.sleep(20);
    }
  } finally {
    try { ff.stdin.end(); } catch {}
  }
  await ff.exited;
  server.stop();
  console.log(`\nwrote ${out} (${frames} frames in ${((performance.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`sub-frames per frame (count:frames): ${hist(used)}`);
}

async function motion(page: Page) {
  let from = numOpt('from', 0, 0);
  let to = numOpt('to', 10, 0);
  if (to <= from) { console.warn(`[motion] Empty window (to<=from), expanding to from+1s`); to = from + 1; }
  if (to - from > 15.0) {
    console.warn(`[WARNING] Window duration ${(to - from).toFixed(1)}s > 15s. Analysis may take longer.`);
  }

  const fps = numOpt('fps', 60, 15, 120);
  const binSec = numOpt('bin', 0.25, 0.05, 2);
  const topN = Math.round(numOpt('topn', 12, 1, 100));
  const paletteArg = opt('palette', 'ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A')!;
  const palette = parsePalette(paletteArg);
  const paletteNames = palette.map((p) => p.name);

  const samplesArg = opt('samples', '1')!;
  const motionSamples = samplesArg === 'auto' ? SAMPLES : numOpt('samples', 1, 1, 324);
  const motionShutter = numOpt('shutter', 0, 0, 1);

  const allowBlankRanges: [number, number][] = [];
  const abArg = opt('allow-blank');
  if (abArg) {
    abArg.split(',').forEach((rangeStr) => {
      const parts = rangeStr.split('-').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
        allowBlankRanges.push([parts[0]!, parts[1]!]);
      }
    });
  }

  const userEvents: number[] = opt('events')
    ? opt('events')!.split(',').map(Number).filter((x) => !isNaN(x))
    : [];
  const eventOffsets: number[] = opt('event-offsets')
    ? opt('event-offsets')!.split(',').map(Number).filter((x) => !isNaN(x))
    : [-0.2, -0.1, 0, 0.05, 0.1, 0.2, 0.4];

  const comparePath = opt('compare');
  const outDir = resolveOut(opt('out'), path.join(ROOT, 'out/motion/doors-v3'));
  mkdirSync(outDir, { recursive: true });
  mkdirSync(path.join(outDir, 'events'), { recursive: true });

  const tl: { id: string; start: number; end: number }[] = await page.evaluate(() => (window as any).__pdoom.timeline);
  if (!tl || tl.length === 0) throw new Error('Could not read timeline from window.__pdoom');
  const activeFirst = tl.filter((e) => from >= e.start && from < e.end);
  const plateLabel = activeFirst.map((e) => e.id).join('+') || 'doors';
  console.log(`[motion] Analyzing window [${from.toFixed(2)}–${to.toFixed(2)}s] (${(to - from).toFixed(2)}s) at ${fps} fps on plate(s): ${plateLabel}`);

  const lyricsData = existsSync(path.join(APP, 'public/data/lyrics.json'))
    ? await Bun.file(path.join(APP, 'public/data/lyrics.json')).json()
    : null;
  const audioData = existsSync(path.join(APP, 'public/data/audio.json'))
    ? await Bun.file(path.join(APP, 'public/data/audio.json')).json()
    : null;

  const allEvents: AudioEvent[] = [];
  if (tl) {
    for (const e of tl) {
      if (e.start >= from && e.start <= to) {
        allEvents.push({ type: 'cut', t: e.start, source: 'timeline', details: { id: e.id } });
      }
    }
  }
  if (audioData) {
    if (audioData.downbeats) {
      for (const t of audioData.downbeats) {
        if (t >= from && t <= to) allEvents.push({ type: 'downbeat', t, source: 'audio.json' });
      }
    }
    if (audioData.beats) {
      for (const t of audioData.beats) {
        if (t >= from && t <= to) allEvents.push({ type: 'beat', t, source: 'audio.json' });
      }
    }
    if (audioData.onsets?.kick) {
      for (const [t, s] of audioData.onsets.kick) {
        if (t >= from && t <= to) allEvents.push({ type: 'kick', t, strength: s, source: 'audio.json' });
      }
    }
    if (audioData.onsets?.snare) {
      for (const [t, s] of audioData.onsets.snare) {
        if (t >= from && t <= to) allEvents.push({ type: 'snare', t, strength: s, source: 'audio.json' });
      }
    }
  }
  if (lyricsData?.lines) {
    for (const line of lyricsData.lines) {
      if (line.words) {
        for (const w of line.words) {
          if (w.start >= from && w.start <= to) {
            allEvents.push({ type: 'word', t: w.start, end: w.end, word: w.w, line: line.text, source: 'lyrics.json' });
          }
        }
      }
    }
  }
  for (const t of userEvents) {
    if (t >= from && t <= to) allEvents.push({ type: 'custom', t, source: '--events' });
  }
  allEvents.sort((a, b) => a.t - b.t);

  const calibrationPath = opt('calibration');
  const calibrationData = loadCalibrationData(calibrationPath);

  const totalFrames = Math.round(to * fps) - Math.round(from * fps);
  const motionDeadline = performance.now() + 60000 + Math.max(0, totalFrames) * 2000;
  const frames480: Uint8Array[] = [];
  const centerCols: Uint8Array[] = [];
  let frameCount = 0;
  const tStart = performance.now();

  const server = Bun.serve({
    port: 0,
    fetch(req, srv) { return srv.upgrade(req) ? undefined : new Response('ws only', { status: 400 }); },
    websocket: {
      maxPayloadLength: Math.max(64 * 1024 * 1024, OW * OH * 4 + 1024),
      async message(ws, msg) {
        const raw = msg as Uint8Array;
        const d480 = downscaleFrame(raw, OW, OH, 480, 270);
        frames480.push(d480);

        const col = new Uint8Array(270 * 4);
        for (let y = 0; y < 270; y++) {
          const idx = (y * 480 + 240) * 4;
          col[y * 4] = d480[idx]!;
          col[y * 4 + 1] = d480[idx + 1]!;
          col[y * 4 + 2] = d480[idx + 2]!;
          col[y * 4 + 3] = d480[idx + 3]!;
        }
        centerCols.push(col);

        frameCount++;
        ws.send(String(frameCount));
      },
    },
  });

  const streamRes = await page.evaluate((o) => (window as any).__pdoom.stream(o), {
    from,
    to,
    fps,
    ws: `ws://localhost:${server.port}`,
    samples: motionSamples,
    shutter: motionShutter,
    inflight: 4,
    probe: true,
  });

  while (frameCount < totalFrames) {
    if (performance.now() > motionDeadline) {
      try { server.stop(); } catch {}
      throw new Error(`[motion] stream timeout: ${frameCount}/${totalFrames} frames (WS drop or fps rounding mismatch)`);
    }
    await Bun.sleep(10);
  }
  try { server.stop(); } catch {}

  const wallClockSec = (performance.now() - tStart) / 1000;
  console.log(`[motion] Rendered ${frameCount} frames in ${wallClockSec.toFixed(2)}s (${(frameCount / wallClockSec).toFixed(1)} fps)`);

  const frameMeta: any[] = streamRes?.frameMeta ?? [];
  const textProbes: any[] = streamRes?.textProbes ?? [];

  console.log('[motion] Computing per-frame pixel metrics (luma, flow, edge, palette)...');
  const lumas: Float32Array[] = [];
  const edgeMaps: Float32Array[] = [];
  const frameMetrics: FrameMetrics[] = [];

  for (let i = 0; i < frameCount; i++) {
    const fBuf = frames480[i]!;
    const curT = from + i / fps;
    const luma = computeLuma(fBuf, 480, 270);
    lumas.push(luma);

    const { lumaMean, contrast } = computeLumaAndContrast(luma);
    const { edgeDensity, edgeMap } = computeSobelEdges(luma, 480, 270);
    edgeMaps.push(edgeMap);

    let E = 0, E_p95 = 0, flow_dx = 0, flow_dy = 0, flow_invalid = false;
    if (i > 0) {
      const eRes = computeMotionEnergy(luma, lumas[i - 1]!);
      E = eRes.E;
      E_p95 = eRes.E_p95;
      const flow = computePhaseCorrelationFlow(luma, lumas[i - 1]!, fps, 480, 270, contrast);
      flow_dx = flow.flow_dx;
      flow_dy = flow.flow_dy;
      flow_invalid = flow.invalid ?? false;
    }

    const { signalPct, brightNonsignalPct } = computeSignalMetrics(fBuf, 480, 270);
    const { shares: pShares, otherPct } = computePaletteShares(fBuf, palette, 480, 270);
    const meta = frameMeta[i] || {};

    frameMetrics.push({
      n: i,
      t: curT,
      E,
      E_p95,
      flow_dx,
      flow_dy,
      flow_invalid,
      luma: lumaMean,
      contrast,
      edge_density: edgeDensity,
      signal_pct: signalPct,
      bright_nonsignal_pct: brightNonsignalPct,
      palette_shares: pShares,
      other_pct: otherPct,
      shimmer: 0,
      segs: meta.segs ?? 0,
      ms: meta.ms ?? 0,
      spp: meta.spp ?? 1,
      sceneProbe: meta.sceneProbe,
    });
  }

  for (let i = 1; i < frameCount - 1; i++) {
    frameMetrics[i]!.shimmer = computeShimmer(lumas[i - 1]!, lumas[i]!, lumas[i + 1]!, edgeMaps[i]!);
  }

  console.log('[motion] Analyzing text probe & lyric join...');
  const textAnalysis = analyzeTextProbes(textProbes, lyricsData, from, to, fps);

  for (const f of frameMetrics) {
    const fTexts = textProbes.filter((r) => r.frameIdx === f.n);
    (f as any).max_text_h = fTexts.length ? Math.max(...fTexts.map((r) => r.hPct)) : 0;
  }

  console.log('[motion] Classifying cuts and measuring hit responses...');
  const cutsList: CutItem[] = [];
  if (tl) {
    for (const e of tl) {
      if (e.start >= from && e.start <= to) {
        const cutIdx = Math.round((e.start - from) * fps);
        let diff = 0;
        let cutType: 'hard' | 'soft' | 'flash' = 'soft';

        if (cutIdx > 0 && cutIdx < frameCount) {
          const lPrev = lumas[cutIdx - 1]!, lCur = lumas[cutIdx]!;
          diff = computeMotionEnergy(lCur, lPrev).E;

          const lumaPrev = frameMetrics[cutIdx - 1]!.luma;
          const lumaCur = frameMetrics[cutIdx]!.luma;
          const lumaJump = lumaCur - lumaPrev;
          let isFlash = false;
          if (lumaJump > 0.25) {
            const checkIdx = Math.min(frameCount - 1, cutIdx + 6);
            if (Math.abs(frameMetrics[checkIdx]!.luma - lumaPrev) < 0.10) {
              isFlash = true;
            }
          }

          if (isFlash) cutType = 'flash';
          else if (diff > CONFIG.cut_hard_diff_threshold) cutType = 'hard';
          else cutType = 'soft';
        }

        let nearestDownbeatDelta = 0;
        if (audioData?.downbeats) {
          let minD = Infinity;
          for (const d of audioData.downbeats) {
            const delta = (e.start - d) * 1000;
            if (Math.abs(delta) < Math.abs(minD)) minD = delta;
          }
          nearestDownbeatDelta = minD;
        }

        let insideWord = false;
        let wordName = undefined, wStart = undefined, wEnd = undefined;
        if (lyricsData?.lines) {
          for (const line of lyricsData.lines) {
            for (const w of line.words ?? []) {
              if (e.start >= w.start + 0.02 && e.start <= w.end - 0.02) {
                insideWord = true;
                wordName = w.w;
                wStart = w.start;
                wEnd = w.end;
                break;
              }
            }
            if (insideWord) break;
          }
        }

        cutsList.push({
          t: e.start,
          diff_before_after: diff,
          type: cutType,
          nearest_downbeat_Δms: nearestDownbeatDelta,
          inside_word: insideWord,
          wordName,
          wStart,
          wEnd,
        });
      }
    }
  }

  const hitsList: HitItem[] = [];
  const candidateHits: { t: number; strength: number; type: 'kick' | 'snare' }[] = [];
  if (audioData?.onsets?.kick) {
    for (const [t, s] of audioData.onsets.kick) {
      if (t >= from && t <= to) candidateHits.push({ t, strength: s, type: 'kick' });
    }
  }
  if (audioData?.onsets?.snare) {
    for (const [t, s] of audioData.onsets.snare) {
      if (t >= from && t <= to) candidateHits.push({ t, strength: s, type: 'snare' });
    }
  }

  for (const hit of candidateHits) {
    const baseFrames = frameMetrics.filter((f) => f.t >= hit.t - 0.30 && f.t <= hit.t - 0.05);
    const E_base = baseFrames.length ? baseFrames.reduce((a, b) => a + b.E, 0) / baseFrames.length : 0;

    const peakFrames = frameMetrics.filter((f) => f.t >= hit.t && f.t <= hit.t + 0.15);
    let E_peak = 0, peakT = hit.t, maxShake = 0, peakLuma = 0;
    for (const pf of peakFrames) {
      if (pf.E > E_peak) { E_peak = pf.E; peakT = pf.t; peakLuma = pf.luma; }
      if (!pf.flow_invalid) {
        const shake = Math.hypot(pf.flow_dx, pf.flow_dy) / fps;
        if (shake > maxShake) maxShake = shake;
      }
    }

    const ratio = E_peak / Math.max(E_base, CONFIG.eps_energy);
    const latency_ms = (peakT - hit.t) * 1000;
    const baseLuma = baseFrames.length ? baseFrames.reduce((a, b) => a + b.luma, 0) / baseFrames.length : 0;
    const luma_jump = peakLuma - baseLuma;

    hitsList.push({
      t: hit.t,
      strength: hit.strength,
      type: hit.type,
      E_base,
      E_peak,
      ratio,
      latency_ms,
      luma_jump,
      shake_px: maxShake,
    });
  }

  // Parse CLI waivers (--waive <rule>:<reason>) and preserve prior waivers from findings.json
  const waivers: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--waive' && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      const parts = argv[++i]!.split(':');
      const ruleKey = parts[0]!.trim();
      const reason = parts.slice(1).join(':').trim() || 'Waived by operator';
      waivers[ruleKey] = reason;
    }
  }

  const priorFindingsPath = path.join(outDir, 'findings.json');
  if (existsSync(priorFindingsPath)) {
    try {
      const priorFindings = JSON.parse(await Bun.file(priorFindingsPath).text());
      if (Array.isArray(priorFindings)) {
        for (const pf of priorFindings) {
          if (pf.waived && pf.waiverReason && pf.id) {
            waivers[pf.id] = waivers[pf.id] ?? pf.waiverReason;
          }
        }
      }
    } catch {}
  }

  console.log('[motion] Evaluating rule-based flags (F01–F16)...');
  const flags = evaluateFlags(frameMetrics, textAnalysis, cutsList, hitsList, allowBlankRanges, allEvents, calibrationData, waivers, fps);

  console.log('[motion] Rendering diagnostic images...');
  const evidenceFiles: { name: string; content: string; whenToOpen: string }[] = [];

  const timelineDataUrl = await renderTimelinePlot(page, frameMetrics, cutsList, allEvents, from, to);
  await Bun.write(path.join(outDir, 'timeline.png'), Buffer.from(timelineDataUrl.split(',')[1]!, 'base64'));
  evidenceFiles.push({
    name: 'timeline.png',
    content: 'Stacked time-series plot (E, luma, signal%, edge_density, text h%, perf ms)',
    whenToOpen: 'Overview of temporal dynamics, audio alignment, and energy profile across the window',
  });

  const slitscanDataUrl = await renderSlitscan(page, centerCols, frameCount);
  await Bun.write(path.join(outDir, 'slitscan.png'), Buffer.from(slitscanDataUrl.split(',')[1]!, 'base64'));
  evidenceFiles.push({
    name: 'slitscan.png',
    content: 'Centre-column slit scan, 4 px per frame, wrapped every 480 frames',
    whenToOpen: 'Inspect camera speed ramps, horizontal rhythm, and scene continuity bands',
  });

  const selectedEventTimes: { label: string; t: number }[] = [];
  cutsList.forEach((c) => selectedEventTimes.push({ label: `cut_${c.t.toFixed(2)}`, t: c.t }));

  const topKicks = [...hitsList].filter((h) => h.type === 'kick').sort((a, b) => b.strength - a.strength).slice(0, 3);
  topKicks.forEach((k, i) => selectedEventTimes.push({ label: `kick_${i + 1}_${k.t.toFixed(2)}`, t: k.t }));

  userEvents.forEach((t) => selectedEventTimes.push({ label: `event_${t.toFixed(2)}`, t }));

  let maxE = 0, maxET = from;
  frameMetrics.forEach((f) => { if (f.E > maxE) { maxE = f.E; maxET = f.t; } });
  if (maxE > 0) selectedEventTimes.push({ label: `max_energy_${maxET.toFixed(2)}`, t: maxET });

  const deadFlags = flags.filter((f) => f.rule === 'F08');
  if (deadFlags.length > 0) {
    const worstDead = deadFlags.sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0))[0]!;
    const midT = (worstDead.t0 + worstDead.t1) / 2;
    selectedEventTimes.push({ label: `dead_motion_${midT.toFixed(2)}`, t: midT });
  }

  if (textAnalysis.collisions.length > 0) {
    const worstCol = textAnalysis.collisions.sort((a, b) => b.intersection_pct - a.intersection_pct)[0]!;
    selectedEventTimes.push({ label: `collision_${worstCol.t0.toFixed(2)}`, t: worstCol.t0 });
  }

  const seenLabels = new Set<string>();
  for (const ev of selectedEventTimes) {
    if (seenLabels.has(ev.label)) continue;
    seenLabels.add(ev.label);

    const stripDataUrl = await renderEventStrip(page, ev.t, eventOffsets, frameMetrics, from, to);
    const stripName = `strip_${ev.label}.png`;
    await Bun.write(path.join(outDir, stripName), Buffer.from(stripDataUrl.split(',')[1]!, 'base64'));
    evidenceFiles.push({
      name: stripName,
      content: `Event contact strip at offsets around t=${ev.t.toFixed(2)}s`,
      whenToOpen: `Detailed sub-second visual evolution around ${ev.label}`,
    });

    const evIdx = Math.max(0, Math.min(frameCount - 1, Math.round((ev.t - from) * fps)));
    const i0 = Math.max(0, evIdx - 2), i1 = evIdx, i2 = Math.min(frameCount - 1, evIdx + 2);
    const rgbDataUrl = await renderRgbTimeComposite(page, lumas[i0]!, lumas[i1]!, lumas[i2]!);
    const rgbName = `rgbtime_${ev.label}.png`;
    await Bun.write(path.join(outDir, rgbName), Buffer.from(rgbDataUrl.split(',')[1]!, 'base64'));
    evidenceFiles.push({
      name: rgbName,
      content: `RGB temporal composite (R=i-2, G=i, B=i+2) around t=${ev.t.toFixed(2)}s`,
      whenToOpen: `Inspect directional velocity and motion fringing around ${ev.label}`,
    });

    const framesAround = frameMetrics.filter((f) => f.t >= ev.t - 0.50 && f.t <= ev.t + 0.50);
    const csvName = `events/${ev.label}.csv`;
    await Bun.write(path.join(outDir, csvName), generateEventsCsv(framesAround, ev.t));
    evidenceFiles.push({
      name: csvName,
      content: `Per-frame metrics table at 60 fps for ±0.5s around t=${ev.t.toFixed(2)}s`,
      whenToOpen: `Frame-accurate numbers and response curve around ${ev.label}`,
    });
  }

  let refSummary: any = null;
  if (comparePath && existsSync(comparePath)) {
    refSummary = await Bun.file(comparePath).json();
  }

  console.log('[motion] Generating report.md, findings.json, and data tables...');
  const { markdown, summaryJson, findingsJson } = generateReportMarkdown(
    {
      command: `bun scripts/render.ts motion ${argv.slice(1).join(' ')}`,
      plateId: plateLabel,
      windowFrom: from,
      windowTo: to,
      fps,
      scale: SCALE,
      samples: motionSamples,
      shutter: motionShutter,
      frameCount,
      wallClockSec,
      paletteString: paletteArg,
      paletteNames,
      topN,
      binSec,
      outDir,
      allowBlankRanges,
      comparePath,
      calibrationData,
      evidenceFiles,
    },
    flags,
    frameMetrics,
    cutsList,
    hitsList,
    textAnalysis.words,
    textAnalysis.runs,
    textAnalysis.collisions,
    allEvents,
    refSummary
  );

  await Bun.write(path.join(outDir, 'report.md'), markdown);
  await Bun.write(path.join(outDir, 'summary.json'), JSON.stringify(summaryJson, null, 2));
  await Bun.write(path.join(outDir, 'findings.json'), JSON.stringify(findingsJson, null, 2));
  await Bun.write(path.join(outDir, 'frames.csv'), generateFramesCsv(frameMetrics));
  await Bun.write(path.join(outDir, 'text.csv'), generateTextCsv(textProbes));
  await Bun.write(path.join(outDir, 'events.json'), JSON.stringify(allEvents, null, 2));

  console.log(`\n[motion] Success! Telemetry written to: ${outDir}`);
  console.log(`- report.md (${flags.length} findings: ${summaryJson.tierCounts.blocking} blocking, ${summaryJson.tierCounts.advisory} advisory, ${summaryJson.tierCounts.info} info)`);
  console.log(`- findings.json (${findingsJson.length} items with stable IDs & waivers)`);
  console.log(`- summary.json`);
  console.log(`- frames.csv (${frameCount} rows)`);
  console.log(`- text.csv (${textProbes.length} rows)`);
  console.log(`- events.json (${allEvents.length} events)`);
  console.log(`- timeline.png, slitscan.png, and ${selectedEventTimes.length} diagnostic suites\n`);
}

const { url, stop } = await ensureServer();
const { browser, page, logs } = await openPage(url);
try {
  if (mode === 'gpu') {
    console.log(await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')!;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    }));
  } else if (mode === 'stills') {
    const times = (opt('t') ?? '0').split(',').map(Number).filter(Number.isFinite);
    if (!times.length) throw new Error('[stills] No valid --t times (got NaN). Pass comma-separated seconds.');
    const files = await stills(page, times, resolveOut(opt('out'), path.join(ROOT, 'out/stills')));
    console.log(files.join('\n'));
  } else if (mode === 'sheet') {
    const from = numOpt('from', 0, 0), to = numOpt('to', 10, 0), n = Math.round(numOpt('n', 12, 1, 200));
    let times = Array.from({ length: n }, (_, i) => from + ((to - from) * i) / Math.max(1, n - 1));
    if (opt('times')) {
      times = opt('times')!.split(',').map(Number).filter(Number.isFinite);
      if (!times.length) throw new Error('[sheet] No valid --times (got NaN).');
    }
    if (flag('cuts')) {
      // 4 frames around every timeline boundary: 2 frames before, 2 after
      const tl: { id: string; start: number }[] = await page.evaluate(() => (window as any).__pdoom.timeline);
      times = tl.slice(1).flatMap((e) => [e.start - 0.1, e.start - 1 / 60, e.start + 1 / 60, e.start + 0.1]);
    }
    const out = resolveOut(opt('out'), path.join(ROOT, `out/sheets/sheet_${from}-${to}.png`));
    await sheet(page, times, Math.round(numOpt('cols', 4, 1, 16)), out);
    console.log(out);
  } else if (mode === 'plates') {
    const tl: { id: string; start: number; end: number }[] = await page.evaluate(() => (window as any).__pdoom.timeline);
    const legacyFigs = ['open', 'loss', 'room', 'shoggoth', 'spacetime', 'ascent', 'bureau', 'leftturn', 'paperclips', 'fuse', 'stack', 'dense', 'loom', 'ilya'];
    const figs = tl.some((x) => legacyFigs.includes(x.id)) ? legacyFigs : tl.map((x) => x.id);
    const overrides: Record<string, number> = existsSync(path.join(APP, 'plates.json')) ? await Bun.file(path.join(APP, 'plates.json')).json() : {};
    const dir = path.join(APP, 'public/plates');
    mkdirSync(dir, { recursive: true });
    await page.evaluate(() => { (window as any).__pdoom.engine.hudOff = true; });
    for (let i = 0; i < figs.length; i++) {
      const e = tl.find((x) => x.id === figs[i]);
      if (!e) continue;
      const t = overrides[figs[i]!] ?? (e.start + e.end) / 2;
      await page.evaluate((t) => (window as any).__pdoom.still(t, 4, 0.2), t);
      const f = path.join(dir, `fig${String(i + 1).padStart(2, '0')}.${SCALE !== 1 ? 'png' : 'jpg'}`);
      if (SCALE !== 1) {
        // Full-res pixel buffer at SCALE (matches stills path); downscale via canvas for jpeg.
        const b64: string = await page.evaluate(() => (window as any).__pdoom.png());
        await Bun.write(f, Buffer.from(b64, 'base64'));
      } else {
        await page.screenshot({ path: f, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: OW, height: OH } });
      }
      console.log(f, t.toFixed(2));
    }
  } else if (mode === 'perf') {
    const from = numOpt('from', 0, 0);
    let to = numOpt('to', 5, 0);
    if (to <= from) { console.warn(`[perf] Empty window (to<=from), expanding to from+1s`); to = from + 1; }
    const r = await page.evaluate(async ({ from, to, samples, shutter }) => {
      const P = (window as any).__pdoom;
      const ms: number[] = [];
      const buf = new Uint8Array(P.width * P.height * 4);
      P.still(from);
      const used: Record<number, number> = {};
      for (let t = from; t < to; t += 1 / 60) {
        const a = performance.now();
        const k = P.engine.render(t, 1 / 60, false, samples, shutter);
        used[k] = (used[k] ?? 0) + 1;
        await P.engine.readPixelsAsync(buf);
        ms.push(performance.now() - a);
      }
      ms.sort((a, b) => a - b);
      return { n: ms.length, avg: ms.reduce((a, b) => a + b, 0) / ms.length, p50: ms[ms.length >> 1], p95: ms[Math.floor(ms.length * 0.95)], max: ms[ms.length - 1], used };
    }, { from, to, samples: SAMPLES, shutter: numOpt('shutter', 0.5, 0, 1) });
    console.log(`frames ${r.n}  avg ${r.avg.toFixed(1)}ms  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  max ${r.max.toFixed(1)}  sub-frames ${hist(r.used)}`);
  } else if (mode === 'video') {
    const dur: number = await page.evaluate(() => (window as any).__pdoom.duration);
    const vFrom = numOpt('from', 0, 0);
    let vTo = numOpt('to', dur, 0);
    if (vTo <= vFrom) { console.warn(`[video] Empty window (to<=from), expanding to from+1s`); vTo = vFrom + 1; }
    await video(page, vFrom, vTo, numOpt('fps', 60, 15, 120), resolveOut(opt('out'), path.join(ROOT, 'out/whos-holding-on-to-who.mp4')));
  } else if (mode === 'motion') {
    await motion(page);
  } else if (mode === 'onion') {
    const { runOnion } = await import('./visual/onion');
    await runOnion(page, process.argv.slice(3));
  } else if (mode === 'stitch') {
    const { runStitch } = await import('./visual/stitch');
    await runStitch(page, process.argv.slice(3));
  } else if (mode === 'compare') {
    const { runCompare } = await import('./visual/compare');
    await runCompare(page, process.argv.slice(3));
  } else if (mode === 'godview') {
    const { runGodView } = await import('./visual/godview');
    await runGodView(page, process.argv.slice(3));
  }
  if (logs.length) console.error('BROWSER LOG:\n' + logs.slice(0, 40).join('\n'));
} finally {
  await browser.close();
  stop();
}
