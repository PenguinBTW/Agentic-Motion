# Visual Diagnostic Tools Architecture & User Guide

A modular suite of four high-leverage visual instruments designed to give autonomous AI agents and human art directors direct **spatial, temporal, and aesthetic sight** into procedural 60 fps WebGL/Canvas2D motion design across **any domain**—commercial product reveals, UI/UX interaction showcases, kinetic typography manifestos, procedural data visualizations, brand identity resolves, and audiovisual productions.

---

## 1. Core Purpose & Philosophy: Sight Over Numbers

When synthesizing procedural 3D motion graphics, automated tools often rely on scalar metrics ($jerk$, optical flow, $\Delta E$, luma). While useful for profiling, scalar numbers fail to answer the essential questions of motion craft:
- *"Does this camera trajectory arc smoothly into the product hero shot, or does it hitch on an unblended spline tangent?"*
- *"Why did that 3D UI card suddenly disappear? Did it penetrate the camera near-clip plane, occlude behind a backplane, or get clipped by the viewport frustum?"*
- *"Is our stroke weight and bloom too aggressive compared to the client's design tokens and brand guidelines?"*
- *"Does the visual focal point stay anchored across this scene cut, or does the viewer's eye get violently thrown across the screen?"*

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE OBSERVABILITY PRINCIPLE                           │
│                                                                             │
│   SCALAR METRICS ALONE                   VISUAL INSTRUMENTATION             │
│   ┌───────────────────────────┐          ┌───────────────────────────┐      │
│   │ jerk = 142.8 m/s³         │          │ [ 3D God-View Blueprint ] │      │
│   │ optical_flow = 18.2 px/s  │  ──────► │ [ Motion Onion Trail    ] │      │
│   │ edge_density = 0.041      │          │ [ Split-Wipe A/B Anchor ] │      │
│   │ delta_e = 8.4             │          │ [ Seam Stitch Overlay   ] │      │
│   └───────────────────────────┘          └───────────────────────────┘      │
│   Blind to spatial geometry,             Provides instantaneous spatial,    │
│   easing rhythm, & aesthetic             temporal, and physical context in  │
│   intent. Fails on intentional           a single, model-inspectable image. │
│   snaps and spring dynamics.                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Four Pillars of Instrument Design
1. **Perceptual Diagnosis**: Each tool collapses complex multi-frame, spatial, or multi-scene state into an **interpretable diagnostic image** (`.png`) that an AI vision model or human director can evaluate in a single glance.
2. **Strict Modularity**: All four tools live in isolated modules under `app/scripts/visual/`. The master `render.ts` script only imports them dynamically when invoked, keeping the core engine harness completely lean.
3. **Zero Native C++ Dependencies**: Built entirely on Bun, TypeScript, Playwright canvas readbacks, and HTML5 Canvas2D/WebGL blending modes. No native graphics compilation required.
4. **Sub-6-Second Turnaround**: Each tool executes headless in 2–6 seconds, enabling rapid closed-loop iteration during autonomous agent coding cycles.

---

## 2. Tool 1: Multi-Exposure Motion Onion (`onion`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/onion.ts` or `bun scripts/render.ts onion`
* **Implementation**: [`app/scripts/visual/onion.ts`](../app/scripts/visual/onion.ts)
* **Core Artifacts**: `onion_motion.png`, `onion_summary.json`

The **Multi-Exposure Motion Onion** collapses an animation window ($0.5\text{–}1.5\,\text{s}$) into a **single composite diagnostic still**. It blends 8–16 consecutive frames using a **chromatic time-decay gradient**:
* **Past Frames ($t < t_{\text{mid}}$)**: Tinted in cool cyan/blue (`#00D2FF`) with ascending opacity ($15\% \to 60\%$).
* **Key Center Frame ($t = t_{\text{mid}}$)**: Rendered in **full natural contrast and color** ($100\%$ opacity).
* **Future Frames ($t > t_{\text{mid}}$)**: Tinted in warm amber/signal orange (`#FF7A00`) with descending opacity ($60\% \to 15\%$).

