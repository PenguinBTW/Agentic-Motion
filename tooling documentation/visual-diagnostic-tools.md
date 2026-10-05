# Visual Diagnostic Tools Architecture & User Guide

A modular suite of four high-leverage visual instruments designed to give autonomous AI agents and human reviewers direct **spatial, temporal, and aesthetic sight** into procedural 60 fps WebGL/Canvas2D motion design.

---

## 1. Core Purpose & Philosophy: Sight Over Numbers

When building procedural 3D motion graphics, automated tools often rely on scalar metrics ($jerk$, optical flow, $\Delta E$, luma). While useful for profiling, scalar numbers fail to answer the core questions of motion craft:
- *"Does the camera flight feel fluid, or does it hitch on a piecewise spline boundary?"*
- *"Why did that 3D text disappear? Did it clip out of the frustum or pass behind a wall?"*
- *"Is our line weight too heavy and aggressive compared to the reference standard?"*
- *"Does the visual handoff across this scene cut jump awkwardly?"*

### The Observability Principle
These four instruments follow the **Instrumentation Over Grading** philosophy:
1. **Perceptual Diagnosis**: Each tool synthesizes complex temporal, spatial, or multi-scene state into an **interpretable diagnostic image** (`.png`) that an agent or director can evaluate in a single glance.
2. **Strict Modularity**: All four tools live in isolated modules under `app/scripts/visual/`. The master `render.ts` script only imports them dynamically when invoked, keeping the core engine harness lean.
3. **Zero Heavy Addon Dependencies**: Built entirely on Bun, TypeScript, Playwright canvas readbacks, and HTML5 Canvas2D/WebGL blending modes. No native C++ canvas bindings required.
4. **Sub-6-Second Turnaround**: Each tool executes headless in 2–6 seconds, allowing rapid visual feedback loops during agent development.

---

## 2. Tool 1: Multi-Exposure Motion Onion (`onion`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/onion.ts` or `bun scripts/render.ts onion`
* **Implementation**: [`app/scripts/visual/onion.ts`](../app/scripts/visual/onion.ts)
* **Core Artifacts**: `onion_motion.png`, `onion_summary.json`

The **Multi-Exposure Motion Onion** collapses a $0.5\text{–}1.5\,\text{s}$ animation window into a **single composite diagnostic still**. It blends 8–16 consecutive frames using a **chromatic time-decay gradient**:
* **Past Frames ($t < t_{\text{mid}}$)**: Tinted in cool cyan/blue (`#00D2FF`) with ascending opacity ($20\% \to 70\%$).
* **Key Center Frame ($t = t_{\text{mid}}$)**: Rendered in **full natural contrast and color** ($100\%$ opacity).
* **Future Frames ($t > t_{\text{mid}}$)**: Tinted in warm amber/signal orange (`#FF7A00`) with decaying opacity ($70\% \to 20\%$).

```
TEMPORAL ONION-SKIN SCHEMATIC (Single Composite Image)

[Past: t - 0.20s]     [t - 0.10s]     [Current: t = 0]     [t + 0.10s]     [Future: t + 0.20s]
   Faint Cyan          Cool Blue         Bright White         Warm Amber       Saturated Orange
       ○                   ○                  ●                   ○                   ○
        \                   \                 │                  /                   /
    ┌──────────┐        ┌──────────┐    ┌──────────┐     ┌──────────┐        ┌──────────┐
    │  "WORD"  │        │  "WORD"  │    │  "WORD"  │     │  "WORD"  │        │  "WORD"  │
    └──────────┘        └──────────┘    └──────────┘     └──────────┘        └──────────┘
       (20% α)             (50% α)         (100% α)         (50% α)             (20% α)

<--- Monotonic Spacing (Even gaps = continuous C1 flight)                                    --->
<--- Clumped Ghost Echoes Followed by Wide Gaps = Piecewise Jolt / Acceleration Break        --->
```

