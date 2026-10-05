# Tooling Documentation: Agentic Motion Design Engine

Welcome to the internal engineering and diagnostic tooling documentation for the **Agentic Motion Design Engine**.

This directory documents the inspection, profiling, and verification infrastructure that enables programmatic, deterministic, model-readable reviews of 60 fps procedural WebGL/Canvas2D motion design.

---

## Tooling Documentation Index

### 1. [Visual Diagnostic Tools Architecture & User Guide (`visual-diagnostic-tools.md`)](./visual-diagnostic-tools.md)
* **Scope**: In-depth architecture, CLI parameters, visual schematics, and decision trees for the **4 modular visual instruments**:
  * **Multi-Exposure Motion Onion (`onion`)**: Chromatic temporal motion trails on a single still.
  * **3D God-View Camera Blueprint (`godview`)**: Dual-panel orthographic top-down ($XZ$) and elevation ($YZ$) blueprints.
  * **Visual A/B Reference Anchor (`compare`)**: Automated side-by-side and $45^\circ$ diagonal split-wipe benchmarking against reference plates.
  * **Transition Seam Stitch Inspector (`stitch`)**: Green/magenta head-to-tail cut overlay and 10-frame contact strip.

### 2. [Motion Analysis Telemetry System (`current-motion-system.md`)](./current-motion-system.md)
* **Scope**: Full-spectrum 60 fps telemetry suite:
  * Engine hooks (`lines.ts`, `engine.ts`, `gl.ts`, `main.ts`).
  * Analytical pixel pipelines ($4 \times 4$ box-filter, Rec.709 luma, Cooley-Tukey 2D FFT phase correlation flow, Sobel edge density, CIE Lab $\Delta E_{76}$ palette shares).
  * Canvas2D text probe interception and lyric word synchronization.
  * Three-tier review policy (`Tier A: Objective`, `Tier B: Benchmark`, `Tier C: Proxies`).
  * Output artifacts catalog (`report.md`, `findings.json`, `summary.json`, `frames.csv`, `text.csv`).

### 3. [Spatial Instruments Specification Catalog (`../ideas/`)](../ideas/)
Comprehensive technical specifications for the visual instruments in [`ideas/`](../ideas/):
* [**01. 3D God-View Camera Blueprint**](../ideas/01-godview-camera-blueprint.md)
* [**02. Multi-Exposure Motion Onion**](../ideas/02-multi-exposure-motion-onion.md)
* [**03. Visual A/B Reference Anchor**](../ideas/03-visual-ab-reference-anchor.md)
* [**04. Transition Seam Stitch Inspector**](../ideas/04-transition-seam-stitch-inspector.md)
