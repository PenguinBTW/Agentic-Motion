// Declarative Scene Authoring DSL & Strict Lifecycle (defineScene, SceneContext)
// Protects autonomous coding agents from boilerplate errors by automating:
// 1. Primitive instantiation and registration in SceneGraph
// 2. Zero-annotation telemetry synchronization to window.__motion.textProbes (and __pdoom alias)
// 3. Batched GPU drawing with automatic renderer.resetState() cleanup
// 4. Strict font readiness gating (document.fonts.ready)
import * as THREE from 'three';
import { Scene, type SceneCtx, type Frame, type PostOverrides, type SceneClass } from './scene';
import { CameraRig, type CameraMode } from './rig';
import { SceneGraph, type EntityRole, type EntityMetadata } from './scenegraph';
import { CompositorGraph } from './graph';
import { SDFBatch, type SDFRectOpts } from './sdf';
import { KineticText, type KineticTextOptions } from './text';
import { LineBatch } from './lines';
import { AnalyticalParticles, type ParticleEmitterOpts } from './particles';
import { LayoutNode, TransformNode } from './transform';
import { motion, MotionBus } from './motion';
import { Layer2D, W, H } from './gl';
import { getDesignTokens, type DesignTokens } from './tokens';
import { LIN, rgba } from './palette';

export interface SceneContextOptions {
  rigMode?: CameraMode;
  particleCapacity?: number;
  lineCapacity?: number;
  sdfCapacity?: number;
}

export class SceneContext {
  readonly sceneCtx: SceneCtx;
  readonly sceneGraph: SceneGraph;
  readonly compositor: CompositorGraph;
  readonly rig: CameraRig;
  readonly threeCam: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly particles: AnalyticalParticles;
  readonly sdf: SDFBatch;
  readonly lines: LineBatch;
  readonly layer2d: Layer2D;
  readonly motion: MotionBus = motion;

  // Cached typography nodes
  private textNodes = new Map<string, KineticText>();
  // Cached layout nodes
  private layoutNodes = new Map<string, LayoutNode>();

  // Current frame state during render pass
  currentFrame: Frame | null = null;

  constructor(sceneCtx: SceneCtx, opts?: SceneContextOptions) {
    this.sceneCtx = sceneCtx;
    this.sceneGraph = new SceneGraph();
    this.compositor = new CompositorGraph();

    const rigMode = opts?.rigMode ?? 'perspective';
    this.rig = new CameraRig(rigMode);

    if (rigMode === 'perspective') {
      this.threeCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
    } else {
      this.threeCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 2000);
    }

