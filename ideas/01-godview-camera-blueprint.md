# Instrument 01: The 3D Camera Trajectory Ribbon & Architectural Blueprint

## 1. Overview & Objective

An abstracted visual diagnostic tool that generates an **external 3D architectural blueprint** of the scene and its camera path across **any procedural motion graphic design project**—commercial product reveals, 3D UI exploded views, architectural fly-throughs, data visualization stages, and brand identity animations.

It replaces invisible 3D calculations and arbitrary scalar "jerk" thresholds with an intuitive visual flight path, allowing an autonomous agent or human art director to inspect camera choreography, velocity gradients, frustum orientation, and spatial clearances from outside the active cinema lens.

---

## 2. Why Abstracted Visual Data Works Better Than Pass/Fail

### Moving Beyond the "Jerk Metric" Anti-Pattern
In earlier motion design experiments, camera motion was often graded with arbitrary scalar thresholds (e.g. `jerk > 120 m/s³ = FAIL`).

This created severe failure modes:
1. **False Positives on Intentional Snaps & Beats**: In professional motion design, the camera often snaps intentionally on sound design accents, voiceover beats, or UI state triggers (e.g. a sharp reframing or rapid push-in). A raw jerk metric mindlessly penalizes these intentional artistic accents as errors.
2. **Invisible Geometry Clipping**: Looking strictly through the 2D front lens, an agent cannot diagnose why a 3D product edge clipped out or why a floating label suddenly vanished.
3. **Sluggish Damping Traps**: Agents tasked with satisfying a jerk threshold would artificially damp and soften all camera moves, draining scenes of kinetic energy and commercial punch.

By rendering an **architectural schematic of the 3D space with a velocity-colored motion trail**, the agent can directly see whether a flight path is a clean, intentional spline or an unintended glitch.

---

## 3. Visualizations Generated

### A. The Top-Down & Elevation Trajectory Blueprint (`cam_godview.png`)
Renders an orthographic $XZ$ top-down blueprint and an orthographic $YZ$ side elevation showing:
1. **The 3D Flight Ribbon**: The camera position curve $\mathbf{P}_{\text{cam}}(t)$ rendered as a continuous ribbon.
2. **Velocity Color Gradient**:
   - Deep Indigo / Blue: Stationary to slow ($0\text{–}4\,\text{m/s}$)
   - Bone / Gray: Moderate transit ($4\text{–}15\,\text{m/s}$)
   - Signal Orange: High-speed acceleration ($15\text{–}30\,\text{m/s}$)
   - Saturated Vermilion: Maximum terminal velocity ($> 30\,\text{m/s}$)
3. **Frustum Pyramid & Line of Sight**:
   - Drawn at regular intervals (e.g. every $0.5\,\text{s}$), showing viewing cones, gaze axis, and focal point.
4. **Spatial Object Footprints**:
   - Projected bounding boxes of 3D hero products, UI planes, stage barriers, and text anchors.

```
TOP-DOWN BLUEPRINT (XZ PLANE)
                 [ 3D HERO PRODUCT / UI ANCHOR ]
                          ┌─────────────┐
                          │  HERO MESH  │
                          └─────────────┘
                                ▲
                               ╱ ╲  <-- Frustum Cone (Target Gaze Axis)
                              ╱   ╲
                        t=12s ─────
                             │   │
Trajectory Ribbon            │   │  (Signal Orange = Speed 24 m/s)
(with velocity gradient)     │   │
                             │   │
                              \   \
                               \   \  t=10s (Smooth 30° Arc Orbit)
                                \   \
                                 │   │ (Deep Blue = Speed 4 m/s)
                                t=8s
```

### B. Planned Extension: Phase-Space Trajectory Plot (`phase_camera.png`)
*(Proposed auxiliary diagnostic plot; the core implemented tool currently outputs `cam_godview.png` containing the dual-panel Top-Down and Elevation blueprints alongside `godview_summary.json` kinematics).*

A 2D phase-space graph plotting **Camera Speed** on the horizontal axis ($v(t)$ in $\text{m/s}$) vs. **Camera Acceleration** on the vertical axis ($a(t)$ in $\text{m/s}^2$):
- **Continuous, Harmonic Splines**: Form smooth, closed or continuous elliptical loops.
- **Piecewise Glitches / Unintended Jolts**: Show sharp, discontinuous spikes jumping across phase space.
- The agent inspects the phase plot to verify that acceleration spikes align with intentional timeline triggers (e.g. UI state changes, audio transients) rather than occurring randomly mid-move.

---

## 4. Quantitative Telemetry (No Arbitrary Grading)

Alongside the visual blueprint, the tool outputs factual physical telemetry:

| Timestamp (s) | Position (x, y, z) | Speed (m/s) | Accel (m/s²) | Nearest Object Distance | Timeline Event Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.00 | (0.0, 1.2, -2.2) | 0.0 m/s | 12.4 m/s² | 1.80 m (Stage Left) | Chapter Start |
| 7.50 | (0.0, 1.2, 9.1) | 18.2 m/s | 0.0 m/s² | 1.78 m (Stage Left) | SFX Transient |
| 11.20 | (0.4, 1.2, 28.2) | 32.0 m/s | -24.1 m/s² | **0.14 m (Near-Plane Alert)** | None |

### Metric Validity Conditions
- **Validity on Intentional Snaps**: If an acceleration spike occurs within $\pm 35\,\text{ms}$ of an audio beat or animation state trigger, it is tagged `intentional_event_snap` and omitted from jitter warnings.
- **World Metric Units**: All speeds and distances are reported in world units ($\text{m}, \text{m/s}$) rather than arbitrary screen pixels.

---

## 5. Technical CLI Interface

```bash
# Inspect a 3D product turntable camera orbit
bun scripts/godview.ts --scene product_reveal --from 4.0 --to 12.0 --samples 32 --out ../out/visual/product_orbit

# Audit an architectural fly-through across an entire sequence
bun scripts/render.ts godview --scene arch_walk --from 0.0 --to 20.0 --samples 40 --out ../out/visual/arch_flythrough

# Check camera clearances in an exploded 3D UI scene
bun scripts/godview.ts --scene ui_explode --from 2.5 --to 8.0 --samples 24 --out ../out/visual/ui_clearances
```
