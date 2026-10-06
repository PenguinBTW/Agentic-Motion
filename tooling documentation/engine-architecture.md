# Universal Agentic Motion Graphics Engine Architecture (v0.5.0)
**Core Engine Implementation, API Reference & Developer Guide**

**Status**: **100% IMPLEMENTED & VERIFIED** across all 4 Milestones  
**Target Audience**: Autonomous AI Coding Agents, Graphics Engineers, Motion Designers  
**Location**: [`app/src/engine/`](../app/src/engine/)  

---

## 1. Executive Overview

The **Universal Agentic Motion Graphics Engine (v0.5.0)** is a high-performance procedural animation and rendering platform designed specifically for autonomous AI coding agents and human motion designers. It decouples the engine from any single project domain, providing a universal foundation for:

* **Commercial Product Reveals & 3D Teasers** (device turntables, exploded engineering assemblies, lighting sweeps)
* **UI/UX Animation & Interaction Showcases** (app walkthroughs, sheet transitions, micro-interactions, isometric UI flows)
* **Brand Identity & Title Sequences** (logo resolves, broadcast bumpers, cinematic titles, vector monograms)
* **Data Visualization & Technical Infographics** (HUD dashboards, network topology graphs, dynamic charts)
* **Voiceover Explainer Videos & Kinetic Manifestos** (speech-timed kinetic typography, editorial statements, subtitles)
* **Audiovisual & Generative Productions** (sound-reactive art, audio-driven visualizers, procedural music videos)

---

## 2. Core Architectural Invariants

### 2.1 Closed-Form Temporal Determinism: $\text{Frame} = f(t)$
Every visual attribute—camera position, particle trajectories, physical springs, and layout pins—is computed as a pure, stateless mathematical function of timeline time $t$:
$$\text{Frame} = f(t)$$
* **Zero Simulation History**: Any sub-frame can be sampled forward or backward with zero memory accumulation.
* **Sub-Frame Adaptive Motion Blur (1 to 324 spp)**: The engine samples up to 324 sub-frames per frame over the shutter window (`Engine.render`). Stateless closed-form evaluation guarantees bit-identical results without ghosting or temporal stepping.

### 2.2 WebGL State Cache Invariant
To prevent state leaks between raw WebGL / shader passes and Three.js internal render pipelines, all batch renderers ([`SDFBatch`](../app/src/engine/sdf.ts), [`LineBatch`](../app/src/engine/lines.ts), [`AnalyticalParticles`](../app/src/engine/particles.ts), [`CompositorGraph`](../app/src/engine/graph.ts)) strictly enforce `renderer.resetState()` immediately after drawing.

### 2.3 PCIe Bandwidth Saturation Elimination
High-throughput buffers use static or single-pass allocations:
* Particle attributes are populated once using `THREE.StaticDrawUsage` in `addEmitter()`, eliminating the 75 MB/frame PCIe transfer bottleneck under multi-sampling.
* Procedural vector shapes (cards, rings, reticles) are drawn on the GPU via instanced SDF quads ([`SDFBatch`](../app/src/engine/sdf.ts)) rather than dirtying 33.2 MB Canvas2D surfaces at 4K.

### 2.4 Strict Font Loading Gate
`engine.init()` and `defineScene.init()` strictly await `document.fonts.ready` prior to evaluating Frame 0, preventing flash-of-unstyled-text (FOUT) glitches and zero-width text measurement errors that trigger false telemetry warnings.

---

## 3. The 12 Operational Engine Modules

