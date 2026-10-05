# Instrument 04: Transition Seam Onion-Skin & Carrier Stitch Inspector

## 1. Overview & Objective

The **Transition Seam Onion-Skin & Carrier Stitch Inspector** is a specialized boundary diagnostic instrument that audits the **exact handoff seam between two adjacent scenes, shots, or UI states** ($\pm 250\,\text{ms}$).

It generates a visual **Split-Wipe Onion Overlay** (`onion_seam.png`) and a frame-accurate **10-Frame Seam Contact Strip** (`strip_seam.png`), allowing an autonomous agent or human art director to verify that focal carrier elements (UI cards, brand logos, 3D anchors, horizon lines) connect seamlessly across transitions rather than violently jumping or dropping out.

---

## 2. Why Visual Seam Overlays Solve Transition Discontinuities

### The Perceptual Failure of Scene Cuts
In procedural motion graphics, transitions between scenes or interactive states are common failure points:
1. **Carrier Teleportation**: A focal element in Scene A ends at $(960, 540)$ with width $400\,\text{px}$, but in the very next frame in Scene B, the incoming element begins at $(920, 500)$ with width $360\,\text{px}$. The viewer's eye suffers an abrupt, jarring spatial dislocation.
2. **Invisible Buffer Dropouts**: A scene may accidentally drop its canvas buffer to black 1 frame before the cut timestamp, creating a subconscious flash.
3. **Horizon & Vanishing Point Tilts**: In 3D camera transitions, a subtle mismatch in horizon angle between the outgoing and incoming cameras produces disorienting visual friction.

A tabular list of numbers cannot communicate the perceptual quality of a cut. By rendering a **composite false-color onion-skin overlay of the exit and entry frames**, any spatial discontinuity appears instantly as bright color fringing.

---

## 3. Visualizations Generated

### A. The Split-Wipe Onion Overlay (`onion_seam.png`)
Composites the final frame of Scene A ($N-1$) directly over the first frame of Scene B ($N$):
- **Scene A (Exit Frame)**: Tinted in translucent green (`#00FF66`, $\alpha = 0.5$).
- **Scene B (Entry Frame)**: Tinted in translucent magenta (`#FF00AA`, $\alpha = 0.5$).
- **The Visual Result**:
  - Wherever the carrier geometry perfectly aligns across the transition, green + magenta light combine into **clean, neutral white/gray**.
  - Any spatial offset, scale discrepancy, or horizon tilt immediately produces **bright green or magenta fringing**.

```
ONION OVERLAY CONCEPT (FRAME N-1 vs FRAME N)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         /─────────────────────────────\                     │
│        │  [ Neutral White Core ]       │                    │
│        │   Carrier aligns cleanly      │                    │
│        │                               │                    │
│        \───[ Green Fringe: 4px shift ]/                     │
│                                                             │
│  [Green = Outgoing Scene | Magenta = Incoming Scene]        │
└─────────────────────────────────────────────────────────────┘
```

### B. The 10-Frame Seam Contact Strip (`strip_seam.png`)
A continuous horizontal contact strip showing the 5 frames immediately preceding the cut ($N-5 \to N-1$) and the 5 frames immediately following the cut ($N \to N+4$), divided by a bright red vertical marker line.
- Allows the agent to verify camera velocity vector continuity (does the motion carry through the cut, or does it freeze dead before jumping?).

---

## 4. Quantitative Seam Telemetry

Alongside the visual overlays, the tool outputs exact physical handoff coordinates:

| Seam Transition | Cut Time (s) | Carrier Position Offset (px) | Carrier Scale Delta (%) | Velocity Continuity | Luma Jump (ΔL) | Dropout Frames | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `feed_card` → `modal_detail` | 3.25s | 1.8 px | 0.6% | 2.1% delta | 0.04 | 0 frames | Seamless |
| `macro_shot` → `wide_reveal` | 6.40s | 3.2 px | 1.4% | 4.2% delta | 0.06 | 0 frames | Aligned |
| `chapter_1` → `chapter_2` | 15.00s | **42.1 px** | **16.8%** | **38.4% delta** | **0.48** | 0 frames | **Discontinuous Offset** |

### Metric Validity Conditions
- **Intentional Orthogonal Cuts**: If a transition is intentionally authored as an orthogonal hard cut (changing camera angle completely), carrier continuity is tagged `intentional_hard_cut` and carrier position matching is omitted.
- **Palette Inversions**: When a cut is accompanied by a dark-to-light theme inversion, luma delta $\Delta L$ is marked `expected_palette_inversion` rather than an exposure error.

---

## 5. Technical CLI Interface

```bash
# Audit a UI card-to-fullscreen modal expansion seam
bun scripts/render.ts stitch --from-scene feed_card --to-scene modal_detail --t 3.25 --out ../out/visual/modal_seam

# Audit the match-cut between product macro shot and wide showcase at t = 6.40s
bun scripts/stitch.ts --from-scene macro_shot --to-scene wide_reveal --t 6.40 --out ../out/visual/macro_to_wide

# Inspect transition seam between two commercial chapters
bun scripts/stitch.ts --from-scene chapter_1 --to-scene chapter_2 --t 15.00 --out ../out/visual/chapter_seam
```
