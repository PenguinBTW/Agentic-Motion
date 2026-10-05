# Engine Architectural Review & Universal Agentic Motion Graphics Roadmap

**Document Version**: 2.1.0  
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
* The agent cannot "eyeball" a timeline by dragging a scrubber; it relies on **headless visual telemetry, multi-exposure motion trails, 3D architectural blueprints, split-wipe benchmark comparators, and semantic scene introspection**.

The current engine provides an extraordinary foundation: **deterministic rendering $f(t)$, 60 fps headless Playwright capture, adaptive sub-frame motion blur, linear HDR optical post-processing, and high-performance GPU line batching**.

However, to serve as a **general-purpose engine for any motion graphic design or animation project**, the engine must eliminate single-project assumptions (such as treating all text as sung lyrics or assuming all timelines are driven by musical beats). It must provide universal motion primitives:
1. **Transform hierarchies with anchor-point parenting**
2. **Procedural vector shapes with trim paths and SVG support**
3. **Universal kinetic typography with character/word staggers**
4. **Declarative motion curves, physical springs, and multi-source modulation (speech, SFX, LFOs, silent clocks)**
5. **GPU instanced particles and field emitters**
6. **Multi-track compositing with alpha/luma track mattes and multi-aspect ratio viewports**
7. **Semantic scene graphs with VLM introspection**
8. **Multi-format headless export pipelines (transparent WebM, ProRes, MP4)**

---

## 2. Deep Audit of the Current Engine

### 2.1 Core Architectural Strengths (Preserve & Protect)

1. **Deterministic Mathematical Purity**: Every frame is an analytical function of timeline time $t$:
   $$\text{Frame} = f(t)$$
   Frames render bit-identically whether scrubbed backward in the interactive Vite player or encoded sequentially at 4K in headless Chrome.
2. **True Cinematic Sub-Frame Motion Blur**: The adaptive ternary sampling engine (`Engine.render`, 1 to 324 sub-frames) provides physically accurate motion blur, shutter simulation, and anti-aliasing without ghosting or temporal stepping.
3. **Linear HDR Optical Post-Processing**: 7-mip bloom pyramid, tone shoulder, halation, subtle chromatic aberration, film grain, and paper/ink inversion provide a cohesive, filmic baseline look out-of-the-box.
4. **High-Throughput GPU Capsule Lines (`LineBatch`)**: Instanced buffer geometry capable of rendering tens of thousands of anti-aliased 2D/3D lines per frame with screen-space or world-scale width.
5. **Integrated Visual Instrumentation**: The 4 visual diagnostic instruments (`onion`, `godview`, `compare`, `stitch`) and 3-tier telemetry suite provide immediate perceptual sight into motion, layout, and timing.

### 2.2 Critical Limitations for General-Purpose Motion Graphics

| Dimension | Current Implementation | Limitation for General Motion Design |
| :--- | :--- | :--- |
| **1. Transform Hierarchy & Parenting** | Flat coordinate calculations. No parent-child matrix transforms or anchor points. | Building compound animated objects (e.g. an animated phone with floating UI layers, a robotic arm, a rotating logo with orbiting satellites) requires tedious manual trigonometric calculations for every child element. |
| **2. Viewport & Aspect Ratios** | Hardcoded to 16:9 (`1920x1080` logical resolution). | Modern motion graphics require multi-aspect delivery: **9:16 vertical** (mobile/social/Reels), **1:1 square** (feeds), and **21:9 ultrawide** (cinematic). |
| **3. Vector Shapes & Primitives** | Only capsule line segments (`LineBatch`) and raw WebGL shaders (`FSPass`). | Motion design essentials—**filled rounded rectangles, trim paths, stroke offsets, polygon morphing, animated pie charts, starbursts, SVG import**—have no native engine primitives. |
| **4. Kinetic Typography Scope** | Tied to song lyric timestamps and word-level audio synchronization. | In general motion graphics, typography includes **brand headlines, feature callouts, data counters, lower thirds, speech transcripts, and editorial quotes** with character/word staggers. |
| **5. Timing & Trigger Sources** | Relies on an audio JSON dataset (`beats`, `downbeats`, `kicks`). | Many motion graphics projects are **silent loops (e.g. 5s logo resolves, UI teasers, looping trade-show backgrounds)** or driven by **speech voiceover transcripts and SFX cues** without musical beats. |
| **6. Compositing & Track Mattes** | Basic sequential scene switching with simple crossfade. | Cannot perform **track mattes** (alpha mattes, luma mattes, stencil reveals) or stack persistent global overlays (brand watermarks, technical HUDs, letterboxes) across scenes. |
| **7. Particles & Ambient Physics** | No particle engine. Lines and meshes must be simulated manually in JS. | Ambient dust motes, sparks on impact, confetti bursts, matrix digital rain, and floating UI orbs require custom per-frame loops. |
| **8. Semantic Scene Graph** | Black-box WebGL draw calls; text scraped via Canvas2D hooks. | Diagnostic tools cannot distinguish between a foreground UI card and a background 3D wall, producing false-positive collision and clipping alerts. |