```
app/src/engine/
├── dsl.ts          # Module 12: Declarative Scene Authoring DSL (defineScene, SceneContext)
├── rig.ts          # Module 1: Universal Dual-Mode 6-DOF Camera Rig (CameraRig)
├── transform.ts    # Module 2: Transform Hierarchy & Responsive Layout (TransformNode, LayoutNode)
├── text.ts         # Module 3: Universal Kinetic Typography Engine (KineticText)
├── sdf.ts          # Module 4: Analytic GPU Signed Distance Fields (SDFBatch)
├── motion.ts       # Module 5: Universal Motion Bus & Physical Solvers (MotionBus, motion)
├── particles.ts    # Module 6: Stateless Analytical GPU Particles (AnalyticalParticles)
├── graph.ts        # Module 7: Scoped Render Graph & Track Matte Compositor (CompositorGraph)
├── scenegraph.ts   # Module 8: Semantic Scene Graph & Entity Introspection (SceneGraph)
├── export.ts       # Module 9: Multi-Format Delivery & Headless Export (ExportPipeline)
├── tokens.ts       # Module 10: Pluggable Brand Design Token System (DesignTokens)
├── heal.ts         # Module 11: Directorial Self-Correction Contract (AgentHeal)
├── lines.ts        # High-Throughput GPU Capsule Line Batching (LineBatch)
├── viewport.ts     # Unified Viewport Space Matrix & Coordinate Bridges (ViewportSpace)
├── post.ts         # Alpha-Preserving HDR Optical Post-Processing Pipeline
├── driver.ts       # Universal Timeline Drivers (ClockDriver, AudioDriver, SpeechDriver)
└── gl.ts           # WebGL State, Fullscreen Shaders & Render Targets
```

---

### Module 1: Universal Dual-Mode 6-DOF Camera Rig ([`rig.ts`](../app/src/engine/rig.ts))
Handles Cinematic Perspective (14mm–200mm) and Technical Isometric projections with centripetal Catmull-Rom arc-length spline flight and analytical trauma shake.

```typescript
export class CameraRig {
  mode: 'perspective' | 'isometric' | 'orthographic';
  setLensMm(mm: number): this;
  setPath(waypoints: CameraWaypoint[]): this;
  evalPath(progress: number): this;
  evalCam(t: number): Cam;
  syncToThreeCamera(cam: Cam, threeCam: THREE.PerspectiveCamera | THREE.OrthographicCamera): void;
  addTrauma(intensity: number, t0: number, decay?: number): this;
}
```
* **Singular-Safe Orthonormal Frames**: Detects near-vertical forward vectors ($|F_w.y| > 0.99$) and substitutes a fallback reference vector to eliminate gimbal flips when looking straight down.
* **Telephoto Threshold**: Preserves focal lengths $< 300$ as millimeters, distinguishing them from pixel-scale lengths ($\ge 300$).
* **Closed-Form Trauma**: Evaluates trauma analytically as $T(t) = \sum I_i e^{-(t - t_0)\text{decay}}$, preserving sub-frame temporal invariance.

---

### Module 2: Transform Hierarchy & Responsive Layout ([`transform.ts`](../app/src/engine/transform.ts))
Hierarchical scene graph with local 3D anchor offsets, dirty-flag matrix concatenation, responsive viewport safe-zone pins, and 3D vertex pinning.

```typescript
export class TransformNode {
  position: V3;
  rotation: V3; // Euler angles in radians
  scale: V3;
  anchor: V3;   // Normalized [0..1] pivot offset
  size: V3;     // Local dimensions in logical pixels or world units
  getWorldMatrix(): THREE.Matrix4;
  getPivotWorldPosition(): V3;
}

export class LayoutNode extends TransformNode {
  pinToViewport(pin: ViewportPin, margins?: Partial<LayoutMargins>, w?: number, h?: number): this;
  pinToWorldVertex(worldPos: V3, cam: THREE.Camera, opts?: { screenOffset?: [number, number]; minScale?: number; maxScale?: number }): this;
}
```
* **Dimension-Aware Safe Zones**: Factored element dimensions and anchor alignment into safe margins to prevent peripheral clipping on mobile and ultra-wide viewports.
* **3D Vertex Pinning**: Automatically updates 2D screen positions with camera depth scaling, near-plane culling, and occlusion tracking (`isOccluded`).

---

### Module 3: Universal Kinetic Typography ([`text.ts`](../app/src/engine/text.ts))
Multi-line typography engine with word wrapping, 3D billboarding, character/word staggered animators, ink knockout halos, numeric rollers, and automatic telemetry tracking.

