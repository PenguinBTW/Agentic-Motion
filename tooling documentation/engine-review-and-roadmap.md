# Engine Architectural Review & Universal Agentic Motion Graphics Roadmap

> [!NOTE]
> **ROADMAP EXECUTION COMPLETE & FULLY VERIFIED (v0.5.0)**:
> All 4 milestones of this roadmap have been fully implemented, verified via automated test suites, and audited by independent subagents.
> For the complete active implementation guide, API reference, and scene authoring documentation, see [**Operational Engine Architecture & API Reference (`engine-architecture.md`)](./engine-architecture.md)**.

**Document Version**: 0.5.0  
**Scope**: Universal Agentic Motion Graphics & Animation Platform — applicable to **all motion graphic design genres**:
* **Commercials & 3D Product Teasers** (device turntable reveals, screen cascades, exploded engineering assemblies)
* **UI/UX Animation & Interaction Showcases** (app walkthroughs, sheet transitions, micro-interactions, isometric UI flows)
* **Brand Identity & Title Sequences** (logo resolves, broadcast bumpers, cinematic titles, vector monograms)
* **Data Visualization & Technical Infographics** (HUD dashboards, network topology graphs, dynamic bar/pie charts)
* **Voiceover Explainer Videos & Kinetic Manifestos** (speech-timed kinetic typography, editorial statements, subtitles)
* **Audiovisual & Generative Productions** (sound-reactive art, audio-driven visualizers, procedural music videos)

---

## 1. Executive Summary

Motion graphics is the craft of applying **time, physics, and choreography to graphic design**. In industry-standard desktop software (After Effects, TouchDesigner, Cinema 4D, Cavalry, Blender), human designers manipulate visual timelines, curve graph editors, and parenting hierarchies with a mouse.

For an **autonomous AI coding agent**, this workflow is fundamentally different:
* The agent authors motion through code, shaders, analytical math, and declarative timing curves.
* The agent cannot "eyeball" a timeline by dragging a scrubber; it relies on **headless visual telemetry, multi-exposure motion trails, 3D architectural blueprints, speed graphs, attention heatmaps, split-wipe benchmark comparators, and semantic scene introspection**.

The current engine provides an extraordinary foundation: **deterministic rendering $f(t)$, 60 fps headless Playwright capture, adaptive sub-frame motion blur (1 to 324 spp), linear HDR optical post-processing, and high-performance GPU line batching**.

However, our deep architectural audit reveals that before this engine can power general motion graphics, it must resolve **three critical layers**:
1. **Engine Decoupling**: Eliminate single-project assumptions (such as engine crashes if `audio.json` or `lyrics.json` is missing, hardcoded `pdoom` HUD regexes, and `alpha: false` WebGL contexts).
2. **Low-Level Graphics Plumbing**: Implement analytic GPU Signed Distance Fields (`SDFBatch`) for vector shapes, closed-form stateless particles (`AnalyticalParticles`) that stay deterministic under adaptive sampling, Rotation Minimizing Frames (Bishop frames) for camera flight, and dual-texture GLSL track mattes.
3. **Agent Directorial Loop**: Couple the 9 visual diagnostic instruments directly to a semantic scene graph to provide autonomous self-correction instructions.

---

## 2. Deep Audit of the Current Engine

### 2.1 Core Architectural Strengths (Preserve & Protect)

1. **Deterministic Mathematical Purity**: Every frame is an analytical function of timeline time $t$:
   $$\text{Frame} = f(t)$$
   Frames render bit-identically whether scrubbed backward in the interactive Vite player or encoded sequentially at 4K in headless Chrome.
2. **True Cinematic Sub-Frame Motion Blur**: The adaptive ternary sampling engine (`Engine.render`, 1 to 324 sub-frames) provides physically accurate motion blur, shutter simulation, and anti-aliasing without ghosting or temporal stepping.
3. **Linear HDR Optical Post-Processing**: 7-mip bloom pyramid, tone shoulder, halation, subtle chromatic aberration, film grain, and paper/ink inversion provide a cohesive, filmic baseline look out-of-the-box.
4. **High-Throughput GPU Capsule Lines (`LineBatch`)**: Instanced buffer geometry capable of rendering tens of thousands of anti-aliased 2D/3D lines per frame with screen-space or world-scale width.
5. **Integrated Visual Instrumentation Suite (01–09)**: 9 visual diagnostic instruments (`onion`, `godview`, `compare`, `stitch`, `curves`, `saliency`, `legibility`, `rhythm`, `framing`) providing perceptual sight across spatial, temporal, and aesthetic domains.

