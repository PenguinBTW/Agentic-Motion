# Diagnostic Instrument 01: 3D God-View Camera Blueprint (`godview`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/godview.ts`](../app/scripts/visual/godview.ts)  
**CLI Command**: `bun scripts/render.ts godview` or `bun scripts/godview.ts`  
**Core Artifacts**: `cam_godview.png`, `godview_summary.json`  

---

## 1. Overview & Capability

The **3D God-View Camera Blueprint** is a spatial diagnostic tool that renders an **external architectural schematic** of the 3D scene and its camera flight path across any procedural motion graphics production—commercial product turntable reveals, 3D UI exploded views, architectural walkthroughs, and animated title stages.

Instead of evaluating camera flight solely through the front lens (which blinds creators and agents to spatial clearance issues or near-plane clipping), this instrument steps outside the camera frustum and renders dual-panel orthographic blueprints with a continuous **velocity-colored flight ribbon** and camera viewing cones.

```
┌────────────────────────────────────────────────────────────────────────┐
│               DUAL-PANEL ORTHOGRAPHIC BLUEPRINT LAYOUT                 │
├──────────────────────────────────┬─────────────────────────────────────┤
│ PANEL 1: TOP-DOWN VIEW (XZ)      │ PANEL 2: SIDE ELEVATION VIEW (YZ)   │
│ • Horizontal flight path         │ • Altitude & vertical arcs          │
│ • Frustum viewing cones & gaze   │ • Pitch angle & elevation dips      │
│ • Hero subject & stage bounds    │ • Floor / ceiling near clearances   │
│ • Velocity color gradient ribbon │ • Velocity color gradient ribbon    │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Visual Artifacts Produced

### A. Dual-Panel Architectural Blueprint (`cam_godview.png`)
Renders a 1920x1080 diagnostic contact sheet with two side-by-side orthographic projections:
1. **Left Panel: Top-Down Plan View ($XZ$ Plane)**:
   - Evaluates camera transit across horizontal space.
   - Plots the bounding footprints of registered hero objects, UI planes, and stage boundaries.
   - Renders camera frustum pyramids at regular sample intervals with a center line of sight (gaze vector) pointing toward the focal point.
2. **Right Panel: Elevation Side View ($YZ$ Plane)**:
   - Evaluates camera altitude, elevation curves, and vertical swoop trajectories.
   - Reveals whether the camera dips dangerously close to the floor plane or geometry base.
3. **Continuous Velocity Gradient Ribbon**:
   - The flight trajectory is rendered as a continuous ribbon whose color dynamically maps to camera speed:
     * **Deep Indigo / Blue (`#1E293B` to `#3B82F6`)**: Stationary dwell to slow transit ($0\text{–}4\,\text{m/s}$).
     * **Bone / Muted Gray (`#CBD5E1`)**: Controlled cruise ($4\text{–}15\,\text{m/s}$).
     * **Signal Orange (`#F97316`)**: High-speed acceleration or cinematic push-in ($15\text{–}30\,\text{m/s}$).
     * **Saturated Vermilion (`#EF4444`)**: Peak terminal velocity ($> 30\,\text{m/s}$).

### B. Kinematic Summary Telemetry (`godview_summary.json`)
Accompanying the image is machine-readable telemetry recording exact spatial kinematics:
```json
{
  "scene": "product_reveal",
  "from": 4.0,
  "to": 12.0,
  "duration": 8.0,
  "sample_count": 32,
  "max_speed_mps": 24.6,
  "avg_speed_mps": 11.2,
  "min_near_distance_m": 0.32,
  "samples": [
    {
      "timestamp": 4.0,
      "position": [0.0, 1.2, -5.0],
      "look_at": [0.0, 1.0, 0.0],
      "speed_mps": 0.0,
      "accel_mps2": 8.4,
      "nearest_object_dist_m": 1.45
    }
  ]
}
```

---

## 3. How Autonomous Agents & Creators Use This Tool

### Diagnostic Workflow
1. **Detecting Near-Clip Violations (`min_near_distance < 0.15m`)**:
   - When an object clips or disappears through the front lens, the agent checks `cam_godview.png`. If a frustum pyramid intersects the bounding box of a 3D model, the camera has penetrated the geometry or near-clip plane.
   - *Remediation*: Retract flight spline control points outward along the gaze normal, or increase the camera focal length.
2. **Diagnosing Tangent Kinks & Jerky Orbits**:
   - In circular product turntables or curved fly-bys, erratic velocity shifts appear as abrupt color stripes on the ribbon (e.g. blue snapping instantly to vermilion).
   - *Remediation*: Match spline tangent handles across keyframe waypoints or switch to `CameraRig.orbit()` with Rotation Minimizing Frames.
3. **Distinguishing Intentional Snaps from Glitches**:
   - Professional motion graphics often use rapid snaps on audio transients or UI triggers. By cross-referencing `godview_summary.json` with timeline trigger timestamps, intentional accents are validated without false alarms.

---

## 4. CLI Parameters & Execution

```bash
# Inspect a specific scene from the timeline
bun scripts/render.ts godview --scene product_reveal --out ../out/visual/godview

# Specify an exact time window and sample density
bun scripts/godview.ts --from 4.0 --to 12.0 --samples 32 --out ../out/visual/godview

# Quick audit of a camera fly-through
bun scripts/render.ts godview --from 0.0 --to 18.5 --samples 40
```

### Supported CLI Flags
* `--scene <id>`: Automatically sets `--from` and `--to` to the start and end of the designated timeline scene.
* `--from <seconds>`: Start timestamp for the inspection window.
* `--to <seconds>`: End timestamp for the inspection window.
* `--samples <N>`: Number of frustum pyramids and trajectory nodes to sample (default: `24`).
* `--out <dir>`: Target directory for `cam_godview.png` and `godview_summary.json` (default: `../out/visual/godview`).