### What It Reveals
1. **Camera Tremors & Jitter**: A continuous $C^1$ cinema flight produces smooth, progressively spaced ghost echoes. High-frequency micro-tremors immediately show up as fuzzy, jagged double-edges.
2. **Piecewise Easing Discontinuities**: If a camera spline has a math error where acceleration drops abruptly to zero, the ghost echoes bunch up tightly in a clump and then suddenly leap across a wide gap.
3. **Typographic Entrance Pops**: If a lyric word pops into existence without easing, there are zero preceding cyan echoes; if it decelerates smoothly to a rest stop, the amber echoes compress proportionally.
4. **Centroid Vector Trail**: Connects the centroid of the hero typography across all sampled frames with node dots, graphing inter-frame pixel displacement $\Delta d$.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t` | float (s) | `10.0` | Center timestamp for symmetric temporal window. |
| `--window` | float (s) | `0.5` | Total duration of time window to collapse (s). |
| `--from` | float (s) | `t - window/2` | Explicit start timestamp (overrides `--window`). |
| `--to` | float (s) | `t + window/2` | Explicit end timestamp (overrides `--window`). |
| `--frames` | integer | `10` | Number of exposure slices to composite (range: 4–20). |
| `--scene` | string | `all` | Specific scene or plate ID to load. |
| `--out` | file path | `../out/visual/onion` | Target output directory for PNG and JSON. |

### Example Invocations
```bash
# Inspect camera easing across a 0.5s phrase in boundary scene
bun scripts/onion.ts --scene boundary --t 26.50 --frames 12 --out ../out/visual/boundary_ease

# Trace a 1.0s hero word trajectory in hook scene
bun scripts/render.ts onion --scene hook1 --from 34.00 --to 35.00 --frames 16 --out ../out/visual/hook_dive
```

---

## 3. Tool 2: 3D God-View Camera Blueprint (`godview`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/godview.ts` or `bun scripts/render.ts godview`
* **Implementation**: [`app/scripts/visual/godview.ts`](../app/scripts/visual/godview.ts)
* **Core Artifacts**: `cam_godview.png`, `godview_summary.json`

The **3D God-View Camera Blueprint** generates an **external orthographic architectural schematic** of the scene rendered from outside the cinema lens. It presents two simultaneous technical projections:
* **Panel 1: Top-Down Blueprint ($XZ$ Plane)**: Shows the world ground grid ($5\text{m}$ metric intervals), physical corridor walls ($\pm 1.8\text{m}$), door notches ($2.2\text{m}$ spacing), the continuous camera flight ribbon colored by velocity, and camera viewing frustum cones every $0.5\text{s}$.
* **Panel 2: Side Elevation ($YZ$ Plane)**: Shows floor ($y = 0$) and ceiling/lintel ($y = 2.2\text{m}$) bounds, camera altitude profile $y(t)$, and pitch angles.

```
TOP-DOWN ARCHITECTURAL BLUEPRINT (XZ PLANE)
 ◄ LEFT WALL (x = -1.8m)                    RIGHT WALL (x = +1.8m) ►
┌──────────────────────────────────────────────────────────────────┐
│  │                                                            │  │
│  ├──[Door Notch]                                [Door Notch]──┤  │
│  │                                                            │  │
│  │                        ▲  t = 12.0s                        │  │
│  │                       ╱ ╲   Frustum Cone                   │  │
│  │                      ╱   ╲  (Viewing axis & FOV)           │  │
│  │                     ───────                                │  │
│  │                        │                                   │  │
│  │                        │  Camera Flight Ribbon             │  │
│  │                        │  (Signal Orange = Speed 22 m/s)   │  │
│  │                         \                                  │  │
│  │                          \  t = 10.0s (Smooth 15° Arc)     │  │
│  │                           \                                │  │
│  │                            │  (Deep Blue = Speed 4 m/s)    │  │
│  │                            │                               │  │
│  ├──[Door Notch]              ●  t = 8.0s       [Door Notch]──┤  │
│  │                                                            │  │
└──────────────────────────────────────────────────────────────────┘
```

