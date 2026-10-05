# Instrument 07: Dynamic Contrast & Legibility Washout Inspector (`legibility`)

## 1. Overview & Objective

The **Dynamic Contrast & Legibility Washout Inspector** is an automated typographic readability instrument that evaluates local background luminance directly behind typography glyphs throughout their active display window.

It guarantees that titles, feature callouts, subtitles, and HUD labels remain legible across moving 3D geometry, animated lighting passes, and dynamic specular reflections without suffering temporary reading dropouts.

---

## 2. The Problem It Solves

In procedural motion graphics, typography rarely sits on a static backdrop:
1. **Dynamic Specular & Geometry Washout**: A white display title may have perfect $14:1$ contrast against dark slate geometry at $t = 2.0\,\text{s}$. However, as the 3D camera dollies forward at $t = 2.4\,\text{s}$, a high-intensity specular highlight or white 3D surface passes directly behind the text, dropping local contrast to $1.2:1$ for $300\,\text{ms}$.
2. **Static Layout Blindness**: Traditional automated layout audits inspect typography only at keyframe stills or bounding box edges, missing dynamic mid-flight contrast failures entirely.
3. **Missing Protective Halos**: Autonomous coding agents often forget to apply ink knockout under-strokes (`withKnockoutHalo`) or localized backdrop scrims, resulting in unreadable copy during camera moves.

---

## 3. Visual Specifications (`legibility_washout.png`)

```
DYNAMIC CONTRAST DIAGNOSTIC SCHEMATIC (legibility_washout.png)

TOP PANEL: CONTINUOUS TIME-SERIES WCAG CONTRAST RATIO
14:1┌──────────────────────────────────────────────────────────┐  Safe Baseline
    │                                                          │  (High Contrast)
 7:1├──────────────────\                      /────────────────┤  WCAG AAA Line
 4.5├───────────────────\                    /─────────────────┤  WCAG AA Minimum
    │                    \  DROPOUT RUN     /                  │
 1:1└─────────────────────\───────▼────────/───────────────────┘
    t0 = 6.2s            t_dip = 7.15s (2.1:1)       t1 = 8.5s

BOTTOM INSET PANELS: THE 3 LOWEST CONTRAST MOMENTS
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ CROP A: t = 7.05s       │ CROP B: t = 7.15s (WORST│ CROP C: t = 7.25s       │
│ Contrast: 3.2:1         │ Contrast: 2.1:1         │ Contrast: 3.4:1         │
│   "RETINA XDR DISPLAY"  │   "RETINA XDR DISPLAY"  │   "RETINA XDR DISPLAY"  │
│ [Red Mask: Glyphs Wash] │ [Red Mask: Full Dropout]│ [Red Mask: Recovering]  │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### Visual Features
1. **Top Panel: WCAG Contrast Time-Series**:
   - Plots local Michelson and WCAG contrast ratio across the text's active dwell window.
   - Highlights any duration where contrast dips below the $4.5:1$ threshold.
2. **Bottom Inset Panels: Worst-Moment Frame Crops**:
   - Zooms into the typography bounding box at the **3 lowest-contrast timestamps**.
   - Overlays a false-color red mask over glyph strokes where contrast falls below acceptable legibility limits.

---

## 4. Technical CLI Interface

```bash
# Audit feature callout title contrast during camera travel
bun scripts/legibility.ts --scene feature_callout --probe title_spec_01 --from 6.20 --to 8.50 --out ../out/visual/spec_contrast

# Quick contrast check on hero headline across its dwell window
bun scripts/legibility.ts --scene hero_reveal --probe headline_main

# Audit all text probes in a sequence for contrast dropouts
bun scripts/legibility.ts --scene modal_reveal --all-probes
```

### Options
* `--scene <name>`: Target scene or plate identifier.
* `--probe <id>`: Specific text probe ID from Canvas2D or `SceneGraph`.
* `--from <seconds> --to <seconds>`: Dwell window to inspect.
* `--threshold <ratio>`: Minimum WCAG contrast threshold (default: `4.5` for body, `3.0` for display).
* `--out <path>`: Output directory for PNG strip and telemetry JSON.

---

## 5. Quantitative Telemetry (`legibility_summary.json`)

```json
{
  "scene": "feature_callout",
  "probe_id": "title_spec_01",
  "text": "RETINA XDR DISPLAY",
  "active_window_s": [6.20, 8.50],
  "mean_contrast_ratio": 8.4,
  "min_contrast_ratio": 2.1,
  "min_contrast_timestamp_s": 7.15,
  "dropout_duration_ms": 280,
  "wcag_compliance": "FAIL_DURING_TRANSIT",
  "root_cause": "specular_reflection_pass_behind",
  "status": "requires_knockout_or_scrim"
}
```

---

## 6. Autonomous Agent Iteration Workflow

```
[ Agent parses legibility_summary.json ]
                │
                ├─► min_contrast_ratio < 4.5:1 with dropout_duration_ms > 100
                │   • Diagnosis: Text washes out against background geometry or lighting during flight.
                │   • Action: Apply ink knockout halo via KineticText.withKnockoutHalo(strokePx = 3, haloColor = LIN.ink).
                │
                ├─► root_cause == "specular_reflection_pass_behind"
                │   • Diagnosis: Direct bloom highlight or mesh pass-behind blinds text.
                │   • Action: Inject localized dark backdrop scrim or adjust 3D light intensity.
                │
                └─► wcag_compliance == "PASS"
                    • Diagnosis: Text maintains clean legibility throughout entire flight.
                    • Action: Verified clean; lock typographic styling.
```
