# Tooling Documentation: Agentic Motion Design Engine

Welcome to the internal engineering and diagnostic tooling documentation for the **Agentic Motion Design Engine**.

This directory documents the inspection, profiling, and verification infrastructure that enables programmatic, deterministic, model-readable reviews of 60 fps procedural WebGL/Canvas2D motion design across **any domain**—commercial product reveals, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, brand identity resolves, and audiovisual productions.

---

## Tooling Documentation Index

### 1. Implemented Diagnostic Instruments (Operational Visual Tooling)
Comprehensive guides, CLI flags, visual output specifications, and agent remediation workflows for the **4 operational visual diagnostic instruments** in [`app/scripts/visual/`](../app/scripts/visual/):
* [**01. 3D God-View Camera Blueprint (`01-godview-camera-blueprint.md`)](./01-godview-camera-blueprint.md): Dual-panel orthographic top-down ($XZ$) and elevation ($YZ$) blueprints with velocity gradient flight ribbons and viewing cones.
* [**02. Multi-Exposure Motion Onion (`02-multi-exposure-motion-onion.md`)](./02-multi-exposure-motion-onion.md): Single-still chromatic temporal motion trails (cyan $\to$ natural $\to$ amber) exposing spring damping, camera tremors, and typography easing.
* [**03. Visual A/B Reference Anchor (`03-visual-ab-reference-anchor.md`)](./03-visual-ab-reference-anchor.md): Side-by-side contact plates and $45^\circ$ diagonal split-wipes benchmarking against Figma artboards and design tokens.
* [**04. Transition Seam Stitch Inspector (`04-transition-seam-stitch-inspector.md`)](./04-transition-seam-stitch-inspector.md): False-color green/magenta split-wipe onion overlays and 10-frame filmstrips across scene cut boundaries ($\pm 250\text{ms}$).
* [**Master Architectural Overview (`visual-diagnostic-tools.md`)](./visual-diagnostic-tools.md): Synthesis document covering cross-instrument architecture, execution performance, and agent decision trees.

### 2. [Operational Engine Architecture & API Reference (`engine-architecture.md`)](./engine-architecture.md)
* **Scope**: **100% IMPLEMENTED & VERIFIED**. Comprehensive architectural reference and developer guide for the 12 core engine modules in [`app/src/engine/`](../app/src/engine/):
  * **Module 1**: Universal Dual-Mode 6-DOF Camera Rig ([`rig.ts`](../app/src/engine/rig.ts))
  * **Module 2**: Transform Hierarchy & Responsive Layout ([`transform.ts`](../app/src/engine/transform.ts))
  * **Module 3**: Universal Kinetic Typography Engine ([`text.ts`](../app/src/engine/text.ts))
  * **Module 4**: Analytic GPU Signed Distance Fields ([`sdf.ts`](../app/src/engine/sdf.ts))
  * **Module 5**: Universal Motion Bus & Physical Solvers ([`motion.ts`](../app/src/engine/motion.ts))
  * **Module 6**: Stateless Analytical GPU Particles ([`particles.ts`](../app/src/engine/particles.ts))
  * **Module 7**: Scoped Render Graph & Track Matte Compositor ([`graph.ts`](../app/src/engine/graph.ts))
  * **Module 8**: Semantic Scene Graph & Entity Introspection ([`scenegraph.ts`](../app/src/engine/scenegraph.ts))
  * **Module 9**: Multi-Format Delivery & Headless Export ([`export.ts`](../app/src/engine/export.ts))
  * **Module 10**: Pluggable Brand Design Token System ([`tokens.ts`](../app/src/engine/tokens.ts))
  * **Module 11**: Directorial Self-Correction Contract ([`heal.ts`](../app/src/engine/heal.ts))
  * **Module 12**: Declarative Scene Authoring DSL & Strict Lifecycle ([`dsl.ts`](../app/src/engine/dsl.ts))
  * Complete scene authoring tutorial, code examples, and automated verification test suite guide.