---

## 3. The Universal Agentic Motion Graphics Architecture

To transform this foundation into a universal platform for any motion design genre, the engine is structured around nine modular subsystems:

```
┌────────────────────────────────────────────────────────────────────────┐
│            UNIVERSAL AGENTIC MOTION GRAPHICS ENGINE                    │
├────────────────────────────────────────────────────────────────────────┤
│  [8. Semantic Scene Graph]  ──> Entities, Roles, Bounding Volumes, HUD │
├────────────────────────────────────────────────────────────────────────┤
│  [3. Kinetic Typography]    ──> Titles, Callouts, Data Counters, Outlines│
│  [4. Procedural Vector 2D]  ──> Filled Shapes, Trim Paths, SVG, Morphs  │
│  [6. GPU Particle Engine]   ──> Sparks, Confetti, Ambient Dust, Fields │
│  [5. Universal Motion Bus]  ──> Springs, Bezier Curves, Speech, LFOs   │
│  [1. Continuous Camera Rig] ──> C2 Splines, Lens Presets, LookAt, Orbit│
│  [2. Transform Hierarchy]   ──> Anchor Points, Parent Matrices, TRS    │
├────────────────────────────────────────────────────────────────────────┤
│  [7. Multi-Track Compositor]──> Track Mattes, Stencils, Multi-Aspect   │
├────────────────────────────────────────────────────────────────────────┤
│  [9. Multi-Format Exporter] ──> Alpha WebM, ProRes, MP4, Stills, CSVs │
├────────────────────────────────────────────────────────────────────────┤
│  [Core Engine Foundations]  ──> Adaptive Sub-Sampler, Post, WebGL/GPU  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Module 1: Continuous $C^2$ Camera Choreography Rig (`CameraRig`)

#### Scope Across Motion Graphics
* **Product Teasers**: Smooth $360^\circ$ turntable orbits around a 3D gadget, zooming into specific ports or lenses.
* **UI/UX Showcases**: Isometric tilt down onto an app screen, dollying diagonally across feature cards.
* **Brand Ident Sequences**: Sweeping low-angle fly-by around an extruded metallic logo.
* **Architectural & Data Walkthroughs**: Seamless glide through 3D wireframe corridors or node clusters.

#### Architecture
The `CameraRig` eliminates piecewise acceleration breaks by computing **$C^2$ continuous Centripetal Hermite or Catmull-Rom splines** through 3D waypoints:

```typescript
export class CameraRig {
  // Add 3D waypoints with arrival times and gaze targets
  waypoint(t: number, pos: V3, lookAt?: V3, opts?: { fov?: number; roll?: number; snap?: boolean }): this;

  // Orbit / Turntable choreographies around an object
  orbit(center: V3, radius: number, speedDegPerSec: number, opts?: { elevation?: number; wobble?: number }): this;

  // Cinematic lens presets (replaces arbitrary focal lengths)
  lens(preset: '18mm' | '24mm' | '35mm' | '50mm' | '85mm' | '135mm'): this;