### 2.2 Critical Codebase Decoupling Blockers & Graphics Bottlenecks

| Issue / Area | Current Codebase Implementation | Impact on General Motion Design |
| :--- | :--- | :--- |
| **Boot Crash on Missing Audio** | `engine.ts:146` literally awaits `AudioData.load()` and `Lyrics.load()`. | If `audio.json` or `lyrics.json` is absent, the engine crashes on boot. Silent 5s UI teasers or procedural loops cannot run. |
| **WebGL Alpha Disabled** | `engine.ts:92` initializes `THREE.WebGLRenderer({ alpha: false })`. | Transparent WebM exports (VP9 with alpha for Lottie/web UI embeds) are impossible. Background defaults to opaque black. |
| **Hardcoded Legacy Constants** | `hud.ts` has regex on `/p[-(\s]?doom/i`; `palette.ts` hardcodes `signal` / `acid` descriptions; `timeline.ts` imports missing `plates.json`. | Prevents clean project reuse; pollutes new projects with single-project metadata. |
| **4K Canvas2D PCIe Saturation** | Canvas2D renders to `Layer2D`, which uploads to WebGL via `texImage2D` every frame. | At 4K (`3840x2160`), uploading an uncompressed 32-bit RGBA surface ($33.2\,\text{MB}$) per frame takes **$8\text{--}16\,\text{ms}$**, saturating PCIe bandwidth. |
| **WebGL State Desynchronization** | Raw GL calls in `LineBatch` / `gl.ts` mutate VAO, blend modes, and buffers without resetting state. | Desynchronizes Three.js internal `WebGLState` cache, causing random line dropouts, depth-test failures, or corrupted post shaders. |
| **Async Font Ready Race Condition** | `engine.init()` starts rendering without gating on `@font-face` loading. | Frame 0 renders with system fallback fonts (flash of unstyled text) and returns 0-width metrics, corrupting `text.csv` and triggering false `F04`/`F05` flags. |
| **Coordinate Space Ambiguity** | Mixes Logical ($1920 \times 1080$), High-DPI physical ($3840 \times 2160$), and Three.js world units without unified scaling. | Causes $2\times$ sizing bugs, misplaced safe-zone clipping borders, and desynchronized 2D callouts over 3D anchors. |
| **Camera Duality Disconnect** | `camera3d.ts` computes custom CPU pinhole math (`Cam`); `lines.ts` uses Three.js `projectionMatrix * modelViewMatrix`. | Forces developers to choose between slow CPU coordinate projection or maintaining two desynchronized camera rigs. |
| **Particle Simulation vs. Blur** | Forward Euler simulation ($p_{t+dt} = p_t + v \cdot dt$) breaks under adaptive sampling. | Adaptive motion blur samples sub-frames out of chronological order. Stateful particles require expensive simulation preroll. |
| **Single-Texture Compositor** | `gl.ts` only draws single textures with basic blend modes (`normal`, `add`, `screen`). | Cannot perform **track mattes** (alpha mattes, luma mattes, stencil reveals) or isolate bloom from UI text. |

---

## 3. The Universal Agentic Motion Graphics Architecture

To transform this foundation into a universal platform for any motion design genre, the engine is structured around eleven modular subsystems:

