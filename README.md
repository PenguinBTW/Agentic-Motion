# Agentic Motion Design Toolset

A production-grade, agent-accessible boilerplate and diagnostic inspection toolkit for procedural 60 fps WebGL/Canvas2D motion design across **any domain**—commercial product reveals, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, brand identity resolves, and audiovisual productions.

---

## 1. Core Philosophy: Instrumentation Over Grading

Earlier automated motion design tools relied on arbitrary scalar thresholds (`jerk > 120 m/s³ = FAIL`, `R < 3.5 = HOLLOW`, `similarity > 0.88 = LAZY`). This penalized intentional artistic accents, created blind spots, and incentivized agents to game arbitrary numbers.

This toolset operates on **Visual Instrumentation & Empirical Calibration**:
1. **Perceptual Sight Over Numbers**: Rather than parsing tables of scalars, agents and art directors inspect **visual diagnostic images**—3D architectural blueprints, chromatic multi-exposure motion trails, side-by-side design benchmark anchors, and head-to-tail transition seam overlays.
2. **Empirical Benchmarks Over Arbitrary Rules**: Non-objective metrics are calibrated against empirical reference distributions (`min`, $p_{10}$, $p_{50}$, $p_{90}$, `max`) extracted from approved production plates (`calibration/example.json`).
3. **Three-Tier Review Architecture**:
   - **Tier A (Objective)**: True physical or rendering bugs (text collisions, viewport safe-margin clipping, unintended blackouts, frame render time spikes). Only Tier A may be `blocking` in CI gates.
   - **Tier B (Benchmark)**: Empirical comparison against reference project distributions. Strictly `advisory` with one-line waiver logging.
   - **Tier C (Perceptual Proxies)**: Uncalibrated exploratory heuristics. Strictly `info` ("do not optimize to").

---

## 2. The 4 Visual Diagnostic Instruments

All visual tools are implemented modularly in `app/scripts/visual/`, keeping `render.ts` lightweight and unbloated. Each tool can be executed via its dedicated forwarder in `scripts/` or as a subcommand of `render.ts`.

| Instrument | CLI Command | Visual Artifacts | Purpose & Insights Across Motion Design |
| :--- | :--- | :--- | :--- |
| **Multi-Exposure Motion Onion** | `bun scripts/onion.ts`<br>`bun scripts/render.ts onion` | `onion_motion.png`<br>`onion_summary.json` | **Temporal motion arcs & easing on a single still**: Collapses an animation window ($0.5\text{–}1.5\text{s}$) into a chromatic ghost trail (cyan $\to$ natural $\to$ amber), instantly exposing camera micro-tremors, physical spring oscillation damping, vector morph glitches, and kinetic typography deceleration without video playback. |
| **3D God-View Camera Blueprint** | `bun scripts/godview.ts`<br>`bun scripts/render.ts godview` | `cam_godview.png`<br>`godview_summary.json` | **3D spatial blindness & frustum clearances**: Renders orthographic top-down ($XZ$) and side elevation ($YZ$) blueprints showing scene geometry bounds, hero product anchors, camera flight ribbons, and field-of-view viewing cones. Prevents near-plane clipping and spatial collisions. |
| **Visual A/B Reference Anchor** | `bun scripts/compare.ts`<br>`bun scripts/render.ts compare` | `ab_side_by_side.png`<br>`ab_split_wipe.png`<br>`ab_comparison.json` | **Aesthetic ground-truth benchmarking**: Automated side-by-side and $45^\circ$ diagonal split-wipe contact sheets directly comparing typographic scale, stroke weights, negative space ratio, and color gamut against Figma keyframes, brand guidelines, or benchmark plates. |
| **Transition Seam Stitch Inspector** | `bun scripts/stitch.ts`<br>`bun scripts/render.ts stitch` | `onion_seam.png`<br>`strip_seam.png`<br>`stitch_summary.json` | **Scene handoff & UI state cut inspector**: Overlays outgoing frame $N-1$ (green) and incoming frame $N$ (magenta) across cut boundaries ($\pm 250\,\text{ms}$) to verify carrier geometry alignment (UI cards, logos, focal anchors), velocity continuity, and horizon stability. |

---

## 3. Calibrated Motion Telemetry Engine

Comprehensive 60 fps telemetry suite analyzing pixel dynamics, canvas text probes, and audio synchronization:

```bash
# Profile an entire scene or time window with empirical benchmark comparison
bun scripts/render.ts motion --from 4.0 --to 12.0 --only hero_reveal --out ../out/motion/reveal_audit
```