  // Target tracking with critically damped physical springs
  track(target: V3 | (() => V3), dampingRatio = 0.8, frequency = 2.5): this;

  // Impulse shake (simulates camera rumble or physical impacts without corrupting trajectory)
  shake(intensity: number, decay = 0.12): this;

  // Evaluates smooth 6-DOF camera at time t
  evaluate(t: number): Cam;
}
```

* **Value for Autonomous Agents**: Agents never have to manually calculate roll quaternions, look-at cross products, or piecewise easing splines. They declare spatial intent; the engine guarantees fluid cinema flight.

---

### Module 2: Universal Transform Hierarchy & Anchor-Point Parenting (`TransformNode`)

#### Scope Across Motion Graphics
* **Compound UI Elements**: A mobile phone frame rotating while nested app screens, floating buttons, and tooltip badges stay anchored and inherit transforms.
* **Rotational Pivots & Hinges**: Doors swinging on edge hinges, clock hands rotating from their base, progress dials rotating from center.
* **Complex Geometric Assemblies**: Robotic arms, solar system orbital graphics, kinetic logo monograms unfolding from folded facets.

#### Architecture
Every 2D or 3D graphical element inherits from `TransformNode`, introducing **anchor points** (the pivot point for rotation and scaling, normalized $[0..1]$ or pixel units) and recursive matrix concatenation:

```typescript
export class TransformNode {
  // Local Transform properties
  position: V3;               // Local translation [x, y, z]
  rotation: V3;               // Local Euler angles or Quaternion
  scale: V3;                  // Local scale [sx, sy, sz]
  anchor: [number, number];   // Pivot point: [0.5, 0.5] = center, [0, 1] = bottom-left

  // Hierarchy management
  parent: TransformNode | null;
  children: TransformNode[];

  addChild(node: TransformNode): this;
  removeChild(node: TransformNode): this;

  // Computes concatenated world matrix M_world = M_parent * M_local * T(-anchor)
  getWorldMatrix(): Matrix4;
  getWorldPosition(): V3;
}
```

* **Value for Autonomous Agents**: Agents can pivot any shape from its bottom-left, top-center, or exact geometric center simply by declaring `node.anchor = [0.5, 1.0]`. When animating scale bounces, the element scales up from its feet rather than from the screen origin.

---

### Module 3: Universal Kinetic Typography Engine (`KineticText`)

#### Scope Across Motion Graphics
* **Brand Manifestos & Hero Titles**: Bold display headlines fading up character-by-character with tracking expansion.
* **Product Teasers & UI Callouts**: Technical feature callout specs ("3.2 GHz", "OLED DISPLAY") pinned to 3D product anchors.
* **Voiceover Explainer Videos**: Speech-synchronized typography revealing sentences in rhythm with voice narration.
* **Data Visualizations & Financial Graphics**: Dynamic animated counters rolling smoothly from `$0` to `$1,420,000`.

#### Architecture
A declarative layout and animator pipeline for text in 2D screen-space or 3D world-space:

```typescript
export class KineticText {
  constructor(text: string, style: TextStyle);

  // Multi-line layout with alignment, optical tracking, and line leading
  layout(opts: { maxWidth?: number; align?: 'left' | 'center' | 'right'; tracking?: number; leading?: number }): this;

  // 3D Spatial Anchoring & Billboarding with depth-attenuated minimum readable scale
  anchor3D(worldPos: V3, cam: Cam, opts?: { billboard?: boolean; minPx?: number; maxPx?: number }): this;

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

