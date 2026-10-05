// Multi-Exposure Onion Skinner
// Blends consecutive frames with a chromatic temporal gradient (cyan -> white -> amber)
// to visualize motion arcs, camera tremors, and typographic easing on a single still.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright-core';

export interface OnionOptions {
  scene?: string;
  t?: number;
  from?: number;
  to?: number;
  window?: number;
  frames?: number;
  out?: string;
}

function isFlagVal(val?: string): boolean {
  return typeof val === 'string' && !val.startsWith('--');
}

export function parseOnionArgs(argv: string[]): OnionOptions {
  const opts: OnionOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--t' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.t = v; }
    else if (arg === '--from' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.from = v; }
    else if (arg === '--to' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.to = v; }
    else if (arg === '--window' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.window = v; }
    else if (arg === '--frames' && isFlagVal(argv[i + 1])) { const v = parseInt(argv[++i]!, 10); if (Number.isFinite(v)) opts.frames = Math.max(2, Math.min(64, v)); }
    else if (arg === '--scene' && isFlagVal(argv[i + 1])) { opts.scene = argv[++i]!; }
    else if (arg === '--out' && isFlagVal(argv[i + 1])) { opts.out = argv[++i]!; }
  }
  return opts;
}

export async function runOnion(page: Page, argv: string[] = []): Promise<void> {
  const opts = parseOnionArgs(argv);

  if (opts.from === undefined && opts.to === undefined && opts.scene) {
    const tl: { id: string; start: number; end: number }[] = await page.evaluate(
      () => (window as any).__pdoom?.timeline || []
    );
    const match = tl.find((e) => e.id === opts.scene);
    if (match) {
      opts.from = match.start;
      opts.to = match.end;
    }
  }

  let from = opts.from;
  let to = opts.to;
  const numFrames = opts.frames ?? 10;

  if (from !== undefined && to !== undefined) {
    // Both explicitly set
  } else if (from !== undefined && to === undefined) {
    to = from + (opts.window ?? 0.5);
  } else if (to !== undefined && from === undefined) {
    from = Math.max(0, to - (opts.window ?? 0.5));
  } else {
    const centerT = opts.t ?? 10.0;
    const halfWin = (opts.window ?? 0.5) / 2;
    from = Math.max(0, centerT - halfWin);
    to = centerT + halfWin;
  }

  const ROOT = path.resolve(import.meta.dir, '../../..');
  const defaultOut = path.join(ROOT, 'out/visual/onion');
  const outDir = path.resolve(opts.out ?? defaultOut);
  mkdirSync(outDir, { recursive: true });

  console.log(`[onion] Generating multi-exposure motion trail across [${from.toFixed(2)}–${to.toFixed(2)}s] (${numFrames} frames)...`);

  const timestamps: number[] = [];
  for (let i = 0; i < numFrames; i++) {
    const t = from + (i / Math.max(1, numFrames - 1)) * (to - from);
    timestamps.push(t);
  }

  // Render each frame and composite in browser context
  const result: { dataUrl: string; summary: any } = await page.evaluate(
    async ({ times, sceneName }: { times: number[]; sceneName: string }) => {
      const P = (window as any).__pdoom;
      const W = P.width ?? 1920;
      const H = P.height ?? 1080;
      const N = times.length;
      const midIdx = Math.floor(N / 2);

      // Create main canvas
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d')!;

      // Background fill
      ctx.fillStyle = '#0A0A0B';
      ctx.fillRect(0, 0, W, H);

      const capturedCanvases: HTMLCanvasElement[] = [];
      const textCenters: { x: number; y: number; text: string }[] = [];

      for (let i = 0; i < N; i++) {
        const t = times[i]!;
        await P.still(t, 1, 0);

        const src = document.getElementById('c') as HTMLCanvasElement;
        const copyCv = document.createElement('canvas');
        copyCv.width = W;
        copyCv.height = H;
        const copyCtx = copyCv.getContext('2d')!;
        copyCtx.drawImage(src, 0, 0, W, H);
        capturedCanvases.push(copyCv);

        // Find active hero text centroid if available
        const probes = (window as any).__pdoom_textProbes || P.textProbes || [];
        const frameProbes = probes.filter((p: any) => Math.abs(p.t - t) < 0.02 && p.globalAlpha > 0.3);
        if (frameProbes.length > 0) {
          const maxP = frameProbes.reduce((a: any, b: any) => (a.hPct > b.hPct ? a : b));
          textCenters.push({ x: maxP.cx, y: maxP.cy, text: maxP.text });
        } else {
          textCenters.push({ x: W / 2, y: H / 2, text: '' });
        }
      }

      // Composite pass with chromatic time tinting
      // Past frames (cyan): #00D2FF
      // Center frame (key): Full natural color
      // Future frames (amber): #FF7A00
      ctx.globalCompositeOperation = 'source-over';

      for (let i = 0; i < N; i++) {
        const frameCv = capturedCanvases[i]!;
        const tintCv = document.createElement('canvas');
        tintCv.width = W;
        tintCv.height = H;
        const tCtx = tintCv.getContext('2d')!;

        tCtx.drawImage(frameCv, 0, 0);

        if (i < midIdx) {
          // Past: Cyan tint with ascending opacity
          const progress = i / Math.max(1, midIdx);
          const alpha = 0.20 + 0.50 * progress;
          tCtx.globalCompositeOperation = 'source-atop';
          tCtx.fillStyle = '#00D2FF';
          tCtx.globalAlpha = 0.70;
          tCtx.fillRect(0, 0, W, H);

          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(tintCv, 0, 0);
        } else if (i === midIdx) {
          // Key center frame: natural full contrast
          ctx.globalAlpha = 1.0;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(frameCv, 0, 0);
        } else {
          // Future: Amber/Signal tint with descending opacity
          const progress = (i - midIdx) / Math.max(1, N - 1 - midIdx);
          const alpha = 0.70 * (1 - progress) + 0.20;
          tCtx.globalCompositeOperation = 'source-atop';
          tCtx.fillStyle = '#FF7A00';
          tCtx.globalAlpha = 0.70;
          tCtx.fillRect(0, 0, W, H);

          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(tintCv, 0, 0);
        }
      }

      // Draw centroid motion trail if movement detected
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      let totalTravel = 0;
      const spacings: number[] = [];

      ctx.beginPath();
      for (let i = 0; i < textCenters.length; i++) {
        const pt = textCenters[i]!;
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else {
          ctx.lineTo(pt.x, pt.y);
          const prev = textCenters[i - 1]!;
          const d = Math.hypot(pt.x - prev.x, pt.y - prev.y);
          spacings.push(d);
          totalTravel += d;
        }
      }
      ctx.strokeStyle = 'rgba(255, 77, 18, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw node dots
      for (let i = 0; i < textCenters.length; i++) {
        const pt = textCenters[i]!;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, i === midIdx ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = i < midIdx ? '#00D2FF' : i === midIdx ? '#FFFFFF' : '#FF7A00';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Technical HUD Banner at bottom
      const hudH = 54;
      ctx.fillStyle = 'rgba(10, 10, 11, 0.90)';
      ctx.fillRect(0, H - hudH, W, hudH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, H - hudH, W, 1);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#EEE9DF';
      ctx.textBaseline = 'middle';
      const labelLeft = `[ONION SKINNER] Window: ${times[0]!.toFixed(2)}s – ${times[N - 1]!.toFixed(2)}s (${(times[N - 1]! - times[0]!).toFixed(2)}s) | Samples: ${N} frames | Key Frame: ${times[midIdx]!.toFixed(2)}s`;
      ctx.fillText(labelLeft, 24, H - hudH / 2);

      // Color legend on right
      const legendText = 'Past [Cyan] ── Key [White] ── Future [Amber]';
      const legW = ctx.measureText(legendText).width;
      ctx.fillStyle = '#A0A0AA';
      ctx.fillText(legendText, W - legW - 24, H - hudH / 2);

      const dataUrl = cv.toDataURL('image/png');

      return {
        dataUrl,
        summary: {
          scene: sceneName,
          center_t: times[midIdx],
          window_seconds: times[N - 1]! - times[0]!,
          from: times[0],
          to: times[N - 1],
          frame_count: N,
          timestamps: times,
          frames: N,
          total_centroid_travel_px: totalTravel,
          inter_frame_spacings_px: spacings,
          continuity: spacings.length > 0 && Math.max(...spacings) < 150 ? 'continuous' : 'high_velocity_or_jump',
        },
      };
    },
    { times: timestamps, sceneName: opts.scene ?? 'all' }
  );

  const base64Data = result.dataUrl.replace(/^data:image\/png;base64,/, '');
  const pngPath = path.join(outDir, 'onion_motion.png');
  const jsonPath = path.join(outDir, 'onion_summary.json');

  await Bun.write(pngPath, Buffer.from(base64Data, 'base64'));
  await Bun.write(jsonPath, JSON.stringify(result.summary, null, 2));

  console.log(`[onion] Wrote composite motion trail: ${pngPath}`);
  console.log(`[onion] Wrote summary telemetry: ${jsonPath}`);
}
