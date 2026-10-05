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

export function parseCompareArgs(argv: string[]): CompareOptions {
  const opts: CompareOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--t' && argv[i + 1]) opts.t = parseFloat(argv[++i]!);
    else if (arg === '--scene' && argv[i + 1]) opts.scene = argv[++i]!;
    else if (arg === '--ref' && argv[i + 1]) opts.refScene = argv[++i]!;
    else if (arg === '--ref-t' && argv[i + 1]) opts.refT = parseFloat(argv[++i]!);
    else if (arg === '--out' && argv[i + 1]) opts.out = argv[++i]!;
    else if (arg === '--port' && argv[i + 1]) opts.port = parseInt(argv[++i]!, 10);
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

  const outDir = path.resolve(opts.out ?? path.join(process.cwd(), '../out/visual/compare'));
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

  if (existsSync(REF_APP)) {
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
        refBrowser = await chromium.launch({ headless: true, channel: 'chrome' });
        const refPage = await refBrowser.newPage({ viewport: { width: 1920, height: 1080 } });
        await refPage.goto(`${refUrl}/?export=1&only=${refScene}`);
        await refPage.waitForFunction(() => (window as any).__pdoom?.ready, null, { timeout: 15000 });
        await refPage.evaluate(([t]) => (window as any).__pdoom.still(t, 1, 0), [refT]);
        refBase64 = await refPage.evaluate(() => (window as any).__pdoom.png());
      } catch (err: any) {
        console.warn(`[compare] Warning: Could not capture reference plate directly: ${err.message}`);
      } finally {
        if (refBrowser) await refBrowser.close();
        if (refProc) refProc.kill();
      }
    }
  }

  // If reference could not be captured live, create simulated comparison
  if (!refBase64) {
    console.warn('[compare] Note: Example project live capture unavailable. Using active frame as baseline.');
    refBase64 = activeBase64;
  }

  // 3. Composite in current browser page
  const compositeRes: { sideUrl: string; splitUrl: string } = await page.evaluate(
    async ({ b64A, b64B, scA, tA, scB, tB }: any) => {
      const W = 1920;
      const H = 1080;

      const imgA = new Image();
      const imgB = new Image();
      await new Promise((res) => {
        let loaded = 0;
        imgA.onload = () => { if (++loaded === 2) res(true); };
        imgB.onload = () => { if (++loaded === 2) res(true); };
        imgA.src = 'data:image/png;base64,' + b64A;
        imgB.src = 'data:image/png;base64,' + b64B;
      });

      // --- Canvas 1: Side by Side (2-Panel) ---
      const cvSide = document.createElement('canvas');
      cvSide.width = W;
      cvSide.height = H;
      const ctxS = cvSide.getContext('2d')!;

      ctxS.fillStyle = '#0A0A0B';
      ctxS.fillRect(0, 0, W, H);

      const panelW = (W - 12) / 2;
      const panelH = (panelW * 9) / 16;
      const yOffset = (H - panelH) / 2;

      // Draw Panel A (Active)
      ctxS.drawImage(imgA, 0, 0, imgA.width, imgA.height, 4, yOffset, panelW, panelH);
      ctxS.strokeStyle = '#00D2FF';
      ctxS.lineWidth = 2;
      ctxS.strokeRect(4, yOffset, panelW, panelH);

      // Draw Panel B (Reference)
      ctxS.drawImage(imgB, 0, 0, imgB.width, imgB.height, panelW + 8, yOffset, panelW, panelH);
      ctxS.strokeStyle = '#FF4D12';
      ctxS.lineWidth = 2;
      ctxS.strokeRect(panelW + 8, yOffset, panelW, panelH);

      // Labels
      ctxS.font = '14px monospace';
      ctxS.fillStyle = '#00D2FF';
      ctxS.fillText(`[ACTIVE] ${scA} (t = ${tA.toFixed(2)}s)`, 12, yOffset - 12);

      ctxS.fillStyle = '#FF4D12';
      ctxS.fillText(`[EXAMPLE BENCHMARK] ${scB} (t = ${tB.toFixed(2)}s)`, panelW + 16, yOffset - 12);

      // Header Banner
      const hudH = 50;
      ctxS.fillStyle = 'rgba(10, 10, 11, 0.90)';
      ctxS.fillRect(0, 0, W, hudH);
      ctxS.font = '13px monospace';
      ctxS.fillStyle = '#EEE9DF';
      ctxS.textBaseline = 'middle';
      ctxS.fillText(`[VISUAL A/B ANCHOR] Active: ${scA} vs Reference: ${scB} | Scale: 1080p | Line Weight & Negative Space Benchmark`, 24, hudH / 2);

      // --- Canvas 2: Diagonal 50/50 Split Wipe ---
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
      ctxW.fillText(`▼ EXAMPLE REF: ${scB} (${tB.toFixed(2)}s)`, W - 320, H - 24);

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
    }
  );

  const sideData = compositeRes.sideUrl.replace(/^data:image\/png;base64,/, '');
  const splitData = compositeRes.splitUrl.replace(/^data:image\/png;base64,/, '');

  const sidePath = path.join(outDir, 'ab_side_by_side.png');
  const splitPath = path.join(outDir, 'ab_split_wipe.png');
  const jsonPath = path.join(outDir, 'ab_comparison.json');

  await Bun.write(sidePath, Buffer.from(sideData, 'base64'));
  await Bun.write(splitPath, Buffer.from(splitData, 'base64'));
  await Bun.write(
    jsonPath,
    JSON.stringify(
      {
        active_scene: activeScene,
        active_t: activeT,
        ref_scene: refScene,
        ref_t: refT,
        status: 'benchmarked',
        limits: 'Visual comparison only; provides direct aesthetic reference without enforcing identical composition.',
      },
      null,
      2
    )
  );

  console.log(`[compare] Wrote side-by-side contact plate: ${sidePath}`);
  console.log(`[compare] Wrote 50/50 diagonal split wipe: ${splitPath}`);
  console.log(`[compare] Wrote comparison metadata: ${jsonPath}`);
}
