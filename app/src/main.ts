// Entry: preview player (default) or export mode (?export=1, driven by scripts/render.ts).
import { Engine, type AdaptiveSampling } from './engine/engine';
import { PW, PH, SCALE } from './engine/gl';
import { makeTimeline } from './timeline';

const params = new URLSearchParams(location.search);
const EXPORT = params.has('export');
const ONLY = params.get('only'); // comma-separated scene ids to load (faster stills)
const FROM = params.get('t') ? parseFloat(params.get('t')!) : null;

const canvas = document.getElementById('c') as HTMLCanvasElement;
// physical size: 1920x1080 times ?scale= (the page CSS keeps showing it at 1920x1080)
canvas.width = PW;
canvas.height = PH;

const engine = new Engine(canvas, makeTimeline);

declare global {
  interface Window { __pdoom: any }
}

let TIMELINE: typeof engine.timeline = [];

async function boot() {
  const onlySet = ONLY ? new Set(ONLY.split(',')) : null;
  await engine.init(onlySet ? (e) => onlySet.has(e.id) || (Boolean(e.file) && onlySet.has(e.file!)) : undefined);
  TIMELINE = engine.timeline;
  if (EXPORT) setupExport();
  else setupPlayer();
}

// Text probe hook for Canvas2D
function installTextProbeHook() {
  const proto = CanvasRenderingContext2D.prototype;
  const origFillText = proto.fillText;
  const origStrokeText = proto.strokeText;

  function recordCall(ctx: CanvasRenderingContext2D, text: any, x: number, y: number, isStroke: boolean) {
    const P = window.__pdoom;
    if (!P?.probe || P.recordText === false) return;
    const str = String(text ?? '');
    if (!str || !str.trim()) return;

    let fontPx = 16, fontFamily = 'sans-serif';
    const mFont = /(\d+(?:\.\d+)?)px\s+["']?([^"',]+)["']?/i.exec(ctx.font);
    if (mFont) {
      fontPx = parseFloat(mFont[1]!);
      fontFamily = mFont[2]!;
    } else {
      const mSize = /(\d+(?:\.\d+)?)px/i.exec(ctx.font);
      if (mSize) fontPx = parseFloat(mSize[1]!);
    }

    const metrics = ctx.measureText(str);
    const left = metrics.actualBoundingBoxLeft ?? 0;
    const right = metrics.actualBoundingBoxRight ?? (metrics.width || fontPx * str.length * 0.6);
    const ascent = metrics.actualBoundingBoxAscent ?? (fontPx * 0.7);
    const descent = metrics.actualBoundingBoxDescent ?? (fontPx * 0.2);

    const x0 = x - left, x1 = x + right;
    const y0 = y - ascent, y1 = y + descent;

    const m = ctx.getTransform();
    const div = (ctx as any)._isScaled ? 1 : (P.scale || 1);
    const a = m.a / div, b = m.b / div, c = m.c / div, d = m.d / div, e = m.e / div, f = m.f / div;

    const pts = [
      [a * x0 + c * y0 + e, b * x0 + d * y0 + f],
      [a * x1 + c * y0 + e, b * x1 + d * y0 + f],
      [a * x1 + c * y1 + e, b * x1 + d * y1 + f],
      [a * x0 + c * y1 + e, b * x0 + d * y1 + f],
    ];
    const minX = Math.min(pts[0]![0]!, pts[1]![0]!, pts[2]![0]!, pts[3]![0]!);
    const maxX = Math.max(pts[0]![0]!, pts[1]![0]!, pts[2]![0]!, pts[3]![0]!);
    const minY = Math.min(pts[0]![1]!, pts[1]![1]!, pts[2]![1]!, pts[3]![1]!);
    const maxY = Math.max(pts[0]![1]!, pts[1]![1]!, pts[2]![1]!, pts[3]![1]!);

    const capHeight = ascent * Math.hypot(c, d);
    const hPct = (capHeight / 1080) * 100;
    const layerId = (ctx as any)._layerId || (ctx.canvas as any)?._layerId || ctx.canvas?.id || 'layer2d';

    P.textProbes.push({
      frameIdx: P.currentFrameIdx ?? 0,
      t: P.currentTime ?? 0,
      text: str,
      fontFamily,
      fontPx,
      fillStyle: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#ffffff',
      globalAlpha: ctx.globalAlpha,
      layerId,
      bbox: [minX, minY, maxX, maxY],
      w: maxX - minX,
      h: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      hPct,
      isStroke,
    });
  }

  proto.fillText = function (this: CanvasRenderingContext2D, text: any, x: number, y: number, maxWidth?: number) {
    origFillText.call(this, text, x, y, ...(maxWidth !== undefined ? [maxWidth] : []));
    recordCall(this, text, x, y, false);
  };

  proto.strokeText = function (this: CanvasRenderingContext2D, text: any, x: number, y: number, maxWidth?: number) {
    origStrokeText.call(this, text, x, y, ...(maxWidth !== undefined ? [maxWidth] : []));
    recordCall(this, text, x, y, true);
  };
}
installTextProbeHook();
if (typeof window !== 'undefined') (window as any).__textHookActive = true;

