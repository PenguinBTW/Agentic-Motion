# Motion Analysis Telemetry Report

## 0. Header & Run Context
- **Command**: `bun scripts/render.ts motion --from 0 --to 2 --samples 1 --out out/test_motion`
- **Plate ID**: `demo`
- **Window**: `0.00–2.00 s` (duration: `2.00 s`)
- **Framerate**: `60 fps`
- **Scale**: `1`
- **Samples / Shutter**: `1 / 0`
- **Frame Count**: `120`
- **Wall-clock**: `5.6 s`
- **Palette**: `ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A`
- **Probe Coverage**: `canvas2d-only` (Known limit: text rendered inside WebGL shaders or atlases is invisible to probe. Pixel metrics cover all frames.)
- **Findings Summary**: `1 blocking`, `1 advisory`, `0 info`

### Top 5 Findings (Ranked Priority)

1. **[BLOCKING]** `F16-001` (0.00–1.98s): near-black segment of 1.98s outside --allow-blank (> 0.3s)
   - *Limits*: Cannot distinguish intentional blackout pauses from rendering failure without --allow-blank.
2. *[ADVISORY]* `F13-001` (0.00–0.00s): frame time 62.4ms exceeded 25.0ms budget
   - *Limits*: Includes Playwright readback overhead and headless Chrome software/hardware scheduling.

## 1. Diagnostic Findings & Flags

### 1.1 Tier A: Objective Findings
> **Limits**: Canvas2D text bounds; does not detect shader margin clipping. Screen-space 2D coordinates ignore Z depth.
> *Review policy: Only Tier A flags may be blocking. Hard bugs must be addressed before merge.*

| id | class | severity | t0–t1 (s) | rule | evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| F16-001 | blocking | fail | 0.00–1.98 | Near-black or near-white screen run > 0.3s outside --allow-blank | near-black segment of 1.98s outside --allow-blank (> 0.3s) |
| F13-001 | advisory | warn | 0.00–0.00 | Frame render time > 25 ms (GPU-synced playback bottleneck) | frame time 62.4ms exceeded 25.0ms budget |

### 1.2 Tier B: Calibrated Benchmark Comparisons
> **Limits**: Derived from Example project reference distributions (p10–p90). Does not impose creative uniformity.
> *Review policy: Advisory only. Reviewers may waive any advisory finding with a one-line written reason in findings.json.*

| id | class | t0–t1 (s) | rule | evidence (vs Example range) |
| :--- | :--- | :--- | :--- | :--- |
| - | - | - | Within calibrated benchmark range | All metrics conform to Example project empirical bounds |

### 1.3 Tier C: Perceptual Proxies (Uncalibrated)
> **Limits**: Unvalidated heuristic proxies. Cannot see semantic intent, shader text, or intentional hold frames.
> *Review policy: Informational only. DO NOT optimize or game code to satisfy these proxies.*

| id | class | t0–t1 (s) | proxy heuristic | measured telemetry |
| :--- | :--- | :--- | :--- | :--- |
| - | - | - | None triggered | No heuristic proxy triggers |

## 2. Timeline Bins (0.25 s)
> **Limits**: Time-averaged metrics smooth out micro-spikes shorter than the bin duration.

| t0 (s) | E_mean | E_p95 | flow_dx (px/s) | flow_dy (px/s) | luma | contrast | signal% | bright_nonsignal% | edge_density | n_texts | max_text_h% | min_text_h% | segs | ms | spp |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 0.00 | 0.0020 | 0.0033 | -1.4 | -0.8 | 0.006 | 0.024 | 1.47 | 0.00 | 0.0086 | 0 | 0.0 | 0.0 | 161 | 22.8 | 1 |
| 0.25 | 0.0021 | 0.0035 | 0.0 | 0.6 | 0.007 | 0.027 | 1.50 | 0.00 | 0.0094 | 0 | 0.0 | 0.0 | 161 | 19.9 | 1 |
| 0.50 | 0.0021 | 0.0035 | -1.9 | 0.4 | 0.008 | 0.031 | 1.56 | 0.00 | 0.0104 | 0 | 0.0 | 0.0 | 161 | 18.8 | 1 |
| 0.75 | 0.0021 | 0.0035 | -0.0 | 0.3 | 0.008 | 0.035 | 1.55 | 0.00 | 0.0113 | 0 | 0.0 | 0.0 | 161 | 19.2 | 1 |
| 1.00 | 0.0021 | 0.0035 | -0.1 | 1.4 | 0.009 | 0.038 | 1.52 | 0.00 | 0.0120 | 0 | 0.0 | 0.0 | 161 | 19.4 | 1 |
| 1.25 | 0.0021 | 0.0035 | 0.1 | 1.8 | 0.009 | 0.039 | 1.51 | 0.00 | 0.0122 | 0 | 0.0 | 0.0 | 161 | 19.8 | 1 |
| 1.50 | 0.0021 | 0.0035 | -1.7 | 3.2 | 0.009 | 0.040 | 1.49 | 0.00 | 0.0124 | 0 | 0.0 | 0.0 | 161 | 18.3 | 1 |
| 1.75 | 0.0021 | 0.0035 | 1.1 | 1.6 | 0.009 | 0.041 | 1.47 | 0.00 | 0.0126 | 0 | 0.0 | 0.0 | 161 | 19.5 | 1 |

