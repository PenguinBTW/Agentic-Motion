# Instrument 01: The 3D Camera Trajectory Ribbon & Architectural Blueprint

## 1. Overview & Objective

An abstracted visual diagnostic tool that generates an **external 3D architectural blueprint** of the scene and its camera path. It replaces invisible 3D calculations and arbitrary "jerk" thresholds with an intuitive visual flight path, allowing an agent or reviewer to inspect camera choreography, velocity gradients, frustum orientation, and spatial clearances from outside the cinema lens.

---

## 2. Why Abstracted Visual Data Works Better Than Pass/Fail

### Moving Beyond the "Trapezoidal Snap" Penalty
In earlier proposals, camera motion was graded with arbitrary mathematical thresholds (e.g. `jerk > 120 m/s³ = FAIL`). 

This created severe failure modes:
1. **False Positives on Beat Snaps**: In professional editing (including `Example project/room.ts`), the camera intentionally snaps on musical beats (`snap: 0.09` on downbeats) or performs quick reframings. A raw jerk test mindlessly flags these intentional artistic snaps as "errors".
2. **Invisible Geometry Clipping**: Looking only through the 2D front lens, an agent cannot understand why an object popped into view or clipped out.
3. **Gaming the Easing Curve**: Agents tasked with satisfying a jerk threshold would artificially damp and soften camera movements, making energetic scenes sluggish and lifeless.

By rendering an **architectural schematic of the 3D space with a glowing motion trail**, the agent can directly see whether a flight path is a clean, intentional spline or an unintended glitch.

---

## 3. Visualizations Generated

### A. The Top-Down & Isometric Trajectory Ribbon (`cam_trail_3d.png`)
Renders an orthographic $XZ$ top-down schematic and an isometric $3/4$ perspective showing:
1. **The 3D Flight Ribbon**: The camera position curve $\mathbf{P}_{\text{cam}}(t)$ rendered as a continuous ribbon.
2. **Velocity Color Gradient**:
   - Deep Indigo / Blue: Stationary to slow ($0\text{–}4\,\text{m/s}$)
   - Bone / Gray: Moderate transit ($4\text{–}15\,\text{m/s}$)
   - Signal Orange: High-speed acceleration ($15\text{–}30\,\text{m/s}$)
   - Saturated Vermilion: Maximum terminal velocity ($> 30\,\text{m/s}$)
3. **Frustum Pyramid & Line of Sight**:
   - Drawn at regular time intervals (e.g. every $0.5\,\text{s}$), showing the viewing cone and gaze direction.
4. **Spatial Object Footprints**:
   - Bounding boxes of world geometry (walls, doorframes, decision boundaries, text planes) projected onto the blueprint ground.

```
TOP-DOWN BLUEPRINT (XZ PLANE)
                 [Object: Decision Ridge]
                         ┌─────────────┐
                         │             │
                         └─────────────┘
                               ▲
                              ╱ ╲  <-- Frustum Cone (gaze orientation)
                             ╱   ╲
                       t=12s ─────
                            │   │
Trajectory Ribbon           │   │  (Signal Orange = Speed 24 m/s)
(with velocity gradient)    │   │
                            │   │
                             \   \
                              \   \  t=10s (Smooth 30° Arc)
                               \   \
                                │   │ (Deep Blue = Speed 4 m/s)
                               t=8s
```

### B. The Phase-Space Trajectory Plot (`phase_camera.png`)
A 2D phase-space graph plotting **Camera Speed** on the horizontal axis ($v(t)$ in $\text{m/s}$) vs. **Camera Acceleration** on the vertical axis ($a(t)$ in $\text{m/s}^2$):
- **Continuous, Harmonic Splines**: Form smooth, closed or continuous elliptical loops.
- **Piecewise Glitches / Unintended Snaps**: Show sharp, discontinuous spikes jumping across phase space.
- The agent inspects the phase plot to confirm that high-acceleration transients land squarely on musical beats rather than occurring randomly mid-phrase.

---

## 4. Quantitative Telemetry (No Arbitrary Grading)

Alongside the visual blueprint, the tool outputs raw physical telemetry:

| Timestamp (s) | Position (x, y, z) | Speed (m/s) | Accel (m/s²) | Nearest Object Distance | Beat Transient |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 8.50 | (0.0, 1.2, -2.2) | 0.0 m/s | 12.4 m/s² | 1.80 m (Left Wall) | Vocal Onset |
| 11.00| (0.0, 1.2, 9.1) | 18.2 m/s | 0.0 m/s² | 1.78 m (Left Wall) | Kick 1 (Transient) |
| 16.80| (0.4, 1.2, 45.2) | 38.0 m/s | -24.1 m/s² | **0.12 m (Near-Plane Alert)** | None |

### Metric Validity Conditions
- **Validity on Beat Snaps**: If an acceleration spike occurs within $\pm 35\,\text{ms}$ of an audio beat or downbeat, it is tagged `intentional_beat_snap` and omitted from jitter analysis.
- **World Scale Normalization**: All speeds and distances are reported in world metric units ($\text{m}, \text{m/s}$) rather than arbitrary screen pixels.

---

## 5. Technical Implementation Plan

1. **Lightweight Secondary Pass in `scripts/render.ts`**:
   Add `--godview` flag to render the secondary orthographic camera pass:
   ```bash
   bun scripts/render.ts motion --only doors --from 8 --to 18.5 --godview --out ../out/motion/doors-blueprint
   ```
2. **Camera Helper & Spline Extraction**:
   Sample `camera.matrixWorld` over the frame range and generate `cam_trail_3d.png` via Three.js `LineBatch` or headless Canvas2D.
3. **Phase-Space Plot Generation**:
   Compute finite differences $v(t) = \frac{\Delta x}{\Delta t}, a(t) = \frac{\Delta v}{\Delta t}$ and plot on a clean $600 \times 400$ canvas.
