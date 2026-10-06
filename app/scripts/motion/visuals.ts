// Visual generators: timeline.png, slitscan.png, rgbtime_<label>.png, strip_<label>.png
import type { Page } from 'playwright-core';
import type { FrameMetrics, AudioEvent } from './config';
import type { CutItem } from './flags';

export async function renderTimelinePlot(
  page: Page,
  frames: FrameMetrics[],
  cuts: CutItem[],
  audioEvents: AudioEvent[],
  windowFrom: number,
  windowTo: number
): Promise<string> {
  return await page.evaluate(
    ({ frames, cuts, audioEvents, windowFrom, windowTo }) => {
      const W = 1920, H = 1080;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;

      // Background
      ctx.fillStyle = '#0A0A0B';
      ctx.fillRect(0, 0, W, H);

      const marginL = 80, marginR = 40, marginT = 50, marginB = 50;
      const plotW = W - marginL - marginR;
      const dur = Math.max(0.001, windowTo - windowFrom);
      const timeToX = (t: number) => marginL + ((t - windowFrom) / dur) * plotW;

      // 6 stacked subplots:
      // 1. Motion Energy E (0 to max(0.2, maxE))
      // 2. Luma & Contrast (0 to 1.0)
      // 3. Signal% & Bright non-signal% (0 to max(5, maxSignal))
      // 4. Edge Density (0 to max(0.15, maxEdge))
      // 5. Max Text Height % (0 to max(15, maxTextH))
      // 6. Frame ms & spp (0 to max(30, maxMs))
      const panels = [
        { name: 'Motion Energy E', unit: '', max: Math.max(0.15, ...frames.map((f) => Math.max(f.E, f.E_p95))) * 1.15 },
        { name: 'Luma / Contrast', unit: '', max: 1.0 },
        { name: 'Signal% / Bright%', unit: '%', max: Math.max(5.0, ...frames.map((f) => Math.max(f.signal_pct, f.bright_nonsignal_pct))) * 1.2 },
        { name: 'Edge Density', unit: '', max: Math.max(0.10, ...frames.map((f) => f.edge_density)) * 1.2 },
        { name: 'Max Text h%', unit: '%', max: 20.0 },
        { name: 'Perf (ms)', unit: 'ms', max: Math.max(30.0, ...frames.map((f) => f.ms)) * 1.15 },
      ];

      const numPanels = panels.length;
      const totalPlotH = H - marginT - marginB;
      const panelGap = 12;
      const panelH = (totalPlotH - (numPanels - 1) * panelGap) / numPanels;

      // Draw vertical guidelines: downbeats (grey) and cuts (white)
      for (const ev of audioEvents) {
        if (ev.type === 'downbeat' && ev.t >= windowFrom && ev.t <= windowTo) {
          const x = timeToX(ev.t);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, marginT);
          ctx.lineTo(x, H - marginB);
          ctx.stroke();
        }
      }

      for (const c of cuts) {
        if (c.t >= windowFrom && c.t <= windowTo) {
          const x = timeToX(c.t);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x, marginT - 15);
          ctx.lineTo(x, H - marginB);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`CUT ${c.t.toFixed(2)}s`, x + 3, marginT - 4);
        }
      }

      // Draw word start annotations along top
      for (const ev of audioEvents) {
        if (ev.type === 'word' && ev.t >= windowFrom && ev.t <= windowTo && ev.word) {
          const x = timeToX(ev.t);
          ctx.fillStyle = '#FF4D12';
          ctx.fillRect(x - 1, marginT - 20, 2, 8);
          ctx.fillStyle = '#EEE9DF';
          ctx.font = '10px monospace';
          ctx.save();
          ctx.translate(x + 2, marginT - 22);
          ctx.rotate(-Math.PI / 4);
          ctx.fillText(ev.word, 0, 0);
          ctx.restore();
        }
      }

      // Draw panels
      for (let pIdx = 0; pIdx < numPanels; pIdx++) {
        const p = panels[pIdx]!;
        const yTop = marginT + pIdx * (panelH + panelGap);
        const yBottom = yTop + panelH;

        // Background & border
        ctx.fillStyle = '#141416';
        ctx.fillRect(marginL, yTop, plotW, panelH);
        ctx.strokeStyle = '#2A2A2E';
        ctx.lineWidth = 1;
        ctx.strokeRect(marginL, yTop, plotW, panelH);

        // Label
        ctx.fillStyle = '#A0A0A8';
        ctx.font = '11px monospace';
        ctx.fillText(p.name, 10, yTop + 14);
        ctx.fillText(`${p.max.toFixed(2)}${p.unit}`, marginL - 45, yTop + 12);
        ctx.fillText(`0${p.unit}`, marginL - 25, yBottom);

        const valToY = (v: number) => yBottom - (Math.max(0, Math.min(v, p.max)) / p.max) * panelH;

        // Series plotting
        if (pIdx === 0) {
          // E (orange) and E_p95 (signal-lite)
          ctx.strokeStyle = '#FF4D12';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.E);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();

          ctx.strokeStyle = '#F9845A';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.E_p95);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (pIdx === 1) {
          // Luma (bone) & Contrast (signal-lite)
          ctx.strokeStyle = '#EEE9DF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.luma);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();

          ctx.strokeStyle = '#707078';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.contrast);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (pIdx === 2) {
          // Signal% (orange) & Bright non-signal% (bone)
          ctx.strokeStyle = '#FF4D12';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.signal_pct);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();

          ctx.strokeStyle = '#EEE9DF';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.bright_nonsignal_pct);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (pIdx === 3) {
          // Edge density
          ctx.strokeStyle = '#EEE9DF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.edge_density);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (pIdx === 4) {
          // Max text h%
          ctx.strokeStyle = '#F9845A';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          frames.forEach((f, i) => {
            // max text height in frame
            const h = (f as any).max_text_h ?? 0;
            const x = timeToX(f.t), y = valToY(h);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (pIdx === 5) {
          // Render time ms (bone line) & 25ms threshold line (red)
          const y25 = valToY(25);
          ctx.strokeStyle = 'rgba(255, 77, 18, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(marginL, y25);
          ctx.lineTo(marginL + plotW, y25);
          ctx.stroke();

          ctx.strokeStyle = '#EEE9DF';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          frames.forEach((f, i) => {
            const x = timeToX(f.t), y = valToY(f.ms);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
      }

      // Kick ticks along bottom
      const botY = H - marginB;
      for (const ev of audioEvents) {
        if (ev.type === 'kick' && ev.t >= windowFrom && ev.t <= windowTo) {
          const x = timeToX(ev.t);
          const tickH = Math.min(25, (ev.strength ?? 0.5) * 25);
          ctx.strokeStyle = '#FF4D12';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, botY);
          ctx.lineTo(x, botY - tickH);
          ctx.stroke();
        }
      }

      // X-axis time markings
      ctx.fillStyle = '#A0A0A8';
      ctx.font = '11px monospace';
      const step = dur > 10 ? 2.0 : 1.0;
      for (let t = Math.ceil(windowFrom); t <= windowTo; t += step) {
        const x = timeToX(t);
        ctx.fillText(`${t.toFixed(1)}s`, x - 12, botY + 18);
      }

      return cv.toDataURL('image/png');
    },
    { frames, cuts, audioEvents, windowFrom, windowTo }
  );
}

export async function renderSlitscan(
  page: Page,
  centerColumns: Uint8Array[], // array of 270x4 RGBA bytes per frame
  frameCount: number
): Promise<string> {
  // Wrap every 480 frames -> 480 * 4 = 1920 px width
  const colsPerRow = 480;
  const numRows = Math.ceil(frameCount / colsPerRow);
  const W = 1920, H = numRows * 270;

  // Flatten buffers to base64 chunks or transfer
  return await page.evaluate(
    ({ frameCount, colsPerRow, numRows, W, H, colDataList }) => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < frameCount; i++) {
        const r = Math.floor(i / colsPerRow);
        const c = i % colsPerRow;
        const x0 = c * 4;
        const y0 = r * 270;
        const raw = atob(colDataList[i]!);

        const img = ctx.createImageData(4, 270);
        for (let y = 0; y < 270; y++) {
          const rVal = raw.charCodeAt(y * 4);
          const gVal = raw.charCodeAt(y * 4 + 1);
          const bVal = raw.charCodeAt(y * 4 + 2);
          for (let dx = 0; dx < 4; dx++) {
            const outIdx = (y * 4 + dx) * 4;
            img.data[outIdx] = rVal;
            img.data[outIdx + 1] = gVal;
            img.data[outIdx + 2] = bVal;
            img.data[outIdx + 3] = 255;
          }
        }
        ctx.putImageData(img, x0, y0);
      }
      return cv.toDataURL('image/png');
    },
    {
      frameCount,
      colsPerRow,
      numRows,
      W,
      H,
      colDataList: centerColumns.map((col) => Buffer.from(col).toString('base64')),
    }
  );
}