### What It Reveals
1. **Frustum & Geometry Clipping**: When looking through the first-person camera, if an object pops out of nowhere, you cannot tell where it came from. The God-View shows you immediately: *"The camera is orbiting $12\,\text{cm}$ from the left corridor wall,"* or *"The text was spawned behind the near clip plane."*
2. **Flight Path Spline Health**: You see the physical flight path through world space. Sudden sharp 90-degree kinks, unwanted reversals along $Z$, or collision courses stand out clearly.
3. **Altitude & Ground Proximity**: Panel 2 reveals whether camera dives dip dangerously into the floor or breach the ceiling.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--from` | float (s) | timeline start | Start of the camera path in song seconds. |
| `--to` | float (s) | timeline end | End of the camera path in song seconds. |
| `--samples` | integer | `24` | Number of discrete camera positions and frustum cones to sample. |
| `--scene` | string | `all` | Target scene or plate ID to inspect. |
| `--out` | file path | `../out/visual/godview` | Output directory for blueprint image and JSON. |

### Example Invocations
```bash
# Render the entire doors corridor flight path (8.0 to 18.5s)
bun scripts/godview.ts --from 8.0 --to 18.5 --samples 24 --out ../out/visual/doors_godview

# Inspect the 3D canyon flight in boundary scene
bun scripts/render.ts godview --scene boundary --from 25.6 --to 34.0 --samples 30
```

---

## 4. Tool 3: Visual A/B Reference Anchor (`compare`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/compare.ts` or `bun scripts/render.ts compare`
* **Implementation**: [`app/scripts/visual/compare.ts`](../app/scripts/visual/compare.ts)
* **Core Artifacts**: `ab_side_by_side.png`, `ab_split_wipe.png`, `ab_comparison.json`

The **Visual A/B Reference Anchor** pairs a frame from the active scene directly against the corresponding benchmark plate from `Example project` at matching 1080p resolution.

If the Example project dev server is not running, `compare.ts` automatically spawns a private ephemeral Vite instance on port `5189`, captures the exact reference plate at `--ref-t`, and generates two composite artifacts:
1. **Side-by-Side Plate (`ab_side_by_side.png`)**: Two 16:9 panels placed side-by-side with cyan (`[ACTIVE]`) and signal orange (`[EXAMPLE BENCHMARK]`) borders and timestamp labels.
2. **50/50 Diagonal Split Wipe (`ab_split_wipe.png`)**: A $45^\circ$ diagonal hairline cut across the frame. Top-left is the active project; bottom-right is the Example project benchmark.

```
DIAGONAL 50/50 SPLIT WIPE SCHEMATIC (ab_split_wipe.png)
┌─────────────────────────────────────────────────────────────┐
│ ▲ ACTIVE: boundary.ts (t = 27.5s)       \                   │
│                                          \                  │
│   Word: "BOUNDARY"                        \                 │
│   Line width: 2.8px                        \                │
│                                             \  45° Hairline │
│                                              \   Split Line │
│                                               \             │
│                                                \            │
│                 ▼ EXAMPLE REF: loss.ts (t = 14.2s)          │
│                   Word: "LOSS"                              │
│                   Line width: 1.0px                         │
│                   Negative space: 72%                       │
└─────────────────────────────────────────────────────────────┘
```

### What It Reveals
1. **Typographic Scale Discrepancies**: Immediately shows whether your active scene's font is twice the size of the reference standard.
2. **Line Weight & Contrast**: Reveals whether your 3D wireframes are delicate 1px semi-transparent lines or thick, over-bloomed glowing chalk.
3. **Negative Space Discipline**: Visually exposes whether the composition is crowded against the borders or maintains the spacious negative field of the Example project.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene` | string | `boundary` | Active scene name in the current project. |
| `--t` | float (s) | `27.50` | Timestamp in current scene. |
| `--ref` | string | `loss` | Reference scene plate in `Example project/app`. |
| `--ref-t` | float (s) | `14.20` | Matching timestamp in reference project. |
| `--port` | integer | `5189` | Port for ephemeral reference Vite instance. |
| `--out` | file path | `../out/visual/compare` | Output directory for contact plates. |

### Example Invocations
```bash
# Compare boundary typography against Example loss scene
bun scripts/compare.ts --scene boundary --t 27.5 --ref loss --ref-t 14.2 --out ../out/visual/boundary_vs_loss

