# Agentic Motion Design Toolset

A production-grade, agent-accessible boilerplate and diagnostic inspection toolkit for procedural 60 fps WebGL/Canvas2D motion design and music video generation.

---

## 1. Core Philosophy: Instrumentation Over Grading

Earlier automated motion tools relied on arbitrary scalar thresholds (`jerk > 120 m/s³ = FAIL`, `R < 3.5 = HOLLOW`, `similarity > 0.88 = LAZY`). This penalized intentional artistic beat snaps, created blind spots, and incentivized agents to game arbitrary metrics.

This toolset operates on **Visual Instrumentation & Empirical Calibration**:
1. **Perceptual Sight Over Numbers**: Rather than parsing tables of scalars, agents and directors inspect **visual diagnostic images**—3D architectural blueprints, chromatic multi-exposure motion trails, side-by-side benchmark anchors, and head-to-tail seam overlays.
2. **Empirical Benchmarks Over Arbitrary Rules**: Non-objective metrics are calibrated against empirical reference distributions (`min`, $p_{10}$, $p_{50}$, $p_{90}$, `max`) extracted from the 22 plates of `Example project` (`calibration/example.json`).
3. **Three-Tier Review Architecture**:
   - **Tier A (Objective)**: True rendering bugs (text collisions, viewport clipping during sung windows, unintended blackouts, frame time spikes). Only Tier A may be `blocking`.
   - **Tier B (Benchmark)**: Empirical comparison against reference project distributions. Strictly `advisory` with one-line waiver logging.
   - **Tier C (Perceptual Proxies)**: Uncalibrated heuristic indicators. Strictly `info` ("do not optimize to").

---

## 2. The 4 Visual Diagnostic Instruments

All visual tools are implemented modularly in `app/scripts/visual/`, keeping `render.ts` lightweight and unbloated. Each tool can be executed via its dedicated script in `scripts/` or as a subcommand of `render.ts`.

| Instrument | CLI Command | Visual Artifacts | Purpose & Insights |
| :--- | :--- | :--- | :--- |
| **Multi-Exposure Motion Onion** | `bun scripts/onion.ts` | `onion_motion.png`<br>`onion_summary.json` | **Temporal motion arcs & easing on a single still**: Collapses an animation window ($0.5\text{–}1.5\text{s}$) into a chromatic ghost trail (cyan $\to$ white $\to$ amber), instantly exposing camera tremors, piecewise easing kinks, and velocity breaks without playing a video. |
| **3D God-View Camera Blueprint** | `bun scripts/godview.ts` | `cam_godview.png`<br>`godview_summary.json` | **3D spatial blindness & frustum clearances**: Renders orthographic top-down ($XZ$) and side elevation ($YZ$) blueprints showing scene geometry bounds, corridor walls, camera flight ribbons, and field-of-view viewing cones. |
| **Visual A/B Reference Anchor** | `bun scripts/compare.ts` | `ab_side_by_side.png`<br>`ab_split_wipe.png`<br>`ab_comparison.json` | **Aesthetic ground-truth benchmarking**: Automated side-by-side and $45^\circ$ diagonal split-wipe contact sheets directly comparing typographic scale, line thickness, and negative space against Example project reference plates. |
| **Transition Seam Stitch Inspector** | `bun scripts/stitch.ts` | `onion_seam.png`<br>`strip_seam.png`<br>`stitch_summary.json` | **Scene handoff cut inspector**: Overlays outgoing frame $N-1$ (green) and incoming frame $N$ (magenta) across cut boundaries ($\pm 250\,\text{ms}$) to verify carrier geometry alignment and horizon continuity. |

---

## 3. Calibrated Motion Telemetry Engine

Comprehensive 60 fps telemetry suite analyzing pixel dynamics, canvas text probes, and audio synchronization:

```bash
# Profile an entire plate or time window with empirical benchmark comparison
bun scripts/render.ts motion --from 8.0 --to 18.5 --only open --out ../out/motion/doors_audit
```

