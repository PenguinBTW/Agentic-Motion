# Motion Analysis Telemetry System Architecture (`scripts/render.ts motion`)

A model-readable, deterministic motion profiling and visual telemetry engine designed for autonomous coding agents and human art directors across **any procedural motion graphic design project**—commercials, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, and audiovisual productions.

---

## 1. Core Purpose & Philosophy: Telemetry Over Grading

Autonomous coding agents and human creative directors need **interpretable physical evidence and spatial context, not arbitrary scorecards**. Because every frame in a procedural motion graphics engine is a deterministic mathematical function of timeline time $t$:

$$\text{Frame} = f(t)$$

(where $t$ in seconds or frame numbers is clocked by voiceover narration, sound design cues, musical transients, or procedural animation loops), we can measure motion velocity, reading dwell time, optical flow, geometric complexity, and color palette fidelity with absolute mathematical precision.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TELEMETRY OVER GRADING                             │
│                                                                             │
│   SUBJECTIVE GRADING (ANTI-PATTERN)      EMPIRICAL TELEMETRY (OUR ENGINE)   │
│   ┌───────────────────────────┐          ┌───────────────────────────┐      │
│   │ Score: 6.2 / 10           │          │ Dwell: 420 ms (210 WPM)   │      │
│   │ Status: FAIL (ROBOTIC)    │  ──────► │ Cap Height: 5.4% (58 px)  │      │
│   │ Suggestion: Smooth camera │          │ Palette Gamut: 98.2% ink  │      │
│   │ by 15%                    │          │ Optical Flow: 312 px/s    │      │
│   └───────────────────────────┘          └───────────────────────────┘      │
│   Arbitrary, untrustworthy, &            Deterministic, model-readable      │
│   incentivizes gaming the score.         facts with physical context.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Observability Principle
The motion system operates like a digital audio workstation (DAW) spectrum analyzer or aerospace flight telemetry recorder:
1. **Facts and Context, Never a Verdict**: The tool reports measured numbers, calibrated benchmark distributions from approved reference runs (`calibration/example.json`), and neutral status indicators (`within range`, `above range`, `below range`, `no reference`). It never stamps subjective verdicts (`PASS`, `FAIL`, `EXCELLENT`, `ROBOTIC`, `HOLLOW`).
2. **Zero Auto-Generated Prescriptions**: The tool reports physical reality, but never generates uncalibrated pseudo-fixes ("reduce opacity to 0.45", "increase zoom by 0.08"). The agent and art director determine creative intent.
3. **Deterministic Outputs**: Identical inputs yield bit-identical reports, CSVs, and summaries across consecutive runs (excluding wall-clock GPU readback ms).
4. **Multi-Scale Visual Diagnostics**: Stacked metric plots, center-column spatio-temporal slitscans, high-speed RGB temporal motion composites, and sub-second event contact filmstrips.

---

## 2. CLI Invocation & Options

```bash
bun scripts/render.ts motion --url http://localhost:5173 --only <scene-id|scene-file> \
  --from <start-seconds> --to <end-seconds> --out <fresh-output-directory> \
  [--fps 60] [--scale 1] [--samples 1] [--shutter 0] [--bin 0.25] [--topn 12] \
  [--events 8.5,11.0,12.5] [--event-offsets -0.2,-0.1,0,0.05,0.1,0.2,0.4] \
  [--palette ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A] \
  [--allow-blank 0-0.6] [--compare path/to/reference/summary.json]
```

