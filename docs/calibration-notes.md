# Calibration Notes & Sanity Check Decisions

This document records the empirical calibration decisions, false-positive investigations, and threshold sanity checks conducted across the director-approved `doors` plate (`8.00–18.50s`) and the `Example project` reference hook (`22.51–24.33s`).

---

## 1. Sanity Check Outcomes

As required by the review policy, **neither director-approved plate nor the Example project hook produced a blocking flag**.

| Plate / Sequence | Time Window | Blocking Flags | Advisory Flags | Info Flags | Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Example project Hook** (`Example project/app`) | `22.51–24.33s` | **0** | 11 | 0 | **PASSED** (Clean benchmark baseline) |
| **Director-Approved Doors** (`app/src/scenes/doors.ts`) | `8.00–18.50s` | **0** | 22 | 0 | **PASSED** (Zero blocking defects) |

---

## 2. Metric Investigations & Threshold Decisions

During calibration and sanity checking, two objective rules (`F05` Text Clipping and `F04` Text Collision) initially triggered false-positive blocking flags on the approved `doors` plate. Below is the diagnostic analysis and formal resolution for each.

### 2.1 Rule F05: Text Clipping
- **Initial Finding**: Triggered 561 blocking flags across `8.00–18.50s` on `doors`.
- **Root Cause**:
  1. The text analyzer tracked `max_clip_pct` across the entire temporal lifetime of each text run. Consequently, lyric words floating off the top edge of the screen during exit animations (`minY: -149px`) were flagged as layout clipping bugs.
  2. 3D geometry labels on doors exiting the camera frustum as the camera dollied forward through the corridor were flagged as clipping.
- **Metric Limit Identified**: Frustum transit is a natural feature of 3D camera travel, not a 2D typography layout failure. Similarly, exit and entrance transitions naturally move text past the viewport boundary.
- **Decision & Fix**:
  - Scoped lyric clipping checks strictly to the active sung window (`tw.start` to `tw.end`). A sung word is only flagged if clipped while actively being sung.
  - Excluded dynamic 3D world elements ($v \ge 50\,\text{px/s}$) and offscreen transit from layout clipping.
  - Status: **Fixed** in `app/scripts/motion/text-analyzer.ts` and `app/scripts/motion/flags.ts`.

### 2.2 Rule F04: Text Collisions
- **Initial Finding**: Triggered 105 blocking flags across `8.00–18.50s` on `doors`.
- **Root Cause**:
  - Canvas2D text interception captures 2D bounding boxes `[minX, minY, maxX, maxY]` on screen space without a 3D Z-buffer.
  - In `doors.ts`, foreground 2D lyrics (`"little"`, `"doors"`, $h\% = 1.12\%$) float in front of distant 3D doors down the corridor. As the camera looks down the corridor, distant door plaques (`"OPENS ONTO: № 0027 (SMALLER)"`, $h\% = 0.13\%$) pass behind the foreground lyric text.
  - Because the smaller box had tiny area ($\sim 1.4\,\text{px}$ height), the 2D bounding box intersection registered as $40\%\text{--}100\%$ overlap, triggering false collision flags.
- **Metric Limit Identified**: 2D screen-space overlap between elements at radically different 3D depth planes is 3D perspective parallax, not a typographic collision defect.
- **Decision & Fix**:
  - Excluded micro-geometry text ($h\% < 0.4\%$, or $< 4.3\,\text{px}$ cap height) from 2D collision detection.
  - Excluded pairs with extreme scale disparity ($\ge 2.5\times$ font height ratio).
  - Preserved strict blocking flags for genuine same-layer typographic collisions (two lyric words colliding, overlapping title lines, or overlapping HUD badges).
  - Status: **Fixed** in `app/scripts/motion/text-analyzer.ts` and documented in limits for `F04`.

### 2.3 Rule F13: Frame Render Time (> 25 ms)
- **Initial Finding**: Triggered 19 advisory warnings on `doors` and 8 advisory warnings on `Example hook`.
- **Root Cause**: Headless Chrome canvas readback overhead in Playwright (`page.screenshot` / `evaluate`) occasionally spikes per-frame turnaround time to $27\text{--}55\,\text{ms}$ on CPU/software readback.
- **Decision**:
  - Tagged as **Advisory** (Class: `advisory`, Tier: `tier_a_objective`, Source: `objective`).
  - Added explicit limits note: *"Includes Playwright readback overhead and headless Chrome software/hardware scheduling."*
  - The review gate does not block merges on test-runner harness overhead.
  - Status: **Retained as Advisory**.

### 2.4 Rule F11 & F12: Bone Bloom & Palette Conformity
- **Initial Finding**: F11 and F12 triggered advisory flags during bright aesthetic moments on `doors`.
- **Root Cause**: `doors` features an intentional transition through bright bone/white space as doors open.
- **Decision**:
  - Calibrated against empirical distributions from `Example project` (where peak off-palette reaches $50.02\%$ and bright non-signal reaches $73.25\%$).
  - Tagged as **Advisory** (Tier B Benchmark). Reviewers can waive with a single-line reason in `findings.json`.
  - Status: **Retained as Advisory**.

---

## 3. Flag Classification & Threshold Lineage Summary

| Rule ID | Rule Name | Tier | Threshold Source | Class | Calibration Range / Reference |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F01** | `lyric_visibility` | Tier B | `calibrated` | advisory | Example min: 90.0%, p10–p90: 92.5–100.0% |
| **F02** | `sung_word_height` | Tier B | `calibrated` | advisory | Example min: 4.8%, p10–p90: 5.2–12.4% |
| **F03** | `word_anticipation` | Tier B | `calibrated` | advisory | Example max: 0.45s, p10–p90: 0.05–0.35s |
| **F04** | `text_collision` | Tier A | `objective` | **blocking** | Hard overlap > 2.0% (same plane / scale ratio < 2.5x) |
| **F05** | `text_clipping` | Tier A | `objective` | **blocking** | Viewport edge clip > 5.0% during sung window |
| **F06** | `corner_persistence` | Tier C | `guess` | info | Uncalibrated heuristic (outer 12%×14% > 3.0s) |
| **F07** | `static_digit_persistence`| Tier C | `guess` | info | Uncalibrated heuristic (digits unchanged > 3.0s) |
| **F08** | `dead_motion` | Tier C | `guess` | info | Uncalibrated heuristic (E < 0.001 for > 0.5s) |
| **F09** | `kick_motion_response` | Tier B | `calibrated` | advisory | Example min: 1.08x, p10–p90: 1.15–2.42x |
| **F10** | `cut_during_sung_word` | Tier A | `objective` | **blocking** | Hard cut inside word sung window |
| **F11** | `bone_bloom_bright` | Tier B | `calibrated` | advisory | Example max: 73.25%, p10–p90: 0.01–8.34% |
| **F12** | `palette_off_share` | Tier B | `calibrated` | advisory | Example max: 50.02%, p10–p90: 2.91–41.53% |
| **F13** | `perf_frame_time` | Tier A | `objective` | advisory | Budget: 25.0 ms (advisory due to harness overhead) |
| **F14** | `sampler_max_spp` | Tier B | `calibrated` | advisory | Adaptive sampler reached 324 sub-frames |
| **F15** | `edge_shimmer_flicker` | Tier B | `calibrated` | advisory | Example max: 0.3515, p10–p90: 0.1013–0.2296 |
| **F16** | `unintended_blank` | Tier A | `objective` | **blocking** | Near-black/white run > 0.3s without `--allow-blank` |