// ------------------------------------------------------------------ export API
function setupExport() {
  document.body.classList.add('export');
  window.__pdoom = {
    engine,
    duration: engine.duration,
    errors: engine.errors,
    /** Output size in px (1920x1080 times scale); stream() sends frames of width*height*4 bytes. */
    scale: SCALE,
    width: PW,
    height: PH,
    probe: false,
    recordText: true,
    textProbes: [] as any[],
    currentFrameIdx: 0,
    currentTime: 0,
    timeline: TIMELINE.map(({ id, start, end }) => ({ id, start, end })),
    /** Render a single frame at t (seeks as needed). */
    still(t: number, samples: number | AdaptiveSampling = 1, shutter = 0.5) { return engine.render(t, 1 / 60, true, samples, shutter); },
    /** The last rendered frame as a full-resolution (PW x PH) PNG, base64 (for stills at scale > 1). */
    async png() {
      const px = await engine.readPixelsAsync(), row = PW * 4;
      const img = new ImageData(PW, PH);
      for (let y = 0; y < PH; y++) img.data.set(px.subarray((PH - 1 - y) * row, (PH - y) * row), y * row); // bottom-up -> top-down
      const oc = new OffscreenCanvas(PW, PH);
      oc.getContext('2d')!.putImageData(img, 0, 0);
      const b = new Uint8Array(await (await oc.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    },
    /**
     * Render [from, to) at fps and stream raw RGBA frames (bottom-up) over a WebSocket.
     * Returns when all frames were sent, with a histogram of sub-frames per frame. With `inflight`, the
     * receiver acknowledges each frame it has handed on (a text message with its running count) and at
     * most `inflight` frames are unacknowledged:
     * backpressure from the encoder, so a slow encode (4K) cannot pile frames up in the receiver's memory.
     */
    async stream(opts: { from: number; to: number; fps: number; ws: string; samples?: number | AdaptiveSampling; shutter?: number; inflight?: number; probe?: boolean }) {
      window.__pdoom.probe = false;
      const ws = new WebSocket(opts.ws);
      ws.binaryType = 'arraybuffer';
      let acked = 0;
      ws.onmessage = (e) => { if (typeof e.data === 'string') acked = Math.max(acked, +e.data || 0); };
      await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(e); });
      const dt = 1 / opts.fps;
      const n0 = Math.round(opts.from * opts.fps), n1 = Math.round(opts.to * opts.fps);
      const buf = new Uint8Array(PW * PH * 4);
      // warm-up: render one frame before the range so the first frame is sequential for stateful scenes
      const S = opts.samples ?? 1, SH = opts.shutter ?? 0.5;
      // (adaptive sampling only runs stateless scenes: one sample is enough for the warm-up)
      if (n0 > 0) engine.render((n0 - 1) * dt, dt, false, typeof S === 'number' ? S : 1, SH);
      if (opts.probe) {
        window.__pdoom.probe = true;
        window.__pdoom.textProbes = [];
      }
      const used: Record<number, number> = {}; // sub-frames per frame -> frames
      const frameMeta: any[] = [];
      for (let n = n0; n < n1; n++) {
        const frameIdx = n - n0;
        const curT = n * dt;
        window.__pdoom.currentFrameIdx = frameIdx;
        window.__pdoom.currentTime = curT;
        const a = performance.now();
        const k = engine.render(curT, dt, false, S, SH);
        used[k] = (used[k] ?? 0) + 1;
        await engine.readPixelsAsync(buf);
        const ms = performance.now() - a;
        if (opts.probe) {
          frameMeta.push({
            n: frameIdx,
            t: curT,
            ms,
            spp: k,
            segs: (engine as any).lastSegs ?? 0,
            sceneProbe: (engine as any).lastSceneProbe ?? null,
          });
        }
        if (opts.inflight) while (n - n0 - acked >= opts.inflight) await new Promise((r) => setTimeout(r, 2));
        while (ws.bufferedAmount > 64 * 1024 * 1024) await new Promise((r) => setTimeout(r, 2));
        ws.send(buf);
        if (n % 30 === 0) await new Promise((r) => setTimeout(r, 0)); // let the socket flush
      }
      while (ws.bufferedAmount > 0) await new Promise((r) => setTimeout(r, 5));
      ws.close();
      if (opts.probe) {
        return { used, frameMeta, textProbes: window.__pdoom.textProbes };
      }
      return used;
    },
  };
  window.__pdoom.ready = true;
}