# Compare hook drop against Example hook drop
bun scripts/render.ts compare --scene hook1 --t 34.5 --ref hook --ref-t 22.5 --out ../out/visual/hook_vs_benchmark
```

---

## 5. Tool 4: Transition Seam Stitch Inspector (`stitch`)

### Overview & Visual Output
* **CLI Entrypoints**: `bun scripts/stitch.ts` or `bun scripts/render.ts stitch`
* **Implementation**: [`app/scripts/visual/stitch.ts`](../app/scripts/visual/stitch.ts)
* **Core Artifacts**: `onion_seam.png`, `strip_seam.png`, `stitch_summary.json`

The **Transition Seam Stitch Inspector** audits the exact boundary where one scene cuts into the next ($\pm 250\,\text{ms}$). It produces two diagnostic images:
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

### What It Reveals
1. **Carrier Teleportation**: If a doorway or portal carrier ends at screen center in Scene A, but the incoming scene spawns it $60\,\text{px}$ to the left, the green and magenta fringes jump out immediately.
2. **Horizon & Angle Shifts**: Catches accidental camera roll or vanishing point dislocations across match cuts.
3. **Dropout Frames**: Instantly flags if a scene accidentally fades to black or collapses its line buffers a few frames before the official cut timestamp.

### CLI Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t` | float (s) | auto | Cut timestamp in song seconds (auto-detected from timeline if omitted). |
| `--from-scene` | string | auto | Outgoing scene name. |
| `--to-scene` | string | auto | Incoming scene name. |
| `--window` | float (s) | `0.25` | Inspection window radius in seconds ($\pm 15$ frames at 60fps). |
| `--out` | file path | `../out/visual/stitch` | Output directory for onion overlay and filmstrip. |

### Example Invocations
```bash
# Audit the handoff cut between doors and boundary at t = 25.60s
bun scripts/stitch.ts --t 25.60 --out ../out/visual/doors_to_boundary

# Audit the boundary to hook drop cut
bun scripts/render.ts stitch --from-scene boundary --to-scene hook1 --t 34.00
```

---

## 6. Architecture & Modularity Matrix

All four instruments share a clean, zero-bloat architecture:

```
Agentic motion design toolset/
├── scripts/                          # Lightweight forwarders (~13 lines each)
│   ├── render.ts                     # Master CLI dispatcher
│   ├── onion.ts                      # Direct CLI -> app/scripts/render.ts onion
│   ├── godview.ts                    # Direct CLI -> app/scripts/render.ts godview
│   ├── compare.ts                    # Direct CLI -> app/scripts/render.ts compare
│   └── stitch.ts                     # Direct CLI -> app/scripts/render.ts stitch
│
└── app/scripts/
    ├── render.ts                     # Dynamic import dispatcher (12 lines added)
    └── visual/                       # Self-contained tool logic
        ├── onion.ts                  # Multi-exposure chromatic blending
        ├── godview.ts                # Orthographic blueprint & frustum rendering
        ├── compare.ts                # Dual-session reference comparator
        └── stitch.ts                 # Seam onion overlay & filmstrip generator
```

### Dynamic Import Dispatcher (`app/scripts/render.ts`)
The main renderer does not load or evaluate any visual tool module unless the subcommand is explicitly invoked:
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

When building, debugging, or reviewing procedural scenes, autonomous agents should follow this diagnostic sequence:

```
                                  [ AGENT TASK ]
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   [ New 3D Scene / Layout ]    [ Tuning Motion & Easing ]  [ Reviewing Scene Cut ]
             │                          │                          │
             ▼                          ▼                          ▼
      bun scripts/godview.ts      bun scripts/onion.ts       bun scripts/stitch.ts
      • Check 3D clearances       • Check ghost spacing      • Check carrier alignment
      • Verify frustum cone       • Spot piecewise jerks     • Spot horizon tilt jumps
      • Inspect flight ribbon     • Verify ease-in/out       • Confirm zero blackouts
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
                                        ▼
                           [ Aesthetic Calibration ]
                                        │
                                        ▼
                             bun scripts/compare.ts
                             • Compare font height & weight
                             • Verify negative space (60-75%)
                             • Check line density against Example
                                        │
                                        ▼
                           [ Final Verification Audit ]
                                        │
                                        ▼
                             bun scripts/render.ts motion
                             • Verify 0 blocking flags in findings.json
                             • Verify lyric sync & luma within range
```
