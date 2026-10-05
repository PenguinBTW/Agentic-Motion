# Motion Report Mode (`scripts/render.ts motion`)

A model-readable, deterministic motion profiling tool for programmatic visual and temporal verification across plates.

---

## 1. CLI Usage

```bash
bun scripts/render.ts motion --url http://localhost:5174 --only <plate-id|scene-file> \
  --from <start-s> --to <end-s> --out <fresh-out-dir> \
  [--fps 60] [--scale 1] [--samples 1] [--shutter 0] [--bin 0.25] [--topn 12] \
  [--events 8.5,11.0,12.5] [--event-offsets -0.2,-0.1,0,0.05,0.1,0.2,0.4] \
  [--palette ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A] \
  [--allow-blank 0-0.6] [--compare path/to/reference/summary.json]
```

*Note: `--out` must point to a new directory. Analysis resolution is 480×270 (4×4 box-downscaled from 1920×1080).*

---

## 2. Output File Index

| File | Format | Contents & Purpose |
| :--- | :--- | :--- |
| `report.md` | Markdown | Fact-only model report with fixed sections (0–12), ranked top-5 findings, units in headers, and limits rows. |
| `findings.json` | JSON | Machine-readable log of all Tier A, B, and C findings with stable IDs, timestamps, evidence files, and reviewer waiver logs. |
| `summary.json` | JSON | Machine-readable aggregate numbers, flag items, tier counts, and timing distributions (used by `--compare`). |
| `frames.csv` | CSV | Per-frame metrics: $E, E_{p95}, \text{flow}_{dx}, \text{flow}_{dy}$, luma, contrast, edge density, signal%, shimmer, segs, ms, spp. |
| `text.csv` | CSV | Canvas2D text draw trace: frame index, timestamp, string, font, bounding box, alpha, layer ID. |
| `events.json` | JSON | Event catalogue: detected cuts, beats, kick/snare onsets, lyric word timestamps. |
| `timeline.png` | PNG | 1920px stacked time-series plot with shared time axis ($E$, luma, signal%, edge density, text height, ms). |
| `slitscan.png` | PNG | Center-column slit scan (4px/frame, wrapping at 1920px) showing camera speed ramps and continuity. |
| `strip_<label>.png`| PNG | Event contact filmstrip sampled at `--event-offsets` around key moments (cuts, kicks, collisions). |
| `rgbtime_<label>.png`| PNG | RGB temporal composite ($R = i-2, G = i, B = i+2$) revealing directional velocity and spatial fringing. |
| `events/<label>.csv`| CSV | High-precision per-frame table for $\pm 0.5\,\text{s}$ surrounding each diagnostic event. |

---

## 3. Flag Classification & Three-Tier System

Diagnostic findings are categorized into **3 strict tiers** to prevent Goodhart's law optimization traps and subjective grading loops:

### Tier A: Objective Findings (`source: objective`, `class: blocking` / `advisory`)
Hard mathematical, geometric, or rendering facts. Only Tier A objective findings may be marked `blocking`:
- `F04` (Text Collision): Overlapping text bounding boxes ($\alpha > 0.15$ each) by $> 2\%$ of the smaller box (`blocking`).
- `F05` (Text Clipping): Text clipped outside viewport edges by $> 5\%$ of its box (`blocking`).
- `F10` (Vocal Word Cut): Hard visual cut falls inside an active sung vocal word (`blocking`).
- `F16` (Blank Dropout): Near-black or near-white screen run $> 0.3\,\text{s}$ outside `--allow-blank` (`blocking`).
- `F13` (Frame Render Time): Frame render time $> 25\,\text{ms}$ GPU playback budget (`advisory`).

### Tier B: Calibrated Benchmark Comparisons (`source: calibrated`, `class: advisory`)
Measured numbers compared against empirical distributions from `Example project` (`calibration/example.json`). A flag triggers only when values fall outside the Example project's min–max range:
- `F01` (Lyric Visibility): Word visible for less than the Example project min sung window duration.
- `F02` (Sung Word Height): Word peak height below the Example project min threshold.
- `F03` (Word Anticipation): Word appears earlier than the Example project max anticipation lead.
- `F09` (Kick Response Ratio): Kick motion energy response ratio below Example project min.
- `F11` (Bone Bloom): Bright non-signal pixels above Example project max.
- `F12` (Off-Palette Wash): Off-palette pixels ($\Delta E > 12$) above Example project max.
- `F14` (Sampler Saturation): Adaptive sampler reached 324 sub-frames.
- `F15` (Edge Shimmer): Edge shimmer index above Example project max.

*Review Policy*: **Advisory only.** Reviewers may waive any Tier B flag with a one-line written reason in `findings.json`. Review gates must never block or loop on Tier B flags.

### Tier C: Perceptual Proxies (`source: guess`, `class: info`)
Uncalibrated heuristics. Informational only — **do not optimize code to satisfy Tier C**:
- `F06` (Corner Persistence): Text persisting in corner margin $> 3.0\,\text{s}$ (uncalibrated proxy).
- `F07` (Static Digit Persistence): Static number unchanging in slot $> 3.0\,\text{s}$ (uncalibrated proxy).
- `F08` (Dead Motion): Motion energy $E < \epsilon$ for $> 0.5\,\text{s}$ (uncalibrated proxy).

---

## 4. Known Blind Spots

1. **Shader / Texture Font Atlases (`TextPlane`, MSDF, raw WebGL)**: The probe intercepts Canvas2D `fillText` / `strokeText` on the CPU side. Text geometry baked into GPU shaders or custom WebGL pipelines is invisible to `text.csv`. Global pixel metrics (luma, flow, edge density, palette shares) still inspect those frames accurately.
2. **Sub-pixel Anti-aliasing Jitter**: At low resolutions ($480 \times 270$), high-frequency sub-pixel wireframe shimmer can register low-level motion energy even when camera coordinates are stationary.
3. **Adaptive Supersampling Text Capture**: When `--samples auto` or `--samples N` is active, text probes are recorded on sub-frame 0 (unblurred) to avoid redundant duplicate entries.