```
TEMPORAL ONION-SKIN SCHEMATIC (Single Composite Diagnostic Image)

[Past: t - 0.20s]     [t - 0.10s]     [Center: t = 0]      [t + 0.10s]     [Future: t + 0.20s]
   Faint Cyan          Cool Blue         Natural Color        Warm Amber       Saturated Orange
       ○                   ○                  ●                   ○                   ○
        \                   \                 │                  /                   /
    ┌──────────┐        ┌──────────┐    ┌──────────┐     ┌──────────┐        ┌──────────┐
    │ HERO OBJ │        │ HERO OBJ │    │ HERO OBJ │     │ HERO OBJ │        │ HERO OBJ │
    └──────────┘        └──────────┘    └──────────┘     └──────────┘        └──────────┘
       (15% α)             (45% α)         (100% α)         (45% α)             (15% α)

<--- Monotonic Spacing (Even progression = smooth C1 deceleration or fluid spring motion)    --->
<--- Clumped Ghost Echoes Followed by Wide Gaps = Spline Hitch / Tangent Discontinuity        --->
```

### Universal Motion Design Applications
1. **UI/UX Micro-Interactions & Spring Dynamics**:
   - Inspecting sheet reveals, card swipes, modal expansions, and spring bouncers ($m, k, c$).
   - A properly damped spring reveals a characteristic decaying oscillation in amber echoes; an underdamped spring reveals excessive ringing; an overdamped spring shows sluggish clumped echoes.
2. **Kinetic Typography & Display Manifestos**:
   - Diagnosing title entrances, tracking expansions, and numerical counter rolls.
   - If a headline pops into existence without easing, there are zero cyan echoes; if it smoothly decelerates to a reading rest, the amber echoes compress proportionally.
3. **3D Product & Commercial Camera Moves**:
   - Inspecting camera orbits, fly-throughs, and crane dives.
   - Smooth continuous splines produce evenly spaced ghost silhouettes of the product. High-frequency micro-tremors immediately show up as fuzzy, jagged double-edges.
4. **Vector Logo & Brand Icon Morphs**:
   - Tracing shape transitions and path morphing between geometric icons.
   - Instantly exposes whether control points interpolate along natural arcs or deform unnaturally.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t` | float (s) | `10.0` | Center timestamp for symmetric temporal inspection window. |
| `--window` | float (s) | `0.5` | Total duration of time window to collapse (s). |
| `--from` | float (s) | `t - window/2` | Explicit start timestamp (overrides `--window`). |
| `--to` | float (s) | `t + window/2` | Explicit end timestamp (overrides `--window`). |
| `--frames` | integer | `10` | Number of exposure slices to composite (range: 4–20). |
| `--scene` | string | `all` | Specific scene or plate ID to load. |
| `--out` | file path | `../out/visual/onion` | Target output directory for PNG and JSON telemetry. |

### Example Invocations
```bash
# Audit UI card spring-damper deceleration across a 0.5s window
bun scripts/onion.ts --scene modal_reveal --t 2.40 --frames 12 --out ../out/visual/modal_spring

# Trace a 1.0s hero 3D camera crane move in a commercial product reveal
bun scripts/render.ts onion --scene hero_product --from 14.00 --to 15.00 --frames 16 --out ../out/visual/product_crane

# Inspect kinetic title deceleration in a brand manifesto sequence
bun scripts/onion.ts --scene title_intro --t 0.85 --window 0.6 --frames 10 --out ../out/visual/title_ease
```

---

## 3. Tool 2: 3D God-View Camera Blueprint (`godview`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/godview.ts` or `bun scripts/render.ts godview`
* **Implementation**: [`app/scripts/visual/godview.ts`](../app/scripts/visual/godview.ts)
* **Core Artifacts**: `cam_godview.png`, `godview_summary.json`

The **3D God-View Camera Blueprint** generates an **external orthographic architectural schematic** of the scene rendered from outside the active cinema lens. It provides two simultaneous technical projections:
* **Panel 1: Top-Down Blueprint ($XZ$ Plane)**: Shows the world ground grid ($5\text{m}$ metric intervals), physical scene geometry, obstacle boundaries, hero subject anchor, the continuous camera flight ribbon colored by physical velocity, and viewing frustum cones sampled every $0.5\text{s}$.
* **Panel 2: Side Elevation ($YZ$ Plane)**: Shows floor ($y = 0$), vertical ceiling/bounds, camera altitude profile $y(t)$, tilt/pitch angles, and near/far clipping thresholds.

