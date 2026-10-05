# The 4 Core Visual Diagnostic Instruments

This directory contains technical architectural specifications for the **4 approved visual diagnostic instruments**. These tools replace arbitrary mathematical scorecards and scalar verdicts with **interpretable visual diagrams, multi-exposure motion trails, and side-by-side benchmark anchors**.

---

## The 4 Approved Visual Instruments

| Instrument | CLI Command | Core Visual Output | Problem It Solves |
| :--- | :--- | :--- | :--- |
| [**01. 3D God-View Camera Blueprint**](./01-godview-camera-blueprint.md) | `bun scripts/render.ts godview` | `cam_godview.png` | **3D spatial blindness & frustum clipping**: Shows top-down and 45° isometric architectural schematics of scene geometry, camera position, frustum cones, and velocity ribbons. |
| [**02. Multi-Exposure Motion Onion**](./02-multi-exposure-motion-onion.md) | `bun scripts/render.ts onion` | `onion_motion.png` | **Camera tremors & piecewise easing breaks**: Converts temporal acceleration into a static chromatic ghost trail (cyan-to-amber), revealing jerks and easing discontinuities on a single still without video playback. |
| [**03. Visual A/B Reference Anchor**](./03-visual-ab-reference-anchor.md) | `bun scripts/render.ts compare` | `ab_side_by_side.png`, `ab_split_wipe.png` | **Aesthetic drift vs Example project**: Automated side-by-side and 50/50 split-wipe contact sheets directly comparing typography scale, line weights, and negative space against reference plates. |
| [**04. Transition Seam Stitch Inspector**](./04-transition-seam-stitch-inspector.md) | `bun scripts/render.ts stitch` | `onion_seam.png`, `strip_seam.png` | **Scene handoff teleportation**: Overlays exit frame (green) and entry frame (magenta) across cut boundaries ($\pm 250\,\text{ms}$) to verify carrier alignment and horizon continuity. |

---

## Architectural Principles
1. **Modular Engine Architecture**: All tool implementations are fully separated into modular standalone files under `app/scripts/visual/` (`godview.ts`, `onion.ts`, `compare.ts`, `stitch.ts`), keeping `render.ts` lightweight and clean.
2. **Zero New Heavy Dependencies**: Powered strictly by Bun, TypeScript, Playwright canvas readbacks, and analytical geometry.
3. **Evidence Over Verdicts**: Factual visual diagrams and empirical percentiles instead of PASS/FAIL scorecards.
4. **Fast Headless CI Execution**: Micro-runners execute on single scenes in under 15–30 seconds.
