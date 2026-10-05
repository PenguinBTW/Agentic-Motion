// Visual A/B Reference Anchor
// Side-by-side & 50/50 diagonal split-wipe comparison against Example project reference plates.

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';

export interface CompareOptions {
  scene?: string;
  t?: number;
  refScene?: string;
  refT?: number;
  out?: string;
  port?: number;
}

function isFlagVal(val?: string): boolean {
  return typeof val === 'string' && !val.startsWith('--');
}

export function parseCompareArgs(argv: string[]): CompareOptions {
  const opts: CompareOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--t' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.t = v; }
    else if (arg === '--scene' && isFlagVal(argv[i + 1])) { opts.scene = argv[++i]!; }
    else if (arg === '--ref' && isFlagVal(argv[i + 1])) { opts.refScene = argv[++i]!; }
    else if (arg === '--ref-t' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.refT = v; }
    else if (arg === '--out' && isFlagVal(argv[i + 1])) { opts.out = argv[++i]!; }
    else if (arg === '--port' && isFlagVal(argv[i + 1])) { const v = parseInt(argv[++i]!, 10); if (Number.isFinite(v)) opts.port = v; }
  }
  return opts;
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function runCompare(page: Page, argv: string[] = []): Promise<void> {
  const opts = parseCompareArgs(argv);
  const activeT = opts.t ?? 27.50;
  const activeScene = opts.scene ?? 'boundary';
  const refScene = opts.refScene ?? 'loss';
  const refT = opts.refT ?? 14.20;
  const port = opts.port ?? 5189;

  const ROOT = path.resolve(import.meta.dir, '../../..');
  const defaultOut = path.join(ROOT, 'out/visual/compare');
  const outDir = path.resolve(opts.out ?? defaultOut);
  mkdirSync(outDir, { recursive: true });

  console.log(`[compare] Benchmarking active [${activeScene} @ ${activeT.toFixed(2)}s] vs Example [${refScene} @ ${refT.toFixed(2)}s]...`);

  // 1. Capture Active Still from current page
  await page.evaluate(([t]) => (window as any).__pdoom.still(t, 1, 0), [activeT]);
  const activeBase64: string = await page.evaluate(() => (window as any).__pdoom.png());

  // 2. Capture Reference Still from Example project
  const REF_APP = path.resolve(import.meta.dir, '../../../../Example project/app');
  let refBase64: string | null = null;
  let refProc: any = null;
  let refBrowser: Browser | null = null;
  let refAvailable = false;

  if (existsSync(REF_APP)) {
    try {
      const refUrl = `http://localhost:${port}`;
      let alive = await isReachable(refUrl);
      if (!alive) {
        console.log(`[compare] Starting Example project Vite server on port ${port}...`);
        refProc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], {
          cwd: REF_APP,
          stdout: 'ignore',
          stderr: 'ignore',
          env: { ...process.env, PDOOM_NO_HMR: '1' },
        });
        for (let i = 0; i < 30; i++) {
          await Bun.sleep(150);
          if (await isReachable(refUrl)) { alive = true; break; }
        }
      }

      if (alive) {
        try {
          try {
            refBrowser = await chromium.launch({ headless: true, channel: 'chrome' });
          } catch {
            refBrowser = await chromium.launch({ headless: true });
          }
          const refPage = await refBrowser.newPage({ viewport: { width: 1920, height: 1080 } });
          await refPage.goto(`${refUrl}/?export=1&only=${refScene}`);
          await refPage.waitForFunction(() => (window as any).__pdoom?.ready, null, { timeout: 15000 });
          await refPage.evaluate(([t]) => (window as any).__pdoom.still(t, 1, 0), [refT]);
          refBase64 = await refPage.evaluate(() => (window as any).__pdoom.png());
          if (refBase64) refAvailable = true;
        } catch (err: any) {
          console.warn(`[compare] Warning: Could not capture reference plate directly: ${err.message}`);
        } finally {
          if (refBrowser) {
            await refBrowser.close().catch(() => {});
            refBrowser = null;
          }
        }
      }
    } finally {
      if (refProc) {
        refProc.kill();
        refProc = null;
      }
    }
  }

  // If reference could not be captured live, create fallback comparison
  if (!refBase64) {
    console.warn('[compare] Note: Example project live capture unavailable. Using active frame as fallback.');
    refBase64 = activeBase64;
  }

  // 3. Composite in current browser page
  const compositeRes: { sideUrl: string; splitUrl: string } = await page.evaluate(
    async ({ b64A, b64B, scA, tA, scB, tB, isRefLive }: any) => {
      const W = 1920;
      const H = 1080;

      const imgA = new Image();
      const imgB = new Image();
      await new Promise((res, rej) => {
        let loaded = 0;
        const timer = setTimeout(() => rej(new Error('Base64 image load timeout')), 8000);
        const check = () => { if (++loaded === 2) { clearTimeout(timer); res(true); } };
        imgA.onload = check;
        imgB.onload = check;
        imgA.onerror = () => { clearTimeout(timer); rej(new Error('Failed to load imgA')); };
        imgB.onerror = () => { clearTimeout(timer); rej(new Error('Failed to load imgB')); };
        imgA.src = 'data:image/png;base64,' + b64A;
        imgB.src = 'data:image/png;base64,' + b64B;
      });

      // --- Canvas 1: Side by Side (2-Panel, 3840x1080) ---
      const cvSide = document.createElement('canvas');
      cvSide.width = 3840;
      cvSide.height = 1080;
      const ctxS = cvSide.getContext('2d')!;

      ctxS.fillStyle = '#0A0A0B';
      ctxS.fillRect(0, 0, 3840, 1080);

      // Draw Panel A (Active, Left 1920)
      ctxS.drawImage(imgA, 0, 0, 1920, 1080, 0, 0, 1920, 1080);
      ctxS.strokeStyle = '#00D2FF';
      ctxS.lineWidth = 3;
      ctxS.strokeRect(0, 0, 1920, 1080);

      // Draw Panel B (Reference, Right 1920)
      ctxS.drawImage(imgB, 0, 0, 1920, 1080, 1920, 0, 1920, 1080);
      ctxS.strokeStyle = '#FF4D12';
      ctxS.lineWidth = 3;
      ctxS.strokeRect(1920, 0, 1920, 1080);

      // Labels
      ctxS.font = 'bold 20px monospace';
      ctxS.fillStyle = '#00D2FF';
      ctxS.fillText(`[ACTIVE] ${scA} (t = ${tA.toFixed(2)}s)`, 32, 44);

      ctxS.fillStyle = '#FF4D12';
      const refTag = isRefLive ? `[EXAMPLE BENCHMARK] ${scB} (t = ${tB.toFixed(2)}s)` : `[EXAMPLE BENCHMARK (FALLBACK)] ${scB}`;
      ctxS.fillText(refTag, 1920 + 32, 44);

      // Header Banner
      const hudH = 50;
      ctxS.fillStyle = 'rgba(10, 10, 11, 0.90)';
      ctxS.fillRect(0, 0, 3840, hudH);
      ctxS.font = '14px monospace';
      ctxS.fillStyle = '#EEE9DF';
      ctxS.textBaseline = 'middle';
      ctxS.fillText(`[VISUAL A/B ANCHOR] Active: ${scA} vs Reference: ${scB} | Scale: 3840x1080 Full HD Dual Panel | 1:1 Pixel Inspection`, 32, hudH / 2);

      // --- Canvas 2: Diagonal 50/50 Split Wipe (1920x1080) ---
      const cvSplit = document.createElement('canvas');
      cvSplit.width = W;
      cvSplit.height = H;
      const ctxW = cvSplit.getContext('2d')!;

      // Draw Reference base
      ctxW.drawImage(imgB, 0, 0, W, H);

      // Draw Active with diagonal clip path
      ctxW.save();
      ctxW.beginPath();
      ctxW.moveTo(0, 0);
      ctxW.lineTo(W, 0);
      ctxW.lineTo(0, H);
      ctxW.closePath();
      ctxW.clip();
      ctxW.drawImage(imgA, 0, 0, W, H);
      ctxW.restore();

      // Draw diagonal divider line
      ctxW.strokeStyle = '#FF4D12';
      ctxW.lineWidth = 2;
      ctxW.beginPath();
      ctxW.moveTo(W, 0);
      ctxW.lineTo(0, H);
      ctxW.stroke();

      // Corner tags
      ctxW.font = '13px monospace';
      ctxW.fillStyle = '#00D2FF';
      ctxW.fillText(`▲ ACTIVE: ${scA} (${tA.toFixed(2)}s)`, 24, 34);

      ctxW.fillStyle = '#FF4D12';
      const splitRefTag = isRefLive ? `▼ EXAMPLE REF: ${scB} (${tB.toFixed(2)}s)` : `▼ EXAMPLE REF (FALLBACK): ${scB}`;
      const tagW = ctxW.measureText(splitRefTag).width;
      ctxW.fillText(splitRefTag, W - tagW - 24, H - 24);

      return {
        sideUrl: cvSide.toDataURL('image/png'),
        splitUrl: cvSplit.toDataURL('image/png'),
      };
    },
    {
      b64A: activeBase64,
      b64B: refBase64,
      scA: activeScene,
      tA: activeT,
      scB: refScene,
      tB: refT,
      isRefLive: refAvailable,
    }
  );

  const sideData = compositeRes.sideUrl.replace(/^data:image\/png;base64,/, '');
  const splitData = compositeRes.splitUrl.replace(/^data:image\/png;base64,/, '');

  const sidePath = path.join(outDir, 'ab_side_by_side.png');
  const splitPath = path.join(outDir, 'ab_split_wipe.png');
  const jsonPath = path.join(outDir, 'compare_summary.json');
  const legacyJsonPath = path.join(outDir, 'ab_comparison.json');

  await Bun.write(sidePath, Buffer.from(sideData, 'base64'));
  await Bun.write(splitPath, Buffer.from(splitData, 'base64'));

  const summaryData = {
    active_scene: activeScene,
    active_t: activeT,
    ref_scene: refScene,
    ref_t: refT,
    resolution: [1920, 1080],
    artifacts: ['ab_side_by_side.png', 'ab_split_wipe.png'],
    status: refAvailable ? 'benchmarked' : 'reference_unavailable',
    limits: 'Visual comparison only; provides direct aesthetic reference without enforcing identical composition.',
  };

  await Bun.write(jsonPath, JSON.stringify(summaryData, null, 2));
  await Bun.write(legacyJsonPath, JSON.stringify(summaryData, null, 2));

  console.log(`[compare] Wrote side-by-side contact plate (3840x1080): ${sidePath}`);
  console.log(`[compare] Wrote 50/50 diagonal split wipe (1920x1080): ${splitPath}`);
  console.log(`[compare] Wrote comparison metadata: ${jsonPath}`);
}