```typescript
export class KineticText {
  constructor(text: string, style?: TextStyle);
  setText(text: string): this;
  updateStyle(style: Partial<TextStyle>): this;
  withKnockoutHalo(strokePx: number, haloColor: string): this;
  numericRoll(val: number, formatter?: (n: number) => string): this;
  layout(opts?: { maxWidth?: number; align?: 'left' | 'center' | 'right'; tracking?: number; leading?: number }): this;
  getScreenBounds(x?: number, y?: number): [number, number, number, number];
  render(ctx: CanvasRenderingContext2D, t: number, x?: number, y?: number, staggerStates?: TextUnitState[]): void;
}
```
* **Paragraph Preservation**: Word-wrap strictly preserves explicit newlines across multiline copy.
* **Telemetry Deduplication**: Only emits direct telemetry to `window.__pdoom.textProbes` when Canvas2D text probe monkey-patching is inactive, eliminating double-counted text bounds and false F04 collisions.

---

### Module 4: Analytic GPU Signed Distance Fields ([`sdf.ts`](../app/src/engine/sdf.ts))
High-performance instanced quad batcher rendering procedural vector graphics directly on the GPU using analytical SDF formulas.

```typescript
export class SDFBatch {
  constructor(capacity?: number);
  rect(x: number, y: number, w: number, h: number, opts?: SDFRectOpts): this;
  shadow(x: number, y: number, w: number, h: number, blur: number, color?: [number, number, number, number], offset?: [number, number], radius?: number): this;
  ring(cx: number, cy: number, radius: number, thickness?: number, trim?: [number, number], color?: [number, number, number, number], glow?: number): this;
  reticle(cx: number, cy: number, size?: number, thickness?: number, color?: [number, number, number, number]): this;
  flush(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void;
  dispose(): void;
}
```
* **Clamped Corner Radii**: Automatically clamps per-corner radii (`[rTL, rTR, rBR, rBL]`) so their sum does not exceed dimension boundaries.
* **Analytic Drop Shadows**: Computes Gaussian soft drop shadows analytically in the quad fragment shader.
* **Anti-Aliased Trim Paths**: Renders partial gauge rings with sub-pixel screen anti-aliasing via GLSL `fwidth`.

---

### Module 5: Universal Motion Bus & Physical Solvers ([`motion.ts`](../app/src/engine/motion.ts))
Stateless physics solvers, procedural LFOs, and stagger distributions.

```typescript
export class MotionBus {
  // Closed-form 2nd-order ODE spring solver with initial velocity injection
  spring(triggerT: number, t: number, opts?: { freq?: number; damping?: number; v0?: number; scale?: number }): number;
  
  // Custom & standard Bezier curves
  ease(t: number, t0: number, t1: number, curve?: 'cubic' | 'expo' | 'elastic' | [number, number, number, number]): number;
  
  // Stagger engine
  stagger(count: number, totalDuration: number, pattern?: 'start' | 'center-out' | 'random' | 'wave'): number[];
  
  // Procedural LFO oscillators
  lfo(wave: 'sine' | 'triangle' | 'saw' | 'square' | 'noise', frequencyHz: number, t: number): number;
}

export const motion: MotionBus;
```
* **Second-Order ODE Spring Math**: Closed-form analytical solutions for under-damped ($\zeta < 1$), critically damped ($\zeta = 1$), and over-damped ($\zeta > 1$) regimes with algebraic sign verification ($c_1 = \frac{v_0 + s_2}{s_1 - s_2}$), preventing momentum loss during state handoffs.
* **Sub-Frame Negative Phase LFO**: Uses `floor`-based modulo to guarantee smooth phase continuity for negative sub-frame times sampled during motion blur.

---

### Module 6: Stateless Analytical GPU Particles ([`particles.ts`](../app/src/engine/particles.ts))
Closed-form particle system executed completely on the GPU:
$$p_i(t) = p_{0, i} + \vec{v}_{0, i} \tau + \frac{1}{2} \vec{g} \tau^2 + \vec{\mathcal{N}}_{\text{fbm}}(p_{0, i} + \vec{v}_{0, i} \tau, t)$$
where $\tau = (t - t_{\text{birth}, i}) \pmod{\text{lifetime}}$.