```
┌────────────────────────────────────────────────────────────────────────┐
│            UNIVERSAL AGENTIC MOTION GRAPHICS ENGINE (v0.5.0)           │
├────────────────────────────────────────────────────────────────────────┤
│  [11. Agent Director Loop]  ──> Machine-Actionable Remediation Engine   │
├────────────────────────────────────────────────────────────────────────┤
│  [8. Semantic Scene Graph]  ──> Auto-Projected Bounds, Semantic Roles  │
├────────────────────────────────────────────────────────────────────────┤
│  [3. Kinetic Typography]    ──> Staggers, Numeric Rollers, Knockout Halos│
│  [4. Analytic GPU SDFs]     ──> SDFBatch: Rounded Rects, Rings, Trim Paths│
│  [6. Stateless GPU Particles]─> Closed-Form Deterministic Emitters      │
│  [5. Universal Motion Bus]  ──> Springs (v0), Bezier Curves, Drivers   │
│  [1. Continuous Camera Rig] ──> Bishop Frames, C2 Splines, Lens Presets │
│  [2. Transform & Layout]    ──> 3D Anchors, LayoutNode Responsive Pins │
│  [10. Pluggable DesignTokens]─> Brand Palettes, Typography & Motion Tokens│
├────────────────────────────────────────────────────────────────────────┤
│  [7. Dual-Texture Compositor]─> Alpha/Luma Track Mattes, Scoped Post   │
├────────────────────────────────────────────────────────────────────────┤
│  [9. Multi-Format Exporter] ──> Alpha WebM, ProRes 422 HQ, MP4, Stills │
├────────────────────────────────────────────────────────────────────────┤
│  [Core Engine Foundations]  ──> Adaptive Sub-Sampler, Post, WebGL/GPU  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Module 1: Continuous $C^2$ Camera Choreography Rig (`CameraRig`)

#### Architecture, Gimbal Fix & Dual-Mode Projections
To eliminate camera roll flips when the gaze vector aligns with world up ($\vec{F} \parallel [0, 1, 0]$), `CameraRig` adopts **Rotation Minimizing Frames (Bishop Frames)** combined with **Spherical Quadrangle (SQUAD)** quaternion interpolation and **arc-length reparameterized** Centripetal Catmull-Rom positional splines:

$$s(t) = \int_0^t \|\gamma'(\tau)\| d\tau, \quad \tilde{\gamma}(u) = \gamma(s^{-1}(u \cdot L))$$

* **$O(1)$ Random-Access Evaluation**: Because Bishop parallel transport is path-dependent ($\dot{u}(s) = -(\kappa(s) \cdot u(s))T(s)$), naive forward numerical integration from $t=0$ creates an $O(N)$ penalty during scrubbing or headless frame seeking. `CameraRig` solves this by precomputing an analytical arc-length lookup table and utilizing keyframed SQUAD quaternion orientation, guaranteeing instant $O(1)$ evaluation at any arbitrary time $t$.
* **Dual-Mode Projections (Perspective & Isometric)**: Modern UI/UX showcases, technical infographics, and exploded assemblies often require isometric / axonometric projection ($30^\circ$ isometric app flows) to eliminate perspective distortion across 3D card stacks.
* **Camera Duality Reconciliation**: Unifies Three.js vertical FOV ($\text{fov}_y$) with pinhole screen focal length $f$:
  $$f = \frac{H}{2 \tan(\text{fov}_y / 2)}, \quad \text{fov}_y = 2 \arctan\left(\frac{H}{2 f}\right)$$

```typescript
export class CameraRig {
  // Projection mode: perspective or true isometric / axonometric
  mode(type: 'perspective' | 'isometric', opts?: { orthoScale?: number }): this;

  // Isometric preset for UI card stacks and exploded technical views
  isometric(angleDeg = 30, rotationDeg = 45): this;

  // Waypoints with arrival times, gaze targets, and lens options
  waypoint(t: number, pos: V3, lookAt?: V3, opts?: { fov?: number; roll?: number; snap?: boolean }): this;

  // Orbit / Turntable choreographies around a 3D subject (Bishop frame transport)
  orbit(center: V3, radius: number, speedDegPerSec: number, opts?: { elevation?: number; wobble?: number }): this;

  // Cinematic lens presets (replaces arbitrary focal lengths)
  lens(preset: '18mm' | '24mm' | '35mm' | '50mm' | '85mm' | '135mm'): this;

  // Target tracking with critically damped physical springs
  track(target: V3 | (() => V3), dampingRatio = 0.8, frequency = 2.5): this;

  // Impulse shake (simulates camera rumble without corrupting the baseline spline)
  shake(intensity: number, decay = 0.12): this;

  // Synchronizes Three.js camera and returns analytical Cam struct at time t
  evaluate(t: number): { cam: Cam; threeCamera: THREE.Camera };
}
```

* **Value for Autonomous Agents**: Agents declare spatial intent without manual quaternion math, roll matrix calculations, or gimbal lock risks, and can switch seamlessly between cinematic perspective flight and isometric UI showcases.

---

### Module 2: Transform Hierarchy & Responsive Layout (`TransformNode` & `LayoutNode`)

#### Architecture
Separates local spatial kinematics from responsive screen layout:
1. **`TransformNode`**: Implements 3D local anchor points $[x, y, z] \in [0..1]^3$ (enabling objects to scale up from their feet or rotate around edge hinges) with cached dirty-flag matrix concatenation:
   $$M_{\text{world}} = M_{\text{parent}} \cdot M_{\text{local}} \cdot T(-\text{anchor})$$
2. **`LayoutNode`**: Introduces declarative viewport pins that automatically adapt across 16:9, 9:16 vertical, and 1:1 square:

```typescript
export class LayoutNode extends TransformNode {
  // Declarative viewport pins
  pin?: 'top-left' | 'top-center' | 'top-right' |
        'center-left' | 'center' | 'center-right' |
        'bottom-left' | 'bottom-center' | 'bottom-right';