### Output Artifacts Generated
* **`report.md`**: Three-tier diagnostic markdown report with ranked top-5 findings and physical limits lines.
* **`findings.json`**: Machine-readable array of findings with stable IDs (`F01-001`, `F04-001`), tier tags, and waiver audit trails.
* **`summary.json`**: Global run parameters and flag tallies (`0 blocking, N advisory`).
* **`frames.csv`**: Per-frame telemetry (luma, contrast, Sobel edge density, FFT phase-correlation optical flow, palette shares).
* **`text.csv`**: Probe capture of all Canvas2D typography (bounding boxes, font size, layer, travel velocity).
* **`events.json`**: Event catalogue of cuts, audio transients, and animation state triggers.
* **`timeline.png` & `slitscan.png`**: Multi-track visual rhythm strip and spatio-temporal slit-scan.

> [!NOTE]
> **Universal vs. Lyric-Only Telemetry Rules**:
> - **Universal Rules (`F04–F08`, `F11–F16`)**: Evaluate typography collisions, viewport margin clipping, palette gamut conformity, highlight bloom, and GPU performance across **all** motion design projects.
> - **Lyric & Music-Sync Rules (`F01–F03`, `F09`, `F10`)**: Specifically evaluate on-screen vocal word timing and kick-transient kinetics. For non-lyric projects (commercials, UI/UX, 3D reveals), **these flags can simply be ignored**.

---

## 4. Directory Structure

```
Agentic motion design toolset/
├── scripts/                          # Fast CLI forwarders
│   ├── render.ts                     # Master render entrypoint
│   ├── onion.ts                      # Multi-exposure motion onion forwarder
│   ├── godview.ts                    # 3D God-view camera blueprint forwarder
│   ├── compare.ts                    # Visual A/B reference anchor forwarder
│   ├── stitch.ts                     # Transition seam cut inspector forwarder
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
│       │   ├── onion.ts              # Multi-exposure chromatic blender
│       │   ├── godview.ts            # Orthographic schematic renderer
│       │   ├── compare.ts            # Dual-harness visual comparator
│       │   └── stitch.ts             # Seam onion & filmstrip generator
│       │
│       └── motion/                   # Calibrated telemetry suite
│           ├── config.ts             # Rule thresholds & 3-tier catalog
│           ├── flags.ts              # Rule evaluation (F01–F16)
│           ├── pixel-metrics.ts      # Luma, edges, FFT flow, palette ΔE
│           ├── text-analyzer.ts      # Dwell time, collisions, safe clipping
│           └── report.ts             # 3-tier markdown & findings generator
│
├── calibration/                      # Ground-truth empirical datasets
│   ├── example.json                  # Reference distributions (min, p10, p50, p90, max)
│   └── director-notes.md             # Directorial artistic feedback & intent log
│
├── ideas/                            # Visual diagnostic instrument specifications
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
└── tooling documentation/            # Comprehensive engineering documentation
    ├── visual-diagnostic-tools.md    # Guide for the 4 modular visual instruments
    ├── current-motion-system.md      # Detailed motion pipeline architecture
    ├── engine-review-and-roadmap.md  # Universal engine architecture & roadmap (v2.0.0)
    └── README.md
```

---

## 5. Quick Start for Autonomous AI Agents & Developers

### 1. Inspect Motion Smoothness, Springs & Easing
```bash
# Collapses a 0.5s window into a chromatic ghost trail
bun scripts/onion.ts --scene modal_reveal --t 2.40 --frames 12 --out ../out/visual/modal_spring
```

### 2. Inspect 3D Camera Flight & Spatial Clearances
```bash
# Renders orthographic top-down and side elevation blueprints
bun scripts/godview.ts --scene product_turntable --from 4.0 --to 12.0 --samples 32 --out ../out/visual/product_orbit
```

### 3. Compare Against Design Tokens or Figma Reference
```bash
# Generates side-by-side and 45° diagonal split-wipe contact sheets
bun scripts/compare.ts --scene dashboard_hud --t 5.20 --ref figma_keyframe --ref-t 5.20 --out ../out/visual/hud_vs_figma
```

### 4. Inspect a Scene Handoff Transition or UI State Change
```bash
# Generates green/magenta onion overlay and 10-frame seam filmstrip
bun scripts/stitch.ts --from-scene macro_shot --to-scene wide_reveal --t 6.40 --out ../out/visual/seam_audit
```

### 5. Full Scene Telemetry & Verification Audit
```bash
# Evaluates F01-F16 rules and outputs report.md, findings.json, and CSVs
bun scripts/render.ts motion --from 4.0 --to 12.0 --only hero_reveal --out ../out/motion/audit
```