  // Direct render to Layer2D or WebGL text batch
  render(ctx: CanvasRenderingContext2D, t: number): void;
}
```

* **Value for Autonomous Agents**: Replaces 200 lines of manual character loops and canvas string-measuring with a single, expressive builder that handles layout, animation, and legibility automatically.

---

### Module 4: Procedural Vector Primitives, Trim Paths & SVG Import (`VectorBatch`)

#### Scope Across Motion Graphics
* **UI/UX Motion**: Rounded cards expanding, toggle switches sliding, progress rings filling.
* **Brand & Logo Motion**: Geometry shapes morphing from an initial circle into a brand monogram, importing client SVGs.
* **Technical HUDs & Infographics**: Animated circular compass reticles, radar sweeps, crosshairs, and data bars.
* **Graphic Transitions**: Full-screen circle wipes, diagonal ribbon sweeps, and expanding iris masks.

#### Architecture
GPU-instanced procedural vector geometry with **trim path** support and SVG path loading:

```typescript
export class VectorBatch {
  // Primitives with animated trim paths (0..1 start and end)
  circle(cx: number, cy: number, r: number, style?: ShapeStyle, trim?: [number, number]): void;
  roundedRect(x: number, y: number, w: number, h: number, radius: number, style?: ShapeStyle): void;
  polygon(cx: number, cy: number, r: number, sides: number, style?: ShapeStyle): void;
  arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, style?: ShapeStyle): void;

  // SVG Vector Import: parses SVG path strings into animatable vector geometry
  loadSvgPath(svgPathD: string, transform?: Transform2D, trim?: [number, number]): void;

  // Technical HUD graphics
  reticle(cx: number, cy: number, r: number, mode?: 'cross' | 'bracket' | 'radial'): void;
  gauge(cx: number, cy: number, r: number, value01: number, rangeDeg?: [number, number]): void;

  // Vector Path Morphing between two bezier paths
  morph(pathA: Path2DData, pathB: Path2DData, progress01: number, style?: ShapeStyle): void;

  // Flush batch to WebGL render target
  flush(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void;
}
```

* **Trim Path Support**: Every vector shape supports `trim: [start, end]` (0 to 1), replicating After Effects' most widely used vector animation primitive for stroke reveals and drawing animations.

---

### Module 5: Universal Motion Bus & Animation Drivers (`MotionBus`)

#### Scope Across Motion Graphics
* **Physical Spring Bounces**: UI sheets snapping up with realistic mass, stiffness, and damping.
* **Cubic-Bezier Easing**: Classic motion curves (`easeInOutExpo`, `cubic-bezier(0.25, 0.1, 0.25, 1.0)`).
* **Multi-Element Stagger Math**: Spreading animations across $N$ elements (linear, center-out, random).
* **Voiceover & Speech Timing**: Syncing visual accents to voiceover transcript words/phonemes.
* **Procedural LFO Rhythms**: Looping background waves, ambient breathing lights, and technical scans in silent videos.

#### Architecture
A unified physics, curve interpolation, and signal modulation bus:

```typescript
export class MotionBus {
  // 1. Second-order physical spring solver (frequency in Hz, damping ratio zeta)
  spring(triggerT: number, t: number, opts?: { freq?: number; damping?: number; scale?: number }): number;

  // 2. Standard & Custom Bezier Easing Curves
  ease(t: number, t0: number, t1: number, curve: 'cubic' | 'expo' | 'elastic' | [number, number, number, number]): number;

  // 3. Stagger Engine: returns an array of delay offsets for N elements
  stagger(count: number, totalDuration: number, pattern?: 'start' | 'center-out' | 'random' | 'wave'): number[];

  // 4. Value Remapping with Easing
  remap(val: number, inMin: number, inMax: number, outMin: number, outMax: number, easeFn?: (u: number) => number): number;

  // 5. Procedural LFO Oscillators (for silent animations or ambient loops)
  lfo(wave: 'sine' | 'triangle' | 'saw' | 'square' | 'noise', frequencyHz: number, t: number): number;

  // 6. Speech & Voiceover Timing Stream (when voice narration is present)
  speechCue(cueId: string, t: number, window = 0.12): number;

