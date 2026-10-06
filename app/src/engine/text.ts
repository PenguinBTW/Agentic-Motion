// Universal Kinetic Typography Engine (KineticText)
// Declarative text layout, 3D world anchoring, character/word staggered animators,
// ink knockout halos, and direct telemetry emission bridge to window.__pdoom.textProbes.
import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { type V3 } from './camera3d';
import { clamp, ease } from './util';
import { rgba } from './palette';

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  alpha?: number;
  letterSpacing?: number | string;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
}

export type KineticTextOptions = TextStyle;

export type TextAnimationMotion = 'slide-up' | 'fade' | 'typewriter' | 'scale-pop' | 'wipe';

export interface TextStaggerOpts {
  unit: 'char' | 'word' | 'line';
  start: number;
  staggerDuration: number;
  inDuration: number;
  motion?: TextAnimationMotion;
  ease?: (u: number) => number;
}

export interface TextUnitState {
  text: string;
  x: number;
  y: number;
  width: number;
  alpha: number;
  scale: number;
  offsetY: number;
}

export interface KnockoutHaloOpts {
  strokePx: number;
  haloColor: string;
}

export class KineticText {
  private rawText: string;
  private style: Required<TextStyle>;
  private halo: KnockoutHaloOpts | null = null;

  // Layout lines and words
  private lines: string[] = [];
  private anchorPos: [number, number] = [0, 0];
  private is3DAnchored = false;
  private isVisible = true;
  private depthScale = 1.0;

  constructor(text: string, style: TextStyle = {}) {
    this.rawText = text;
    this.style = {
      fontFamily: style.fontFamily ?? 'Archivo, sans-serif',
      fontSize: style.fontSize ?? 36,
      fontWeight: style.fontWeight ?? 700,
      color: style.color ?? rgba('bone'),
      alpha: style.alpha ?? 1.0,
      letterSpacing: style.letterSpacing ?? 0,
      lineHeight: style.lineHeight ?? 1.25,
      align: style.align ?? 'left',
    };
    this.lines = text.split('\n');
  }

  get text(): string {
    return this.rawText;
  }

  setText(text: string): this {
    this.rawText = text;
    this.lines = text.split('\n');
    return this;
  }

  updateStyle(style: Partial<TextStyle>): this {
    if (style.fontFamily !== undefined) this.style.fontFamily = style.fontFamily;
    if (style.fontSize !== undefined) this.style.fontSize = style.fontSize;
    if (style.fontWeight !== undefined) this.style.fontWeight = style.fontWeight;
    if (style.color !== undefined) this.style.color = style.color;
    if (style.alpha !== undefined) this.style.alpha = style.alpha;
    if (style.letterSpacing !== undefined) this.style.letterSpacing = style.letterSpacing;
    if (style.lineHeight !== undefined) this.style.lineHeight = style.lineHeight;
    if (style.align !== undefined) this.style.align = style.align;
    return this;
  }

  getScreenBounds(x = this.anchorPos[0], y = this.anchorPos[1]): [number, number, number, number] {
    const effFontSize = this.style.fontSize * (this.is3DAnchored ? this.depthScale : 1.0);
    const lineH = effFontSize * this.style.lineHeight;
    const maxLen = this.lines.length > 0 ? Math.max(0, ...this.lines.map((l) => l.length)) : 0;
    // Include letterSpacing tracking in width (0.55 heuristic + tracking; full measureText
    // requires canvas/fonts-ready — future work, see audit).
    const ls = this.style.letterSpacing;
    const tracking = typeof ls === 'number' ? ls : (typeof ls === 'string' ? parseFloat(ls) || 0 : 0);
    const approxW = maxLen * effFontSize * 0.55 + Math.max(0, maxLen - 1) * tracking;
    const approxH = Math.max(lineH, this.lines.length * lineH);

    let minX = x;
    if (this.style.align === 'center') minX -= approxW / 2;
    if (this.style.align === 'right') minX -= approxW;
    const maxX = minX + approxW;
    const minY = y;
    const maxY = minY + approxH;
    return [minX, minY, maxX, maxY];
  }