### Output Artifacts Generated
* **`report.md`**: Three-tier diagnostic markdown report with ranked top-5 findings and limits lines.
* **`findings.json`**: Machine-readable array of findings with stable IDs (`F01-001`, `F04-001`), tier tags, and waiver audit trails.
* **`summary.json`**: Global run parameters and flag tallies (`0 blocking, N advisory`).
* **`frames.csv`**: Per-frame telemetry (luma, contrast, Sobel edge density, FFT phase-correlation optical flow, palette shares).
* **`text.csv`**: Probe capture of all Canvas2D typography (bounding boxes, font size, layer, travel velocity).
* **`timeline.png` & `slitscan.png`**: Multi-track visual rhythm strip and spatio-temporal slit-scan.

---

## 4. Directory Structure

```
Agentic motion design toolset/
├── scripts/                          # Fast CLI forwarders
│   ├── render.ts                     # Master render entrypoint
│   ├── onion.ts                      # Multi-exposure onion skinner
│   ├── godview.ts                    # 3D God-view camera blueprint
│   ├── compare.ts                    # Visual A/B reference anchor
│   ├── stitch.ts                     # Transition seam cut inspector
│   └── calibrate.ts                  # Playwright benchmark calibrator
│
├── app/                              # Core procedural motion engine
│   ├── src/                          # Three.js / WebGL / Canvas2D codebase
│   │   ├── engine/                   # Camera3D, lines, audio, post-processing
│   │   ├── scenes/                   # Modular scene implementations
│   │   └── main.ts                   # Export harness & text probe interceptor
│   │
│   └── scripts/                      # Engine scripts
│       ├── render.ts                 # Lean dispatcher (dynamic imports)
│       ├── visual/                   # Modular visual diagnostic tools
│       │   ├── onion.ts              # Multi-exposure blender
│       │   ├── godview.ts            # Orthographic schematic renderer
│       │   ├── compare.ts            # Dual-harness visual comparator
│       │   └── stitch.ts             # Seam onion & filmstrip runner
│       │
│       └── motion/                   # Calibrated telemetry suite
│           ├── config.ts             # Rule thresholds & 3-tier catalog
│           ├── flags.ts              # Rule evaluation (F01–F16)
│           ├── pixel-metrics.ts      # Luma, edges, FFT flow, palette ΔE
│           ├── text-analyzer.ts      # Lyric join, collisions, clipping
│           └── report.ts             # 3-tier markdown & findings generator
│
├── calibration/                      # Ground-truth empirical datasets
│   ├── example.json                  # Reference distributions (min, p10, p50, p90, max)
│   └── director-notes.md             # Human artistic reactions & intent log
│
├── ideas/                            # Spatial diagnostic instruments specifications
│   ├── 01-godview-camera-blueprint.md
│   ├── 02-multi-exposure-motion-onion.md
│   ├── 03-visual-ab-reference-anchor.md
│   ├── 04-transition-seam-stitch-inspector.md
│   └── README.md
│
├── docs/                             # Engineering audit notes
│   ├── calibration-notes.md          # False-positive resolutions & threshold lineage
│   └── motion-report.md              # Telemetry report specification
│
└── tooling documentation/            # Architecture & engine documentation
    ├── visual-diagnostic-tools.md    # Guide for the 4 modular visual instruments
    ├── current-motion-system.md      # Detailed motion pipeline architecture
    └── README.md
```

---

## 5. Quick Start for AI Agents & Developers

### 1. Inspect Motion Smoothness & Easing
```bash
bun scripts/onion.ts --t 10.0 --frames 12 --out ../out/visual/onion
```

### 2. Inspect 3D Camera Flight & Spatial Clearances
```bash
bun scripts/godview.ts --from 8.0 --to 18.5 --samples 24 --out ../out/visual/godview
```

### 3. Compare Against the Example Project Reference
```bash
bun scripts/compare.ts --scene boundary --t 27.5 --ref loss --ref-t 14.2 --out ../out/visual/compare
```

### 4. Inspect a Scene Handoff Transition
```bash
bun scripts/stitch.ts --t 25.60 --out ../out/visual/stitch
```

### 5. Full Scene Telemetry & Verification Audit
```bash
bun scripts/render.ts motion --from 8.0 --to 18.5 --only open --out ../out/motion/audit
```
