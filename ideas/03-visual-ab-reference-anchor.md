# Instrument 03: Visual A/B Reference Anchor (Side-by-Side & Split-Wipe Benchmarking)

## 1. Overview & Objective

The **Visual A/B Reference Anchor** is an automated visual comparison instrument that pairs frames from an active procedural motion graphics scene directly against authoritative design references—such as Figma artboards, brand style guidelines, or benchmark animation plates—at matching 1080p resolution and scaling.

It generates two composite visual artifacts:
1. **Side-by-Side Contact Plate (`ab_side_by_side.png`)**: Current procedural scene on the left, reference benchmark on the right, with matching typographic zoom insets and parameter callouts.
2. **50/50 Diagonal Split-Wipe Plate (`ab_split_wipe.png`)**: A $45^\circ$ diagonal hairline cut across the center of the frame, directly exposing differences in stroke thickness, negative space ratio, and color gamut across the boundary.

---

## 2. Why Visual Ground Truth Solves Real Motion Problems

### The Failure of Purely Numerical Proxies
1. **Scalar Numbers Do Not Convey Visual Restraint**: An agent looking at `edge_density = 0.038` or `delta_e = 4.2` cannot tell whether its wireframes are $3\times$ too thick, whether its typography is crowded against the borders, or whether its bloom is overpowering the composition.
2. **Review Hallucinations Without Visual Grounding**: Without side-by-side visual grounding, code reviews fall into subjective guesswork ("make it cleaner", "reduce clutter").
3. **Typographic Scale & Design Token Drift**: Procedural scenes often drift away from intended brand typography hierarchies (e.g. rendering headline text at 68px when the design system specifies 36px with generous letter spacing).

### How the Visual A/B Anchor Solves It Across Motion Domains
- **Design System & Figma Parity**: Directly verifies that procedural typography cap heights, line weights, and layout margins adhere to design tokens.
- **Negative Space Discipline**: Visually confirms whether the procedural scene preserves generous negative space ($60\%\text{–}75\%$ breathing room) or crowds the viewport.
- **Stroke Weight & Bloom Balance**: Reveals whether procedural vector lines are delicate 1px semi-transparent strokes or thick, over-bloomed chalk.
- **Gamut & Tone Juxtaposition**: The $45^\circ$ diagonal cut places active and reference backgrounds in direct contact, instantly highlighting black-point or white-point discrepancies.

---

## 3. Visual Specifications

### A. Side-by-Side Diagnostic Plate (`ab_side_by_side.png`)

```
┌────────────────────────────────────────┬────────────────────────────────────────┐
│           ACTIVE SCENE                 │         REFERENCE BENCHMARK            │
│   Scene: product_hero (t = 4.20s)      │   Plate: figma_keyframe (t = 4.20s)    │
│                                        │                                        │
│               [ HERO TITLE ]           │                 [ HERO TITLE ]         │
│               Height: 68px             │                 Height: 36px           │
│                                        │                                        │
│       Wireframe stroke: 2.5px          │         Wireframe stroke: 1.0px        │
│       Negative space: 42%              │         Negative space: 72%            │
└────────────────────────────────────────┴────────────────────────────────────────┘
 [ Zoom Box A: 200x200px Inset ]          [ Zoom Box B: 200x200px Inset ]
```

### B. Diagonal Split-Wipe Plate (`ab_split_wipe.png`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ACTIVE SCENE (Top-Left)                  \                                      │
│                                           \                                     │
│                                            \  <--- 45° Hairline Split Cut       │
│                                             \                                   │
│                                              \       REFERENCE BENCHMARK        │
│                                               \      (Bottom-Right)             │
│                                                \                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```
Across the $45^\circ$ diagonal hairline, background tone, wireframe contrast, and font weight meet directly. Any jarring disparity in stroke weight, bloom, or exposure jumps out immediately.

---

## 4. Technical CLI Interface

```bash
# Compare active UI showcase frame against design benchmark
bun scripts/compare.ts --scene dashboard_hud --t 5.20 --ref figma_keyframe --ref-t 5.20 --out ../out/visual/hud_vs_figma

# Benchmark active 3D commercial typography against master design tokens
bun scripts/render.ts compare --scene brand_reveal --t 3.50 --ref style_guide --ref-t 1.00 --out ../out/visual/brand_alignment

# Compare lighting and negative space against approved reference scene
bun scripts/compare.ts --scene feature_callout --t 12.0 --ref master_template --ref-t 12.0
```

### Options
- `--scene <name>`: Current procedural scene name or plate ID.
- `--t <seconds>`: Timestamp in current scene.
- `--ref <name>`: Reference plate, Figma keyframe, or benchmark asset name.
- `--ref-t <seconds>`: Matching timestamp in reference plate.
- `--port <number>`: Port for ephemeral reference server instance (default: `5189`).
- `--out <path>`: Output directory for diagnostic contact plates.

---

## 5. Output Telemetry (`ab_comparison.json`)

```json
{
  "active_scene": "dashboard_hud",
  "active_t": 5.20,
  "ref_scene": "figma_keyframe",
  "ref_t": 5.20,
  "font_height_ratio": 1.88,
  "negative_space_pct_active": 44.2,
  "negative_space_pct_ref": 71.0,
  "edge_density_active": 0.042,
  "edge_density_ref": 0.018,
  "palette_delta_e_mean": 4.1,
  "limits": "Automated pixel-level comparison; cannot resolve 3D geometry obscured behind foreground occluders."
}
```
