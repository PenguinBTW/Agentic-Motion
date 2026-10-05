# Motion Analysis System Architecture (`scripts/render.ts motion`)

A model-readable, deterministic motion profiling and visual telemetry engine designed for autonomous coding agents and human reviewers.

---

## 1. Core Purpose & Philosophy: Telemetry Over Grading

Reviewers (both AI agents and human art directors) need **interpretable evidence and physical context, not arbitrary scorecards**. Because every frame in this project is a deterministic mathematical function of song time:

$$\text{Frame} = f(t)$$

we can measure motion, typographic synchronization, optical flow, and energy with exact precision.

### The Observability Principle
The motion system operates like a digital audio workstation (DAW) spectrum analyzer or flight cockpit HUD:
1. **Facts and Context, Never a Verdict**: The tool reports measured numbers, calibrated reference distributions from `Example project/`, and neutral status indicators (`within range`, `above range`, `below range`, `no reference`). It never stamps subjective verdicts (`PASS`, `FAIL`, `EXCELLENT`, `ROBOTIC`, `HOLLOW`).
2. **Zero Auto-Generated Prescriptions**: The tool reports what is happening physically, but never gives uncalibrated fix suggestions ("reduce opacity to 0.45", "increase zoom to 0.08"). The director and agent decide intent.
3. **Deterministic Outputs**: Identical inputs yield bit-identical reports, CSVs, and summaries across consecutive runs (excluding wall-clock GPU readback ms).
4. **Multi-Scale Visual Diagnostics**: Stacked metric plots, center-column slitscans, high-speed RGB temporal motion composites, and sub-second event contact filmstrips.

---

## 2. CLI Invocation & Options

```bash
bun scripts/render.ts motion --url http://localhost:5174 --only <plate-id|scene-file> \
  --from <start-seconds> --to <end-seconds> --out <fresh-output-directory> \
  [--fps 60] [--scale 1] [--samples 1] [--shutter 0] [--bin 0.25] [--topn 12] \
  [--events 8.5,11.0,12.5] [--event-offsets -0.2,-0.1,0,0.05,0.1,0.2,0.4] \
  [--palette ink=#0A0A0B,bone=#EEE9DF,paper=#F7F4EC,signal=#FF4D12,signal-lite=#F9845A] \
  [--allow-blank 0-0.6] [--compare path/to/reference/summary.json]
```

### Parameter Reference

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--url` | URL string | `http://localhost:5173` | Address of Vite dev server running the app. |
| `--only` | string | `all` | Plate ID (`open`, `boundary`, etc.) or scene filename (`doors`, `hook`). Automatically expands scene aliases against `analysis/plates.json`. |
| `--from` | float (s) | `0.0` | Start timestamp of song window in seconds. |
| `--to` | float (s) | duration | End timestamp of song window in seconds. Warns if window $> 15\,\text{s}$. |
| `--out` | file path | *required* | Target output directory. **Must be a fresh or non-existent path** to prevent Windows `EEXIST` collisions. |
| `--fps` | integer | `60` | Sampling framerate. |
| `--scale` | float | `1` | Canvas physical scaling factor. |
| `--samples` | int / `auto`| `1` | Sub-frame supersampling count. Defaults to 1 for razor-sharp pixel diffs and single text probes. |
| `--shutter` | float | `0` | Motion blur shutter angle (0 = zero blur). |
| `--bin` | float (s) | `0.25` | Aggregation bin size for Section 2 and Section 9 tables. |
| `--topn` | integer | `12` | Maximum rows shown per table in `report.md` before folding into `(+N more)`. |
| `--events` | list (s) | `[]` | User-defined timestamps to force diagnostic strips and event CSVs. |
| `--event-offsets`| list (s)| `-0.2,-0.1,0,0.05,0.1,0.2,0.4` | Relative time offsets for each frame in event contact strips. |
| `--palette` | key-value | default palette | Hex mapping for color classification (ink, bone, paper, signal, signal-lite). |
| `--allow-blank` | range list | `[]` | Timestamp ranges permitted to have near-black or near-white ground (e.g. `0-0.6`). |
| `--compare` | file path | `null` | Path to another `summary.json`. Enables Section 11 automated comparative diff. |

---

## 3. Engine Hooks & Architecture