    this.particles = new AnalyticalParticles(opts?.particleCapacity ?? 1024);
    this.lines = new LineBatch(opts?.lineCapacity ?? 2048, { screen2D: false, blend: 'normal' });
    this.sdf = new SDFBatch(opts?.sdfCapacity ?? 2048);
    this.layer2d = new Layer2D();
  }

  get renderer(): THREE.WebGLRenderer {
    return this.sceneCtx.renderer;
  }

  get W(): number {
    return this.sceneCtx.W ?? W;
  }

  get H(): number {
    return this.sceneCtx.H ?? H;
  }

  get tokens(): DesignTokens {
    return getDesignTokens();
  }

  get lin(): typeof LIN {
    return LIN;
  }

  rgba(nameOrHex: string, a = 1): string {
    return rgba(nameOrHex, a);
  }

  /**
   * Declare or retrieve a KineticText node, automatically registering into SceneGraph
   */
  text(id: string, content: string, opts?: KineticTextOptions & { role?: EntityRole }): KineticText {
    let kt = this.textNodes.get(id);
    if (!kt) {
      kt = new KineticText(content, opts);
      this.textNodes.set(id, kt);

      this.sceneGraph.register({
        id,
        type: 'text',
        role: opts?.role ?? 'headline',
        opacity: opts?.alpha ?? 1.0,
        text: content,
        fontPx: opts?.fontSize ?? 36,
        fontFamily: opts?.fontFamily ?? 'Archivo, sans-serif',
        fillStyle: opts?.color ?? '#FFFFFF',
      });
    } else {
      if (opts) kt.updateStyle(opts);
      if (kt.text !== content) kt.setText(content);
      const meta = this.sceneGraph.get(id);
      if (meta) {
        meta.text = content;
        if (opts?.fontSize) meta.fontPx = opts.fontSize;
        if (opts?.fontFamily) meta.fontFamily = opts.fontFamily;
        if (opts?.color) meta.fillStyle = opts.color;
        if (opts?.alpha !== undefined) meta.opacity = opts.alpha;
      }
    }
    return kt;
  }

  /**
   * Render text node onto canvas and synchronize exact 2D screen bounds to SceneGraph
   */
  renderText(id: string, c2d: CanvasRenderingContext2D, t: number, x: number, y: number, staggerStates?: any[]): void {
    const kt = this.textNodes.get(id);
    if (!kt) return;
    kt.render(c2d, t, x, y, staggerStates);
    const bounds = kt.getScreenBounds(x, y);
    const meta = this.sceneGraph.get(id);
    if (meta) {
      meta.screenBounds = bounds;
    }
  }

  /**
   * Declare or retrieve a responsive LayoutNode
   */
  node(id: string, opts?: { role?: EntityRole; size?: [number, number, number] }): LayoutNode {
    let n = this.layoutNodes.get(id);
    if (!n) {
      n = new LayoutNode(id);
      if (opts?.size) n.size = opts.size;
      this.layoutNodes.set(id, n);

      this.sceneGraph.register({
        id,
        type: 'vector',
        role: opts?.role ?? 'callout',
        node: n,
        opacity: 1.0,
      });
    }
    return n;
  }

  /**
   * Draw an analytic rounded rectangle via SDFBatch with automatic SceneGraph bounds registration
   */
  card(id: string, opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    radius?: number | [number, number, number, number];
    fill?: [number, number, number, number];
    stroke?: [number, number, number, number];
    strokeWidth?: number;
    shadow?: { blur?: number; color?: [number, number, number, number]; offset?: [number, number] };
    role?: EntityRole;
    opacity?: number;
  }): void {
    const opacity = opts.opacity ?? 1.0;
    if (opacity <= 0.001) {
      const meta = this.sceneGraph.get(id);
      if (meta) meta.opacity = 0;
      return;
    }

    if (opts.shadow) {
      const sBlur = opts.shadow.blur ?? 16;
      const sCol = opts.shadow.color ?? [0, 0, 0, 0.4 * opacity];
      const sOff = opts.shadow.offset ?? [0, 6];
      this.sdf.shadow(opts.x, opts.y, opts.w, opts.h, sBlur, sCol, sOff);
    }

    const rectOpts: SDFRectOpts = {
      radius: opts.radius,
      fill: opts.fill ? [opts.fill[0], opts.fill[1], opts.fill[2], opts.fill[3] * opacity] : undefined,
      stroke: opts.stroke ? [opts.stroke[0], opts.stroke[1], opts.stroke[2], opts.stroke[3] * opacity] : undefined,
      strokeWidth: opts.strokeWidth,
    };

    this.sdf.rect(opts.x, opts.y, opts.w, opts.h, rectOpts);

    // Update screen bounds in SceneGraph
    let meta = this.sceneGraph.get(id);
    if (!meta) {
      meta = {
        id,
        type: 'vector',
        role: opts.role ?? 'callout',
        screenBounds: [opts.x, opts.y, opts.x + opts.w, opts.y + opts.h],
        opacity,
      };
      this.sceneGraph.register(meta);
    } else {
      meta.screenBounds = [opts.x, opts.y, opts.x + opts.w, opts.y + opts.h];
      meta.opacity = opacity;
    }
  }

  /**
   * Add a circular ring with anti-aliased trim path to SDFBatch
   */
  ring(opts: {
    cx: number;
    cy: number;
    radius: number;
    thickness?: number;
    trim?: [number, number];
    color?: [number, number, number, number];
    glow?: number;
  }): void {
    this.sdf.ring(
      opts.cx,
      opts.cy,
      opts.radius,
      opts.thickness ?? 2.0,
      opts.trim ?? [0, 1],
      opts.color ?? [1, 1, 1, 1],
      opts.glow ?? 1.0,
    );
  }

  /**
   * Add a HUD crosshair reticle to SDFBatch
   */
  reticle(opts: {
    cx: number;
    cy: number;
    size?: number;
    thickness?: number;
    color?: [number, number, number, number];
  }): void {
    this.sdf.reticle(
      opts.cx,
      opts.cy,
      opts.size ?? 12,
      opts.thickness ?? 1.5,
      opts.color ?? [1, 1, 1, 1],
    );
  }

  /**
   * Synchronize camera rig to Three.js camera and update scene graph screen projections
   */
  updateCamera(t: number, progress: number): void {
    this.rig.evalPath(progress);
    const cam = this.rig.evalCam(t);
    this.rig.syncToThreeCamera(cam, this.threeCam);
    this.sceneGraph.updateScreenProjections(this.threeCam, this.W, this.H);
  }

  /**
   * Flush GPU vector batches and 2D canvas layers into out target.
   * NOTE: 2D-only (lines/sdf/layer2d). Particles are NOT flushed here —
   * use the compositor path for particles (flush needs cam+t; kept 2D-only by design).
   */
  flush(out: THREE.WebGLRenderTarget): void {
    // 1. Flush 3D lines if any were queued
    if (this.lines.count > 0) {
      this.lines.render(this.renderer, out, this.threeCam);
    }

    // 2. Flush SDF quads
    this.sdf.flush(this.renderer, out);

    // 3. Upload and composite 2D Canvas Layer
    const layerTex = this.layer2d.upload();
    this.sceneCtx.comp.draw(this.renderer, layerTex, out, { mode: 'normal', opacity: 1.0 });

    // 4. Telemetry sync
    if (this.currentFrame) {
      this.sceneGraph.syncTelemetry(this.currentFrame.t);
    }

    // Invariant: reset WebGL state cache after raw canvas/shader passes
    this.renderer.resetState();
  }

  dispose(): void {
    this.particles.dispose();
    this.lines.dispose();
    this.sdf.dispose();
    this.compositor.dispose();
    this.layer2d.texture.dispose();
    this.sceneGraph.clear();
    this.textNodes.clear();
    this.layoutNodes.clear();
  }
}