  // 7. Audio Envelope Follower (when music/SFX stems are present)
  audioPeak(channel: 'master' | 'low' | 'mid' | 'high', t: number, window = 0.08): number;
}
```

* **Value for Autonomous Agents**: Guarantees physically natural bounce and spring settles, eliminating floaty, linear, or robotic movements across all animated properties.

---

### Module 6: GPU Particles & Instanced Field Simulation (`ParticleSystem`)

#### Scope Across Motion Graphics
* **Product Reveals**: Drifting illuminated dust motes, specular glints reflecting off 3D surfaces.
* **UI Micro-Interactions**: One-shot celebration confetti bursts on button clicks or transaction success states.
* **Technical & Sci-Fi Graphics**: Digital data packet streams flowing through network lines, matrix grid points.
* **Physical Impacts**: Sparks and shockwave rings radiating from high-energy scene cuts or collisions.

#### Architecture
Lightweight GPU instanced sprite particles driven by analytical fields:

```typescript
export interface ParticleEmitterOpts {
  capacity: number;           // Max particle count (e.g. 500–50,000)
  shape: 'circle' | 'square' | 'spark' | 'ring';
  rate: number;               // Continuous emission rate (particles/sec) or 0 for one-shot burst
  lifetime: [number, number]; // [minLife, maxLife] in seconds
  speed: [number, number];    // Emission velocity range
  color: [string, string];    // Color ramp start/end
  gravity?: V3;               // Global acceleration
  turbulence?: number;        // Curl noise dispersion intensity
}

export class ParticleSystem {
  createEmitter(opts: ParticleEmitterOpts): Emitter;
  burst(emitterId: string, count: number, origin: V3, t: number): void;
  render(renderer: THREE.WebGLRenderer, cam: Cam, t: number): void;
}
```

* **Value for Autonomous Agents**: Allows agents to add cinematic atmosphere and energetic impact with 3 lines of code without writing custom WebGL vertex buffers.

---

### Module 7: Multi-Track Compositor & Track Matte System (`LayerStack`)

#### Scope Across Motion Graphics
* **Track Mattes / Stencil Masks**: Revealing a 3D product or city through the silhouette of a typographic headline (Alpha Matte).
* **Multi-Layer Stacking**: Rendering a persistent global technical frame (timecodes, brand logo, crop marks) continuously over multiple independent 3D shots.
* **Multi-Aspect Ratio Canvas**: Rendering 16:9 widescreen, 9:16 vertical, and 1:1 square from the same scene with responsive camera adaptation.

#### Architecture
A hierarchical NLE compositor layer stack:

```typescript
export interface Layer {
  name: string;
  depth: 'background' | 'scene3d' | 'overlay2d' | 'hud';
  blendMode: 'normal' | 'add' | 'screen' | 'multiply';
  matte?: { type: 'alpha' | 'luma' | 'inverted-alpha'; sourceLayer: Layer };
  render(f: Frame, target: THREE.WebGLRenderTarget): void;
}

export class LayerStack {
  // Multi-aspect ratio viewport configuration (16:9, 9:16, 1:1, 21:9)
  setViewport(aspect: '16:9' | '9:16' | '1:1' | '21:9', customWidth?: number, customHeight?: number): this;

  // Add layer to stack
  addLayer(layer: Layer): this;

  // Global persistent HUD / Branding overlay
  setGlobalOverlay(overlay: Scene): this;

  // Asset layers: Video or image textures
  addVideoLayer(videoUrl: string, opts?: VideoLayerOpts): this;
  addImageLayer(imageUrl: string, opts?: ImageLayerOpts): this;

  // Shot transition effects
  transition(fromShot: Scene, toShot: Scene, t: number, opts: {
    type: 'cut' | 'dissolve' | 'wipe' | 'iris' | 'stencil-mask';
    duration: number;
    direction?: 'left' | 'right' | 'up' | 'down';
  }): void;
}
```

* **Value for Autonomous Agents**: Allows complex multi-element compositions to be assembled modularly, without cramming background shaders, 3D meshes, and 2D text into a single monolithic file.

---

### Module 8: Semantic Scene Graph & Entity Introspection (`SceneGraph`)

#### Scope Across Motion Graphics
* **Directorial Scene Inspection**: Allowing an AI agent to query the scene at any timestamp and get a complete semantic map:
  ```json
  {
    "t": 4.2,
    "camera": { "pos": [0, 1.2, 12], "fov": 35, "target": [0, 1.2, 0] },
    "entities": [
      { "id": "product_hero", "type": "mesh", "role": "hero_subject", "worldPos": [0, 1.2, 0] },
      { "id": "spec_title", "type": "text", "role": "headline", "screenBounds": [400, 200, 680, 248] },
      { "id": "battery_gauge", "type": "vector", "role": "hud_graphic", "screenBounds": [1600, 80, 1720, 140] }
    ]
  }
  ```
* **Telemetric Accuracy**: Enables the visual diagnostic instruments (`onion`, `godview`, `compare`, `stitch`, `motion`) to inspect exact semantic boundaries rather than guessing via pixel scraping.

#### Architecture
```typescript
export interface EntityMetadata {
  id: string;
  type: 'mesh' | 'text' | 'vector' | 'camera' | 'light' | 'emitter';
  role: 'hero_subject' | 'headline' | 'callout' | 'hud' | 'background';
  worldPos?: V3;
  worldBounds?: BoundingBox3D;
  screenBounds?: [number, number, number, number];
  opacity: number;
}