The motion analysis subsystem interfaces with the core engine via 4 lightweight, zero-overhead hooks:

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
                                        │ WebSocket stream
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Bun Node / CLI Runtime                    │
│  ┌───────────────────────┐         ┌─────────────────────┐  │
│  │   downscaleFrame()    │         │ analyzeTextProbes() │  │
│  │ (4x4 box to 480x270)  │         │ (lyric synchronization││
│  └──────────┬────────────┘         └──────────┬──────────┘  │
│             │                                 │             │
│             ▼                                 ▼             │
│  ┌───────────────────────┐         ┌─────────────────────┐  │
│  │   computeLuma()       │         │   evaluateFlags()   │  │
│  │   Cooley-Tukey FFT    │ ──────► │  (3-Tier Telemetry) │  │
│  │   Sobel edgeDensity   │         └──────────┬──────────┘  │
│  │   CIE Lab palette     │                    │             │
│  └───────────────────────┘                    ▼             │
│                                    ┌─────────────────────┐  │
│                                    │ report.md & CSVs    │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Hook 1: Segment Counter (`app/src/engine/lines.ts`)
- Added static variable `LineBatch.frameSegs`.
- Incremented inside `LineBatch.prototype.render()` by `this.count`.
- Reset to 0 at the start of each logical frame in `Engine.render()`.
- Exposes true vector complexity per frame.

### Hook 2: Engine Telemetry State (`app/src/engine/engine.ts`)
- Added properties to `Engine`:
  - `lastSegs`: Line segment count of the last frame.
  - `lastSamples`: Number of sub-frames actually rendered (crucial when adaptive sampling is active).
  - `lastSceneProbe`: Custom probe payload from scene `probe?(frame)` implementations.
- Controls sub-frame text probe isolation: sets `window.__pdoom.recordText = (k === 0)` so multi-sample runs do not create duplicate text entries.

### Hook 3: Context Scaling Metadata (`app/src/engine/gl.ts`)
- `scaleContext2D`: Tags `(c as any)._isScaled = (s !== 1)`.
- `Layer2D`: Assigns unique monotonic `_layerId` (`layer_1`, `layer_2`, ...) to each backing canvas and 2D context.

### Hook 4: Text Probe Interceptor (`app/src/main.ts`)
- Hooks `CanvasRenderingContext2D.prototype.fillText` and `strokeText`.
- Whenever `window.__pdoom.probe === true` and `recordText !== false`:
  - Intercepts text strings (ignoring empty strings and pure whitespace).
  - Extracts active font family and pixel cap size (`fontPx`).
  - Calls `ctx.measureText(str)` to compute precise physical bounding boxes:
    $$\text{bbox} = [x_{\min}, y_{\min}, x_{\max}, y_{\max}]$$
  - Multiplies bounding box by `ctx.getTransform()` and divides out `scaleContext2D` ratios.
  - Appends record to `window.__pdoom.textProbes[]`.
- Stays dormant during warm-up renders (`n0 - 1`).

---

## 4. Signal Processing & Pixel Metric Pipeline

All image metrics run on **$480 \times 270$** downscaled frames ($4 \times 4$ box-filter downsampling of the $1920 \times 1080$ frame).

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

*Metric Validity Condition*: $E$ is **invalid across flash/paper-invert frames**. On inversion boundaries, the tool prints `n/a (palette invert/flash transition)` rather than reporting a false motion surge.

### D. 2D Cooley-Tukey Phase Correlation (Optical Flow)
Global camera velocity $(\text{flow}_{dx}, \text{flow}_{dy})$ in $\text{px/s}$ is computed via 2D Fast Fourier Transform phase correlation:

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
Quantifies adherence to the official Swiss palette:
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

## 5. Three-Tier Flag & Findings Classification

To prevent agents from gaming uncalibrated numbers or getting trapped in infinite optimization loops, all diagnostic findings are categorized into **3 strict tiers**:

### Tier A: Objective Findings (`source: objective`, `class: blocking`)
Hard physical, typographic, or rendering defects. These represent unequivocal bugs:
- **`F04`**: Two text bounding boxes overlap by $> 2\%$ ($\alpha > 0.15$).
- **`F05`**: Text clipped outside the $1920 \times 1080$ frame by $> 5\%$.
- **`F11`**: Cut boundary lands directly inside an active sung vocal word ($[start + 20\text{ms}, end - 20\text{ms}]$).
- **`F16`**: Unintended blank screen (pure black $L < 0.02$ or white $L > 0.98$ for $> 0.3\,\text{s}$ outside permitted `--allow-blank` windows).
- **GPU Timeout**: Frame render time $> 25\,\text{ms}$ (GPU sync bottleneck).

*Rule*: **Only Tier A flags may be marked `blocking` in CI gates.**

### Tier B: Benchmark Comparison to Example Project (`source: calibrated`, `class: advisory`)
Calibrated observations derived from empirical runs across all 17 plates of `Example project` (`calibration/example.json`). 
- Reports: `this plate: X, Example range p10–p90: A–B, percentile: N%`.
- If value falls outside $p_{10}\text{–}p_{90}$, status is marked `below range` or `above range`.
- *Rule*: **Advisory only.** Reviewers may waive any Tier B advisory flag with a one-line written reason in `findings.json`. The review gate must never loop on an advisory flag.

### Tier C: Perceptual Proxies (`source: guess`, `class: info`)
Experimental heuristics (e.g. unvalidated gaze jumps, corner persistence, static digits).
- Printed as `uncalibrated (informational, do not optimize to)`.
- Cannot block reviews or fail CI passes.

---

## 6. Output Files Specification

| File | Type | Purpose |
| :--- | :--- | :--- |
| `report.md` | Markdown | Comprehensive report structured in fixed sections (0 to 12). Capped at `--topn` rows per table. Units in every header. |
| `findings.json` | JSON | Machine-readable log of all Tier A, B, and C findings with stable IDs, timestamps, evidence files, and waiver logs. |
| `summary.json` | JSON | Normalized machine-readable object containing all aggregates, hit ratios, word sync stats, and flag records. Consumed by `--compare`. |
| `frames.csv` | CSV | Full 60 fps table: $n, t, E, E_{p95}, \text{flow}_{dx}, \text{flow}_{dy}, L, C, \text{edgeDensity}, \text{signal\%}, \text{brightNonsignal\%}, \text{shimmer}, \text{segs}, \text{ms}, \text{spp}$. |
| `text.csv` | CSV | Complete log of every intercepted Canvas2D `fillText` call: frame, $t$, string, font, bounding box coordinates, $\alpha$, and layer. |
| `events.json` | JSON | Catalogue of cuts, musical downbeats, kicks, snares, and lyric onsets used in the window. |
| `timeline.png` | Image (PNG) | 1920px stacked time-series plot with synchronized time axis showing $E$, luma, signal%, edge density, text height%, and ms. |
| `slitscan.png` | Image (PNG) | Center-column slit scan (4px per frame, wrapped every 480 frames) revealing camera speed ramps and continuity. |
| `strip_<label>.png`| Image (PNG) | Sub-second visual contact filmstrip sampled at `--event-offsets` around major cuts, kicks, and collisions. |
| `rgbtime_<label>.png`| Image (PNG) | RGB temporal composite ($R = i-2, G = i, B = i+2$) highlighting velocity direction, fringing, and micro-stutter. |
| `events/<label>.csv`| CSV | High-resolution per-frame metric table for $\pm 0.5\,\text{s}$ surrounding each diagnostic event. |

---

## 7. Known Limits & Practical Guidelines

1. **Shader / Texture Font Atlases**: The Canvas2D text probe intercepts JavaScript `fillText` calls. If text is pre-rendered into a WebGL texture atlas (e.g., `TextPlane` or MSDF shaders), it is invisible to `text.csv`. Global pixel metrics (luma, edges, flow, palette) still cover those frames.
2. **Sub-pixel Wireframe Jitter**: Highly detailed wireframe geometry moving across pixel boundaries can register minor motion energy ($E \approx 0.001\text{–}0.003$) even when the 3D camera is stationary.
3. **Always Run on a Clean Directory**: On Windows, file locking during rapid re-writes can cause `EEXIST` errors. Ensure `--out` points to a clean or newly named folder.
4. **Use `--only` Scene Aliases**: You can pass either plate IDs (`--only open`, `--only hook1`) or scene file basenames (`--only doors`, `--only hook`). The script automatically expands both.