```typescript
export class AnalyticalParticles {
  constructor(capacity?: number, seed?: number);
  addEmitter(id: string, opts: ParticleEmitterOpts): this;
  render(renderer: THREE.WebGLRenderer, cam: THREE.Camera, target: THREE.WebGLRenderTarget, t: number): void;
  dispose(): void;
}
```
* **Stateless Determinism**: Zero simulation memory drift across forward or backward seeks.
* **Analytical Bounding Volumes**: Non-NaN bounding spheres cover the full ballistic volume for clean frustum culling.

---

### Module 7: Scoped Render Graph & Track Matte Compositor ([`graph.ts`](../app/src/engine/graph.ts))
Multi-layer compositor supporting dual-texture alpha/luma track mattes and custom blend modes.

```typescript
export class CompositorGraph {
  createLayer(name: string, def: {
    render: (target: THREE.WebGLRenderTarget) => void;
    matte?: { source: string; mode: 'alpha' | 'inv-alpha' | 'luma' | 'inv-luma' };
    blend?: 'normal' | 'add' | 'screen' | 'multiply';
    opacity?: number;
    /** Accepted but no-op in v0.5 — warns at runtime. Scoped post isolation is future work. */
    post?: ScopedPostOpts;
  }): this;
  evaluate(renderer: THREE.WebGLRenderer, finalTarget: THREE.WebGLRenderTarget): void;
  dispose(): void;
}
```
* **Corrected Premultiplied Math**: Scales premultiplied RGB and Alpha together by $m = \text{clamp}(\text{mask} \cdot \text{opacity}, 0, 1)$ to eliminate dark edge fringing.
* **Safe Multiply Over**: Preserves background where foreground alpha is empty.

---

### Module 8: Semantic Scene Graph & Entity Introspection ([`scenegraph.ts`](../app/src/engine/scenegraph.ts))
Central entity registry providing automatic 3D-to-2D screen bounding box projection, role querying, geometric collision detection, and telemetry synchronization.

```typescript
export class SceneGraph {
  register(entity: EntityMetadata): this;
  unregister(id: string): this;
  queryByRole(role: EntityRole): EntityMetadata[];
  queryByType(type: EntityType): EntityMetadata[];
  updateScreenProjections(cam: THREE.Camera, w?: number, h?: number): void;
  detectCollisions(roleA?: EntityRole, roleB?: EntityRole): CollisionEvent[];
  syncTelemetry(t: number): void;
}
```
* **Anchor Parity**: Defaults local geometry bounds to $[0, 0, 0]$ to $[\text{size}.x, \text{size}.y, \text{size}.z]$ so center anchors ($[0.5, 0.5]$) project centered on the screen $(960, 540)$ without double-offset shifts.
* **Collision Detection**: Detects overlapping 2D boxes with exact pixel area and percentage metrics.

---

### Module 9: Multi-Format Delivery & Headless Export Pipeline ([`export.ts`](../app/src/engine/export.ts))
Generates production-grade FFmpeg arguments, Playwright headless flags, and delivery presets.

```typescript
export class ExportPipeline {
  static getPreset(format: ExportFormat): ExportPresetConfig;
  static validate(opts: ExportVideoOptions): { valid: boolean; errors: string[] };
  static buildFFmpegArgs(opts: ExportVideoOptions): string[];
  static buildChromiumFlags(): string[];
  static buildCLICommand(opts: ExportVideoOptions): string;
}
```
* **Presets Supported**:
  * `webm-alpha`: VP9 (`libvpx-vp9`, `yuva420p`, `-auto-alt-ref 0`) for transparent web delivery.
  * `prores-4444`: Apple ProRes 4444 (`prores_ks`, `yuva444p10le`, `-profile:v 4`) 10-bit broadcast mastering.
  * `prores-422hq`: Apple ProRes 422 HQ high-bitrate mastering.
  * `mp4`: H.264 (`libx264`, `yuv420p`, `-tune grain`, `aq-mode=3`, `+faststart`).
  * `png-sequence`: Lossless RGBA frames.

---

### Module 10: Pluggable Brand Design Token System ([`tokens.ts`](../app/src/engine/tokens.ts))
Dynamic token registry connecting the renderer, HUD, and the telemetry auditor (`F12: palette_off_share`).