### Parameter Reference

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--url` | URL string | `http://localhost:5173` | Address of Vite dev server running the motion design app. |
| `--only` | string | `all` | Scene or plate identifier (e.g. `hero_reveal`, `modal_spring`, `doors`). Automatically expands scene aliases against project registries. |
| `--from` | float (s) | `0.0` | Start timestamp of animation inspection window in timeline seconds. |
| `--to` | float (s) | duration | End timestamp of animation inspection window in timeline seconds. Warns if window $> 15\,\text{s}$. |
| `--out` | file path | *required* | Target output directory. **Must be a fresh or non-existent path** to prevent Windows `EEXIST` file lock collisions. |
| `--fps` | integer | `60` | Sampling framerate. |
| `--scale` | float | `1` | Canvas physical scaling factor. |
| `--samples` | int / `auto`| `1` | Sub-frame supersampling count. Defaults to 1 for razor-sharp pixel diffs and single text probes. |
| `--shutter` | float | `0` | Motion blur shutter angle (0 = zero blur). |
| `--bin` | float (s) | `0.25` | Aggregation bin size for statistical distribution tables. |
| `--topn` | integer | `12` | Maximum rows shown per table in `report.md` before folding into `(+N more)`. |
| `--events` | list (s) | `[]` | User-defined timestamps (scene cuts, speech onsets, audio beats, UI state triggers) to force diagnostic contact strips. |
| `--event-offsets`| list (s)| `-0.2,-0.1,0,0.05,0.1,0.2,0.4` | Relative time offsets for each frame in event contact strips. |
| `--palette` | key-value | default palette | Hex mapping for design system color classification (e.g., `ink=#0A0A0B`, `signal=#FF4D12`). |
| `--allow-blank` | range list | `[]` | Timestamp ranges permitted to have near-black or near-white ground (e.g. dramatic blackout holds or intro `0-0.6`). |
| `--compare` | file path | `null` | Path to reference `summary.json`. Enables automated comparative benchmark diffing. |

---

## 3. Engine Hooks & Architecture

The motion telemetry subsystem interfaces with the core motion engine via 4 lightweight, zero-overhead hooks:

```
┌─────────────────────────────────────────────────────────────┐
│                       Headless Chrome                       │
│  ┌────────────┐   fillText   ┌───────────────────────────┐  │
│  │  Layer2D   │ ───────────► │  installTextProbeHook()   │  │
│  └────────────┘              │  (main.ts prototype tap)  │  │
│        ▲                     └─────────────┬─────────────┘  │
│        │                                   │ textProbes[]   │
│  ┌────────────┐   LineBatch.frameSegs      ▼                │
│  │ LineBatch  │ ────────────────────► Engine.render()       │
│  └────────────┘                       │                     │
│                                       ▼                     │
│                             readPixelsAsync() (RGBA)        │
└───────────────────────────────────────┬─────────────────────┘
                                        │ WebSocket / IPC
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Bun Runtime / CLI Harness                 │
│  ┌───────────────────────┐         ┌─────────────────────┐  │
│  │   downscaleFrame()    │         │ analyzeTextProbes() │  │
│  │ (4x4 box to 480x270)  │         │ (typography dwell,  │  │
│  └──────────┬────────────┘         │  clipping & layout) │  │
│             │                      └──────────┬──────────┘  │
│             ▼                                 │             │
│  ┌───────────────────────┐                    │             │
│  │   computeLuma()       │                    │             │
│  │   Cooley-Tukey FFT    │                    ▼             │
│  │   Sobel edgeDensity   │ ──────────► evaluateFlags()      │
│  │   CIE Lab ΔE palette  │             (3-Tier Classification)
│  └───────────────────────┘                    │             │
│                                               ▼             │
│                                    ┌─────────────────────┐  │
│                                    │ report.md & CSVs    │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Hook 1: Segment Counter (`app/src/engine/lines.ts`)
- Added static variable `LineBatch.frameSegs`.
- Incremented inside `LineBatch.prototype.render()` by `this.count`.
- Reset to 0 at the start of each logical frame in `Engine.render()`.
- Exposes true procedural vector complexity per frame.

### Hook 2: Engine Telemetry State (`app/src/engine/engine.ts`)
- Added properties to `Engine`:
  - `lastSegs`: Line segment count of the last frame.
  - `lastSamples`: Number of sub-frames actually rendered (crucial when adaptive sampling is active).
  - `lastSceneProbe`: Custom probe payload from scene `probe?(frame)` implementations (e.g. 3D camera coordinates, focal length).
- Controls sub-frame text probe isolation: sets `window.__pdoom.recordText = (k === 0)` so multi-sample runs do not create duplicate text entries.

### Hook 3: Context Scaling Metadata (`app/src/engine/gl.ts`)
- `scaleContext2D`: Tags `(c as any)._isScaled = (s !== 1)`.
- `Layer2D`: Assigns unique monotonic `_layerId` (`layer_1`, `layer_2`, ...) to each backing canvas and 2D context to track render pass depth.

### Hook 4: Universal Text Probe Interceptor (`app/src/main.ts`)
- Hooks `CanvasRenderingContext2D.prototype.fillText` and `strokeText`.
- Captures all kinetic typography—display titles, subtitles, UI labels, data numbers, HUD readouts:
  - Intercepts text strings (ignoring empty strings and pure whitespace).
  - Extracts active font family and pixel cap size (`fontPx`).
  - Calls `ctx.measureText(str)` to compute precise physical bounding boxes:
    $$\text{bbox} = [x_{\min}, y_{\min}, x_{\max}, y_{\max}]$$
  - Multiplies bounding box by `ctx.getTransform()` and divides out `scaleContext2D` ratios.
  - Appends record to `window.__pdoom.textProbes[]`.
- Stays dormant during warm-up renders (`n0 - 1`).

---

## 4. Signal Processing & Pixel Metric Pipeline

All image metrics run on **$480 \times 270$** downscaled frames ($4 \times 4$ box-filter downsampling of the $1920 \times 1080$ frame) to enable instant headless execution.

### A. Box Downsampling & Bottom-Up Inversion
`WebGLRenderer.readPixels` returns RGBA bytes arranged from bottom-left to top-right. `downscaleFrame()` box-averages $4 \times 4$ blocks and flips the vertical axis into top-down scanlines in a single pass:

$$R_{480}(x, y) = \frac{1}{16} \sum_{u=0}^{3} \sum_{v=0}^{3} R_{1920}(4x + u, 1080 - 1 - (4y + v))$$

### B. Rec.709 Luma & Michelson Contrast
Luminance is calculated per pixel using standard HDTV Rec.709 coefficients:

$$L(x, y) = 0.2126\,R + 0.7152\,G + 0.0722\,B$$

Michelson contrast across the frame is calculated from the 1st and 99th percentiles of $L$:

$$C = \frac{L_{p99} - L_{p01}}{L_{p99} + L_{p01} + \epsilon}$$

### C. Motion Energy ($E$ and $E_{p95}$)
Motion energy measures the raw frame-to-frame temporal difference:

$$\Delta L(x, y) = |L_t(x, y) - L_{t-1}(x, y)|$$

$$E = \frac{1}{W \times H} \sum_{x, y} \Delta L(x, y)$$

*Metric Validity Condition*: $E$ is **invalid across palette-inversion frames** (e.g. dark mode to light mode cuts). On inversion boundaries, the tool prints `n/a (palette invert transition)` rather than reporting a false motion surge.

### D. 2D Cooley-Tukey Phase Correlation (Optical Flow)
Global camera translation velocity $(\text{flow}_{dx}, \text{flow}_{dy})$ in $\text{px/s}$ is computed via 2D Fast Fourier Transform phase correlation:

1. Let $F_1 = \mathcal{F}\{L_{t-1}\}$, $F_2 = \mathcal{F}\{L_t\}$.
2. Compute normalized cross-power spectrum:
   $$R(u, v) = \frac{F_1(u, v) \cdot F_2^*(u, v)}{|F_1(u, v) \cdot F_2^*(u, v)|}$$
3. Take inverse Fourier transform: $r(x, y) = \mathcal{F}^{-1}\{R\}$.
4. The location of the peak $(\Delta x, \Delta y)$ in $r(x, y)$ gives the global shift vector. Multiply by `fps` to obtain physical $\text{px/s}$.

*Metric Validity Condition*: Phase correlation measures **translation only**. A forward camera dolly creates radial optical expansion, so the tool also reports physical camera velocity $v_z$ ($\text{m/s}$) from the camera probe.

### E. Sobel Edge Density
Evaluates wireframe complexity and geometric detail:
1. Convolves luma with $3 \times 3$ horizontal and vertical Sobel kernels:
   $$G_x = \begin{bmatrix} -1 & 0 & 1 \\ -2 & 0 & 2 \\ -1 & 0 & 1 \end{bmatrix} * L, \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ 1 & 2 & 1 \end{bmatrix} * L$$
2. Magnitude: $G = \sqrt{G_x^2 + G_y^2}$.
3. $\text{edgeDensity}$ = percentage of pixels where $G > 0.12$.

*Limits*: At $480 \times 270$, 1px sub-pixel lines may fall below detection thresholds. Evaluated in tandem with `LineBatch.frameSegs`.

### F. CIE Lab $\Delta E_{76}$ Palette Enforcement
Quantifies adherence to the official brand design system palette:
1. Converts sRGB pixels to linear RGB, then to CIE XYZ ($D_{65}$ illuminant), then to CIE $L^*a^*b^*$.
2. Calculates Euclidean distance $\Delta E_{76}$ to all configured palette swatches:
   $$\Delta E = \sqrt{(\Delta L^*)^2 + (\Delta a^*)^2 + (\Delta b^*)^2}$$
3. Assigns each pixel to the nearest swatch if $\Delta E \le 12.0$.
4. Any pixel exceeding $\Delta E = 12.0$ for all palette entries is classified as `other` (off-palette wash).

### G. Edge Shimmer Index
Detects aliasing crawl, temporal sub-pixel jitter, and flickering geometry:
1. Computes the second temporal derivative on edges:
   $$\text{Shimmer}(x, y) = |L_{t+1}(x, y) - 2L_t(x, y) + L_{t-1}(x, y)| \times \text{EdgeMask}_t(x, y)$$
2. A high shimmer index indicates geometric instability or lack of temporal anti-aliasing.

---

## 5. Universal Three-Tier Flag & Findings Classification

To prevent agents from gaming uncalibrated numbers or getting trapped in endless optimization loops, all diagnostic findings are categorized into **3 strict tiers**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE THREE-TIER CLASSIFICATION HIERARCHY                 │
│                                                                             │
│  TIER A: OBJECTIVE FINDINGS             TIER B: CALIBRATED BENCHMARKS       │
│  • Hard physical / geometric defects    • Calibrated against design norms   │
│  • Text collisions (F04)                • Dwell time / reading speed (F01)  │
│  • Safe margin clipping (F05)           • Typographic scale (F02)           │
│  • Semantic cut disruption (F10)        • Anticipation lead (F03)           │
│  • Unintended blackout drops (F16)      • Palette wash / bloom (F11, F12)   │
│  ──► CAN BE BLOCKING IN CI GATES        ──► ADVISORY ONLY (1-LINE WAIVER)   │
│                                                                             │
│  TIER C: PERCEPTUAL PROXIES                                                 │
│  • Uncalibrated exploratory heuristics (F06, F07, F08)                      │
│  ──► INFORMATIONAL ONLY ("DO NOT OPTIMIZE TO")                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Universal Rules vs. Lyric-Specific Rules

The 16 diagnostic flags are divided into two operational categories:
1. **Universal Motion Graphics Rules (F04–F08, F11–F16)**: Apply to **all** procedural motion design (commercials, UI/UX interaction showcases, 3D product reveals, procedural data graphics, brand resolves).
2. **Lyric & Audio-Sync Rules (F01–F03, F09, F10)**: **Strictly designed for reviewing productions with synchronized lyrics and musical audio stems.** When reviewing non-lyric projects, these flags produce zero matches and **should be completely ignored**.

> [!IMPORTANT]
> **Applicability Scope for Lyric Flags (F01, F02, F03, F09, F10)**:
> These rules rely on input timing metadata (`lyrics.json` for vocal word windows, `events.json` for musical kick drum transients). If you are authoring or auditing a commercial, UI showcase, or general motion graphic without synchronized on-screen lyrics, **these flags do not apply and can be safely ignored**.

---

### Category A: Universal Motion Graphics Rules (Apply to ALL Projects)

| Rule ID | Codebase Identifier (`config.ts`) | Tier | Source | Default Class | Motion Graphics Standard & Enforcement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`F04`** | `text_collision` | Tier A | `objective` | **blocking** | **Text Collision**: Two typography bounding boxes overlap by $> 2\%$ on the same depth layer ($\alpha > 0.15$). (Excludes depth parallax between elements with $\ge 2.5\times$ scale disparity or micro-text $< 0.4\%$). |
| **`F05`** | `text_clipping` | Tier A | `objective` | **blocking** | **Safe Boundary Clipping**: Typography clipped outside viewport edges by $> 5\%$ of its box during its active display window. |
| **`F06`** | `corner_persistence` | Tier C | `guess` | info | **Corner Persistence**: Static element persisting inside outer $12\% \times 14\%$ corner margins $> 3.0\,\text{s}$ without kinetic modulation. |
| **`F07`** | `static_digit_persistence` | Tier C | `guess` | info | **Static Digit Persistence**: Unchanging numerical string or ticker persisting in slot $> 3.0\,\text{s}$. |
| **`F08`** | `dead_motion` | Tier C | `guess` | info | **Dead Motion**: Viewport motion energy $E < \epsilon$ for $> 0.5\,\text{s}$ stalling visual momentum. |
| **`F11`** | `bone_bloom_bright_nonsignal` | Tier B | `calibrated` | advisory | **Luminance Bloom Wash**: Bright non-signal pixels ($L > 0.85$) exceed $> 0.5\%$ target exposure budget outside flash frames. |
| **`F12`** | `palette_off_share` | Tier B | `calibrated` | advisory | **Off-Palette Gamut Wash**: Pixels deviating by $\Delta E > 12$ from the configured color palette exceed $3.0\%$ share. |
| **`F13`** | `perf_frame_time` | Tier A | `objective` | advisory | **Frame Render Time Budget**: Frame render time exceeds $25\,\text{ms}$ (60 fps GPU execution budget exceeded). Advisory due to test harness overhead. |
| **`F14`** | `sampler_max_spp` | Tier B | `calibrated` | advisory | **Sampler Saturation**: Adaptive supersampling reached maximum sub-frame limit (324 spp), indicating complex sub-pixel aliasing. |
| **`F15`** | `edge_shimmer_flicker` | Tier B | `calibrated` | advisory | **Edge Shimmer Crawl**: Temporal edge shimmer index exceeds threshold ($0.025$), indicating moiré or geometric chatter. |
| **`F16`** | `unintended_blank` | Tier A | `objective` | **blocking** | **Unintended Blank Screen**: Blank screen run (black $L < 0.02$ or white $L > 0.98$) for $> 0.3\,\text{s}$ outside permitted `--allow-blank` intervals. |

---

### Category B: Lyric & Musical Sync Rules (ONLY for Videos with Lyrics; Otherwise Ignored)

| Rule ID | Codebase Identifier (`config.ts`) | Tier | Source | Default Class | Lyric-Specific Function & Expected Input |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`F01`** | `lyric_visibility` | Tier B | `calibrated` | advisory | **Lyric Display Duration**: Word visible for $< 90\%$ of its sung window. *(Requires `lyrics.json`; ignore if no lyrics).* |
| **`F02`** | `sung_word_height` | Tier B | `calibrated` | advisory | **Sung Word Legibility**: Peak sung word cap height $< 5.0\%$ of $1080\text{p}$ height. *(Requires `lyrics.json`; ignore if no lyrics).* |
| **`F03`** | `word_anticipation` | Tier B | `calibrated` | advisory | **Lyric Anticipation Lead**: Word appears $> 0.40\,\text{s}$ before sung start timestamp. *(Requires `lyrics.json`; ignore if no lyrics).* |
| **`F09`** | `kick_response_ratio` | Tier B | `calibrated` | advisory | **Kick Motion Response**: Kinetic energy ratio on kick drum transient $< 1.15\times$. *(Requires `kick` events in `events.json`; ignore if no kick stem).* |
| **`F10`** | `cut_inside_sung_word` | Tier A | `objective` | **blocking** | **Vocal Cut Disruption**: Hard scene cut falls inside an active sung vocal word window. *(Requires `lyrics.json`; ignore if no lyrics).* |

*Review Governance*:
- **Only Tier A flags may be marked `blocking` in CI gates.**
- **Tier B flags are advisory.** Reviewers or agents may waive any Tier B flag with a one-line written justification in `findings.json`. CI gates must never loop on advisory flags.
- **Tier C flags are informational.** Agents must never alter code specifically to optimize Tier C metrics.
- **Non-Lyric Productions**: Flags `F01`, `F02`, `F03`, `F09`, and `F10` must be skipped or waived automatically if the project has no lyrics displayed.

---

## 6. Output Files Specification

| File | Type | Purpose |
| :--- | :--- | :--- |
| `report.md` | Markdown | Comprehensive report structured in fixed sections (0 to 12). Capped at `--topn` rows per table. Units in every header. |
| `findings.json` | JSON | Machine-readable log of all Tier A, B, and C findings with stable IDs, timestamps, evidence files, and waiver logs. |
| `summary.json` | JSON | Normalized machine-readable object containing all aggregates, hit ratios, dwell stats, and flag records. Consumed by `--compare`. |
| `frames.csv` | CSV | Full 60 fps table: $n, t, E, E_{p95}, \text{flow}_{dx}, \text{flow}_{dy}, L, C, \text{edgeDensity}, \text{signal\%}, \text{brightNonsignal\%}, \text{shimmer}, \text{segs}, \text{ms}, \text{spp}$. |
| `text.csv` | CSV | Complete log of every intercepted Canvas2D `fillText` call: frame, $t$, string, font, bounding box coordinates, $\alpha$, and layer. |
| `events.json` | JSON | Catalogue of scene cuts, narration phoneme/word timestamps, musical downbeats/transients, and animation state triggers. |
| `timeline.png` | Image (PNG) | 1920px stacked time-series plot with synchronized time axis showing $E$, luma, signal%, edge density, text height%, and ms. |
| `slitscan.png` | Image (PNG) | Center-column slit scan (4px per frame, wrapped every 480 frames) revealing camera speed ramps and continuity. |
| `strip_<label>.png`| Image (PNG) | Sub-second visual contact filmstrip sampled at `--event-offsets` around major cuts, audio transients, and state changes. |
| `rgbtime_<label>.png`| Image (PNG) | RGB temporal composite ($R = i-2, G = i, B = i+2$) highlighting velocity direction, fringing, and micro-stutter. |
| `events/<label>.csv`| CSV | High-resolution per-frame metric table for $\pm 0.5\,\text{s}$ surrounding each diagnostic event. |

---

## 7. Known Limits & Practical Guidelines

1. **Shader / Texture Font Atlases**: The Canvas2D text probe intercepts JavaScript `fillText` calls. If typography is rendered into a WebGL texture atlas (e.g., MSDF shaders, `TextPlane`), it is invisible to `text.csv`. Global pixel metrics (luma, edges, flow, palette) still inspect those frames accurately.
2. **Sub-pixel Wireframe Jitter**: Highly detailed wireframe geometry moving across pixel boundaries can register minor motion energy ($E \approx 0.001\text{–}0.003$) even when the 3D camera is stationary.
3. **Always Run on a Clean Directory**: On Windows, file locking during rapid re-writes can cause `EEXIST` errors. Ensure `--out` points to a clean or newly named folder.
4. **Use Scene Aliases**: You can pass either plate IDs (`--only hero_reveal`, `--only intro`) or scene file basenames (`--only boundary`, `--only hook`). The script automatically expands both.