## 3. Visual Cuts & Scene Transitions
> **Limits**: Detects frame-to-frame pixel-difference discontinuities. Smooth wipes and gradual morphs register as continuous flow.

| t (s) | diff_before→after | type | nearest_downbeat_Δms (ms) | inside_word? |
| :--- | :--- | :--- | :--- | :--- |
| 0.00 | 0.0000 | soft | -288.0 | false |

## 4. Audio Hit Responses (Kicks & Snares)
> **Limits**: Relies on acoustic events in audio.json. Acoustic syncopations or polyrhythms not annotated in data will not trigger hit probes.

| t (s) | strength | E_base | E_peak | ratio | latency (ms) | luma_jump | shake (px) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| - | - | - | - | - | - | - | - |

## 5. Lyric Typographic Synchronization
> **Limits**: Intercepts Canvas2D text rendering. Custom 3D glyph geometries and shader text do not produce Canvas2D probe events.

| word | line | start (s) | end (s) | first_visible (s) | last_visible (s) | appear_Δms (ms) | visible_during_sung% | peak_h% | mean_h% | travel (px/s) | clip% | match |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| - | - | - | - | - | - | - | - | - | - | - | - | none |

## 6. Non-Lyric Text Runs & Slots
> **Limits**: Canvas2D only. Single-frame ephemeral strings do not register as persistent spatial slots.

| string | slot | t0–t1 (s) | dur (s) | h% | distinct_strings_in_slot | notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| "AGENTIC MOTION DESIGN" | 1 | 0.00–1.98 | 1.98 | 2.8 | 1 | alpha 1.00–1.00 |
| "UNIVERSAL ENGINE ARCHITECTURE v2.4.0" | 2 | 0.00–1.98 | 1.98 | 1.0 | 1 | alpha 1.00–1.00 |
| "TIME: 0.000s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.00–0.00 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "STATUS: MILESTONE 1 DECOUPLING ACTIVE | 60 FPS DETERMINISTIC" | 4 | 0.00–1.98 | 1.98 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.017s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.02–0.02 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.033s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.03–0.03 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.050s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.05–0.05 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.067s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.07–0.07 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.083s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.08–0.08 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.100s | PROGRESS: 0.0% | CLOSED-FORM f(t)" | 3 | 0.10–0.10 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.117s | PROGRESS: 0.1% | CLOSED-FORM f(t)" | 3 | 0.12–0.12 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| "TIME: 0.133s | PROGRESS: 0.1% | CLOSED-FORM f(t)" | 3 | 0.13–0.13 | 0.00 | 0.9 | 1 | alpha 1.00–1.00 |
| ... | ... | ... | ... | ... | ... | (+141 more runs) |

## 7. Spatial Collisions & Frame Clipping
> **Limits**: Evaluates 2D screen-space bounding boxes. Overlapping text separated along the camera Z axis will trigger 2D overlap.

| pair | t0–t1 (s) | intersection% | clip% |
| :--- | :--- | :--- | :--- |
| - | - | 0.0 | 0.0 |

## 8. Static & Blank Segments
> **Limits**: Cannot distinguish intentional dramatic blackout holds from rendering stalls without `--allow-blank`.

| t0–t1 (s) | kind | E_mean |
| :--- | :--- | :--- |
| 0.00–1.98 | blank-dark | 0.00000 |

## 9. Palette Distribution & Swatch Adherence
> **Limits**: CIE Lab distance ΔE 12 on downsampled buffer. Subtle gradient anti-aliasing fringes may register as other%.

