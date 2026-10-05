# Diagnostic Instrument 04: Transition Seam Stitch Inspector (`stitch`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/stitch.ts`](../app/scripts/visual/stitch.ts)  
**CLI Command**: `bun scripts/render.ts stitch` or `bun scripts/visual/stitch.ts`  
**Core Artifacts**: `onion_seam.png`, `strip_seam.png`, `stitch_summary.json`  

---

## 1. Overview & Capability

The **Transition Seam Stitch Inspector** is a boundary verification diagnostic tool that audits the **exact handoff cut between two adjacent scenes or motion states** ($\pm 250\,\text{ms}$).

In procedural motion graphics, transitions are high-risk failure points: focal elements can teleport across screen space, 3D horizons can tilt unexpectedly, or buffers can drop out to black 1 frame early. This instrument captures frames directly before and after the cut and renders a **false-color split-wipe onion overlay** and a **10-frame contact filmstrip** to verify seamless continuity.

---

## 2. Visual Artifacts Produced

### A. False-Color Seam Onion Overlay (`onion_seam.png`)
Composites the final frame of the outgoing scene ($N-1$, at $t - 1/60\,\text{s}$) directly over the first frame of the incoming scene ($N$, at $t$):
* **Outgoing Scene (Frame $N-1$)**: Tinted in translucent green (`#00FF66`, $\alpha = 0.5$).
* **Incoming Scene (Frame $N$)**: Tinted in translucent magenta (`#FF00AA`, $\alpha = 0.5$).
* **Perceptual Alignment Principle**:
  * Where carrier geometry aligns cleanly across the cut, green + magenta combine into **neutral white / gray**.
  * Any spatial offset, scale shift, or camera tilt creates **bright green or magenta color fringing**.

```
SEAM ONION OVERLAY SCHEMATIC (FRAME N-1 vs FRAME N)
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

### B. 10-Frame Seam Contact Strip (`strip_seam.png`)
A horizontal filmstrip capturing 10 consecutive frames at 60 fps centered on the cut:
* **Frames 1–5**: The 5 frames immediately preceding the cut ($N-5 \to N-1$).
* **Red Divider Line**: Bright 2px vertical marker marking the exact cut boundary.
* **Frames 6–10**: The 5 frames immediately following the cut ($N \to N+4$).
* Enables immediate visual verification of velocity continuity (e.g. checking whether elements freeze dead for 1 frame or carry their momentum through the cut).

```
10-FRAME SEAM CONTACT FILMSTRIP
┌──────┬──────┬──────┬──────┬──────┰──────┬──────┬──────┬──────┬──────┐
│ N-5  │ N-4  │ N-3  │ N-2  │ N-1  ┃  N   │ N+1  │ N+2  │ N+3  │ N+4  │
│      │      │      │      │      ┃      │      │      │      │      │
└──────┴──────┴──────┴──────┴──────┸──────┴──────┴──────┴──────┴──────┘
                                   ▲
                             Cut Boundary
```

### C. Seam Summary Telemetry (`stitch_summary.json`)
Emits metadata detailing the seam transition:
```json
{
  "cut_timestamp": 25.6,
  "from_scene": "boundary",
  "to_scene": "hook",
  "window_ms": 166.7,
  "sample_frames": 10,
  "artifacts": [
    "onion_seam.png",
    "strip_seam.png"
  ]
}
```

---

## 3. How Autonomous Agents & Creators Use This Tool

### Diagnostic Workflow
1. **Detecting Carrier Dislocation**:
   - In match-cuts where a card, logo, or subject transforms into the next scene, the agent checks `onion_seam.png`. Green fringing on the left and magenta on the right indicates the carrier leaped horizontally across the cut.
   - *Remediation*: Match exit coordinates of Scene A with entry coordinates of Scene B using `TransformNode`.
2. **Identifying 1-Frame Black Dropouts**:
   - If an outgoing scene unmounts 1 frame too early, frame $N-1$ renders completely black, leaving `onion_seam.png` purely magenta with zero green light.
   - *Remediation*: Extend timeline duration by $\Delta t = 1/60\,\text{s}$ to close the timing gap.
3. **Verifying Motion Flow Through Cuts**:
   - Inspecting `strip_seam.png` verifies that camera or element motion does not freeze abruptly before the cut. Momentum should transfer naturally.

---

## 4. CLI Parameters & Execution

```bash
# Inspect a seam by specifying outgoing and incoming scenes
bun scripts/render.ts stitch --from-scene boundary --to-scene hook --out ../out/visual/stitch

# Inspect a cut at an exact timestamp
bun scripts/visual/stitch.ts --t 25.60 --out ../out/visual/stitch
```

### Supported CLI Flags
* `--t <seconds>`: Explicit cut timestamp.
* `--from-scene <id>`: Outgoing scene name.
* `--to-scene <id>`: Incoming scene name (if `--t` is omitted, automatically finds cut time from timeline).
* `--window <seconds>`: Inspection window duration.
* `--out <dir>`: Target directory for `onion_seam.png`, `strip_seam.png`, and `stitch_summary.json` (default: `../out/visual/stitch`).