export interface DeclarativeSceneDef {
  id: string;
  duration?: number;
  rigMode?: CameraMode;
  particleCapacity?: number;
  lineCapacity?: number;
  sdfCapacity?: number;
  /** Asynchronous preloading phase (assets, textures, fonts) */
  preload?: (ctx: SceneCtx) => Promise<void>;
  /** One-time setup phase (configuring rig flight paths, particle emitters) */
  setup?: (ctx: SceneContext) => void | Promise<void>;
  /** Synchronous closed-form evaluation f(t) executed per sub-frame */
  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => PostOverrides | void;
}

/**
 * Fluent factory function that wraps a declarative scene definition into an engine SceneClass.
 */
export function defineScene(def: DeclarativeSceneDef): SceneClass {
  if (def.duration !== undefined && !(globalThis as any).__dslDurationWarned) {
    // duration is informational only — timeline.ts/driver owns `end`. Warn once so agents
    // don't silently tune a dead field (matches driver in demo but still advisory).
    console.warn(`[dsl] defineScene duration is advisory only; timeline driver owns end.`);
    (globalThis as any).__dslDurationWarned = true;
  }
  return class DeclarativeScene extends Scene {
    private sc!: SceneContext;
    private setupDone = false;

    constructor(ctx: SceneCtx) {
      super(ctx);
    }

    override async init(): Promise<void> {
      // 1. Strict font readiness gating to guarantee non-zero glyph bounds
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }

      // 2. Initialize SceneContext
      this.sc = new SceneContext(this.ctx, {
        rigMode: def.rigMode,
        particleCapacity: def.particleCapacity,
        lineCapacity: def.lineCapacity,
        sdfCapacity: def.sdfCapacity,
      });

      // 3. User preloading phase
      if (def.preload) {
        await def.preload(this.ctx);
      }

      // 4. User setup phase
      if (def.setup) {
        await def.setup(this.sc);
      }
      this.setupDone = true;
    }

    override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
      if (!this.setupDone) return;
      this.sc.currentFrame = f;

      // Closed-form evaluation
      const overrides = def.render(this.sc, f, out);

      return overrides;
    }

    override dispose(): void {
      if (this.sc) {
        this.sc.dispose();
      }
    }
  };
}
