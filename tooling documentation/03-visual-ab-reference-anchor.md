# Diagnostic Instrument 03: Visual A/B Reference Anchor (`compare`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/compare.ts`](../app/scripts/visual/compare.ts)  
**CLI Command**: `bun scripts/render.ts compare` or `bun scripts/visual/compare.ts`  
**Core Artifacts**: `ab_side_by_side.png`, `ab_split_wipe.png`, `compare_summary.json`  

---

## 1. Overview & Capability

The **Visual A/B Reference Anchor** is an automated visual comparison instrument that pairs frames from the active procedural motion graphics scene directly against authoritative design benchmarks—such as Figma keyframes, brand style guidelines, or reference animation plates—at identical 1080p resolution and scaling.

It replaces subjective aesthetic guesswork with direct visual juxtaposition, allowing autonomous agents and human art directors to verify typographic hierarchy, wireframe stroke weights, negative space discipline, and color gamut adherence.

---

## 2. Visual Artifacts Produced

### A. Side-by-Side Diagnostic Plate (`ab_side_by_side.png`)
Renders a 3840x1080 composite contact sheet pairing the active scene and reference benchmark side by side:
* **Left Half (1920x1080)**: Active procedural WebGL/Canvas2D scene at timestamp `--t`.
* **Right Half (1920x1080)**: Reference benchmark plate at matching timestamp `--ref-t`.
* **Header Annotations**: Embedded top banners displaying scene IDs, exact timestamps, and dimensional metadata.

```
┌────────────────────────────────────────┬────────────────────────────────────────┐
│ ACTIVE PROCEDURAL SCENE                │ REFERENCE DESIGN BENCHMARK             │
│ Scene: boundary (t = 27.50s)           │ Reference: loss (t = 14.20s)           │
│                                        │                                        │
│               [ HERO TITLE ]           │                 [ HERO TITLE ]         │
│                                        │                                        │
│         Wireframe stroke: 2.2px        │         Wireframe stroke: 1.0px        │
│         Negative space: 48%            │         Negative space: 70%            │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

### B. 50/50 Diagonal Split-Wipe Plate (`ab_split_wipe.png`)
Renders a single 1920x1080 frame bisected by a $45^\circ$ diagonal hairline cut:
* **Top-Left Triangle**: Active procedural scene.
* **Bottom-Right Triangle**: Reference benchmark plate.
* **The Perceptual Edge**: Because active and reference backgrounds meet directly along the $45^\circ$ boundary, disparities in stroke thickness, background black-point, bloom intensity, or font tracking jump out immediately to visual review models.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ACTIVE PROCEDURAL SCENE (Top-Left)       \                                      │
│                                           \                                     │
│                                            \  <--- 45° Diagonal Hairline Split  │
│                                             \                                   │
│                                              \       REFERENCE BENCHMARK        │
│                                               \      (Bottom-Right)             │
│                                                \                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### C. Comparison Summary Telemetry (`compare_summary.json`)
Emits metadata linking the comparison session:
```json
{
  "active_scene": "boundary",
  "active_t": 27.5,
  "ref_scene": "loss",
  "ref_t": 14.2,
  "resolution": [1920, 1080],
  "artifacts": [
    "ab_side_by_side.png",
    "ab_split_wipe.png"
  ]
}
```

---

## 3. How Autonomous Agents & Creators Use This Tool

### Diagnostic Workflow
1. **Auditing Wireframe Stroke Weight**:
   - In 3D procedural scenes, vector lines often default to 2–3px screen width, looking heavy and unrefined compared to sleek 1px hairline references. Inspecting `ab_split_wipe.png` directly highlights line weight disparities across the diagonal boundary.
2. **Preserving Negative Space & Breathing Room**:
   - Automated layout code frequently crowds the viewport ($< 45\%$ negative space). Comparing against the reference plate allows the agent to visually confirm whether title cards and callouts maintain generous $65\%\text{–}75\%$ breathing room.
3. **Calibrating Optical Bloom & Exposure**:
   - Bloom thresholds that appear fine in isolation often look radioactive when split-wiped against a calibrated reference. The agent uses the diagonal split to tune `bloomStrength` and tone mapping shoulders.

---

## 4. CLI Parameters & Execution

```bash
# Compare active scene at 27.5s against reference benchmark at 14.2s
bun scripts/render.ts compare --scene boundary --t 27.5 --ref loss --ref-t 14.2

# Explicit output folder and reference port
bun scripts/visual/compare.ts --scene hero --t 4.5 --ref brand_keyframe --ref-t 0.0 --out ../out/visual/compare
```

### Supported CLI Flags
* `--scene <id>`: Name of the active scene being inspected.
* `--t <seconds>`: Timestamp in the active scene (default: `27.50`).
* `--ref <id>`: Reference scene or plate identifier (default: `loss`).
* `--ref-t <seconds>`: Timestamp in the reference benchmark (default: `14.20`).
* `--port <number>`: Port of the reference Vite server if spawning a comparison instance (default: `5189`).
* `--out <dir>`: Target directory for composite comparison images (default: `../out/visual/compare`).
