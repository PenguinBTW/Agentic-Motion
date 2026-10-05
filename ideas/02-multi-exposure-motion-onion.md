# Instrument 02: Multi-Exposure Onion Skinner (Temporal Motion Trail on a Single Still)

## 1. Overview & Objective

The **Multi-Exposure Onion Skinner** is a temporal diagnostic instrument that collapses a $0.5\text{–}1.5\,\text{s}$ animation window into a **single composite diagnostic still** (`onion_motion.png`).

It blends 8–16 consecutive frames using a **chromatic time-decay gradient**:
- Past frames in cool cyan/blue (`#00D2FF`, $15\% \to 60\%$ opacity)
- Current key center frame in full natural contrast and color ($100\%$ opacity)
- Future frames in warm amber/orange (`#FF7A00`, $60\% \to 15\%$ opacity)

This renders 3D camera trajectories, physical spring oscillations, UI micro-interactions, vector morphs, and kinetic typography easing curves directly onto a single, model-readable diagnostic image.

---

## 2. Why Visual Motion Trails Solve Real Motion Problems

### The Blind Spots of Static Stills & Video Playback
1. **Static Screenshots Are Blind to Easing Flaws**: When inspecting isolated frame stills ($f_0, f_1, f_2$), every still appears crisp, sharp, and properly framed. A violent acceleration hitch, spring oscillation glitch, or spline discontinuity is completely invisible in static stills.
2. **Video Playback Fleetingness**: In 60 fps video playback, a 2-frame easing discontinuity flashes past in 33 milliseconds—impossible for an autonomous vision model or human director to spatially measure and debug.
3. **Scalar Derivatives Fail on Spring Physics**: Scalar $jerk$ metrics trigger false alarms on intentional spring snaps or physics impacts while failing to catch subtle micro-tremors in tracking shots.

### How the Multi-Exposure Onion Solves It Across Motion Domains
- **Physical Spring Dynamics (UI & Micro-Interactions)**: A damped spring ($m, k, c$) produces a clearly readable decaying harmonic trail. Overdamped springs appear bunched; underdamped springs reveal excessive ringing overshoot.
- **Harmonic 3D Camera Trajectories**: Smooth continuous spline flights appear as a balanced cascade of progressively spaced color echoes. Tangent discontinuities show up as bunched echoes followed by sudden spatial gaps.
- **Kinetic Typography Easing**: When a headline decelerates into a reading rest, the amber echoes compress monotonically. If text enters with an abrupt pop, there are zero preceding cyan echoes.
- **Vector Shape Morphs & Logo Transitions**: Exposes whether path control points deform smoothly or kink awkwardly during shape transitions.

---

## 3. Visual Specifications (`onion_motion.png`)

```
TEMPORAL ONION-SKIN SCHEMATIC (Single Composite Diagnostic Image)

[Past: t - 0.20s]     [t - 0.10s]     [Center: t = 0]      [t + 0.10s]     [Future: t + 0.20s]
   Faint Cyan          Cool Blue         Natural Color        Warm Amber       Saturated Orange
       ○                   ○                  ●                   ○                   ○
        \                   \                 │                  /                   /
         \                   \                │                 /                   /
    ┌──────────┐        ┌──────────┐    ┌──────────┐     ┌──────────┐        ┌──────────┐
    │ HERO OBJ │        │ HERO OBJ │    │ HERO OBJ │     │ HERO OBJ │        │ HERO OBJ │
    └──────────┘        └──────────┘    └──────────┘     └──────────┘        └──────────┘
       (15% α)             (45% α)         (100% α)         (45% α)             (15% α)

<--- Smooth Progressive Easing (Monotonically spaced gaps = continuous C1 deceleration)      --->
<--- Uneven Clumping / Zigzags = Spline Hitch / Tangent Error / Uncontrolled Tremor          --->
```

### Key Visual Features
1. **Temporal Color Mapping**:
   - Frames $t - N$ to $t - 1$: Shifted toward **Cyan / Deep Blue** with ascending opacity ($15\% \to 60\%$).
   - Frame $t$ (Key Target): Rendered in **Full Contrast / Natural Color** ($100\%$ opacity).
   - Frames $t + 1$ to $t + N$: Shifted toward **Amber / Signal Orange** with descending opacity ($60\% \to 15\%$).
2. **Centroid Tracking Vector**:
   - A fine 1px vector curve connecting the geometric centers of the focal element across all sampled frames, with timestamp nodes ($\bullet$) marking sample intervals.
3. **Ghost Spacing Gauge**:
   - Distance indicators measuring the pixel displacement $\Delta d$ between consecutive ghost echoes. An ideal ease-in displays monotonically increasing $\Delta d$; an easing break displays sudden contraction or reversal.

---

## 4. Technical CLI Interface

```bash
# Audit UI card spring-damper deceleration across a 0.5s window
bun scripts/onion.ts --scene modal_reveal --t 2.40 --frames 12 --out ../out/visual/modal_spring

# Trace a 1.0s hero 3D camera crane move in a commercial product reveal
bun scripts/render.ts onion --scene hero_product --from 14.00 --to 15.00 --frames 16 --out ../out/visual/product_crane

# Inspect kinetic title deceleration in a brand manifesto sequence
bun scripts/onion.ts --scene title_intro --t 0.85 --window 0.6 --frames 10 --out ../out/visual/title_ease
```

### Options
- `--scene <name>`: Target scene or plate identifier.
- `--t <seconds>`: Center timestamp for symmetric temporal window.
- `--from <seconds> --to <seconds>`: Explicit time range to collapse.
- `--frames <count>`: Number of exposure slices to composite (default: `10`, range: `4–20`).
- `--out <path>`: Output directory for diagnostic PNG and JSON telemetry.

---

## 5. Output Telemetry (`onion_summary.json`)

Along with the composite PNG, the tool outputs factual spacing telemetry:

```json
{
  "center_t": 2.40,
  "sampled_frames": 12,
  "time_delta_per_frame_s": 0.041,
  "spacing_px": [14.2, 18.5, 22.1, 25.4, 28.0, 27.2, 23.8, 18.1, 12.0, 6.2, 1.4],
  "spacing_continuity": "monotonic_smooth_deceleration",
  "angular_drift_deg": 1.2,
  "unexpected_reversals": 0,
  "limits": "Composites 2D viewport projections; cannot resolve elements rotating purely on their own axis without translation."
}
```