```
TOP-DOWN ARCHITECTURAL BLUEPRINT (XZ PLANE)
 ◄ LEFT STAGE BOUNDARY (x = -4.0m)             RIGHT STAGE BOUNDARY (x = +4.0m) ►
┌──────────────────────────────────────────────────────────────────────────────┐
│  │                                                                        │  │
│  │                      [ 3D HERO PRODUCT / UI ANCHOR ]                   │  │
│  │                               (x=0, z=18.0m)                           │  │
│  │                               ┌─────────────┐                          │  │
│  │                               │  HERO MESH  │                          │  │
│  │                               └─────────────┘                          │  │
│  │                                      ▲                                 │  │
│  │                                     ╱ ╲   t = 12.0s                    │  │
│  │                                    ╱   ╲  Frustum Cone                 │  │
│  │                                   ─────── (Target Gaze Axis)           │  │
│  │                                      │                                 │  │
│  │                                      │  Camera Flight Ribbon           │  │
│  │                                      │  (Signal Orange = Speed 18 m/s) │  │
│  │                                     /                                  │  │
│  │                                    /  t = 10.0s (Smooth 30° Arc)       │  │
│  │                                   /                                    │  │
│  │                                  │  (Deep Blue = Speed 3 m/s)          │  │
│  │                                  │                                     │  │
│  │                                  ●  t = 8.0s (Orchestrated Rest)       │  │
│  │                                                                        │  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Universal Motion Design Applications
1. **Commercial Product Reveals & Turntables**:
   - Orchestrating multi-axis camera orbits around watches, smartphones, automotive chassis, or architectural models.
   - God-View exposes the exact orbit radius, preventing the camera from clipping into geometry or swinging too far from the focal subject.
2. **Isometric & Layered UI Presentations**:
   - Inspecting 3D exploded views of UI application layers (cards floating on $Z$-planes).
   - Verifies that camera flight paths do not penetrate intermediate UI floating planes or induce extreme perspective distortion.
3. **Architectural & Spatial Fly-Throughs**:
   - Navigating through rooms, corridors, or abstract geometric stages.
   - Highlights spatial clearances, wall proximity ($< 0.2\text{m}$ alerts), and frustum near-plane breaches before objects awkwardly pop into view.
4. **Data Visualization Stages**:
   - Sweeping across 3D bar graphs, geographic terrain maps, or network graph clusters.
   - Confirms that the camera flight remains smooth and oriented toward active data clusters.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--from` | float (s) | timeline start | Start of the camera path in timeline seconds. |
| `--to` | float (s) | timeline end | End of the camera path in timeline seconds. |
| `--samples` | integer | `24` | Number of discrete camera positions and frustum cones to sample. |
| `--scene` | string | `all` | Target scene or plate ID to inspect. |
| `--out` | file path | `../out/visual/godview` | Output directory for blueprint image and telemetry JSON. |

### Example Invocations
```bash
# Inspect a 3D product turntable camera orbit (4.0s to 12.0s)
bun scripts/godview.ts --scene product_turntable --from 4.0 --to 12.0 --samples 32 --out ../out/visual/product_orbit

# Audit an architectural camera fly-through across an entire sequence
bun scripts/render.ts godview --scene building_walk --from 0.0 --to 20.0 --samples 40 --out ../out/visual/arch_flythrough

# Verify camera clearances in an exploded 3D UI scene
bun scripts/godview.ts --scene ui_explode --from 2.5 --to 8.0 --samples 20 --out ../out/visual/ui_clearances
```

---

## 4. Tool 3: Visual A/B Reference Anchor (`compare`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/compare.ts` or `bun scripts/render.ts compare`
* **Implementation**: [`app/scripts/visual/compare.ts`](../app/scripts/visual/compare.ts)
* **Core Artifacts**: `ab_side_by_side.png`, `ab_split_wipe.png`, `ab_comparison.json`

The **Visual A/B Reference Anchor** pairs a frame from the active scene directly against an authoritative reference plate—such as a Figma mockup, client brand guideline benchmark, or reference production plate—at matching 1080p resolution.

If the reference server is not running, `compare.ts` automatically spawns a private ephemeral Vite instance on port `5189`, captures the exact reference plate at `--ref-t`, and generates two composite artifacts:
1. **Side-by-Side Plate (`ab_side_by_side.png`)**: Two 16:9 panels placed side-by-side with cyan (`[ACTIVE SCENE]`) and signal orange (`[REFERENCE BENCHMARK]`) borders and parameter annotations.
2. **50/50 Diagonal Split Wipe (`ab_split_wipe.png`)**: A $45^\circ$ diagonal hairline cut across the frame. Top-left is the active scene; bottom-right is the reference benchmark.

```
DIAGONAL 50/50 SPLIT WIPE SCHEMATIC (ab_split_wipe.png)
┌─────────────────────────────────────────────────────────────┐
│ ▲ ACTIVE SCENE (Top-Left)               \                   │
│   Title Height: 68px                     \                  │
│   Stroke Weight: 2.5px                    \                 │
│   Negative Space: 42%                      \  45° Hairline  │
│                                             \   Split Cut   │
│                                              \              │
│                                               \             │
│                 ▼ REFERENCE BENCHMARK          \            │
│                   Title Height: 36px            \           │
│                   Stroke Weight: 1.0px           \          │
│                   Negative Space: 72%             \         │
└─────────────────────────────────────────────────────────────┘
```

