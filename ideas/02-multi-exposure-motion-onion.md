# Instrument 08: Multi-Exposure Onion Skinner (Temporal Motion Trail on a Single Still)

## 1. Overview & Objective

The **Multi-Exposure Onion Skinner** is a temporal diagnostic tool that collapses a 0.5–1.5 second animation window into a **single composite diagnostic still** (`onion_motion.png`). 

It blends 8–16 consecutive frames using a **chromatic time-decay gradient** (past frames in faint cyan/blue, current frame in pure white, future frames in warm amber/orange), rendering camera flight arcs, typographic easing curves, and velocity rhythms directly onto one inspectable image.

---

## 2. Real Historical Scenario & Why It Is Worth Building

### The Problem in Past Work
During earlier iterations of the Phase 1 rebuild (`boundary.ts` and `hook.ts`), the director repeatedly reported:
> *"The camera has violent kick tremors and piecewise acceleration jolts. It accelerates and then suddenly snaps."*

### Why Existing Tools Failed
1. **Isolated Screenshots Were Blind**: When inspecting separate frame stills (`f_26.00.png`, `f_26.10.png`, `f_26.20.png`), every frame looked clean, sharp, and well-composed in isolation. The jerkiness was completely invisible in static screenshots.
2. **Video Playback Clutter**: Generating full 60 fps MP4 videos and playing them back made micro-jitters flash past in 16 milliseconds—impossible for an AI agent or reviewer to inspect with spatial precision.
3. **Scalar Derivatives (Jerk Metrics) Misled**: Scalar metrics like $jerk > 120\,\text{m/s}^3$ produced false positives on intentional musical beat drops while missing high-frequency camera micro-tremors during slow tracking shots.

### How the Multi-Exposure Onion Skinner Solves It
In a chromatic multi-exposure still:
- **Harmonic, continuous C1 camera flight**: Appears as a beautifully smooth, evenly spaced cascade of color echoes with progressive distance spacing.
- **Piecewise acceleration breaks**: Appear as bunched-up, crowded ghost echoes followed by a sudden wide gap or an angular directional kink.
- **Micro-tremors & jitter**: Appear as fuzzy, jagged double-edges or stair-stepped silhouettes rather than a smooth motion ribbon.
- **Typographic easing flaws**: If a word pops in abruptly without ease, there are no preceding cyan ghost echoes; if it decelerates smoothly to a stop, the amber echoes compress proportionally.

---

## 3. Visual Specifications (`onion_motion.png`)

```
TEMPORAL ONION-SKIN SCHEMATIC (Single Composite Image)

[Past: t - 0.20s]     [t - 0.10s]     [Current: t = 0]     [t + 0.10s]     [Future: t + 0.20s]
   Faint Cyan          Cool Blue         Bright White         Warm Amber       Saturated Orange
       ○                   ○                  ●                   ○                   ○
        \                   \                 │                  /                   /
         \                   \                │                 /                   /
    ┌──────────┐        ┌──────────┐    ┌──────────┐     ┌──────────┐        ┌──────────┐
    │  "WORD"  │        │  "WORD"  │    │  "WORD"  │     │  "WORD"  │        │  "WORD"  │
    └──────────┘        └──────────┘    └──────────┘     └──────────┘        └──────────┘
       (20% α)             (50% α)         (100% α)         (50% α)             (20% α)

<--- Smooth Progressive Easing (Evenly spaced gaps = constant velocity or C1 deceleration) --->
<--- Uneven Clumping / Zigzags = Piecewise Jerk / Jitter Bug                                --->
```

### Visual Features
1. **Temporal Color Mapping**:
   - Frames $t - 6$ to $t - 1$: Shifted toward **Cyan / Deep Blue** with ascending opacity ($15\% \to 60\%$).
   - Frame $t$ (Key Target): Rendered in **Full Contrast / Original Palette** ($100\%$ opacity).
   - Frames $t + 1$ to $t + 6$: Shifted toward **Amber / Signal Orange** with descending opacity ($60\% \to 15\%$).
2. **Centroid Tracking Vector**:
   - A fine 1px vector curve connecting the geometric centers of the hero word or camera target across all sampled frames, with timestamp nodes ($\bullet$) marking every 50ms.
3. **Ghost Spacing Gauge**:
   - Small distance ticks measuring the pixel displacement $\Delta d$ between consecutive ghost echoes. An ideal ease-in displays monotonically increasing $\Delta d$; an easing break displays sudden contraction or reversal.

---

## 4. Technical CLI Interface

```bash
# Generate a 12-frame multi-exposure onion skin around t = 26.50s in boundary scene
bun scripts/render.ts onion --scene boundary --t 26.50 --window 0.5 --frames 12 --out ../out/onion/boundary_ease

# Inspect camera trajectory across a 1.0s phrase in hook
bun scripts/render.ts onion --scene hook1 --from 34.00 --to 35.00 --step 0.08 --out ../out/onion/hook_dive
```

### Options
- `--scene <name>`: Target scene or plate ID.
- `--t <seconds>`: Center timestamp for symmetric temporal window.
- `--from <seconds> --to <seconds>`: Asymmetric time range to collapse.
- `--frames <count>`: Number of exposure slices to composite (default: `10`, range: `4–20`).
- `--mode <camera|text|all>`: Focus blend on camera flight or isolate foreground typography layer.

---

## 5. Output Telemetry (`onion_summary.json`)

Along with the composite PNG, the tool outputs factual spacing telemetry:

```json
{
  "center_t": 26.50,
  "sampled_frames": 12,
  "time_delta_per_frame_s": 0.033,
  "spacing_px": [12.4, 15.1, 18.2, 22.0, 25.4, 28.1, 29.8, 30.2, 28.5, 25.1, 20.4],
  "spacing_continuity": "monotonic_smooth",
  "angular_drift_deg": 2.1,
  "unexpected_reversals": 0,
  "limits": "Composites 2D viewport projections; cannot resolve elements that rotate purely on their own axis without translation."
}
```

---

## 6. Implementation Blueprint

1. **Frame Capture**: Render $N$ frames at requested timestamps using headless Playwright canvas stream into memory buffers.
2. **Chromatic Tint Shader / Canvas Blend**:
   - Apply additive or screen blending with temporal tint curves:
     $$\text{Color}(t_k) = \text{Frame}(t_k) \times \text{Tint}(k) \times \alpha(k)$$
3. **Node Centroid Extraction**: If text probe data is active, draw the centroid spline across frames.
4. **Export**: Save `onion_motion.png` and `onion_summary.json`.
