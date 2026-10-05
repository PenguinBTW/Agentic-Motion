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
  private depthScale = 1.0;

  // Cached layout dimensions
  private totalWidth = 0;
  private totalHeight = 0;

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

  /**
   * Multi-line layout with maximum width wrapping, tracking, and leading
   */
  layout(opts: { maxWidth?: number; align?: 'left' | 'center' | 'right'; tracking?: number; leading?: number } = {}): this {
    if (opts.align) this.style.align = opts.align;
    if (opts.tracking !== undefined) this.style.letterSpacing = opts.tracking;
    if (opts.leading !== undefined) this.style.lineHeight = opts.leading;

    if (!opts.maxWidth) {
      this.lines = this.rawText.split('\n');
      return this;
    }

    // Word wrap based on approximate character widths
    const words = this.rawText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    const approxCharWidth = this.style.fontSize * 0.55;
    for (const w of words) {
      const testLine = currentLine.length === 0 ? w : `${currentLine} ${w}`;
      if (testLine.length * approxCharWidth > opts.maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);
    this.lines = lines;
    return this;
  }

  /**
   * 3D Spatial Anchoring & Billboarding with depth-attenuated scale
   */
  anchor3D(worldPos: V3, cam: THREE.Camera, opts: { billboard?: boolean; minPx?: number; maxPx?: number } = {}): this {
    const proj = ViewportSpace.worldToScreen(worldPos, cam);
    if (!proj) {
      this.is3DAnchored = false;
      this.style.alpha = 0;
      return this;
    }

    this.is3DAnchored = true;
    this.anchorPos = [proj[0], proj[1]];

    const depthZ = Math.max(0.1, proj[2]);
    // Standard perspective scaling: reference depth = 5.0m
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
   * Writes bounding boxes and text metrics directly to window.__pdoom.textProbes
   */
  syncTelemetry(t: number, screenX = this.anchorPos[0], screenY = this.anchorPos[1]): void {
    if (typeof window === 'undefined') return;
    const P = (window as any).__pdoom;
    if (!P || !P.textProbes || !P.recordText) return;

    const effFontSize = this.style.fontSize * (this.is3DAnchored ? this.depthScale : 1.0);
    const lineH = effFontSize * this.style.lineHeight;
    const approxW = Math.max(...this.lines.map((l) => l.length)) * effFontSize * 0.55;
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
   * Render text onto a Canvas2D context (with halo and alignment)
   */
  render(ctx: CanvasRenderingContext2D, t: number, x = this.anchorPos[0], y = this.anchorPos[1]): void {
    if (this.style.alpha <= 0.001) return;

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

    ctx.restore();

    // Synchronize telemetry for headless analyzers and visual diagnostic tools
    this.syncTelemetry(t, x, y);
  }
}