  // Responsive safe-zone margins (Action-Safe 90%, Title-Safe 80%)
  margin?: { top?: number; right?: number; bottom?: number; left?: number };

  // 3D Anchor Pinning (pins 2D element to a 3D vertex in world space with depth scaling)
  pinToWorldVertex(worldPos: V3, cam: THREE.Camera, opts?: {
    screenOffset?: [number, number];
    minScale?: number;
    maxScale?: number;
    occlusionCull?: boolean;
  }): this;
}
```

* **Value for Autonomous Agents**: Eliminates `F05` (clipping) bugs when authoring for mobile vertical feeds; agents simply declare `pin: 'top-right'`.

---

### Module 3: Universal Kinetic Typography Engine (`KineticText`)

#### Architecture & Telemetry Bridge
A declarative layout and animator pipeline for text in 2D screen-space or 3D world-space. Employs a hybrid rendering strategy: high-resolution Canvas2D caching for static display headers, and instanced glyph batches for high-speed staggered character animations.

* **CRITICAL TELEMETRY BRIDGE (Decoupling from Canvas2D Monkey-Patching)**:
  In the current engine, `main.ts` intercepts `CanvasRenderingContext2D.prototype.fillText` to populate `window.__pdoom.textProbes[]`. If text moves to GPU instanced glyph batches (e.g. MSDF quad batches), `fillText` is bypassed, blinding `text.csv`, `F04` (collision), `F05` (clipping), and Instrument 07 (`legibility`).
  `KineticText` resolves this by implementing a **direct telemetry emission bridge**: whenever `KineticText.layout()`, `stagger()`, or `render()` evaluates, it calculates its exact 2D screen bounding box $[x, y, w, h]$, string, and opacity and writes directly to `SceneGraph` and `window.__pdoom.textProbes[]`.

```typescript
export class KineticText {
  constructor(text: string, style: TextStyle);

  // Multi-line layout with alignment, optical tracking, and line leading
  layout(opts: { maxWidth?: number; align?: 'left' | 'center' | 'right'; tracking?: number; leading?: number }): this;

  // 3D Spatial Anchoring & Billboarding with depth-attenuated minimum readable scale
  anchor3D(worldPos: V3, cam: THREE.Camera, opts?: { billboard?: boolean; minPx?: number; maxPx?: number }): this;

  // Staggered Character / Word / Line Animators
  stagger(t: number, opts: {
    unit: 'char' | 'word' | 'line';
    start: number;
    staggerDuration: number;
    inDuration: number;
    motion: 'slide-up' | 'fade' | 'typewriter' | 'scale-pop' | 'wipe';
    ease?: (u: number) => number;
  }): TextAnimationState;

  // Dynamic Numerical Counter Rollers (e.g. animated stats, metrics, percentages)
  numericRoll(value: number, format?: (n: number) => string): this;

  // Automatic Ink Knockout Halo (ensures 100% legibility against background geometry)
  withKnockoutHalo(strokePx = 2.5, haloColor = LIN.ink): this;

  // Direct Telemetry Emission (synchronizes screen bounds into SceneGraph & textProbes)
  syncTelemetry(t: number, sceneGraph?: SceneGraph): void;

