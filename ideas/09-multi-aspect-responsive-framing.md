# Instrument 09: Multi-Aspect Responsive Framing Inspector (`framing`)

## 1. Overview & Objective

The **Multi-Aspect Responsive Framing Inspector** is a multi-format visual verification instrument that audits how a procedural motion graphics scene composes across **16:9 Landscape (desktop/broadcast), 9:16 Vertical (Reels/TikTok/Shorts), and 1:1 Square (feeds)** simultaneously.

It generates a synchronized $2 \times 2$ contact plate and safe-zone penetration report, ensuring autonomous coding agents deliver compositionally balanced, crop-safe motion graphics across all modern display platforms.

---

## 2. The Problem It Solves

Modern motion graphics studios rarely deliver exclusively in 16:9 widescreen:
1. **Vertical Safe-Margin Truncation**: When an autonomous agent develops in a 16:9 canvas, it naturally places secondary feature callouts, badges, or brand titles in the outer left and right quadrants. When rendered or cropped for 9:16 mobile feeds, these essential elements are severely clipped.
2. **Vertical Dead Space**: A composition that looks expansive and cinematic in 16:9 can feel vacant and top-heavy in 9:16 vertical, with excessive empty space above and below the hero subject.
3. **Focal Point Drifting**: 3D camera flight paths centered for widescreen often drift out of the narrow 9:16 viewing column during pans or orbits.

---

## 3. Visual Specifications (`framing_multiaspect.png`)

```
MULTI-ASPECT 2x2 CONTACT SCHEMATIC (framing_multiaspect.png)

QUADRANT 1: 16:9 MASTER VIEW WITH SAFETY OVERLAYS  QUADRANT 2: 9:16 VERTICAL PREVIEW
┌──────────────────────────────────────────────┐  ┌──────────────────────┐
│  │   [ Cyan Box: 1:1 Square Boundary ]    │  │  │                      │
│  │   ┌──────────────────────────────┐     │  │  │   [ 9:16 Render ]    │
│  │   │  [ Magenta: 9:16 Vertical ]  │     │  │  │   Hero Product Centered
│[X]───┼──│      [ HERO OBJECT ]      │─────┼──│  │                      │
│Clipped Callout └────────────────────────────┘  │  │   [X] Spec Badge Cut │
└──────────────────────────────────────────────┘  └──────────────────────┘

QUADRANT 3: 1:1 SQUARE PREVIEW                    QUADRANT 4: SAFE-ZONE BREACH HEATMAP
┌──────────────────────────────┐                  ┌──────────────────────────────────────┐
│                              │                  │ Green: 100% Safe in All Aspects      │
│      [ 1:1 Render ]          │                  │ Red: Breached in 9:16 Vertical       │
│      Balanced Core           │                  │      (spec_badge_right, price_tag)   │
│                              │                  │                                      │
└──────────────────────────────┘                  └──────────────────────────────────────┘
```

### Visual Features
1. **Quadrant 1 (Top-Left): 16:9 Master View with Overlays**:
   - Master 1080p frame overlaid with color-coded aspect ratio boundaries:
     - **Cyan Rule**: 1:1 Square crop window.
     - **Magenta Rule**: 9:16 Vertical crop window.
     - **Dotted Green Rule**: Standard Action-Safe ($90\%$) and Title-Safe ($80\%$) boundaries.
2. **Quadrant 2 (Top-Right): Direct 9:16 Vertical Render**:
   - Shows true vertical mobile framing at $1080 \times 1920$ resolution.
3. **Quadrant 3 (Bottom-Left): Direct 1:1 Square Render**:
   - Shows true square feed framing at $1080 \times 1080$ resolution.
4. **Quadrant 4 (Bottom-Right): Safe-Zone Breach Heatmap**:
   - Highlights any text or graphic bounding boxes that breach the vertical or square safe margins in bright red.

---

## 4. Technical CLI Interface

```bash
# Audit responsive framing at hero reveal keyframe
bun scripts/framing.ts --scene product_turntable --t 6.50 --out ../out/visual/product_framing

# Inspect responsive framing across multiple scenes
bun scripts/framing.ts --scene modal_reveal --t 2.40 --aspects 16:9,9:16,1:1

# Batch audit keyframes across an entire sequence
bun scripts/framing.ts --scene dashboard_overview --from 1.0 --to 5.0 --step 1.0
```

### Options
* `--scene <name>`: Target scene or plate identifier.
* `--t <seconds>`: Timestamp to evaluate.
* `--aspects <list>`: Comma-separated list of aspect ratios to audit (default: `16:9,9:16,1:1`).
* `--out <path>`: Target directory for 2x2 contact image and telemetry JSON.

---

## 5. Quantitative Telemetry (`framing_summary.json`)

```json
{
  "scene": "product_turntable",
  "t": 6.50,
  "aspect_audits": {
    "16:9": {
      "safe_zone_breaches": 0,
      "breached_entities": [],
      "crop_loss_pct": 0.0
    },
    "9:16": {
      "safe_zone_breaches": 2,
      "breached_entities": ["spec_badge_right", "price_tag"],
      "crop_loss_pct": 42.1
    },
    "1:1": {
      "safe_zone_breaches": 0,
      "breached_entities": [],
      "crop_loss_pct": 18.4
    }
  },
  "recommendation": "reposition_peripheral_badges_inward",
  "status": "9:16_safe_margin_breach"
}
```

---

## 6. Autonomous Agent Iteration Workflow

```
[ Agent parses framing_summary.json ]
                │
                ├─► aspect_audits["9:16"].safe_zone_breaches > 0
                │   • Diagnosis: Peripheral callouts or badges are cropped in mobile vertical feeds.
                │   • Action: Reposition callouts closer to center using responsive layout offsets or LayerStack.setViewport('9:16').
                │
                ├─► aspect_audits["9:16"].crop_loss_pct > 35% with hero clipped
                │   • Diagnosis: Camera distance is too close for narrow vertical FOV.
                │   • Action: Dolly camera back slightly or widen vertical camera FOV in 9:16 mode.
                │
                └─► 0 safe zone breaches across all aspect ratios
                    • Diagnosis: Clean multi-platform framing verified.
                    • Action: Composition approved for cross-platform export.
```