```typescript
export interface DesignTokens {
  id: string;
  name: string;
  palette: {
    background: string;
    surface: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    [key: string]: string | undefined;
  };
  typography: {
    heroDisplay: string;
    title: string;
    body: string;
    mono: string;
  };
}

export function setDesignTokens(tokens: Partial<DesignTokens>): void;
export function getDesignTokens(): DesignTokens;
export function tokenToLinear(key: string): [number, number, number];
export function tokenToRgba(key: string, a?: number): string;
```
* **Dynamic Proxies**: [`LIN`](../app/src/engine/palette.ts) and [`rgba()`](../app/src/engine/palette.ts) are dynamic Proxies reading from active tokens in real-time, eliminating hardcoded color assumptions.

---

### Module 11: Directorial Self-Correction Contract ([`heal.ts`](../app/src/engine/heal.ts))
Translates diagnostic signals from the 9 visual instruments and telemetry rules into machine-actionable repair directives emitted into `findings.json`.

```typescript
export class AgentHeal {
  static analyzeSignal(sig: DiagnosticSignal, index?: number): DiagnosticFinding;
  static processSignals(signals: DiagnosticSignal[]): DiagnosticFinding[];
  static serialize(findings: DiagnosticFinding[]): string;
  static formatMarkdownReport(findings: DiagnosticFinding[]): string;
}
```

#### Diagnostic Remediation Matrix

| Diagnostic Signal | Rule Detected | Recommended Action | Machine-Actionable Directive |
| :--- | :--- | :--- | :--- |
| **`onion`** | `motion_trajectory_jitter` | `TUNE_CURVE` | Smooth spatial trajectory spline curvature via `motion.ease(t, t0, t1, 'cubic')`. |
| **`godview`** | `camera_geometry_penetration` | `ADJUST_CAMERA` | Retract waypoint 0.5m backwards along gaze normal or expand lens focal length. |
| **`compare`** | `reference_drift` | `SWAP_PALETTE_TOKEN` | Realign color or spatial offset to active design system tokens. |
| **`stitch`** | `transition_cut_pop` | `ADJUST_TIMING` | Apply a 150ms seam dissolve or match boundary velocities across scene cut. |
| **`curves`** | `arrival_impact_kink` | `TUNE_CURVE` | Tune spring damping $\ge 0.82$ or soften Bezier cubic exit tangent. |
| **`saliency`** | `saliency_distraction` | `MUTATE_PROPERTY` | Dim peripheral line contrast or lower particle emission speed. |
| **`legibility`** | `low_contrast_legibility` | `ADD_KNOCKOUT_HALO` | Apply `KineticText.withKnockoutHalo()` or inject localized backdrop scrim. |
| **`rhythm`** | `onset_traffic_jam` | `STAGGER_ONSET` | Disperse element triggers across a 350ms cascade via `motion.stagger(N, 0.35, 'center-out')`. |
| **`framing`** | `mobile_framing_breach` | `ADJUST_LAYOUT` | Pin element to top-center with inward safe margin. |
| **`F04`** | `screen_box_collision` | `ADJUST_LAYOUT` | Increase vertical stacking offset. |
| **`F05`** | `viewport_boundary_clip` | `ADJUST_LAYOUT` | Pull responsive margins inward by 64px. |
| **`F07`** | `excessive_persistence` | `ADJUST_TIMING` | Add smooth exit fade or spring dismiss. |
| **`F12`** | `palette_gamut_deviation` | `SWAP_PALETTE_TOKEN` | Bind fill/stroke color to active design tokens. |

---

### Module 12: Declarative Scene Authoring DSL & Strict Lifecycle ([`dsl.ts`](../app/src/engine/dsl.ts))
Factory pattern that protects autonomous coding agents from boilerplate errors.

```typescript
export interface DeclarativeSceneDef {
  id: string;
  /** Advisory only — timeline driver owns `end`. Warns once if set. */
  duration?: number;
  rigMode?: 'perspective' | 'isometric' | 'orthographic';
  particleCapacity?: number;
  lineCapacity?: number;
  sdfCapacity?: number;
  preload?: (ctx: SceneCtx) => Promise<void>;
  setup?: (ctx: SceneContext) => void | Promise<void>;
  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => PostOverrides | void;
}

export function defineScene(def: DeclarativeSceneDef): SceneClass;
```

---

## 4. How to Author a Scene: Code Example