### Universal Motion Design Applications
1. **Brand Identity & Design System Calibration**:
   - Verifying that rendered typography cap heights, letter spacing, and line weights strictly match design token specifications.
   - Highlights accidental font scaling, blown-out glows, or bloated stroke thicknesses.
2. **Figma / Concept Art Parity Audits**:
   - Benchmarking active procedural WebGL scenes against exported high-fidelity Figma keyframe artboards.
   - Instantly exposes composition drifting, improper vertical alignment, or incorrect color grading.
3. **Commercial Aesthetic Restraint Verification**:
   - Ensures procedural motion retains premium negative space (e.g. $60\%\text{–}75\%$ breathing room) rather than over-filling the viewport with cluttered decorative lines.
4. **Color Palette & Exposure Alignment**:
   - The diagonal split wipe directly juxtaposes background tones and lighting across the $45^\circ$ boundary. Any disparity in black point, white point, or saturation stands out clearly.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene` | string | active | Active scene or plate name in the current project. |
| `--t` | float (s) | `10.0` | Timestamp in current scene. |
| `--ref` | string | benchmark | Reference scene plate or benchmark asset name. |
| `--ref-t` | float (s) | matching | Matching timestamp in reference benchmark. |
| `--port` | integer | `5189` | Port for ephemeral reference server instance. |
| `--out` | file path | `../out/visual/compare` | Output directory for contact plates. |

### Example Invocations
```bash
# Compare active UI showcase frame against design benchmark
bun scripts/compare.ts --scene dashboard_hud --t 5.20 --ref figma_keyframe --ref-t 5.20 --out ../out/visual/hud_vs_figma

# Benchmark active 3D commercial typography against master design tokens
bun scripts/render.ts compare --scene brand_reveal --t 3.50 --ref style_guide --ref-t 1.00 --out ../out/visual/brand_alignment

# Compare lighting and negative space against approved reference scene
bun scripts/compare.ts --scene feature_callout --t 12.0 --ref master_template --ref-t 12.0
```

---

## 5. Tool 4: Transition Seam Stitch Inspector (`stitch`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/stitch.ts` or `bun scripts/render.ts stitch`
* **Implementation**: [`app/scripts/visual/stitch.ts`](../app/scripts/visual/stitch.ts)
* **Core Artifacts**: `onion_seam.png`, `strip_seam.png`, `stitch_summary.json`

The **Transition Seam Stitch Inspector** audits the exact boundary where one scene cuts, wipes, or morphs into the next ($\pm 250\,\text{ms}$). It produces two diagnostic images:
1. **Split-Wipe Onion Overlay (`onion_seam.png`)**: Composites exit frame $N-1$ in translucent green (`#00FF66`, $\alpha = 0.5$) directly over entry frame $N$ in translucent magenta (`#FF00AA`, $\alpha = 0.5$).
   * Wherever carrier geometry lines up across the cut, green + magenta light combine into **neutral white/gray**.
   * Any spatial jump, scale mismatch, or horizon tilt immediately creates **bright green or magenta fringing**.
2. **10-Frame Seam Filmstrip (`strip_seam.png`)**: A horizontal contact strip displaying the 5 frames preceding the cut ($N-5 \to N-1$) and the 5 frames following the cut ($N \to N+4$), divided by a bright red vertical cut marker.

```
SEAM ONION OVERLAY CONCEPT (FRAME N-1 vs FRAME N)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         /─────────────────────────────\                     │
│        │   [ NEUTRAL WHITE CORE ]      │                    │
│        │   Carrier aligns perfectly    │                    │
│        │                               │                    │
│        \───[ Green Fringe: 6px jump ]──/                    │
│                                                             │
│  [Green = Outgoing Scene | Magenta = Incoming Scene]        │
└─────────────────────────────────────────────────────────────┘
```

### Universal Motion Design Applications
1. **Commercial Match-Cuts & Graphic Transitions**:
   - Auditing match-cuts where a geometric shape, product silhouette, or hero title carries over from Scene A into Scene B.
   - Instantly exposes whether the focal carrier shifted by $10\,\text{px}$ or scaled improperly across the boundary.
