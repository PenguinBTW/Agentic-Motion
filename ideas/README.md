# The 4 Core Visual Diagnostic Instruments

This directory contains technical architectural specifications for the **4 approved visual diagnostic instruments** of the Agentic Motion Design Engine.

These tools replace arbitrary mathematical scorecards and scalar verdicts with **interpretable visual blueprints, multi-exposure motion trails, side-by-side design system benchmark anchors, and transition seam overlays** across any procedural motion graphic design domain—commercial product reveals, UI/UX interaction showcases, kinetic typography manifestos, data visualizations, and audiovisual productions.

---

## The 4 Approved Visual Instruments

| Instrument | CLI Command | Core Visual Output | Problem It Solves Across Motion Graphics |
| :--- | :--- | :--- | :--- |
| [**01. 3D God-View Camera Blueprint**](./01-godview-camera-blueprint.md) | `bun scripts/godview.ts`<br>`bun scripts/render.ts godview` | `cam_godview.png`<br>`godview_summary.json` | **3D spatial blindness & frustum clipping**: Shows top-down ($XZ$) and side elevation ($YZ$) architectural blueprints of scene geometry, hero subjects, camera flight paths, frustum cones, and velocity ribbons. Prevents near-plane clipping, camera collisions, and orientation drift in product orbits, architectural fly-throughs, and 3D UI layers. |
| [**02. Multi-Exposure Motion Onion**](./02-multi-exposure-motion-onion.md) | `bun scripts/onion.ts`<br>`bun scripts/render.ts onion` | `onion_motion.png`<br>`onion_summary.json` | **Camera tremors, spring overshoot & easing breaks**: Collapses a $0.5\text{–}1.5\,\text{s}$ animation window into a single chromatic ghost trail (cyan $\to$ natural $\to$ amber), instantly exposing camera micro-tremors, physical spring oscillation damping, vector morph glitches, and kinetic typography deceleration on a single still without video playback. |
| [**03. Visual A/B Reference Anchor**](./03-visual-ab-reference-anchor.md) | `bun scripts/compare.ts`<br>`bun scripts/render.ts compare` | `ab_side_by_side.png`<br>`ab_split_wipe.png`<br>`ab_comparison.json` | **Aesthetic drift vs Design Tokens & Figma Mockups**: Automated side-by-side and $45^\circ$ diagonal split-wipe contact sheets directly comparing typography scale, stroke weight, negative space ratio, and color gamut against Figma keyframes, brand guidelines, or reference animation plates. |
| [**04. Transition Seam Stitch Inspector**](./04-transition-seam-stitch-inspector.md) | `bun scripts/stitch.ts`<br>`bun scripts/render.ts stitch` | `onion_seam.png`<br>`strip_seam.png`<br>`stitch_summary.json` | **Scene handoff & UI state teleportation**: Overlays exit frame $N-1$ (translucent green) and entry frame $N$ (translucent magenta) across cut boundaries ($\pm 250\,\text{ms}$) to verify carrier geometry alignment (UI cards, logos, focal anchors), velocity continuity, and horizon stability. |

---

## Architectural Principles
1. **Modular Engine Architecture**: All tool implementations are fully separated into modular standalone files under `app/scripts/visual/` (`godview.ts`, `onion.ts`, `compare.ts`, `stitch.ts`), keeping the core `render.ts` lightweight and unbloated.
2. **Zero Native C++ Dependencies**: Powered strictly by Bun, TypeScript, Playwright canvas readbacks, and HTML5 Canvas2D/WebGL blending modes.
3. **Evidence Over Verdicts**: Factual visual diagrams and empirical percentiles instead of arbitrary PASS/FAIL scorecards.
4. **Fast Headless CI Execution**: Micro-runners execute on single scenes in under 2–6 seconds, enabling rapid autonomous agent feedback loops.
