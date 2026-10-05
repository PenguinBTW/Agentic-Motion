// Transition Seam Stitch Inspector
// Audits exact handoff seams between adjacent scenes (+-250ms).
// Generates Split-Wipe Onion Overlay (green/magenta) and 10-frame alignment filmstrip.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright-core';

export interface StitchOptions {
  fromScene?: string;
  toScene?: string;
  t?: number;
  window?: number;
  out?: string;
}

function isFlagVal(val?: string): boolean {
  return typeof val === 'string' && !val.startsWith('--');
}

export function parseStitchArgs(argv: string[]): StitchOptions {
  const opts: StitchOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--t' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.t = v; }
    else if (arg === '--window' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.window = v; }
    else if (arg === '--from-scene' && isFlagVal(argv[i + 1])) { opts.fromScene = argv[++i]!; }
    else if (arg === '--to-scene' && isFlagVal(argv[i + 1])) { opts.toScene = argv[++i]!; }
    else if (arg === '--out' && isFlagVal(argv[i + 1])) { opts.out = argv[++i]!; }
  }
  return opts;
}

export async function runStitch(page: Page, argv: string[] = []): Promise<void> {
  const opts = parseStitchArgs(argv);

  // If t is not provided, look up the timeline cut between fromScene and toScene
  let cutT = opts.t;
  if (cutT === undefined) {
    const tl: { id: string; start: number; end: number }[] = await page.evaluate(
      () => (window as any).__pdoom?.timeline || []
    );
    if (opts.toScene && tl.length > 0) {
      const match = tl.find((e) => e.id === opts.toScene);
      if (match) cutT = match.start;
    } else if (opts.fromScene && tl.length > 0) {
      const match = tl.find((e) => e.id === opts.fromScene);
      if (match) cutT = match.end;
    }
    if (cutT === undefined) cutT = 25.60; // fallback default
  }

  const ROOT = path.resolve(import.meta.dir, '../../..');
  const defaultOut = path.join(ROOT, 'out/visual/stitch');
  const outDir = path.resolve(opts.out ?? defaultOut);
  mkdirSync(outDir, { recursive: true });

  console.log(`[stitch] Inspecting transition seam at t = ${cutT.toFixed(2)}s (from: ${opts.fromScene ?? 'auto'} -> to: ${opts.toScene ?? 'auto'})...`);

  const fps = 60;
  // If window is provided in seconds (e.g. 0.25) or ms, derive frame spacing
  const winS = opts.window ? (opts.window > 5 ? opts.window / 1000 : opts.window) : (10 / fps);
  const dt = winS / 10;
  const tBefore = cutT - dt;
  const tAfter = cutT;

  // 10-frame filmstrip timestamps: 5 before cut, 5 after cut
  const stripTimes: number[] = [];
  for (let i = -5; i < 5; i++) {
    stripTimes.push(cutT + i * dt);
  }

  const result: {
    onionUrl: string;
    stripUrl: string;
    summary: any;
  } = await page.evaluate(
    async ({ tA, tB, stripTimes, fromSceneName, toSceneName }: { tA: number; tB: number; stripTimes: number[]; fromSceneName: string; toSceneName: string }) => {
      const P = (window as any).__pdoom;
      const W = P.width ?? 1920;
      const H = P.height ?? 1080;

      // 1. Capture Exit Frame (tA)
      await P.still(tA, 1, 0);
      const srcA = document.getElementById('c') as HTMLCanvasElement;
      const cvA = document.createElement('canvas');
      cvA.width = W; cvA.height = H;
      const ctxA = cvA.getContext('2d')!;
      ctxA.drawImage(srcA, 0, 0);

      // 2. Capture Entry Frame (tB)
      await P.still(tB, 1, 0);
      const srcB = document.getElementById('c') as HTMLCanvasElement;
      const cvB = document.createElement('canvas');
      cvB.width = W; cvB.height = H;
      const ctxB = cvB.getContext('2d')!;
      ctxB.drawImage(srcB, 0, 0);

      // 3. Composite Green/Magenta Split Onion
      const onionCv = document.createElement('canvas');
      onionCv.width = W; onionCv.height = H;
      const oCtx = onionCv.getContext('2d')!;

      oCtx.fillStyle = '#0A0A0B';
      oCtx.fillRect(0, 0, W, H);

      // Exit Frame in Green (#00FF66)
      const gCv = document.createElement('canvas');
      gCv.width = W; gCv.height = H;
      const gCtx = gCv.getContext('2d')!;
      gCtx.drawImage(cvA, 0, 0);
      gCtx.globalCompositeOperation = 'source-atop';
      gCtx.fillStyle = '#00FF66';
      gCtx.fillRect(0, 0, W, H);

      // Entry Frame in Magenta (#FF00AA)
      const mCv = document.createElement('canvas');
      mCv.width = W; mCv.height = H;
      const mCtx = mCv.getContext('2d')!;
      mCtx.drawImage(cvB, 0, 0);
      mCtx.globalCompositeOperation = 'source-atop';
      mCtx.fillStyle = '#FF00AA';
      mCtx.fillRect(0, 0, W, H);

      // Additive / Screen blending: Green + Magenta = White
      oCtx.globalAlpha = 0.50;
      oCtx.globalCompositeOperation = 'screen';
      oCtx.drawImage(gCv, 0, 0);
      oCtx.drawImage(mCv, 0, 0);

      // Header HUD Banner
      oCtx.globalCompositeOperation = 'source-over';
      oCtx.globalAlpha = 1.0;
      const hudH = 50;
      oCtx.fillStyle = 'rgba(10, 10, 11, 0.88)';
      oCtx.fillRect(0, 0, W, hudH);
      oCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      oCtx.lineWidth = 1;
      oCtx.strokeRect(0, hudH, W, 1);

      oCtx.font = '13px monospace';
      oCtx.fillStyle = '#EEE9DF';
      oCtx.textBaseline = 'middle';
      oCtx.fillText(`[SEAM ONION] Cut Handoff at t = ${tB.toFixed(2)}s | Exit: ${tA.toFixed(2)}s (Green) ── Entry: ${tB.toFixed(2)}s (Magenta)`, 24, hudH / 2);
      oCtx.fillStyle = '#A0A0AA';
      oCtx.fillText(`[Neutral White = Seamless Alignment | Green/Magenta Fringe = Discontinuity]`, W - 580, hudH / 2);

      // 4. Generate 10-Frame Contact Strip
      const stripW = 10 * 320 + 9 * 4;
      const stripH = 180 + 36;
      const sCv = document.createElement('canvas');
      sCv.width = stripW; sCv.height = stripH;
      const sCtx = sCv.getContext('2d')!;
      sCtx.fillStyle = '#141416';
      sCtx.fillRect(0, 0, stripW, stripH);

      for (let i = 0; i < stripTimes.length; i++) {
        const t = stripTimes[i]!;
        await P.still(t, 1, 0);
        const fSrc = document.getElementById('c') as HTMLCanvasElement;
        const x = i * (320 + 4);
        sCtx.drawImage(fSrc, 0, 0, fSrc.width, fSrc.height, x, 0, 320, 180);

        // Frame label
        sCtx.font = '11px monospace';
        sCtx.fillStyle = i < 5 ? '#00FF66' : '#FF00AA';
        sCtx.fillText(`t=${t.toFixed(2)}s (N${i === 5 ? '' : i < 5 ? (i - 5) : '+' + (i - 5)})`, x + 6, 180 + 22);

        // Cut line between frame 4 and 5
        if (i === 4) {
          sCtx.strokeStyle = '#FF4D12';
          sCtx.lineWidth = 3;
          sCtx.beginPath();
          sCtx.moveTo(x + 320 + 2, 0);
          sCtx.lineTo(x + 320 + 2, stripH);
          sCtx.stroke();
        }
      }

      return {
        onionUrl: onionCv.toDataURL('image/png'),
        stripUrl: sCv.toDataURL('image/png'),
        summary: {
          cut_timestamp: tB,
          from_scene: fromSceneName,
          to_scene: toSceneName,
          window_ms: (stripTimes[stripTimes.length - 1]! - stripTimes[0]!) * 1000,
          sample_frames: stripTimes.length,
          artifacts: ['onion_seam.png', 'strip_seam.png'],
          cut_t: tB,
          exit_t: tA,
          entry_t: tB,
          strip_frames: stripTimes.length,
          status: 'analyzed',
        },
      };
    },
    { tA: tBefore, tB: tAfter, stripTimes, fromSceneName: opts.fromScene ?? 'auto', toSceneName: opts.toScene ?? 'auto' }
  );

  const onionBase64 = result.onionUrl.replace(/^data:image\/png;base64,/, '');
  const stripBase64 = result.stripUrl.replace(/^data:image\/png;base64,/, '');

  const onionPath = path.join(outDir, 'onion_seam.png');
  const stripPath = path.join(outDir, 'strip_seam.png');
  const jsonPath = path.join(outDir, 'stitch_summary.json');

  await Bun.write(onionPath, Buffer.from(onionBase64, 'base64'));
  await Bun.write(stripPath, Buffer.from(stripBase64, 'base64'));
  await Bun.write(jsonPath, JSON.stringify(result.summary, null, 2));

  console.log(`[stitch] Wrote split onion overlay: ${onionPath}`);
  console.log(`[stitch] Wrote 10-frame contact strip: ${stripPath}`);
  console.log(`[stitch] Wrote telemetry summary: ${jsonPath}`);
}