export async function renderRgbTimeComposite(
  page: Page,
  lumaPrev: Float32Array,
  lumaCur: Float32Array,
  lumaNext: Float32Array,
  w = 480,
  h = 270
): Promise<string> {
  const n = w * h;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const idx = i * 4;
    rgba[idx] = Math.round(Math.min(1, Math.max(0, lumaPrev[i]!)) * 255);
    rgba[idx + 1] = Math.round(Math.min(1, Math.max(0, lumaCur[i]!)) * 255);
    rgba[idx + 2] = Math.round(Math.min(1, Math.max(0, lumaNext[i]!)) * 255);
    rgba[idx + 3] = 255;
  }

  const b64 = Buffer.from(rgba).toString('base64');

  return await page.evaluate(
    ({ b64, w, h }) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d')!;
      const raw = atob(b64);
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < raw.length; i++) img.data[i] = raw.charCodeAt(i);
      ctx.putImageData(img, 0, 0);
      return cv.toDataURL('image/png');
    },
    { b64, w, h }
  );
}

export async function renderEventStrip(
  page: Page,
  eventT: number,
  offsets: number[],
  frames: FrameMetrics[],
  windowFrom: number,
  windowTo: number
): Promise<string> {
  const tileTimes = offsets.map((dt) => Math.max(windowFrom, Math.min(windowTo, eventT + dt)));

  // Lookup nearest E and luma metrics for caption
  const tileCaptions = tileTimes.map((t) => {
    let best = frames[0]!;
    let minD = Infinity;
    for (const f of frames) {
      const d = Math.abs(f.t - t);
      if (d < minD) { minD = d; best = f; }
    }
    return { t, E: best.E, luma: best.luma };
  });

  return await page.evaluate(
    async ({ tileCaptions }) => {
      const P = (window as any).__pdoom;
      const tw = 480, th = 270, capH = 24, pad = 6;
      const cols = tileCaptions.length;
      const cv = document.createElement('canvas');
      cv.width = cols * (tw + pad) + pad;
      cv.height = th + capH + pad * 2;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#141416';
      ctx.fillRect(0, 0, cv.width, cv.height);

      const src = document.getElementById('c') as HTMLCanvasElement;
      for (let i = 0; i < cols; i++) {
        const item = tileCaptions[i]!;
        await P.still(item.t, 1, 0);
        const x = pad + i * (tw + pad), y = pad;
        ctx.drawImage(src, x, y, tw, th);
        ctx.fillStyle = '#0A0A0B';
        ctx.fillRect(x, y + th, tw, capH);
        ctx.fillStyle = '#EEE9DF';
        ctx.font = '12px monospace';
        ctx.fillText(`t=${item.t.toFixed(2)}s  E=${item.E.toFixed(4)}  luma=${item.luma.toFixed(2)}`, x + 8, y + th + 16);
      }
      return cv.toDataURL('image/png');
    },
    { tileCaptions }
  );
}
