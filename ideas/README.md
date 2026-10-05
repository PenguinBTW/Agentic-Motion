# Visual Diagnostic Instruments: Ideas & Roadmap Catalog

This directory contains architectural specifications and design proposals for **future diagnostic instruments (05–09)** in the Agentic Motion Design Engine suite.

The initial four instruments (**01–04**) are **already fully implemented** in [`app/scripts/visual/`](../app/scripts/visual/) and have graduated from ideas to active tooling documentation in [`tooling documentation/`](../tooling%20documentation/).

---

## 1. Implemented Diagnostic Instruments (Active Tooling)

The following four instruments are operational in the engine. Detailed user guides and CLI usage are documented in [`tooling documentation/`](../tooling%20documentation/):

| Instrument | Status | Operational Guide | Core Artifacts | Primary Role |
| :--- | :---: | :--- | :--- | :--- |
| **01. 3D God-View Camera Blueprint** | **Implemented** | [01-godview-camera-blueprint.md](../tooling%20documentation/01-godview-camera-blueprint.md) | `cam_godview.png`<br>`godview_summary.json` | External $XZ$/$YZ$ architectural blueprints with flight ribbons & viewing cones. |
| **02. Multi-Exposure Motion Onion** | **Implemented** | [02-multi-exposure-motion-onion.md](../tooling%20documentation/02-multi-exposure-motion-onion.md) | `onion_motion.png`<br>`onion_summary.json` | Chromatic temporal motion trails (cyan $\to$ natural $\to$ amber) on a single still. |
| **03. Visual A/B Reference Anchor** | **Implemented** | [03-visual-ab-reference-anchor.md](../tooling%20documentation/03-visual-ab-reference-anchor.md) | `ab_side_by_side.png`<br>`ab_split_wipe.png` | Side-by-side & $45^\circ$ diagonal split-wipe benchmarking against Figma & design tokens. |
| **04. Transition Seam Stitch Inspector** | **Implemented** | [04-transition-seam-stitch-inspector.md](../tooling%20documentation/04-transition-seam-stitch-inspector.md) | `onion_seam.png`<br>`strip_seam.png` | Green/magenta false-color overlay & 10-frame filmstrip across scene cut boundaries ($\pm 250\text{ms}$). |

---

## 2. Proposed Diagnostic Instruments (Ideas & Roadmap Specs)

The following specifications define the next generation of diagnostic instruments planned for implementation:

| Instrument | Planned Command | Proposal Document | Core Visual Output | Problem It Solves Across Motion Graphics |
| :--- | :--- | :--- | :--- | :--- |
| **05. Parametric Speed Graph Inspector** | `bun scripts/curves.ts` | [05-parametric-motion-curve-speed-graph.md](./05-parametric-motion-curve-speed-graph.md) | `curve_speedgraph.png`<br>`curves_summary.json` | **Kinematic tangent kinks & arrival shock**: Replicates the classic NLE Speed Graph editor, plotting value curves $y(t)$ alongside physical speed $v(t)$ and acceleration $a(t)$ to flag $C^0$ tangent breaks, inflection flaws, and non-zero arrival impacts. |
| **06. Visual Gaze Saliency Heatmap** | `bun scripts/saliency.ts` | [06-visual-gaze-saliency-attention-heatmap.md](./06-visual-gaze-saliency-attention-heatmap.md) | `saliency_heatmap.png`<br>`saliency_summary.json` | **Perceptual attention hijacking**: Computes spatio-temporal saliency (contrast, color, optical flow) to render a thermal gaze heatmap and rank Top-3 focal anchors, confirming the hero subject captures $> 65\%$ attention share. |
| **07. Dynamic Contrast & Legibility Inspector** | `bun scripts/legibility.ts` | [07-dynamic-contrast-legibility-inspector.md](./07-dynamic-contrast-legibility-inspector.md) | `legibility_washout.png`<br>`legibility_summary.json` | **Dynamic background washout during camera transit**: Tracks local WCAG contrast behind typography glyphs over time, flagging temporary dropouts ($< 4.5:1$) caused by moving 3D geometry, lighting passes, or specular reflections. |
| **08. Choreography Gantt & Stagger Visualizer** | `bun scripts/rhythm.ts` | [08-choreography-gantt-stagger-rhythm.md](./08-choreography-gantt-stagger-rhythm.md) | `choreography_gantt.png`<br>`rhythm_summary.json` | **Ensemble timing & stagger orchestration**: Multi-track visual motion Gantt chart displaying entrance ease, dwell hold, and exit phase for every scene entity, revealing simultaneous onset traffic jams and stagger cascade regularity. |
| **09. Multi-Aspect Responsive Framing Inspector** | `bun scripts/framing.ts` | [09-multi-aspect-responsive-framing.md](./09-multi-aspect-responsive-framing.md) | `framing_multiaspect.png`<br>`framing_summary.json` | **Cross-platform safe-zone truncation**: Generates a synchronized $2 \times 2$ contact plate auditing 16:9 Landscape, 9:16 Vertical (Reels/TikTok), and 1:1 Square (feeds) simultaneously to detect cropped callouts and dead space. |

---

## 3. Architectural Design Invariants

1. **Strict Modular Architecture**: All tool implementations live in isolated modules under `app/scripts/visual/`. The master `render.ts` CLI dynamically dispatches to each tool.
2. **Zero Native C++ Dependencies**: Powered strictly by Bun, TypeScript, Playwright canvas readbacks, and HTML5 Canvas2D/WebGL blending modes.
3. **Machine-Actionable Directives**: Every diagnostic tool pairs its visual `.png` artifact with structured `.json` telemetry that emits actionable remediation advice for autonomous coding agents.