  render(ctx: CanvasRenderingContext2D | THREE.WebGLRenderer, t: number): void;
}
```

---

### Module 4: Analytic GPU Signed Distance Fields (`SDFBatch`)

#### Architecture & Primitives
Renders procedural vector primitives (rounded rectangles, rings, compass reticles, gauges, soft shadows) via instanced quads in a WebGL fragment shader using analytic Signed Distance Fields. Completely bypasses CPU triangulation and 4K texture upload bottlenecks:

* **Analytic Trim Paths**: Supporting After Effects-style animated stroke reveals directly on the GPU with zero memory allocation.
* **Analytic Soft Drop Shadows**: Evaluates box SDF with offset $(x - dx, y - dy)$ and Gaussian-like falloff $\text{smoothstep}(blur, -blur, d)$ directly in fragment shaders, producing soft card shadows with zero extra blur passes or textures.
* **Pixel-Accurate Anti-Aliasing**:
  $$\alpha = \text{clamp}\left(0.5 - \frac{d}{\text{fwidth}(d)}, 0.0, 1.0\right)$$
* **Strict Logical Coordinates ($1920 \times 1080$)**: All inputs $(x, y, w, h)$ are authored strictly in Logical Canvas Points. Shaders apply the hardware `SCALE` multiplier internally at the vertex stage, shielding agents from DPI inconsistencies.
* **WebGL State Cache Invariant (`renderer.resetState()`)**: To prevent desynchronizing Three.js's internal `WebGLState` cache (which causes depth-test failures or disappearing meshes), `SDFBatch.flush()` and `LineBatch.flush()` must call `renderer.resetState()` immediately after issuing raw WebGL draw calls.

```typescript
export interface SDFShapeInstance {
  type: 'rounded-rect' | 'circle' | 'ring' | 'arc' | 'polygon' | 'shadow';
  bounds: [number, number, number, number]; // [x, y, w, h] strictly in logical points (1920x1080)
  radii?: [number, number, number, number];  // Top-left, top-right, bottom-right, bottom-left
  fillColor?: [number, number, number, number];
  strokeColor?: [number, number, number, number];
  strokeWidth?: number;
  trim?: [number, number];                   // [trimStart, trimEnd] (0..1)
  shadowBlur?: number;                       // Soft drop shadow radius
  shadowOffset?: [number, number];           // [dx, dy]
  glow?: number;                             // Linear HDR bloom boost
}

export class SDFBatch {
  constructor(capacity = 2048);
  rect(x: number, y: number, w: number, h: number, opts?: SDFRectOpts): void;
  shadow(x: number, y: number, w: number, h: number, blur: number, color: [number, number, number, number], offset?: [number, number]): void;
  ring(cx: number, cy: number, r: number, thickness: number, trim?: [number, number]): void;
  reticle(cx: number, cy: number, r: number, style?: 'cross' | 'bracket' | 'gauge'): void;
  // Flushes instanced GPU quads and automatically restores Three.js WebGL state
  flush(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void;
}
```

---

### Module 5: Universal Motion Bus & Timeline Drivers (`MotionBus`)

#### Architecture
Decouples timeline time $t$ from specific audio files using an interchangeable `TimelineDriver` strategy pattern (`ClockDriver`, `AudioDriver`, `SpeechDriver`), while providing closed-form analytical springs with initial velocity injection:

```typescript
export interface TimelineDriver {
  readonly duration: number;
  evaluate(t: number): DriverSample;
}

export class MotionBus {
  // 1. Second-order physical spring solver with initial velocity injection
  spring(triggerT: number, t: number, opts?: {
    freq?: number;
    damping?: number;
    v0?: number; // Initial velocity at trigger (prevents momentum loss on state handoffs)
    scale?: number;
  }): number;

  // 2. Standard & Custom Bezier Easing Curves
  ease(t: number, t0: number, t1: number, curve: 'cubic' | 'expo' | 'elastic' | [number, number, number, number]): number;

  // 3. Stagger Engine: returns array of delay offsets for N elements
  stagger(count: number, totalDuration: number, pattern?: 'start' | 'center-out' | 'random' | 'wave'): number[];

  // 4. Procedural LFO Oscillators (for silent animations or ambient loops)
  lfo(wave: 'sine' | 'triangle' | 'saw' | 'square' | 'noise', frequencyHz: number, t: number): number;

