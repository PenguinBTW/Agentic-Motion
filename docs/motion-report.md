# Motion Telemetry Report Specification (`scripts/render.ts motion`)

A model-readable, deterministic motion profiling and visual telemetry specification for programmatic verification across **any procedural motion graphic design project**—commercial product reveals, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, and audiovisual productions.

---

## 1. CLI Usage

```bash
bun scripts/render.ts motion --url http://localhost:5173 --only <scene-id|scene-file> \
  --from <start-s> --to <end-s> --out <fresh-out-dir> \
  [--fps 60] [--scale 1] [--samples 1] [--shutter 0] [--bin 0.25] [--topn 12] \
  [--events 4.5,8.0,12.5] [--event-offsets -0.2,-0.1,0,0.05,0.1,0.2,0.4] \
  [--palette ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A] \
  [--allow-blank 0-0.6] [--compare path/to/reference/summary.json]
```

*Note: `--out` must point to a new directory. Analysis resolution is 480×270 (4×4 box-downscaled from 1920×1080).*

---

## 2. Output File Index

| File | Format | Contents & Purpose |
| :--- | :--- | :--- |
| `report.md` | Markdown | Fact-only model report with fixed sections (0–12), ranked top-5 findings, physical units in headers, and table row caps. |
| `findings.json` | JSON | Machine-readable log of all Tier A, B, and C findings with stable IDs, timestamps, evidence files, and reviewer waiver logs. |
| `summary.json` | JSON | Machine-readable aggregate numbers, flag items, tier counts, and timing distributions (used by `--compare`). |
| `frames.csv` | CSV | Per-frame metrics: $E, E_{p95}, \text{flow}_{dx}, \text{flow}_{dy}$, luma, contrast, edge density, signal%, shimmer, segs, ms, spp. |
| `text.csv` | CSV | Canvas2D text draw trace: frame index, timestamp, string, font, bounding box, alpha, layer ID. |
| `events.json` | JSON | Event catalogue: detected cuts, voiceover word boundaries, audio transients, and animation state triggers. |
| `timeline.png` | PNG | 1920px stacked time-series plot with shared time axis ($E$, luma, signal%, edge density, text height, ms). |
| `slitscan.png` | PNG | Center-column slit scan (4px/frame, wrapping at 1920px) showing camera speed ramps and continuity. |
| `strip_<label>.png`| PNG | Event contact filmstrip sampled at `--event-offsets` around key moments (cuts, transients, state triggers). |
| `rgbtime_<label>.png`| PNG | RGB temporal composite ($R = i-2, G = i, B = i+2$) revealing directional velocity and spatial fringing. |
| `events/<label>.csv`| CSV | High-precision per-frame table for $\pm 0.5\,\text{s}$ surrounding each diagnostic event. |

---

## 3. Flag Classification & Three-Tier Hierarchy

Diagnostic findings are categorized into **3 strict tiers** to prevent Goodhart's law optimization traps and subjective grading loops.

> [!IMPORTANT]
> **Universal vs. Lyric-Only Flags**:
> - **Universal Motion Design Rules (`F04–F08`, `F11–F16`)**: Active for all motion graphic projects (commercials, UI animations, 3D reveals, data visualizers).
> - **Lyric & Music-Sync Rules (`F01–F03`, `F09`, `F10`)**: **Exclusively designed for reviewing videos with synchronized lyrics and musical kicks.** If a project does not display on-screen lyrics or have kick audio stems, **these flags do not apply and can be safely ignored**.

### Tier A: Objective Findings (`source: objective`, `class: blocking` / `advisory`)
Hard mathematical, geometric, or rendering defects. Only Tier A objective findings may be marked `blocking`:
- `F04` (`text_collision`): Overlapping text bounding boxes on the same depth layer ($\alpha > 0.15$ each) by $> 2\%$ of the smaller box (`blocking`).
- `F05` (`text_clipping`): Text clipped outside viewport edges by $> 5\%$ of its box during its active display window (`blocking`).
- `F16` (`unintended_blank`): Near-black or near-white screen run $> 0.3\,\text{s}$ outside permitted `--allow-blank` intervals (`blocking`).
- `F13` (`perf_frame_time`): Frame render time $> 25\,\text{ms}$ GPU playback budget (`advisory`).
- `F10` (`cut_inside_sung_word`): *[Lyric-Only]* Hard visual cut falls inside an active sung vocal word window (`blocking`). **(Ignored if no lyrics).**

### Tier B: Calibrated Benchmark Comparisons (`source: calibrated`, `class: advisory`)
Measured numbers compared against empirical distributions from approved reference runs (`calibration/example.json`):
- **Universal Visual Rules**:
  - `F11` (`bone_bloom_bright_nonsignal`): Bright non-signal highlight pixels exceed design system target exposure budget.
  - `F12` (`palette_off_share`): Off-palette pixels ($\Delta E > 12$) exceed design system color gamut threshold.
  - `F14` (`sampler_max_spp`): Adaptive supersampling reached maximum 324 sub-frames.
  - `F15` (`edge_shimmer_flicker`): Edge shimmer index exceeds benchmark maximum, indicating moiré or geometric chatter.
- **Lyric-Only & Music-Sync Rules (Ignored if no lyrics/music)**:
  - `F01` (`lyric_visibility`): *[Lyric-Only]* Word visible for less than $90\%$ of sung window.
  - `F02` (`sung_word_height`): *[Lyric-Only]* Peak sung word cap height $< 5\%$ of viewport height.
  - `F03` (`word_anticipation`): *[Lyric-Only]* Word appears $> 0.40\,\text{s}$ before sung start timestamp.
  - `F09` (`kick_response_ratio`): *[Music-Only]* Motion energy ratio on kick drum transient $< 1.15\times$.

*Review Policy*: **Advisory only.** Reviewers or agents may waive any Tier B flag with a one-line written justification in `findings.json`. Review gates must never block or loop on Tier B flags.

### Tier C: Perceptual Proxies (`source: guess`, `class: info`)
Uncalibrated heuristics. Informational only — **do not optimize code to satisfy Tier C**:
- `F06` (`corner_persistence`): Element persisting unchanged in outer corner margins $> 3.0\,\text{s}$ without kinetic modulation.
- `F07` (`static_digit_persistence`): Numerical readout or dynamic data ticker unchanging for $> 3.0\,\text{s}$.
- `F08` (`dead_motion`): Viewport motion energy $E < \epsilon$ for $> 0.5\,\text{s}$ stalling visual momentum.

---

## 4. Known Limits & Blind Spots

1. **Shader / Texture Font Atlases (MSDF, `TextPlane`, raw WebGL)**: The probe intercepts Canvas2D `fillText` / `strokeText` on the CPU side. Typography baked directly into GPU shaders or custom WebGL vertex buffers is invisible to `text.csv`. Global pixel metrics (luma, optical flow, edge density, palette shares) still inspect those frames accurately.
2. **Sub-pixel Anti-aliasing Jitter**: At low resolutions ($480 \times 270$), high-frequency sub-pixel wireframe shimmer can register low-level motion energy even when camera coordinates are stationary.
3. **Adaptive Supersampling Text Capture**: When `--samples auto` or `--samples N` is active, text probes are recorded on sub-frame 0 (unblurred) to avoid redundant duplicate entries.