// ------------------------------------------------------------------ preview player
function setupPlayer() {
  const audio = new Audio('audio/pdoom.mp3');
  audio.preload = 'auto';
  const ui = document.getElementById('ui')!;
  const scrub = document.getElementById('scrub') as HTMLInputElement;
  const info = document.getElementById('info')!;
  const marks = document.getElementById('marks')!;
  const errs = document.getElementById('errs')!;
  scrub.max = String(engine.duration);
  scrub.step = '0.001';
  if (engine.errors.length) { errs.textContent = engine.errors.join('\n\n'); errs.style.display = 'block'; }

  for (const e of TIMELINE) {
    const m = document.createElement('div');
    m.className = 'mark';
    m.style.left = `${(e.start / engine.duration) * 100}%`;
    m.style.width = `${((e.end - e.start) / engine.duration) * 100}%`;
    m.title = `${e.id} ${e.start.toFixed(2)}–${e.end.toFixed(2)}`;
    m.textContent = e.id;
    m.onclick = () => seek(e.start);
    marks.appendChild(m);
  }

  let t = FROM ?? 0;
  let playing = false;
  let loop: [number, number] | null = null;
  let lastAudioT = 0, lastPerf = performance.now();
  let audioAvailable = false;
  audio.addEventListener('canplaythrough', () => { audioAvailable = true; });
  audio.addEventListener('error', () => { audioAvailable = false; });

  const seek = (x: number) => {
    t = Math.max(0, Math.min(engine.duration - 0.001, x));
    lastPerf = performance.now();
    if (audioAvailable && !audio.error) audio.currentTime = t;
  };
  seek(t);

  const toggle = () => {
    playing = !playing;
    lastPerf = performance.now();
    if (playing) {
      if (audioAvailable && !audio.error) {
        audio.currentTime = t;
        audio.play().catch(() => { audioAvailable = false; });
      }
    } else {
      if (audioAvailable && !audio.error) audio.pause();
    }
  };
  canvas.onclick = toggle;
  scrub.oninput = () => seek(parseFloat(scrub.value));
  window.addEventListener('keydown', (ev) => {
    if (ev.key === ' ') { ev.preventDefault(); toggle(); }
    if (ev.key === 'ArrowRight') seek(t + (ev.shiftKey ? 5 : 1));
    if (ev.key === 'ArrowLeft') seek(t - (ev.shiftKey ? 5 : 1));
    if (ev.key === '.') seek(t + 1 / 60);
    if (ev.key === ',') seek(t - 1 / 60);
    if (ev.key === 'l') {
      const e = TIMELINE.find((x) => t >= x.start && t < x.end);
      loop = loop ? null : e ? [e.start, e.end] : null;
    }
    if (ev.key === 'h') ui.classList.toggle('hidden');
    if (ev.key === ']') { const e = TIMELINE.find((x) => x.start > t + 0.01); if (e) seek(e.start); }
    if (ev.key === '[') { const es = TIMELINE.filter((x) => x.start < t - 0.3); const e = es[es.length - 1]; if (e) seek(e.start); }
  });

  let frames = 0, fpsT = performance.now(), fps = 0;
  const tick = () => {
    if (playing) {
      const now = performance.now();
      if (audioAvailable && !audio.error && !audio.paused) {
        if (audio.currentTime !== lastAudioT) { lastAudioT = audio.currentTime; lastPerf = now; }
        t = lastAudioT + (now - lastPerf) / 1000;
        if (audio.ended) playing = false;
      } else {
        const dt = (now - lastPerf) / 1000;
        lastPerf = now;
        t += dt;
        if (t >= engine.duration) {
          if (loop) seek(loop[0]);
          else { t = engine.duration; playing = false; }
        }
      }
      if (loop && t >= loop[1]) seek(loop[0]);
    }
    engine.render(t, 1 / 60);
    scrub.value = String(t);
    frames++;
    const now = performance.now();
    if (now - fpsT > 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
    const e = TIMELINE.find((x) => t >= x.start && t < x.end);
    const l = engine.lyrics.lineAt(t);
    info.textContent = `${t.toFixed(2)}s  beat ${engine.audio.beatAt(t).toFixed(2)}  bar ${engine.audio.barAt(t).toFixed(2)}  [${e?.id ?? '—'}]  ${fps.toFixed(0)}fps   ${l ? '“' + l.text + '”' : ''}${loop ? '  LOOP' : ''}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Vite HMR: re-instantiate scenes whose module changed
  if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', (payload: any) => {
      for (const u of payload.updates ?? []) {
        const m = /scenes\/([\w-]+)\.ts/.exec(u.path ?? '');
        if (m) for (const e of TIMELINE) if (e.id === m[1] || (e as any).file === m[1]) engine.reload(e.id);
      }
    });
  }
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f55;position:fixed;top:0;left:0">${String(e?.stack ?? e)}</pre>`);
  window.__pdoom = { error: String(e?.stack ?? e) };
});