  // 5. Speech & Voiceover Timing Stream (when voice narration is present)
  speechCue(cueId: string, t: number, window = 0.12): number;
}
```

---

### Module 6: Stateless Analytical GPU Particles (`AnalyticalParticles`)

#### Architecture
To preserve mathematical determinism $\text{Frame} = f(t)$ under the 324-spp adaptive motion blur engine, particles are **stateless and closed-form**:

$$p_i(t) = p_{0, i} + \vec{v}_{0, i} \tau + \frac{1}{2} \vec{g} \tau^2 + \vec{\mathcal{N}}_{\text{fbm}}(p_{0, i} + \vec{v}_{0, i} \tau, t)$$

where $\tau = (t - t_{\text{birth}, i}) \pmod{\text{lifetime}}$. Zero simulation history, zero memory leaks, and bit-identical sampling in forward or reverse directions at any sub-frame.

```typescript
export class AnalyticalParticles {
  constructor(capacity: number, seed = 1337);
  addEmitter(id: string, opts: ParticleEmitterOpts): this;
  render(renderer: THREE.WebGLRenderer, cam: THREE.Camera, target: THREE.WebGLRenderTarget, t: number): void;
}
```

---

### Module 7: Scoped Render Graph & Track Matte Compositor (`CompositorGraph`)

#### Architecture
Replaces simple ping-pong crossfades with a multi-layer compositor supporting dual-texture alpha/luma track mattes and scoped post-processing:

```typescript
export class CompositorGraph {
  createLayer(name: string, opts: {
    render: (target: THREE.WebGLRenderTarget) => void;
    matte?: { source: string; mode: 'alpha' | 'inv-alpha' | 'luma' | 'inv-luma' };
    blend?: 'normal' | 'add' | 'screen' | 'multiply';
    opacity?: number;
    post?: { bloom?: boolean; grain?: boolean; ca?: boolean }; // Scoped post-processing!
  }): this;