Here is a complete, production-grade procedural scene authored using the declarative DSL:

```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../engine/dsl';
import { type Frame } from '../engine/scene';
import { ease } from '../engine/util';

export default defineScene({
  id: 'product_hero',
  duration: 6.0,
  rigMode: 'perspective',

  setup: async (ctx: SceneContext) => {
    // 1. Configure CameraRig flight path
    ctx.rig.setLensMm(50);
    ctx.rig.setPath([
      { t: 0.0, pos: [0, 2.0, -8.0], target: [0, 0, 0], roll: 0, focalLength: 50 },
      { t: 0.5, pos: [3.0, 1.5, -6.5], target: [0, 0, 0], roll: 0.05, focalLength: 55 },
      { t: 1.0, pos: [0, 0.5, -5.5], target: [0, 0, 0], roll: 0, focalLength: 60 },
    ]);

    // 2. Add GPU analytical particle core
    ctx.particles.addEmitter('core_glow', {
      capacity: 512,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 1.0,
      spread: 0.5,
      lifetime: 2.0,
      size: 0.04,
      color: [ctx.lin.accent[0], ctx.lin.accent[1], ctx.lin.accent[2], 0.8],
    });

    // 3. Register layout node for 3D anchor pin
    ctx.node('callout_anchor', { role: 'callout', size: [120, 32, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    // Update camera flight trajectory and synchronize projections
    ctx.updateCamera(t, progress);

    // Physical spring entrance with initial velocity v0
    const springEnter = ctx.motion.spring(0.2, t, { freq: 3.0, damping: 0.75, v0: 2.0 });

    // Draw vector HUD card via SDFBatch
    ctx.sdf.clear();
    if (springEnter > 0.01) {
      ctx.card('hud_panel', {
        x: W - 400,
        y: 80 + (1 - springEnter) * 30,
        w: 320,
        h: 120,
        radius: 12,
        fill: [lin.surface[0], lin.surface[1], lin.surface[2], 0.9 * springEnter],
        stroke: [lin.primaryText[0], lin.primaryText[1], lin.primaryText[2], 0.2 * springEnter],
        strokeWidth: 1.5,
        shadow: { blur: 20, color: [0, 0, 0, 0.4 * springEnter] },
        role: 'hud',
        opacity: springEnter,
      });
    }

    // Draw typography via KineticText with knockout halos
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    ctx.text('hero_title', 'PROCEDURAL ENGINE', {
      fontSize: 40,
      fontWeight: 900,
      color: ctx.rgba('primaryText'),
      role: 'headline',
    }).withKnockoutHalo(3.0, ctx.rgba('background', 0.95));

    const titleProgress = ease.outExpo(Math.min(1, progress * 3));
    ctx.renderText('hero_title', c2d, t, 80, 140 - (1 - titleProgress) * 30);

    // Multi-layer compositing via CompositorGraph
    ctx.compositor.clear();
    ctx.compositor.createLayer('3d_stage', {
      render: (target) => {
        ctx.particles.render(renderer, ctx.threeCam, target, t);
      },
      blend: 'normal',
    });
    ctx.compositor.createLayer('vector_hud', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal' });
      },
      blend: 'normal',
    });
    ctx.compositor.evaluate(renderer, out);

    // Telemetry synchronization and WebGL state reset invariant
    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();
  },
});
```

---

## 5. Verification Test Suites

The engine overhaul is validated by 4 automated test suites:

```bash
# Milestone 1: Pinhole camera matrix parity & dynamic tokens
bun scripts/test_milestone1.ts

# Milestone 2: 2nd-order ODE spring physics, LFOs, SDF quads & KineticText
bun scripts/test_milestone2.ts

# Milestone 3: CameraRig orthonormal frames, LayoutNode safe pins & GPU particles
bun scripts/test_milestone3.ts

# Milestone 4: CompositorGraph, SceneGraph, Declarative DSL, ExportPipeline & AgentHeal
bun scripts/test_milestone4.ts
```

All 53 unit tests in Milestone 4 and all regression tests across Milestones 1–3 pass with **0 errors**. Type-checking (`bun x tsc --noEmit`) and production bundling (`bun x vite build`) compile with **0 errors**.