  /**
   * Multi-line layout with maximum width wrapping, tracking, and leading.
   * Strictly preserves explicit newline characters across paragraphs.
   */
  layout(opts: { maxWidth?: number; align?: 'left' | 'center' | 'right'; tracking?: number; leading?: number } = {}): this {
    if (opts.align) this.style.align = opts.align;
    if (opts.tracking !== undefined) this.style.letterSpacing = opts.tracking;
    if (opts.leading !== undefined) this.style.lineHeight = opts.leading;

    if (!opts.maxWidth) {
      this.lines = this.rawText.split('\n');
      return this;
    }

    const paragraphs = this.rawText.split('\n');
    const wrappedLines: string[] = [];
    const _ls = this.style.letterSpacing;
    const tracking = typeof _ls === 'number' ? _ls : (typeof _ls === 'string' ? parseFloat(_ls) || 0 : 0);
    const approxCharWidth = this.style.fontSize * 0.55 + tracking;

    for (const para of paragraphs) {
      if (para.trim().length === 0) {
        wrappedLines.push('');
        continue;
      }
      const words = para.split(/\s+/);
      let currentLine = '';

      for (const w of words) {
        const testLine = currentLine.length === 0 ? w : `${currentLine} ${w}`;
        if (testLine.length * approxCharWidth > opts.maxWidth && currentLine.length > 0) {
          wrappedLines.push(currentLine);
          currentLine = w;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine.length > 0) wrappedLines.push(currentLine);
    }

    this.lines = wrappedLines;
    return this;
  }

  /**
   * 3D Spatial Anchoring & Billboarding with depth-attenuated scale.
   * Modulates visibility ephemerally without mutating style.alpha.
   */
  anchor3D(worldPos: V3, cam: THREE.Camera, opts: { billboard?: boolean; minPx?: number; maxPx?: number } = {}): this {
    const proj = ViewportSpace.worldToScreen(worldPos, cam);
    if (!proj) {
      this.is3DAnchored = false;
      this.isVisible = false;
      return this;
    }

    this.is3DAnchored = true;
    this.isVisible = true;
    this.anchorPos = [proj[0], proj[1]];

    const depthZ = Math.max(0.1, proj[2]);
    let scale = 5.0 / depthZ;
    if (opts.minPx && this.style.fontSize * scale < opts.minPx) scale = opts.minPx / this.style.fontSize;
    if (opts.maxPx && this.style.fontSize * scale > opts.maxPx) scale = opts.maxPx / this.style.fontSize;
    this.depthScale = scale;

    return this;
  }

  /**
   * Automatic Ink Knockout Halo (ensures 100% legibility against dynamic 3D geometry)
   */
  withKnockoutHalo(strokePx = 3.0, haloColor = rgba('ink', 0.95)): this {
    this.halo = { strokePx, haloColor };
    return this;
  }

  /**
   * Dynamic numerical counter roller (e.g. animated stats, metrics, percentages)
   */
  numericRoll(value: number, format?: (n: number) => string): this {
    this.rawText = format ? format(value) : value.toFixed(0);
    this.lines = [this.rawText];
    return this;
  }

  /**
   * Calculate per-unit staggered animation state at time t
   */
  stagger(t: number, opts: TextStaggerOpts): TextUnitState[] {
    const easeFn = opts.ease ?? ease.outExpo;
    const motion = opts.motion ?? 'slide-up';

    let tokens: string[] = [];
    if (opts.unit === 'line') {
      tokens = this.lines;
    } else if (opts.unit === 'word') {
      tokens = this.rawText.split(/\s+/);
    } else {
      tokens = Array.from(this.rawText);
    }

    const n = Math.max(1, tokens.length);
    const states: TextUnitState[] = [];

    for (let i = 0; i < n; i++) {
      const unitStart = opts.start + (i / Math.max(1, n - 1)) * opts.staggerDuration;
      const progress = clamp((t - unitStart) / Math.max(1e-4, opts.inDuration), 0, 1);
      const u = easeFn(progress);

      let alpha = progress > 0 ? u : 0;
      let offsetY = 0;
      let scale = 1.0;

      if (motion === 'slide-up') {
        offsetY = (1 - u) * (this.style.fontSize * 0.6);
      } else if (motion === 'typewriter') {
        alpha = t >= unitStart ? 1.0 : 0.0;
      } else if (motion === 'scale-pop') {
        scale = 0.3 + 0.7 * u;
      }

      states.push({
        text: tokens[i]!,
        x: 0,
        y: 0,
        width: 0,
        alpha,
        scale,
        offsetY,
      });
    }

    return states;
  }

  /**
   * Direct Telemetry Emission Bridge
   * Writes bounding boxes and text metrics directly to window.__pdoom.textProbes.
   * Protected against empty lines and preview memory leaks.
   */
  syncTelemetry(t: number, screenX = this.anchorPos[0], screenY = this.anchorPos[1]): void {
    if (typeof window === 'undefined') return;
    const P = (window as any).__pdoom;
    if (!P || !P.textProbes || P.recordText === false) return;

    const effFontSize = this.style.fontSize * (this.is3DAnchored ? this.depthScale : 1.0);
    const lineH = effFontSize * this.style.lineHeight;
    const maxLen = this.lines.length > 0 ? Math.max(0, ...this.lines.map((l) => l.length)) : 0;
    const approxW = maxLen * effFontSize * 0.55;
    const approxH = this.lines.length * lineH;

    let minX = screenX;
    if (this.style.align === 'center') minX -= approxW / 2;
    if (this.style.align === 'right') minX -= approxW;
    const maxX = minX + approxW;
    const minY = screenY;
    const maxY = minY + approxH;

    P.textProbes.push({
      frameIdx: P.currentFrameIdx ?? 0,
      t,
      text: this.rawText,
      fontFamily: this.style.fontFamily,
      fontPx: effFontSize,
      fillStyle: this.style.color,
      globalAlpha: this.style.alpha,
      layerId: 'kinetic_text',
      bbox: [minX, minY, maxX, maxY],
      w: approxW,
      h: approxH,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      hPct: (effFontSize / 1080) * 100,
      isStroke: false,
    });
  }

  /**
   * Render text onto a Canvas2D context (with optional halo and alignment).
   * Automatically handles probe deduplication to prevent false F04 collision flags.
   */
  render(ctx: CanvasRenderingContext2D, t: number, x = this.anchorPos[0], y = this.anchorPos[1], staggerStates?: TextUnitState[]): void {
    if (!this.isVisible || this.style.alpha <= 0.001) return;

    const effFontSize = this.style.fontSize * (this.is3DAnchored ? this.depthScale : 1.0);
    const lineH = effFontSize * this.style.lineHeight;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.font = `${this.style.fontWeight} ${effFontSize}px ${this.style.fontFamily}`;
    ctx.textAlign = this.style.align;

    if (typeof this.style.letterSpacing === 'number') {
      ctx.letterSpacing = `${this.style.letterSpacing}px`;
    } else if (this.style.letterSpacing) {
      ctx.letterSpacing = this.style.letterSpacing;
    }

    if (staggerStates && staggerStates.length > 0) {
      // Staggered Unit Rendering (NOTE: units share anchor x; per-unit advances need
      // measureText layout — future work. Scale is applied; x/width remain 0.)
      for (const st of staggerStates) {
        if (st.alpha <= 0.001) continue;
        ctx.save();
        ctx.globalAlpha *= st.alpha * this.style.alpha;
        const unitY = y + st.offsetY;
        if (st.scale !== 1.0) {
          ctx.translate(x, unitY);
          ctx.scale(st.scale, st.scale);
          ctx.translate(-x, -unitY);
        }

        if (this.halo) {
          ctx.strokeStyle = this.halo.haloColor;
          ctx.lineWidth = this.halo.strokePx * 2;
          ctx.lineJoin = 'round';
          ctx.strokeText(st.text, x, unitY);
        }

        ctx.fillStyle = this.style.color;
        ctx.fillText(st.text, x, unitY);
        ctx.restore();
      }
    } else {
      // Standard Multi-line Rendering
      // 1. Draw Knockout Halo Under-stroke (if enabled)
      if (this.halo) {
        ctx.strokeStyle = this.halo.haloColor;
        ctx.lineWidth = this.halo.strokePx * 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let i = 0; i < this.lines.length; i++) {
          const lineY = y + i * lineH;
          ctx.strokeText(this.lines[i]!, x, lineY);
        }
      }

      // 2. Draw Primary Text Fill
      ctx.fillStyle = this.style.color;
      ctx.globalAlpha *= this.style.alpha;
      for (let i = 0; i < this.lines.length; i++) {
        const lineY = y + i * lineH;
        ctx.fillText(this.lines[i]!, x, lineY);
      }
    }

    ctx.restore();

    // Only emit direct telemetry if Canvas2D text probe hook is NOT active
    // This prevents double-counting and eliminates false F04 typographic collisions.
    const P = typeof window !== 'undefined' ? (window as any).__pdoom : null;
    const hookActive = typeof window !== 'undefined' && Boolean((window as any).__textHookActive || (window as any).__pdoom_hookActive);
    if (P?.probe && P.recordText !== false && !hookActive) {
      this.syncTelemetry(t, x, y);
    }
  }
}