2. **UI State Handoffs & Modal Push/Pop**:
   - Inspecting seamless transitions where a UI card expands into a full-screen view.
   - Highlights anchor misalignment, sudden scale pops, or dropped frames during the handoff.
3. **Camera Trajectory Vector Continuity**:
   - The 10-frame filmstrip reveals whether camera velocity carries smoothly through the transition or freezes dead on frame $N-1$ before jumping on frame $N$.
4. **Blackout / Whiteout Dropout Detection**:
   - Catches unintentional 1-frame blank blackouts or canvas buffer clearing glitches occurring immediately prior to scene initialization.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t` | float (s) | auto | Cut timestamp in timeline seconds (auto-detected if omitted). |
| `--from-scene` | string | auto | Outgoing scene or plate ID. |
| `--to-scene` | string | auto | Incoming scene or plate ID. |
| `--window` | float (s) | `0.25` | Inspection window radius in seconds ($\pm 15$ frames at 60 fps). |
| `--out` | file path | `../out/visual/stitch` | Output directory for onion overlay and filmstrip. |

### Example Invocations
```bash
# Audit the match-cut between product macro shot and wide showcase at t = 6.40s
bun scripts/stitch.ts --from-scene macro_shot --to-scene wide_reveal --t 6.40 --out ../out/visual/macro_to_wide

# Audit a UI card-to-fullscreen modal expansion seam
bun scripts/render.ts stitch --from-scene feed_card --to-scene modal_detail --t 3.25

# Inspect transition seam between two commercial chapters
bun scripts/stitch.ts --from-scene chapter_1 --to-scene chapter_2 --t 15.00
```

---

## 6. Architecture & Modularity Matrix

All four instruments share a clean, zero-bloat architecture:

```
Agentic motion design toolset/
├── scripts/                          # Lightweight CLI forwarders (~13 lines each)
│   ├── render.ts                     # Master CLI dispatcher
│   ├── onion.ts                      # Direct CLI -> app/scripts/render.ts onion
│   ├── godview.ts                    # Direct CLI -> app/scripts/render.ts godview
│   ├── compare.ts                    # Direct CLI -> app/scripts/render.ts compare
│   └── stitch.ts                     # Direct CLI -> app/scripts/render.ts stitch
│
└── app/scripts/
    ├── render.ts                     # Dynamic import dispatcher (zero boot bloat)
    └── visual/                       # Self-contained tool logic
        ├── onion.ts                  # Multi-exposure chromatic blending
        ├── godview.ts                # Orthographic blueprint & frustum rendering
        ├── compare.ts                # Dual-session reference comparator
        └── stitch.ts                 # Seam onion overlay & filmstrip generator
```

### Dynamic Import Dispatcher (`app/scripts/render.ts`)
The main renderer does not evaluate or import visual tool modules unless their specific command is invoked:
```typescript
} else if (mode === 'onion') {
  const { runOnion } = await import('./visual/onion');
  await runOnion(page, process.argv.slice(3));
} else if (mode === 'stitch') {
  const { runStitch } = await import('./visual/stitch');
  await runStitch(page, process.argv.slice(3));
} else if (mode === 'compare') {
  const { runCompare } = await import('./visual/compare');
  await runCompare(page, process.argv.slice(3));
} else if (mode === 'godview') {
  const { runGodView } = await import('./visual/godview');
  await runGodView(page, process.argv.slice(3));
}
```

---

## 7. Recommended Agent Workflow Decision Tree

When building, debugging, or reviewing procedural motion design scenes, autonomous agents should follow this diagnostic sequence:

```
                                  [ AGENT TASK ]
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
    [ 3D Scene / Spatial Layout ] [ Easing, Springs & Motion ] [ Scene Cuts & Handoffs ]
              │                          │                          │
              ▼                          ▼                          ▼
       bun scripts/godview.ts      bun scripts/onion.ts       bun scripts/stitch.ts
       • Inspect 3D clearances    • Check ghost spacing      • Check carrier alignment
       • Verify frustum cone      • Spot spline hitches      • Spot horizon tilt jumps
       • Audit flight ribbon      • Verify spring damping    • Catch blank frame drops
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         │
                                         ▼
                            [ Aesthetic Calibration ]
                                         │
                                         ▼
                              bun scripts/compare.ts
                              • Compare typography height & weight
                              • Verify negative space (60-75%)
                              • Check line density against design tokens
                                         │
                                         ▼
                            [ Final Verification Audit ]
                                         │
                                         ▼
                              bun scripts/render.ts motion
                              • Verify 0 blocking flags in findings.json
                              • Verify dwell times, safe margins & palette
```
