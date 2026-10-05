# Tooling Documentation: Gemini Music Video Production Engine

Welcome to the internal engineering and diagnostic tooling documentation for the **Gemini Music Project** (`Who's Holding On To Who?`).

This directory documents the inspection, profiling, and verification infrastructure that enables programmatic, deterministic, model-readable reviews of the 60fps procedural WebGL/Canvas2D video.

---

## Document Index

1. [**Motion Analysis System (`current-motion-system.md`)**](./current-motion-system.md)
   - Architecture of `scripts/render.ts motion`
   - Engine hooks (`lines.ts`, `engine.ts`, `gl.ts`, `main.ts`)
   - Pixel metrics pipeline ($4 \times 4$ box-filter, Rec.709 luma, Cooley-Tukey 2D FFT phase-correlation flow, Sobel edge density, CIE Lab $\Delta E_{76}$ palette shares)
   - Canvas2D text probe interception and lyric word synchronization
   - Output artifacts catalog (`report.md`, `summary.json`, `frames.csv`, `text.csv`, `events.json`, diagnostic plots and strips)
   - 3-tier classification: `objective` (blocking bugs), `calibrated` (advisory benchmark range), `guess` (informational proxies)
   - Known blind spots and best practices

2. [**Tooling Roadmap & Spatial Instruments (`../ideas/`)**](../ideas/)
   - Specifications for the 7 visual diagnostic and spatial blueprint instruments:
     - [**01. 3D Camera Trajectory Ribbon & Blueprint**](../ideas/01-3d-camera-trajectory-blueprint.md): External top-down architectural blueprint, frustum cone, and speed-vs-acceleration phase plot.
     - [**02. De-Cluttered Structural Passes & Layer Telemetry**](../ideas/02-decluttered-structural-passes.md): Decomposited scene passes (wireframes, text planes, depth map) and spatial frequency breakdown.
     - [**03. Visual Gaze Trail & Saliency Heatmap**](../ideas/03-visual-gaze-trail-saliency.md): 2D attention ribbon and multi-feature visual saliency heatmap detecting competing background clutter.
     - [**04. Transition Seam Onion-Skin & Carrier Stitch Inspector**](../ideas/04-transition-seam-stitch-inspector.md): Boundary seam onion overlay and carrier continuity validator across cuts.
     - [**05. Macro Song Pacing & Dynamic Range Dashboard**](../ideas/05-macro-song-pacing-dashboard.md): Whole-song 4 fps stacked timeline comparing audio RMS against camera speed and visual density.
     - [**06. Ground-Truth Benchmark Calibration & Delta**](../ideas/06-benchmark-calibration-delta.md): Empirical benchmark distributions ($p_{10}\text{–}p_{90}$) from `Example project` and cross-scene variety matrix.
     - [**07. Audio-Visual Spectral Alignment & Perspective Guides**](../ideas/07-audiovisual-spectral-alignment.md): Multiband waveform alignment (bass, vocals, hi-hats) and vanishing point / horizon line diagnostic overlays.
