# Diagnostic Instrument 02: Multi-Exposure Motion Onion (`onion`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/onion.ts`](../app/scripts/visual/onion.ts)  
**CLI Command**: `bun scripts/render.ts onion` or `bun scripts/onion.ts`  
**Core Artifacts**: `onion_motion.png`, `onion_summary.json`  

---

## 1. Overview & Capability

The **Multi-Exposure Motion Onion** is a temporal motion diagnostic tool that collapses an animation window ($0.5\text{–}1.5\,\text{s}$) into a **single composite diagnostic still** (`onion_motion.png`).

It blends consecutive frames across time using a **chromatic temporal decay gradient**, allowing autonomous agents and human directors to evaluate physical spring oscillations, camera flight arcs, UI sheet expansions, and kinetic typography deceleration curves on a single model-readable image.

```
TEMPORAL ONION-SKIN CHROMATIC MAPPING
┌────────────────────────────────────────────────────────────────────────┐
│ [Past: t - 0.25s]  [t - 0.12s]   [Center: t = Key]  [t + 0.12s]  [Future]│
│   Cool Cyan          Sky Blue      Natural Color      Amber      Orange │
│   (15% Opacity)   (45% Opacity)   (100% Opacity)  (45% Opacity)(15% Opacity)
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Visual Artifacts Produced

### A. Chromatic Multi-Exposure Still (`onion_motion.png`)
Renders a single 1920x1080 still where 8–16 consecutive frames are composited together:
1. **Past Frames ($t < t_{\text{mid}}$)**:
   - Tinted in cool cyan/blue (`#00D2FF`) with ascending opacity ($15\% \to 60\%$).
   - Displays the incoming trajectory leading up to the key moment.
2. **Key Center Frame ($t = t_{\text{mid}}$)**:
   - Rendered in **full natural contrast and color** at $100\%$ opacity.
   - Serves as the sharp perceptual baseline anchor.
3. **Future Frames ($t > t_{\text{mid}}$)**:
   - Tinted in warm amber/signal orange (`#FF7A00`) with descending opacity ($60\% \to 15\%$).
   - Displays the outgoing follow-through and deceleration phase.

### Visual Diagnosis Patterns

```
CASE 1: SMOOTH CONTINUOUS DECELERATION (IDEAL EASING)
Past (Cyan)                        Center (Natural)           Future (Amber)
  ●  ───>  ●  ──>  ●  ─>  ●  ────>        ●       ──────>  ●  ─>  ●  ──>  ●
[ Wide Spacing ]  [ Tightening Spacing ] [ Dwell ]  [ Controlled Exit Follow-Through ]
Monotonically decreasing distances demonstrate clean C1/C2 physical damping.

CASE 2: VELOCITY STALL / SPLINE DISCONTINUITY (FLIGHT GLITCH)
Past (Cyan)                        Center (Natural)
  ●  ─────>  ●       ● ● ●                 ● ──────────────> ●
[ Wide Leap ]   [ Sudden Bunching ]   [ Violent Rebound Leap ]
Unintended clustering followed by a jump exposes a tangent kink or sudden velocity stall.
```

### B. Onion Summary Telemetry (`onion_summary.json`)
Emits quantitative metadata detailing the temporal sampling window:
```json
{
  "scene": "hero_transition",
  "center_t": 10.0,
  "window_seconds": 0.5,
  "from": 9.75,
  "to": 10.25,
  "frame_count": 10,
  "timestamps": [9.75, 9.805, 9.86, 9.915, 9.97, 10.025, 10.08, 10.135, 10.19, 10.25]
}
```

---

## 3. How Autonomous Agents & Creators Use This Tool

### Diagnostic Workflow
1. **Verifying Physical Spring Damping**:
   - In UI card popups, buttons, or camera tracking shots driven by `MotionBus.spring()`, the agent inspects the trailing amber echoes.
   - If echoes oscillate back and forth across the center frame, the spring is underdamped ($\zeta < 0.7$) and ringing. If echoes stop prematurely with no follow-through, it is overdamped.
2. **Detecting Motion Stalls & Tangent Freezes**:
   - A smooth motion arc produces evenly spaced or monotonically tightening echoes. Sudden overlapping ghost clusters indicate the motion stalled for 2–3 frames before resuming.
   - *Remediation*: Re-interpolate spline tangents or adjust cubic-bezier handle coordinates.
3. **Typography Entrance Easing**:
   - When kinetic typography slides into reading rest, the amber echoes should compress into a tight stack. If the text hits an abrupt wall with wide ghost spacing up to the stop, arrival impact is too harsh ($C^0$ kink).

---

## 4. CLI Parameters & Execution

```bash
# Inspect motion around a key timestamp with default 0.5s window (10 frames)
bun scripts/render.ts onion --t 10.0 --out ../out/visual/onion

# Audit a rapid UI spring interaction with a tight 0.3s window and 14 frames
bun scripts/onion.ts --t 4.25 --window 0.3 --frames 14 --out ../out/visual/onion

# Inspect an entire scene range
bun scripts/onion.ts --scene card_expand --from 8.2 --to 9.4 --frames 16
```

### Supported CLI Flags
* `--t <seconds>`: Center keyframe timestamp (default: `10.0`).
* `--window <seconds>`: Total time duration for the multi-exposure window centered on `--t` (default: `0.5`).
* `--from <seconds>` / `--to <seconds>`: Explicit time boundaries (overrides `--t` and `--window`).
* `--frames <N>`: Number of exposure frames to blend across the window (default: `10`).
* `--scene <id>`: Target timeline scene.
* `--out <dir>`: Target directory for `onion_motion.png` and `onion_summary.json` (default: `../out/visual/onion`).