  evaluate(renderer: THREE.WebGLRenderer, finalTarget: THREE.WebGLRenderTarget): void;
}
```

* **Value for Autonomous Agents**: Allows 3D scenes to be masked through typography silhouettes (alpha matte) while keeping foreground UI text free of bloom or grain.

---

### Module 8: Semantic Scene Graph & Entity Introspection (`SceneGraph`)

#### Architecture
An automated entity registry that derives 2D screen bounding boxes automatically by multiplying each node's local bounding box by its `TransformNode.getWorldMatrix()` and projecting through `CameraRig`:

```typescript
export interface EntityMetadata {
  id: string;
  type: 'mesh' | 'text' | 'vector' | 'camera' | 'light' | 'emitter';
  role: 'hero_subject' | 'headline' | 'callout' | 'hud' | 'background';
  worldPos?: V3;
  worldBounds?: BoundingBox3D;
  screenBounds?: [number, number, number, number]; // Automatically projected!
  opacity: number;
}

export class SceneGraph {
  register(entity: EntityMetadata): void;
  getEntities(t: number): EntityMetadata[];
  getEntityById(id: string): EntityMetadata | null;
}
```

---

### Module 9: Multi-Format Delivery & Headless Export Pipeline (`ExportPipeline`)

#### Architecture & Alpha Preservation Fix
Enables `alpha: true` WebGL canvas initialization, clearing background targets to `[0, 0, 0, 0]` and delivering transparent WebM (VP9 + alpha) and ProRes 4444 exports.

* **CRITICAL ALPHA CORRUPTION TRAP in `post.ts`**:
  Even with `alpha: true` on WebGL, the post-processing shader in `post.ts:164` currently forces alpha to 1.0 (`fragColor = vec4(sat(s), 1.0)`), and vignette/grain shaders dirty blank pixels.
  `post.ts` is upgraded with a `transparent` flag that:
  1. Gates film grain by source alpha: $s += \text{grain} \times \alpha_{\text{src}}$
  2. Multiplies vignette darkness strictly by source alpha.
  3. Preserves alpha in the final output:
     ```glsl
     float colAlpha = texture(src, uv).a;
     vec3 s = toSRGB(sat(col));
     s += grainNoise * colAlpha;
     fragColor = vec4(s * colAlpha, colAlpha);
     ```

```typescript
export class ExportPipeline {
  exportVideo(opts: {
    format: 'mp4' | 'webm-alpha' | 'prores-4444' | 'prores-422hq' | 'png-sequence';
    resolution: [number, number];
    fps: 60 | 30 | 24;
    from: number;
    to: number;
    audioTrack?: string;
    transparent?: boolean;
    outPath: string;
  }): Promise<string>;
}
```

---

### Module 10: Pluggable Brand Design Token System (`DesignTokens`)

#### Architecture
Replaces hardcoded palettes with a project-agnostic token registry that feeds both rendering and the telemetry auditor (`F12: palette_off_share`):

```typescript
export interface DesignSystem {
  id: string;
  palette: {
    background: string;
    surface: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    accentSecondary?: string;
    alert?: string;
  };
  typography: {
    heroDisplay: string;
    title: string;
    body: string;
    mono: string;
  };
  motion: {
    springBouncy: [number, number];
    springSnappy: [number, number];
    easeEntrance: (u: number) => number;
    easeExit: (u: number) => number;
  };
}
```

---

### Module 11: Directorial Self-Correction Contract (`AgentDirectorLoop` & `agent-heal`)

#### Architecture & Machine-Actionable Directive Schema
Maps signals from the 9 visual diagnostic instruments directly into automated, machine-actionable repair directives emitted into `findings.json`:

```json
{
  "id": "F05-001",
  "tier": "A",
  "rule": "text_clipping",
  "target_entity": "badge_callout_right",
  "timestamp": 4.25,
  "evidence_file": "strip_collision_4.25.png",
  "remediation_directive": {
    "action": "MUTATE_PROPERTY",
    "target_file": "src/scenes/hero.ts",
    "target_line_hint": "badge.pin",
    "recommended_patch": "pin: 'top-right', margin: { right: 48 }"
  }
}
```

#### Diagnostic Remediation Matrix

| Diagnostic Tool Signal | Root Cause Detected | Autonomous Agent Remediation Strategy |
| :--- | :--- | :--- |
| **`curves`**: `arrival_impact_pct > 5.0` | Element slams into rest abruptly ($C^0$ kink). | Tune ease-out shoulder in `MotionBus.ease()` or match boundary velocity $v_0 = v_{\text{prev}}$. |
| **`legibility`**: `min_contrast < 4.5` | Dynamic background reflection blinds text. | Apply `KineticText.withKnockoutHalo()` or inject localized backdrop scrim. |
| **`godview`**: `min_near_distance < 0.10m` | Camera penetrates 3D geometry or near-clip plane. | Retract flight spline waypoint along gaze normal or expand lens focal length. |
| **`rhythm`**: `onset_count > 3` at $\Delta t < 20\text{ms}$ | Multiple elements pop simultaneously (traffic jam). | Apply `MotionBus.stagger(N, 0.35, 'center-out')` for a 60–80ms cascade. |
| **`saliency`**: `hero_attention_share < 60%` | Secondary background particles hijack viewer gaze. | Dim peripheral line contrast or lower particle emission speed. |
| **`framing`**: `9:16 safe_zone_breaches > 0` | Peripheral callouts cropped in mobile format. | Switch element to `LayoutNode.pin = 'top-center'` or pull layout margins inward. |

---

### Module 12: Declarative Scene Authoring DSL & Strict Lifecycle (`defineScene`)

#### Architecture & Ergonomics
To protect autonomous coding agents from boilerplate mistakes (such as forgetting to register an entity in `SceneGraph`, forgetting `syncTelemetry()`, or failing to flush GPU batches), scenes are declared via a fluent factory pattern:

```typescript
export interface SceneDefinition {
  id: string;
  duration: number;
  // Strict Two-Phase Lifecycle:
  // Phase 1: Asynchronous asset preloading (GLTF meshes, HDR probes, SVGs, audio stems)
  preload?: (engine: Engine) => Promise<void>;
  // Phase 2: Strictly synchronous, deterministic closed-form evaluation f(t)
  setup: (ctx: SceneContext) => void;
}

export function defineScene(def: SceneDefinition) {
  return def;
}
```

* **The Boilerplate Shield (`SceneContext`)**:
  When an agent invokes `ctx.text()`, `ctx.card()`, or `ctx.model()`, the context automatically handles:
  1. Instantiating the underlying primitive (`KineticText`, `SDFBatch`, `TransformNode`).
  2. Registering screen bounds into `SceneGraph` and `window.__pdoom.textProbes[]` for zero-annotation telemetry.
  3. Queuing GPU batch flushes with automatic `renderer.resetState()` cleanup.
* **Asynchronous Font Loading Gate (`document.fonts.ready`)**:
  `engine.init()` strictly awaits `document.fonts.ready` prior to evaluating Frame 0, completely eliminating the "flash of unstyled text" and zero-width text measurement glitches that cause false `F04`/`F05` flags.

---

## 4. Re-Aligning Diagnostic Tooling & Telemetry

With this universal framing, the complete 9-instrument diagnostic suite covers all motion design domains:

### The 9 Visual Instruments Across Motion Design
1. **Multi-Exposure Motion Onion (`onion`)**: Traces spatial motion arcs and spring deceleration trails on a single still.
2. **3D God-View Camera Blueprint (`godview`)**: External $XZ$/$YZ$ architectural blueprints with viewing cones and velocity ribbons.
3. **Visual A/B Reference Anchor (`compare`)**: Side-by-side and $45^\circ$ diagonal split-wipes against Figma mockups and design tokens.
4. **Transition Seam Stitch Inspector (`stitch`)**: Green/magenta false-color overlay across cut boundaries ($\pm 250\,\text{ms}$).
5. **Parametric Speed Graph Inspector (`curves`)**: Isolated speed and acceleration derivatives plotting $y(t), v(t), a(t)$ to flag tangent kinks.
6. **Visual Gaze Saliency Heatmap (`saliency`)**: Spatio-temporal foveal attention modeling confirming hero subject captures $> 65\%$ focus.
7. **Dynamic Contrast & Legibility Inspector (`legibility`)**: Continuous local WCAG contrast tracking behind glyphs across moving backgrounds.
8. **Choreography Gantt & Stagger Visualizer (`rhythm`)**: Multi-track timeline bars showing entrance ease, dwell hold, and exit phase.
9. **Multi-Aspect Responsive Framing Inspector (`framing`)**: $2 \times 2$ contact plate auditing 16:9, 9:16 vertical, and 1:1 square simultaneously.

### Universal Telemetry vs. Specialized Lyric Rules
* **Universal Rules (`F04–F08`, `F11–F16`)**: Active for all motion design projects (collisions, safe clipping, persistence, dead motion, bloom, palette gamut, GPU frame budget, and blank dropouts).
* **Lyric-Specific Rules (`F01–F03`, `F09`, `F10`)**: Purpose-built exclusively for productions displaying on-screen lyrics and musical kick stems. **For any commercial, UI showcase, or non-lyric video, these flags do not apply and can be safely ignored.**

---

## 5. Optimized 4-Milestone Strategic Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│             OPTIMIZED 4-STAGE ARCHITECTURAL ROADMAP EXECUTION          │
├────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 1: CORE DECOUPLING, TRANSPARENCY & UNIFIED COORDINATES       │
│ • Universal TimelineDriver (ClockDriver, AudioDriver, SpeechDriver)    │
│ • WebGL alpha: true & alpha-preserving post.ts shader                  │
│ • Unify Camera3D Pinhole math with THREE.PerspectiveCamera & Viewport  │
│ • Pluggable DesignTokens & clean out legacy hardcoded constants        │
│ • Runnable 5-second procedural demo scene (verifies decoupling)        │
├────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 2: PROCEDURAL VECTOR PLUMBING, ANALYTIC SDFs & TELEMETRY     │
│ • SDFBatch (GPU rounded rects, trim paths, rings, soft drop shadows)   │
│ • Move high-draw elements off Canvas2D to eliminate 4K PCIe saturation │
│ • KineticText with telemetry bridge to SceneGraph/textProbes           │
│ • MotionBus (Analytical springs with initial velocity v0)              │
│ • WebGL State Cache Invariant (renderer.resetState() after batches)    │
├────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 3: SPATIAL HIERARCHIES, DUAL-MODE CAMERA & PARTICLES         │
│ • CameraRig (Perspective + Isometric, Bishop frames, SQUAD, arc-len)  │
│ • TransformNode & LayoutNode (3D anchors, safe-zone responsive pins)   │
│ • AnalyticalParticles (Stateless deterministic GPU emitters)           │
├────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 4: COMPOSITING, INTROSPECTION, DSL & AGENT HEALING           │
│ • CompositorGraph (Dual-texture track mattes, scoped post isolation)   │
│ • SceneGraph (Auto-derived 3D-to-2D screen bounds)                     │
│ • Declarative Scene DSL (defineScene, SceneContext, strict preloading) │
│ • ExportPipeline (Alpha WebM, ProRes 4444, H.264 MP4)                  │
│ • Machine-Actionable Self-Healing Directive Protocol (agent-heal)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Conclusion

With this universal architecture, the **Agentic Motion Design Toolset** breaks free from single-project assumptions. It becomes an all-in-one **generative motion graphics studio** where autonomous AI agents can design, animate, verify, and deliver commercial-grade motion graphics across **broadcast branding, product teasers, kinetic typography, UI showcases, data visualization, and audiovisual art**.