### 3. [Motion Analysis Telemetry System (`current-motion-system.md`)](./current-motion-system.md)
* **Scope**: Full-spectrum 60 fps telemetry suite:
  * Engine hooks (`lines.ts`, `engine.ts`, `gl.ts`, `main.ts`).
  * Analytical pixel pipelines ($4 \times 4$ box-filter downsampling, Rec.709 luma, Cooley-Tukey 2D FFT phase correlation flow, Sobel edge density, CIE Lab $\Delta E_{76}$ palette shares).
  * Universal Canvas2D text probe interception (reading dwell time, typographic scale, depth parallax).
  * Three-tier review hierarchy (`Tier A: Objective`, `Tier B: Benchmark`, `Tier C: Proxies`).
  * Telemetry rule policy: Universal Motion Graphics Rules (`F04–F08`, `F11–F16`) vs. Lyric-Only Rules (`F01–F03`, `F09`, `F10`).
  * Output artifacts catalog (`report.md`, `findings.json`, `summary.json`, `frames.csv`, `text.csv`, `timeline.png`, `slitscan.png`).

### 4. [Engine Architectural Review & Universal Roadmap v2.4.0 (`engine-review-and-roadmap.md`)](./engine-review-and-roadmap.md)
* **Scope**: Historical specification, gap analysis, and 4-milestone roadmap for the engine overhaul (now 100% completed). Refer to [`engine-architecture.md`](./engine-architecture.md) for the active operational documentation.
  * **Module 1**: Continuous $C^2$ Camera Choreography Rig (`CameraRig`: Bishop frames, SQUAD, $O(1)$ arc-length LUT, isometric mode, lens presets).
  * **Module 2**: Universal Transform Hierarchy & Responsive Layout (`TransformNode` & `LayoutNode`: 3D anchors, safe-zone pins, depth scaling).
  * **Module 3**: Universal Kinetic Typography & Telemetry Bridge (`KineticText`: display titles, numeric rollers, knockout halos, direct telemetry emission).
  * **Module 4**: Analytic GPU Signed Distance Fields (`SDFBatch`: rounded rects, trim paths, rings, soft drop shadows, WebGL state reset invariant).
  * **Module 5**: Universal Motion Bus & Timeline Drivers (`MotionBus`: closed-form analytical springs with $v_0$, bezier easing, speech cues).
  * **Module 6**: Stateless Analytical GPU Particles (`AnalyticalParticles`: closed-form deterministic emitters surviving 324-spp blur).
  * **Module 7**: Scoped Render Graph & Track Matte Compositor (`CompositorGraph`: alpha/luma track mattes, scoped post-processing isolation).
  * **Module 8**: Semantic Scene Graph & Entity Introspection (`SceneGraph`: auto-projected 3D OBB $\to$ 2D screen AABB bounds).
  * **Module 9**: Multi-Format Delivery & Alpha Headless Export (`ExportPipeline`: transparent WebM alpha, ProRes 4444, H.264 MP4).
  * **Module 10**: Pluggable Brand Design Token System (`DesignTokens`: brand palettes configuring $\Delta E_{76}$ auditor).
  * **Module 11**: Directorial Self-Correction Contract (`AgentDirectorLoop` & `agent-heal`: machine-actionable repair directives in `findings.json`).
  * **Module 12**: Declarative Scene Authoring DSL & Strict Lifecycle (`defineScene`, `SceneContext`, `async preload`, font-ready gating).

### 4. [Proposed Diagnostic Instruments Roadmap (`../ideas/`)](../ideas/)
Architectural specifications and proposals for the next generation of diagnostic instruments (05–09) in [`ideas/`](../ideas/):
* [**05. Parametric Speed Graph Inspector**](../ideas/05-parametric-motion-curve-speed-graph.md)
* [**06. Visual Gaze Saliency Heatmap**](../ideas/06-visual-gaze-saliency-attention-heatmap.md)
* [**07. Dynamic Contrast & Legibility Inspector**](../ideas/07-dynamic-contrast-legibility-inspector.md)
* [**08. Choreography Gantt & Stagger Visualizer**](../ideas/08-choreography-gantt-stagger-rhythm.md)
* [**09. Multi-Aspect Responsive Framing Inspector**](../ideas/09-multi-aspect-responsive-framing.md)