export class SceneGraph {
  register(entity: EntityMetadata): void;
  getEntities(t: number): EntityMetadata[];
  getEntityById(id: string): EntityMetadata | null;
}
```

* **Value for Autonomous Agents**: Gives vision-language models a structured semantic understanding of the visual scene, enabling intelligent self-correction and layout audits.

---

### Module 9: Multi-Format Delivery & Headless Export Pipeline (`ExportPipeline`)

#### Scope Across Motion Graphics
* **Production Master Delivery**: Rendering ProRes 422 HQ or high-bitrate H.264 MP4 with muxed audio.
* **Transparent Web Overlays**: Exporting transparent WebM (VP9 + alpha channel) for web animations and Lottie-style UI embeds.
* **Review Stills & Sequences**: Automated contact sheet generation at $4\text{K}$ or $1080\text{p}$.

#### Architecture
```typescript
export class ExportPipeline {
  // Configures headless encoder options
  exportVideo(opts: {
    format: 'mp4' | 'webm-alpha' | 'prores' | 'png-sequence';
    resolution: [number, number];
    fps: 60 | 30 | 24;
    from: number;
    to: number;
    audioTrack?: string;
    outPath: string;
  }): Promise<string>;
}
```

---

## 4. Re-Aligning Diagnostic Tooling & Telemetry

With this universal framing, our existing visual tools and telemetry rules are elevated into **universal motion graphics instruments**:

### 4.1 The 4 Visual Instruments Across Motion Design
1. **Multi-Exposure Motion Onion (`onion`)**:
   - Traces UI sheet spring reveals, 3D product turntable camera arcs, vector shape morph paths, and kinetic typography deceleration curves on a single still without video playback.
2. **3D God-View Camera Blueprint (`godview`)**:
   - Provides external top-down ($XZ$) and side elevation ($YZ$) architectural blueprints with viewing cones and velocity ribbons for 3D product orbits, architectural fly-throughs, and isometric UI layer presentations.
3. **Visual A/B Reference Anchor (`compare`)**:
   - Automates side-by-side and $45^\circ$ diagonal split-wipes directly comparing active procedural code against Figma artboards, brand style guidelines, or benchmark animation plates.
4. **Transition Seam Stitch Inspector (`stitch`)**:
   - Generates false-color green/magenta overlays ($\pm 250\,\text{ms}$) and 10-frame contact strips to verify carrier alignment during UI card-to-fullscreen expansions, commercial match-cuts, and chapter handoffs.

### 4.2 Universal Telemetry vs. Specialized Lyric Rules
The telemetry catalog is explicitly divided into two operational tiers:

#### A. Universal Motion Graphics Rules (`F04–F08`, `F11–F16`)
Active for **all** motion design projects:
* **F04 (`text_collision`)**: Overlapping 2D typography bounding boxes on matching depth planes.
* **F05 (`text_clipping`)**: Viewport safe-margin clipping ($90\%$ safe area).
* **F06 (`corner_persistence`)**: Static elements lingering in peripheral corner margins without motion.
* **F07 (`static_digit_persistence`)**: Frozen data tickers or metrics failing to animate.
* **F08 (`dead_motion`)**: Stalled timeline momentum outside intentional artistic holds.
* **F11 (`bone_bloom_bright_nonsignal`)**: Highlight exposure exceeding design system thresholds.
* **F12 (`palette_off_share`)**: Colors deviating from configured brand palette gamut ($\Delta E > 12.0$).
* **F13 (`perf_frame_time`)**: GPU playback budget alert ($> 25\,\text{ms}$ at 60 fps).
* **F14 (`sampler_max_spp`)**: Adaptive supersampling saturation.
* **F15 (`edge_shimmer_flicker`)**: Sub-pixel aliasing and moiré crawl.
* **F16 (`unintended_blank`)**: Unintended black/white screen dropouts.

#### B. Specialized Lyric & Music-Sync Rules (`F01–F03`, `F09`, `F10`)
*Purpose-built only for productions displaying synchronized on-screen lyrics and musical stems:*
* **F01 (`lyric_visibility`)**: Word display duration evaluated against `lyrics.json` sung window.
* **F02 (`sung_word_height`)**: Sung word peak cap height.
* **F03 (`word_anticipation`)**: Word anticipation lead before vocal onset.
* **F09 (`kick_response_ratio`)**: Kinetic energy response ratio on kick drum transient markers.
* **F10 (`cut_inside_sung_word`)**: Hard visual cut landing inside an active sung vocal word.

> **Operational Standard**: For any commercial, UI showcase, or non-lyric video, **rules `F01`, `F02`, `F03`, `F09`, and `F10` do not apply and can be completely ignored**.

---

## 5. Phased Implementation Roadmap

| Phase | Milestone | Core Deliverables | Value to General Motion Graphics |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Continuous $C^2$ Camera Rig** | `CameraRig`, Hermite/Catmull-Rom splines, lens presets, turntable orbits. | Eliminates camera tremors and jerky piecewise breaks across all 3D scenes. |
| **Phase 2** | **Transform Hierarchy & Parenting** | `TransformNode`, anchor points $[0..1]$, parent-child matrix concatenation. | Enables compound animated objects, rotational hinges, and layered UI motion. |
| **Phase 3** | **Universal Kinetic Typography** | `KineticText`, character/word staggers, numerical counters, knockout halos, 3D billboarding. | Powers brand headlines, voiceover titles, data counters, and feature callouts. |
| **Phase 4** | **Procedural Vector Shapes & Trim Paths** | `VectorBatch`, filled rounded rects, animated trim paths, reticles, SVG path import. | Enables UI/UX motion, technical HUD graphics, progress rings, and shape morphs. |
| **Phase 5** | **Universal Motion Bus & Easing** | `MotionBus`, physical spring solvers, cubic-bezier curves, stagger math, voiceover sync. | Replaces ad-hoc math with organic physics, spring bounces, and precise easing. |
| **Phase 6** | **GPU Particles & Instanced Fields** | `ParticleSystem`, instanced sprite emitters, sparks, confetti, turbulence fields. | Adds cinematic atmosphere, ambient dust, and high-energy collision impacts. |
| **Phase 7** | **Multi-Track Compositor & Mattes** | `LayerStack`, alpha/luma track mattes, multi-aspect ratio canvas (16:9, 9:16, 1:1, 21:9). | Enables vertical social videos, stencil reveals, and persistent global branding overlays. |
| **Phase 8** | **Semantic Scene Graph** | `SceneGraph`, entity registration, 3D bounding volumes, JSON introspection API. | Provides AI agents with a complete mental model of scene topology for self-correction. |
| **Phase 9** | **Multi-Format Export Pipeline** | `ExportPipeline`, transparent WebM (VP9 + alpha), ProRes 422, H.264 MP4. | Delivers production masters, web animation assets, and review sequences. |

---

## 6. Conclusion

With this universal architecture, the **Agentic Motion Design Toolset** breaks free from single-project assumptions. It becomes an all-in-one **generative motion graphics studio** where autonomous AI agents can design, animate, verify, and deliver commercial-grade motion graphics across **broadcast branding, product teasers, kinetic typography, UI showcases, data visualization, and audiovisual art**.
