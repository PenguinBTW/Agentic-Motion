# Instrument 06: Visual Gaze Saliency & Attention Heatmap (`saliency`)

## 1. Overview & Objective

The **Visual Gaze Saliency & Attention Heatmap** is a perceptual diagnostic instrument that models human foveal vision and visual attention distribution across animated scenes. It computes a spatio-temporal saliency model—combining local luminance contrast, chromatic distinctiveness, and optical flow velocity—to answer the core directorial question:

**"Where does the human eye actually look, and does the intended hero subject command visual dominance?"**

---

## 2. The Problem It Solves

Human perception is governed by foveal vision ($\sim 2^\circ$), driven by rapid saccadic eye movements toward high-contrast, fast-moving, or isolated visual stimuli:
1. **Attention Hijacking**: An autonomous coding agent may add ambient dust particles, animated background grid lines, or high-contrast corner HUD elements to make a scene "feel rich". However, because these background elements move rapidly or have high contrast, the viewer's eye is unconsciously pulled away from the hero product or headline.
2. **Split-Attention Fatigue**: When two visual events of equal contrast and speed occur simultaneously on opposite sides of the viewport, the viewer's gaze oscillates erratically, inducing cognitive fatigue.
3. **Low Focal Clarity**: In diffuse scenes without a strong visual anchor, the eye wanders aimlessly, weakening the commercial or narrative impact.

---

## 3. Visual Specifications (`saliency_heatmap.png`)

```
GAZE SALIENCY DIAGNOSTIC SCHEMATIC (Dual-Panel Composite)

PANEL 1: THERMAL GAZE HEATMAP               PANEL 2: TOP-3 FOCAL ANCHORS
┌──────────────────────────────────────────┬──────────────────────────────────────────┐
│             [ Cool Deep Blue ]           │                                          │
│                                          │   ┌──────────────────────────────────┐   │
│             ▲ High Saliency Core         │   │ #1 [HERO SUBJECT]: 74.2% Share   │   │
│            ╱ ╲ (Burning Vermilion)       │   │    Bounding Box: [840, 420, 1080]│   │
│           │ ● │ Gaze Fixation Focus      │   └──────────────────────────────────┘   │
│            ╲ ╱                           │                                          │
│             ▼                            │   ┌──────────────────────────────────┐   │
│                                          │   │ #2 [BACKGROUND PARTICLES]: 14.1% │   │
│   [ Faint Cyan: Low Background Draw ]    │   │    Distraction Warning: > 10%    │   │
│                                          │   └──────────────────────────────────┘   │
└──────────────────────────────────────────┴──────────────────────────────────────────┘
```

### Visual Features
1. **Panel 1: Thermal Gaze Heatmap Overlay**:
   - Deep Blue: Zero gaze probability ($0\%$).
   - Bright Cyan / Green: Moderate peripheral visual weight ($20\%\text{–}50\%$).
   - Hot Amber / Burning Vermilion: Peak foveal gaze fixation ($> 85\%$ probability).
2. **Panel 2: Top-3 Focal Anchors Breakdown**:
   - Bounding boxes isolating the primary attention clusters.
   - Attention Capture Share percentage for each cluster.
   - Hierarchy Tags: `#1 [HERO]`, `#2 [PERIPHERAL]`, `#3 [BACKGROUND]`.

---

## 4. Technical CLI Interface

```bash
# Evaluate visual saliency at hero reveal moment
bun scripts/saliency.ts --scene hero_reveal --t 4.20 --out ../out/visual/hero_saliency

# Analyze gaze stability over a 1.0s window
bun scripts/saliency.ts --scene modal_reveal --t 2.50 --window 1.0 --out ../out/visual/modal_attention

# Inspect title entrance attention dominance
bun scripts/saliency.ts --scene title_manifesto --t 1.10
```

### Options
* `--scene <name>`: Target scene or plate identifier.
* `--t <seconds>`: Center timestamp for analysis.
* `--window <seconds>`: Temporal window radius for spatio-temporal flow weighting (default: `0.25`).
* `--out <path>`: Target directory for diagnostic PNG and JSON telemetry.

---

## 5. Quantitative Telemetry (`saliency_summary.json`)

```json
{
  "scene": "hero_reveal",
  "t": 4.20,
  "gaze_entropy": 1.42,
  "entropy_classification": "focused_single_anchor",
  "primary_focal_point": [960, 520],
  "hero_subject_attention_share_pct": 74.2,
  "peripheral_distraction_share_pct": 11.5,
  "competing_clusters_count": 1,
  "status": "clear_visual_hierarchy"
}
```

---

## 6. Autonomous Agent Iteration Workflow

```
[ Agent parses saliency_summary.json ]
                │
                ├─► hero_subject_attention_share_pct < 60%
                │   • Diagnosis: Secondary elements are fighting the hero subject for viewer attention.
                │   • Action: Reduce background line contrast, dim particle opacity, or add a subtle vignette.
                │
                ├─► peripheral_distraction_share_pct > 15%
                │   • Diagnosis: Corner HUD or background elements are pulling foveal vision away from the center.
                │   • Action: Soften corner motion velocity or stagger secondary elements to enter after the hero.
                │
                └─► gaze_entropy > 2.5 (Diffuse / Chaotic)
                    • Diagnosis: Scene lacks a distinct visual focal point; viewer eye wanders aimlessly.
                    • Action: Increase hero scale, boost hero contrast, or darken surrounding stage geometry.
```
