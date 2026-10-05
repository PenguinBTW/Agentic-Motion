# Instrument 04: Transition Seam Onion-Skin & Carrier Stitch Inspector

## 1. Overview & Objective

A specialized boundary inspection tool that audits the **exact handoff seam between two adjacent scenes** ($\pm 250\,\text{ms}$). It generates a visual **Split-Wipe Onion Overlay** and a frame-accurate alignment contact strip, allowing an agent or reviewer to directly observe whether carrier elements (doors, portals, coordinate planes) connect seamlessly across cuts or violently jump.

---

## 2. Why Abstracted Visual Data Works Better Than Pass/Fail

### The Seam Alignment Problem
Transitions are where videos fail most severely:
1. **Carrier Teleportation**: An object in Scene A ends at $(960, 540)$ with width $800\,\text{px}$, but in the very next frame in Scene B, the incoming object starts at $(910, 480)$ with width $650\,\text{px}$. The carrier jumps noticeably.
2. **Invisible Seam Gaps**: A scene might accidentally drop to black or collapse its 3D rails 2 frames before the cut, destroying the carrier before the next scene even loads.

A simple numbers table cannot show you how the visual flow feels across a cut. By rendering a **composite onion-skin overlay of the exit and entry frames**, any spatial discontinuity appears instantly as a visible visual misalignment.

---

## 3. Visualizations Generated

### A. The Split-Wipe Onion Overlay (`onion_seam.png`)
Composites the final frame of Scene A ($N-1$) directly over the first frame of Scene B ($N$):
- **Scene A (Exit Frame)**: Tinted in translucent green.
- **Scene B (Entry Frame)**: Tinted in translucent magenta.
- **The Visual Result**:
  - Wherever the carrier geometry perfectly lines up across the cut, green + magenta light combine into **clean, neutral white/gray**.
  - Any spatial offset, scale mismatch, or horizon tilt immediately produces **bright green or magenta fringing**.

```
ONION OVERLAY CONCEPT (FRAME N-1 vs FRAME N)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         /─────────────────────────────\                     │
│        │  [ Neutral White Core ]       │                    │
│        │   Carrier lines up 98%        │                    │
│        │                               │                    │
│        \───[ Green Fringe: 4px shift ]/                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### B. The 10-Frame Seam Contact Strip (`strip_seam.png`)
A continuous horizontal filmstrip showing the 5 frames immediately preceding the cut and the 5 frames immediately following the cut ($N-5 \to N+5$).
- Allows the agent to inspect velocity vector continuity (does the camera maintain speed through the cut, or does it freeze before jumping?).

---

## 4. Quantitative Seam Telemetry

Alongside the visual overlays, the tool reports exact physical handoff coordinates:

| Seam Transition | Cut Time (s) | Carrier Position Offset (px) | Carrier Scale Delta (%) | Velocity Continuity | Luma Jump (ΔL) | Dropout Frames | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `doors` → `boundary` | 25.63s | 4.2 px | 2.1% | 4.8% delta | 0.08 | 0 frames | Aligned |
| `boundary` → `hook1` | 34.85s | 1.8 px | 0.8% | 2.1% delta | 0.04 | 0 frames | Seamless |
| `ledger` → `whisper` | 129.89s| **48.2 px** | **18.4%** | **42.0% delta** | **0.52** | 0 frames | **Discontinuous Offset** |

### Metric Validity Conditions
- **Hard Cuts vs Match Cuts**: If a transition is intentionally designed as an orthogonal hard cut (changing camera angle completely), carrier continuity is tagged `intentional_hard_cut` and carrier position matching is omitted.
- **Paper / Ink Invert Cuts**: When a cut is accompanied by a white-paper inversion, luma delta $\Delta L$ is marked `expected_palette_inversion` rather than an exposure error.

---

## 5. Technical Implementation Plan

1. **Implement `scripts/stitch.ts`**:
   Add dedicated micro-runner for seam analysis:
   ```bash
   bun scripts/render.ts stitch --from-scene doors --to-scene boundary --t 25.63 --out ../out/stitch/doors_to_boundary
   ```
2. **Render Boundary Frames**:
   Render frames $t_{\text{cut}} - 0.25\,\text{s}$ through $t_{\text{cut}} + 0.25\,\text{s}$.
3. **Generate Onion Composite**:
   Perform false-color additive compositing of frames 14 and 15 into `onion_seam.png`.
