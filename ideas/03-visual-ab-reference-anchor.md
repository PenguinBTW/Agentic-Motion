# Instrument 09: Visual A/B Reference Anchor (Side-by-Side & Split-Wipe Benchmarking)

## 1. Overview & Objective

The **Visual A/B Reference Anchor** is an automated visual comparison instrument that pairs frames from the active scene directly against corresponding benchmark plates from `Example project` at identical 1080p resolution and scaling.

It generates two composite visual artifacts:
1. **Side-by-Side Contact Plate (`ab_side_by_side.png`)**: Current scene on the left, Example project benchmark on the right, with matching typographic zoom callouts.
2. **50/50 Diagonal Split-Wipe Plate (`ab_split_wipe.png`)**: A diagonal or vertical split cut directly across the center of the frame, revealing differences in line thickness, bloom intensity, and negative space across the boundary.

---

## 2. Real Historical Scenario & Why It Is Worth Building

### The Problem in Past Work
Throughout the music video build, the primary standard of excellence was:
> *"Look at how Example project did it (e.g. loss.ts, room.ts, hook.ts). Match that level of typographic craft, line restraint, and optical comfort."*

### Why Existing Tools Failed
1. **Mathematical Proxies Failed to Convey Aesthetic Feel**: We computed scalar numbers like $\Delta E = 12.0$, motion energy $E = 0.04$, and line density. An agent looking at `edge_density = 0.038` cannot tell whether its wireframes are 3x too thick or whether its font is overcrowded.
2. **Review Hallucinations**: Without side-by-side visual grounding, code reviews relied on memory and vague adjectives ("make it cleaner", "reduce clutter").
3. **Typographic Scale Guesswork**: In our early Phase 1 passes, words were rendered in heavy 48px bold boxes. We only discovered this was wrong after manually copying screenshots from Example project to realize Example used 24px letter-spaced display type with generous ink knockout halos.

### How the Visual A/B Anchor Solves It
By rendering an automated, aligned side-by-side comparison:
- **Typographic Proportions**: You immediately see if your hero word is 2× the size of Example project's reference typography.
- **Negative Space & Clutter**: You see that Example project leaves 65% of the frame as clean negative space, whereas your scene may have crowded the borders.
- **Line Weight & Bloom**: You see whether your wireframes are 1px semi-transparent ink vs 3px saturated glowing chalk.

---

## 3. Visual Specifications

### A. Side-by-Side Diagnostic Plate (`ab_side_by_side.png`)

```
┌────────────────────────────────────────┬────────────────────────────────────────┐
│           ACTIVE PROJECT               │         EXAMPLE BENCHMARK              │
│       Scene: boundary.ts (t = 27.5s)   │        Scene: loss.ts (t = 14.2s)      │
│                                        │                                        │
│               [ HERO WORD ]            │                 [ HERO WORD ]          │
│               Height: 84px             │                 Height: 38px           │
│                                        │                                        │
│       Wireframe line width: 2.8px      │         Wireframe line width: 1.0px    │
│       Negative space: 38%              │         Negative space: 72%            │
└────────────────────────────────────────┴────────────────────────────────────────┘
 [ Zoom Box A: 200x200px Word Inset ]     [ Zoom Box B: 200x200px Word Inset ]
```

### B. Diagonal Split-Wipe Plate (`ab_split_wipe.png`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ACTIVE PROJECT (Top-Left)               \                                       │
│                                          \                                      │
│                                           \  <--- 45° Hairline Split            │
│                                            \                                    │
│                                             \        EXAMPLE BENCHMARK          │
│                                              \       (Bottom-Right)             │
│                                               \                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```
- Across the 45° diagonal line, the background tone, wireframe contrast, and font weight meet directly. Any jarring discrepancy in line thickness or exposure jumps out immediately.

---

## 4. Technical CLI Interface

```bash
# Compare current boundary scene at t=27.5s against Example project's loss scene
bun scripts/render.ts compare --scene boundary --t 27.5 --ref loss --ref-t 14.2 --out ../out/compare/boundary_vs_loss

# Automated mode: auto-selects closest musical counterpart plate in Example project
bun scripts/render.ts compare --scene hook1 --t 34.5 --auto-ref --out ../out/compare/hook_vs_benchmark
```

### Options
- `--scene <name>`: Current project scene name or plate ID.
- `--t <seconds>`: Timestamp in current project.
- `--ref <name>`: Reference plate in `Example project/app` (e.g. `loss`, `room`, `hook`, `corridor`).
- `--ref-t <seconds>`: Timestamp in reference plate.
- `--auto-ref`: Uses `calibration/example.json` metadata to find the plate with matching musical energy and tempo.
- `--split <side|diagonal|wipe>`: Layout mode (`side` for 2-panel, `diagonal` for 45° seam, `wipe` for slider comparison).

---

## 5. Output Telemetry (`ab_comparison.json`)

```json
{
  "active_scene": "boundary",
  "active_t": 27.50,
  "ref_scene": "loss",
  "ref_t": 14.20,
  "font_height_ratio": 2.21,
  "negative_space_pct_active": 38.4,
  "negative_space_pct_ref": 71.8,
  "edge_density_active": 0.048,
  "edge_density_ref": 0.019,
  "palette_delta_e_mean": 3.8,
  "limits": "Visual benchmark comparison only; does not enforce identical composition or restrict deliberate stylistic divergence."
}
```

---

## 6. Implementation Blueprint

1. **Dual Render Harness**:
   - Playwright session 1 renders current project via `app/` at `t_active`.
   - Playwright session 2 renders reference project via `Example project/app` at `t_ref`.
2. **Compositing Engine**:
   - Reads raw pixel buffers into Bun memory.
   - Generates side-by-side composite canvas with centered labels and typographic callouts.
   - Generates diagonal split mask with 1px signal hairline divider.
3. **Telemetry Extraction**:
   - Computes negative space and edge density deltas between the two frames.
   - Writes `ab_side_by_side.png`, `ab_split_wipe.png`, and `ab_comparison.json`.
