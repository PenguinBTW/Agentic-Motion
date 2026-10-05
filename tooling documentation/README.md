# Tooling Documentation: Agentic Motion Design Engine

Welcome to the internal engineering and diagnostic tooling documentation for the **Agentic Motion Design Engine**.

This directory documents the inspection, profiling, and verification infrastructure that enables programmatic, deterministic, model-readable reviews of 60 fps procedural WebGL/Canvas2D motion design across **any domain**—commercial product reveals, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, brand identity resolves, and audiovisual productions.

---

## Tooling Documentation Index

### 1. [Visual Diagnostic Tools Architecture & User Guide (`visual-diagnostic-tools.md`)](./visual-diagnostic-tools.md)
* **Scope**: In-depth architecture, CLI parameters, visual schematics, and agent decision trees for the **4 modular visual instruments**:
  * **Multi-Exposure Motion Onion (`onion`)**: Chromatic temporal motion trails on a single still (UI springs, 3D camera arcs, kinetic typography easing).
  * **3D God-View Camera Blueprint (`godview`)**: Dual-panel orthographic top-down ($XZ$) and elevation ($YZ$) blueprints (product turntable orbits, architectural fly-throughs, UI depth layers).
  * **Visual A/B Reference Anchor (`compare`)**: Automated side-by-side and $45^\circ$ diagonal split-wipe benchmarking against Figma mockups, brand guidelines, or reference animation plates.
  * **Transition Seam Stitch Inspector (`stitch`)**: Green/magenta head-to-tail cut overlay and 10-frame contact filmstrip (commercial match-cuts, UI modal push/pop expansions).

### 2. [Motion Analysis Telemetry System (`current-motion-system.md`)](./current-motion-system.md)
* **Scope**: Full-spectrum 60 fps telemetry suite:
  * Engine hooks (`lines.ts`, `engine.ts`, `gl.ts`, `main.ts`).
  * Analytical pixel pipelines ($4 \times 4$ box-filter downsampling, Rec.709 luma, Cooley-Tukey 2D FFT phase correlation flow, Sobel edge density, CIE Lab $\Delta E_{76}$ palette shares).
  * Universal Canvas2D text probe interception (reading dwell time, typographic scale, depth parallax).
  * Three-tier review hierarchy (`Tier A: Objective`, `Tier B: Benchmark`, `Tier C: Proxies`).
  * Output artifacts catalog (`report.md`, `findings.json`, `summary.json`, `frames.csv`, `text.csv`, `timeline.png`, `slitscan.png`).

### 3. [Engine Review & Universal Architecture Roadmap v2.1.0 (`engine-review-and-roadmap.md`)](./engine-review-and-roadmap.md)
* **Scope**: In-depth architectural audit of engine capabilities, analysis of autonomous agent authoring bottlenecks, and a 9-module universal motion graphics roadmap:
  * **Module 1**: Continuous $C^2$ Camera Choreography Rig (`CameraRig`: Hermite/Catmull-Rom splines, turntable orbits, lens presets).
  * **Module 2**: Universal Transform Hierarchy & Anchor-Point Parenting (`TransformNode`: anchor pivots $[0..1]$, recursive matrix concatenation).
  * **Module 3**: Universal Kinetic Typography & Layout Engine (`KineticText`: display titles, UI callouts, animated numeric rollers, 3D billboarding, knockout halos).
  * **Module 4**: Procedural Vector Primitives, Trim Paths & SVG Import (`VectorBatch`: filled rounded rects, trim paths, reticles, circular gauges, SVG path loader).
  * **Module 5**: Universal Motion Bus & Animation Drivers (`MotionBus`: second-order springs, cubic-bezier curves, stagger math, voiceover & audio envelopes).
  * **Module 6**: GPU Particles & Instanced Field Simulation (`ParticleSystem`: sparks, confetti bursts, drifting dust, analytical force fields).
  * **Module 7**: Multi-Track Layer Compositor & Track Mattes (`LayerStack`: alpha/luma track mattes, video/image layers, multi-aspect ratio viewports: 16:9, 9:16, 1:1, 21:9).
  * **Module 8**: Semantic Scene Graph & Entity Introspection Registry (`SceneGraph`: first-class entity registry for vision-language models).
  * **Module 9**: Multi-Format Delivery & Headless Export Pipeline (`ExportPipeline`: transparent WebM with alpha, ProRes 422 HQ, H.264 MP4).

### 4. [Spatial Diagnostic Instruments Catalog (`../ideas/`)](../ideas/)
Comprehensive technical specifications for each individual instrument in [`ideas/`](../ideas/):
* [**01. 3D God-View Camera Blueprint**](../ideas/01-godview-camera-blueprint.md)
* [**02. Multi-Exposure Motion Onion**](../ideas/02-multi-exposure-motion-onion.md)
* [**03. Visual A/B Reference Anchor**](../ideas/03-visual-ab-reference-anchor.md)
* [**04. Transition Seam Stitch Inspector**](../ideas/04-transition-seam-stitch-inspector.md)