| t0 (s) | ink% | bone% | paper% | signal% | signal-lite% | other% |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 0.00 | 98.6 | 0.0 | 0.0 | 0.0 | 0.0 | 1.4 |
| 0.25 | 98.3 | 0.0 | 0.0 | 0.0 | 0.0 | 1.7 |
| 0.50 | 98.2 | 0.0 | 0.0 | 0.0 | 0.0 | 1.8 |
| 0.75 | 98.1 | 0.0 | 0.0 | 0.0 | 0.0 | 1.9 |
| 1.00 | 97.9 | 0.0 | 0.0 | 0.0 | 0.0 | 2.1 |
| 1.25 | 97.9 | 0.0 | 0.0 | 0.0 | 0.0 | 2.1 |
| 1.50 | 97.8 | 0.0 | 0.0 | 0.0 | 0.0 | 2.2 |
| 1.75 | 97.8 | 0.0 | 0.0 | 0.0 | 0.0 | 2.2 |

## 10. Frame Render Durations & Sampling
> **Limits**: Headless Chrome pixel readback introduces CPU/IPC latency. In-engine runtime frame times are lower.

| metric | value |
| :--- | :--- |
| ms p50 | 19.5 ms |
| ms p95 | 21.8 ms |
| ms max | 62.4 ms |
| frames over 25 ms | 1 |
| spp histogram | 1:120 |

### Worst 5 frames
| t (s) | ms | spp |
| :--- | :--- | :--- |
| 0.00 | 62.4 | 1 |
| 1.25 | 25.0 | 1 |
| 1.08 | 23.1 | 1 |
| 0.03 | 22.0 | 1 |
| 1.15 | 21.9 | 1 |

## 11. Compare to Benchmark (Example Project Reference)

> **Limits**: Example project represents a distinct pacing and density aesthetic; stylistic differences from benchmark are advisory context, not quality grades.

| metric | this plate | Example range (p10–p90) | status |
| :--- | :--- | :--- | :--- |
| cut rate/s | 0.500 | 0.000–0.000 (min 0.000, max 0.000) | above range |
| E_mean | 0.002 | 0.006–0.081 (min 0.004, max 0.139) | below range |
| E_p95 | 0.003 | 0.015–0.347 (min 0.010, max 0.732) | below range |
| kick response ratio median | 1.000 | 0.871–16.241 (min 0.030, max 160.384) | within range |
| max/min text size ratio median | 1.000 | 0.000–0.000 (min 0.000, max 0.000) | above range |
| signal% | 1.509 | 0.898–36.365 (min 0.292, max 92.778) | within range |
| edge_density | 0.011 | 0.014–0.073 (min 0.009, max 0.101) | below range |
| dead-motion fraction | 0.008 | 0.017–0.018 (min 0.017, max 0.024) | below range |

## 12. Evidence Index
> **Limits**: Visual diagnostic artifacts are targeted proxies to assist human and model inspection.

| file | content | when to open |
| :--- | :--- | :--- |
| [`timeline.png`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/timeline.png) | Stacked time-series plot (E, luma, signal%, edge_density, text h%, perf ms) | Overview of temporal dynamics, audio alignment, and energy profile across the window |
| [`slitscan.png`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/slitscan.png) | Centre-column slit scan, 4 px per frame, wrapped every 480 frames | Inspect camera speed ramps, horizontal rhythm, and scene continuity bands |
| [`strip_cut_0.00.png`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/strip_cut_0.00.png) | Event contact strip at offsets around t=0.00s | Detailed sub-second visual evolution around cut_0.00 |
| [`rgbtime_cut_0.00.png`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/rgbtime_cut_0.00.png) | RGB temporal composite (R=i-2, G=i, B=i+2) around t=0.00s | Inspect directional velocity and motion fringing around cut_0.00 |
| [`events/cut_0.00.csv`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/events/cut_0.00.csv) | Per-frame metrics table at 60 fps for ±0.5s around t=0.00s | Frame-accurate numbers and response curve around cut_0.00 |
| [`strip_max_energy_1.63.png`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/strip_max_energy_1.63.png) | Event contact strip at offsets around t=1.63s | Detailed sub-second visual evolution around max_energy_1.63 |
| [`rgbtime_max_energy_1.63.png`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/rgbtime_max_energy_1.63.png) | RGB temporal composite (R=i-2, G=i, B=i+2) around t=1.63s | Inspect directional velocity and motion fringing around max_energy_1.63 |
| [`events/max_energy_1.63.csv`](file:///C:/Users/brosf/Documents/A vio projects/VioPls/Agentic motion design toolset/app/out/test_motion/events/max_energy_1.63.csv) | Per-frame metrics table at 60 fps for ±0.5s around t=1.63s | Frame-accurate numbers and response curve around max_energy_1.63 |

