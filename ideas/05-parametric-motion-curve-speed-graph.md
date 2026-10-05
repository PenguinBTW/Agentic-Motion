# Instrument 05: Parametric Motion Curve & Speed Graph Inspector (`curves`)

## 1. Overview & Objective

The **Parametric Motion Curve & Speed Graph Inspector** is an isolated mathematical diagnostic tool that plots the value curve and physical kinematic derivatives (speed $v(t) = |y'(t)|$ and acceleration $a(t) = y''(t)$) of any animated scene property—position, scale, rotation, opacity, camera FOV, spring values, or custom shader parameters.

It replicates the classic desktop NLE/DAW **Speed Graph Editor** (After Effects, Cavalry, Blender), providing autonomous coding agents and human art directors with a dedicated diagnostic instrument to inspect easing curvature, tangent health, and arrival velocity without spatial conflation.

---

## 2. The Problem It Solves

When an autonomous coding agent writes procedural animation code:
1. **$C^0$ Tangent Kinks & Velocity Spikes**: When chaining animation segments or blending curves, mathematical errors often introduce sharp velocity spikes where acceleration instantaneously spikes to infinity, creating an ugly jolt.
2. **Arrival Shock & Slamming Stops**: An animation may look smooth initially, but arrive at its rest value with a non-zero velocity ($v(t_{\text{end}}) > 0$), creating an abrupt visual stop rather than a fluid deceleration shoulder.
3. **Spring Tuning Ambiguity**: Tuning a second-order spring ($m, k, c$) in code without a speed graph often leads to underdamping (excessive ringing) or overdamping (sluggish crawl).
4. **Spatial Conflation in Motion Trails**: The Motion Onion reflects 2D spatial positions. When an element moves along an arc or rotates in 3D, spatial curvature is conflated with velocity easing. Furthermore, the Motion Onion is **completely blind to non-spatial properties** like opacity fades, scale bounces, or camera FOV zooms.

---

## 3. Visual Specifications (`curve_speedgraph.png`)

```
PARAMETRIC SPEED GRAPH SCHEMATIC (Dual-Panel Diagnostic Chart)

PANEL 1: VALUE CURVE y(t)
1.0 ┌───────────────────────────────────────────────/─────────┐  Ease-Out Rest
    │                                             /---         │  (v_end ≈ 0)
    │                                           /              │
    │                                         /                │
0.5 │                                       /                  │
    │                                    /                     │
    │                        /-----------                      │
0.0 └────────────────────────┴─────────────────────────────────┘
   t0 = 2.0s                                         t1 = 2.8s

PANEL 2: VELOCITY v(t) & ACCELERATION a(t)
Peak┌──────────────────────────────────────────────────────────┐
    │                       ▲ Peak Velocity: 4.82 units/s      │
    │                      / \                                 │
    │                     /   \                                │
    │                    /     \                               │
0.0 └───────────────────/───────\─────────────────────────────-┘
   [C2 Smooth Shoulder]           \                [v_end = 0.02]
                                   ▼ Deceleration   (Zero Impact)
```

### Visual Features
1. **Panel 1: Normalized Value Curve $y(t)$**:
   - Plots value trajectory over time with keyframe arrival targets, ease shoulders, and overshoot envelopes.
2. **Panel 2: Kinematic Speed $v(t)$ & Acceleration $a(t)$**:
   - Plots first derivative $dy/dt$ (solid cyan) and second derivative $d^2y/dt^2$ (dashed amber).
   - **Green Shading**: Smooth $C^1/C^2$ continuous acceleration/deceleration.
   - **Signal Orange Flags**: Tangent breaks or acceleration jolts ($|a(t)| > \text{threshold}$).
   - **Red Cross Markers ($\times$)**: Hard impact on arrival ($v(t_{\text{end}}) > 5\%$ of peak velocity).

---

## 4. Technical CLI Interface

```bash
# Inspect UI card scale spring curve across 2.0s to 2.8s
bun scripts/curves.ts --scene modal_reveal --prop card_scale --from 2.00 --to 2.80 --out ../out/visual/card_curve

# Inspect camera FOV transition across a commercial shot
bun scripts/curves.ts --scene product_hero --prop camera_fov --from 4.00 --to 5.50

# Inspect opacity crossfade easing
bun scripts/curves.ts --scene title_intro --prop title_opacity --from 0.50 --to 1.20
```

### Options
* `--scene <name>`: Target scene or plate ID.
* `--prop <name>`: Target animated property identifier (`position.y`, `scale`, `rotation.z`, `opacity`, `fov`).
* `--from <seconds> --to <seconds>`: Inspection time window.
* `--samples <integer>`: Sub-frame sampling count (default: `120`, range: `60–600`).
* `--out <path>`: Output directory for PNG chart and telemetry JSON.

---

## 5. Quantitative Telemetry (`curves_summary.json`)

```json
{
  "scene": "modal_reveal",
  "property": "card_scale",
  "window_s": [2.00, 2.80],
  "duration_s": 0.80,
  "peak_speed_units_per_s": 4.82,
  "arrival_speed_units_per_s": 0.02,
  "arrival_impact_pct": 0.4,
  "continuity_class": "C2_continuous",
  "tangent_breaks_count": 0,
  "overshoot_pct": 8.4,
  "damping_ratio_zeta": 0.72,
  "settle_time_s": 0.48,
  "status": "smooth_spring_settle"
}
```

---

## 6. Autonomous Agent Iteration Workflow

```
[ Agent parses curves_summary.json ]
                │
                ├─► arrival_speed_units_per_s > 0.5
                │   • Diagnosis: Element slams into rest abruptly without deceleration.
                │   • Action: Adjust cubic-bezier ease-out shoulder or increase spring damping.
                │
                ├─► tangent_breaks_count > 0
                │   • Diagnosis: Discontinuous C0 tangent break between keyframe segments.
                │   • Action: Unify piecewise segments into a continuous Hermite spline or single MotionBus curve.
                │
                └─► damping_ratio_zeta < 0.5 (Excessive ringing)
                    • Diagnosis: Spring oscillates violently past settle point.
                    • Action: Increase damping parameter in MotionBus.spring(t, { damping: 0.8 }).
```
