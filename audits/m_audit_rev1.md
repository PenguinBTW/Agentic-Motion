# Agentic Motion Design Toolset — Deep Codebase Audit `m_audit_rev1`

**Date:** 2026-10-05
**Scope:** `Agentic motion design toolset/` (full tree)
**Auditor:** Muse Spark (OpenCode) — 4 parallel sub-audits + manual spot-verification
**Status context (user-confirmed):** Pre-release, in active development. Instruments 05–09 in `ideas/` are **known-in-progress / not yet implemented** — not treated as release blockers in this revision, but tracked for roadmap alignment. `git` present, not at release tag.
**Method:** Read `README.md`, `tooling documentation/*.md` (engine-architecture, 01–04, visual-diagnostic-tools, current-motion-system, engine-review-and-roadmap), `docs/*.md`, `calibration/*`, `app/src/engine/*`, `app/src/main.ts`, `timeline.ts`, `scenes/demo.ts`, `app/scripts/visual/*`, `app/scripts/motion/*`, `app/scripts/render.ts`, `app/scripts/calibrate.ts`, `scripts/*`, `app/package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `git log/status/ls-files`. Spot-verified Criticals (`rig.ts:195`, `heal.ts:150-279`, `package.json`, `pixel-metrics.ts:165`).

**Inventory:** ~57 `*.ts` files. `app/src/engine/` = 29 entries (not 12). Visual impl = 4 files (`onion,godview,compare,stitch`). Motion = 6 files (`config,flags,pixel-metrics,text-analyzer,report,visuals`). Forwarders = 6 files in root `scripts/`.

---

## 0. Executive summary

Good foundation, not shippable as documented. Architecture/philosophy (instrumentation-over-grading, `Frame=f(t)` determinism, 3-tier gates, declarative DSL) is sound and determinism holds in the frame path. Implementation has ~15 Critical correctness/schema bugs, ~25 Major API/docs/robustness gaps, plus repo-hygiene debt. No secrets found. No `Math.random`/`Date.now` in frame path (seeded `sin/hash/noise1` only — verified good).

Pre-release allowance: 05–09 missing is expected. The problem is not that they are missing, but that (a) docs/`heal.ts`/roadmap claim 9 instruments as present/verified, and (b) `heal.ts` already emits repair directives for non-existent signals. Gate those behind feature-flags until implemented.

**Critical counts:** Engine 6, Visual 10, Telemetry/Calibration 5, Git-hygiene 1 (`.gitignore` uncommitted + generated artifacts committed).
**Highest ROI fixes:** rig basis math → heal patches → visual JSON schemas → pixel-math + `p10/p90` calibration → gitignore/lockfile/typecheck coverage.

---

## 1. Engine core (`app/src/engine/` + harness)

### 1.1 Critical

#### E-C1 — `app/src/engine/rig.ts:195` Copy-paste: `U[2]` uses `R0[0]` [VERIFIED]
```ts
const R: V3 = [R0[0]*cosR+U0[0]*sinR, R0[1]*cosR+U0[1]*sinR, R0[2]*cosR+U0[2]*sinR];
const U: V3 = [U0[0]*cosR-R0[0]*sinR, U0[1]*cosR-R0[1]*sinR, U0[2]*cosR-R0[0]*sinR];
//                                                                       ^^^^^ should be R0[2]
```
Effect: roll basis skewed, breaks orthonormality when `roll != 0`. Fix: `R0[2]*sinR`. Test: `R·U≈0, |R|≈|U|≈1` for random roll.

#### E-C2 — `app/src/engine/rig.ts:184-189`, `app/src/engine/camera3d.ts:121-122` Flipped `U` handedness → det `-1`
`R=up×F`, `U=F×R` gives `R×U=+F`. View rows `R,U,-F` then have det `-1` (mirror). Correct: `U=R×F` so `R×U=-F`. Affects `rig.ts:185-189`, `camera3d.ts:122`, consumed by `viewport.ts:50-54` / `rig.ts:227-232`. Fix: `U = R × F` in both. Verify with `Matrix4.determinant() > 0` + winding test.

#### E-C3 — `app/src/engine/heal.ts:164,206,260,278` Heal emits non-existent/broken patches [VERIFIED]
- `:164`: `pos: [pos.x,pos.y,pos.z-0.5]` — `pos` is `V3` array, `.x` is `undefined` → `NaN`. Should be `pos[2]-0.5`.
- `:206`: `particles.speed=0.5; lines.opacity=0.25` — `AnalyticalParticles` has no `.speed`, `LineBatch` has no `.opacity`.
- `:260` (+`:224` variant): `node.setMargins(...)` / `node.pin`/`node.margin` — `LayoutNode` has `setPin(pin,margin)`, no `setMargins`/`pin` property. Should be `node.setPin('top-center',{top:64})`.
- `:278`: `ease.inQuad(...)` with undefined `lt`/`t`.
Fix: correct to real APIs. Add test that every `recommended_patch` parses and references real APIs. Until then, agents applying `findings.json` get `NaN`/`TypeError`.

#### E-C4 — `app/src/engine/text.ts:253-260` vs `357-360` Telemetry dedup guard contradicts itself
`render()` calls `syncTelemetry` only when `!P.probe`, but `syncTelemetry` early-returns unless `P.probe && P.recordText`. Direct emission can never fire in browser. Fix: single owner — e.g. `render` calls `syncTelemetry` when `P.probe && P.recordText && !P.hookActive`, guard should not require `P.probe` when called as fallback. Test with mock `__pdoom`.

#### E-C5 — `app/src/engine/camera3d.ts:121` No singular-safe fallback
`camFromKey` does `R0=vnorm(up×F)` with no `|F.y|>0.99` guard. Looking straight down → `cross=0` → `vnorm([0,0,0])=[0,0,0]` → zero basis → `proj`/`clipSeg` `NaN`. `rig.ts:173` has fallback to `[0,0,±1]`; copy it. Test `Fw=[0,±1,0]`.

#### E-C6 — `app/src/engine/engine.ts:218`, `app/src/engine/util.ts:11-18,51,59` Zero-division → `NaN` camera
Zero-duration timeline: `p=(t-start)/0=NaN`; `clamp(NaN)` returns `NaN` (`NaN<a` false, `NaN>b` false); `spline.getPointAt(NaN)` poisons rig. `smoothstep/smootherstep/prog/springStep/keys` all divide by `(b-a)` / `sqrt(1-d²)` without guard. Fix: guard `e.end>e.start else p=0`; guard `a===b`; guard `damping>=1` in `springStep`.

### 1.2 Major — API mismatches vs `engine-architecture.md`

- **E-M7 `sdf.ts:277,327,364,399,434`:** Docs Module 4 claim `rect(...):this; shadow(...):this; ring(...):this; reticle(...):this`. Code is `void`. Chainable `ctx.sdf.rect(...).rect(...)` fails to typecheck. Fix docs or return `this`.
- **E-M8 `transform.ts:171,220`:** Docs claim `pinToViewport(pin,margins?,w?,h?)` + `pinToWorldVertex(...)`. Code: `setPin(pin,margin)` + `resolveLayout(w,h)` + `pinToWorldVertex(...,{...,occlusionCull?})`. Agent code from docs throws `TypeError`. Add alias or fix docs; document `occlusionCull`.
- **E-M9 `graph.ts:14-27,153-196`:** `post?:ScopedPostOpts` accepted but ignored in `evaluate()`. "Scoped post isolation" dead API. Implement or remove.
- **E-M10 `dsl.ts:259-264,303-316`:** `duration` in `DeclarativeSceneDef` dead; `timeline.ts:23,32` drives `end` from `driver.duration`. Agent tuning `duration` has no effect. Use/warn/remove.
- **E-M11 `tokens.ts:20-22` vs `palette.ts:20-29`:** "Dynamic Proxies in real-time" false for GPU. `LIN`/`rgba()` proxy live for CPU, but `glsl/common.ts:18-26` bakes `v3(LIN.*)` at import into `GLSL_COMMON`. `setDesignTokens()` after import never updates `C_BONE` etc. in `post.ts`/`gl.ts`. Rebuild materials on change or document restart-required.
- **E-M12 Docs "9 instruments / 12 modules 100% VERIFIED, 53 tests 0 errors":** `README.md:63`, `heal.ts:2`, `engine-architecture.md:290,470` claim 9 instruments; only 4 exist. Heal handles `curves,saliency,legibility,rhythm,framing` (ideas 05–09, unimplemented — known in-progress per user, so downgrade claim to "4 implemented + 5 proposed" and gate heal cases). `53 tests 0 errors / tsc/vite 0 errors` contradicted by `letterSpacing` compat, `setMargins`, `pos.x` findings and by `tsconfig` gaps (§4).
- **E-M13 `particles.ts:129,287-297`:** `seed` ignored (hashes fixed `sin/cos`); `updateBounds` uses `speed*lifetime+1` ignoring `0.5*g*t²` + turbulence; `mesh.frustumCulled=false` makes bounds dead, contradicting "Analytical Bounding Volumes for clean frustum culling". Seed hashes, include gravity/turbulence or enable culling + test.
- **E-M14 `particles.ts:209-211`:** Per-emitter `gravity` overwrites shared `uniforms.gravity`; second `addEmitter({gravity})` retroactively changes first emitter trajectories (breaks setup-order stability). Per-particle attribute or document single-gravity + warn.

### 1.3 Major — Logic / robustness / perf

- **E-M15 `transform.ts:76-97`:** `addChild` never checks `child===this` or ancestor → cycle → infinite recursion in `updateMatrix()`. Walk parents, throw on cycle.
- **E-M16 `transform.ts:148-154`:** `getPivotWorldPosition()` ignores anchor/size/rotation (returns parent-transformed `position` only). Should apply full `worldMatrix` to pivot. Decide semantics + test.
- **E-M17 `scenegraph.ts:99-115`:** Partial near-plane clip underestimates bounds (only visible corners contribute; straddling box shrinks → missed F04/F05). Clip edges to near plane like `clipSeg`.
- **E-M18 `scenegraph.ts:174-189`:** Fabricated telemetry `fillStyle:'#FFFFFF', fontFamily:'Archivo, sans-serif'` for every entity, ignoring `KineticText.style`. Palette audit F12 false-positive/negative. Store real style in `EntityMetadata`.
- **E-M19 `text.ts:98-112,258-262`:** `0.55*fontSize` bounds + char-count wrap ignore `measureText`/`letterSpacing`/weight. Mis-wrap/mis-collide vs probe `measureText` path in `main.ts:54-76`. Use `measureText` (or `type.ts:layout`).
- **E-M20 `text.ts:311-329,234-242`:** `stagger()` sets `x=0,y=0,width=0` for all units; `render()` draws every token at `(x,y+offsetY)` (overlap). `scale-pop` computes `scale` but never applies it. Compute per-unit advances + `ctx.translate/scale`, or remove.
- **E-M21 `graph.ts:133-136`:** `renderer.clear()` without explicit color → opaque background risk for alpha delivery (webm-alpha, prores-4444). Use `clearRT(r,rt,[0,0,0],0)` consistently.
- **E-M22+ (truncated in sub-audit, preserved intent):** `engine.ts:94,156,162` still `await AudioData.load()/Lyrics.load()` — verify no-crash when `app/public/data/*.json` missing; `hud.ts:89-132`/`main.ts:19,116,209` still `PDoom`/`__pdoom` single-project leftovers vs generic toolset claim.

### 1.4 Verified good
- Determinism `Frame=f(t)`: no `Math.random`/`Date.now` in frame path; seeded `sin/hash/noise1` only. Preview `performance.now` wall-clock is playback-only (acceptable).
- `alpha:true` fixed, `resetState()` present in `sdf.ts:486,lines.ts:148,particles.ts:312,graph.ts:198,dsl.ts:288`, `fonts.ready` in `dsl.ts:332,type.ts:68`.

---

## 2. Visual diagnostic instruments (`app/scripts/visual/`, `app/scripts/render.ts`, `scripts/`)

Refs: `tooling documentation/01-04`, `visual-diagnostic-tools.md`, `README.md §2/§5`, `test_milestone*.ts`.

### 2.1 Critical

#### V-C1 Documented CLI `bun scripts/visual/*.ts` does not exist
Docs `01:93,96,99`, `02:94,97`, `03:93`, `04:98`, headers `:5` advertise `bun scripts/visual/<tool>.ts`. No `scripts/visual/` dir exists. Real entrypoints: `bun scripts/<tool>.ts` (forwarder, `cwd=app`) or `bun scripts/render.ts <tool>`. Every `scripts/visual/` example fails `ENOENT`. Fix: replace with `bun scripts/*.ts`; keep `app/scripts/visual/*.ts` as "Source Implementation" only.

#### V-C2 `onion_summary.json` schema ≠ docs (`onion.ts:212-223` vs `02:59-69`)
Docs: `{scene, center_t, window_seconds, from, to, frame_count, timestamps[]}`. Code: `{from, to, center_t, frames, total_centroid_travel_px, inter_frame_spacings_px, continuity}`. Fix: add `scene`, `window_seconds: to-from`, `frame_count`, `timestamps`; keep extras as additive.

#### V-C3 `godview_summary.json` schema ≠ docs (`godview.ts:324-336` vs `01:50-71`)
Docs: `{scene, from, to, duration, sample_count, max_speed_mps, avg_speed_mps, min_near_distance_m, samples[...]}`. Code: `{from, to, total_travel_z_m, max_speed_m_s, min_speed_m_s, camera_min_clearance_wall_m, camera_y_range_m, status}`. Naming (`_mps` vs `_m_s`), missing `scene/duration/samples[]`. Breaks `01:78-80` `min_near_distance < 0.15m` workflow. Fix: align to doc schema; include collected `samples[{t,x,y,z,fx,fy,fz,v}]`.

#### V-C4 `stitch_summary.json` schema ≠ docs (`stitch.ts:172-178` vs `04:61-73`)
Docs: `{cut_timestamp, from_scene, to_scene, window_ms, sample_frames, artifacts[]}`. Code: `{cut_t, exit_t, entry_t, strip_frames, status}`. Fix: emit `{cut_timestamp:tB, from_scene, to_scene, window_ms, sample_frames, artifacts:[...], exit_t, entry_t}`.

#### V-C5 `compare` filename + schema 3-way mismatch (`compare.ts:217-235`)
Code writes `ab_comparison.json`. README + `03:6,70` say `compare_summary.json`. Master doc `:190` says `ab_comparison.json`. Docs self-contradictory. Content: docs promise `{active_scene, active_t, ref_scene, ref_t, resolution:[1920,1080], artifacts[]}`; code emits `{..., status, limits}` — no `resolution`/`artifacts`. Fix: standardize on `compare_summary.json` (+ back-compat write), add missing keys.

#### V-C6 `ab_side_by_side.png` not 3840×1080 (`compare.ts:120-142` vs `03:21`)
Docs: "3840×1080 composite, Left 1920 + Right 1920". Code: 1920×1080 canvas, `panelW=954, panelH=536` (quarter-res downscale). Defeats 1px-hairline audit (`03:77-83`). Fix canvas to 3840 or update docs to thumbnail intent.

#### V-C7 `--scene` dead (onion); `--from-scene`/`--window` dead (stitch)
`onion.ts:19-49` parses `scene`, never reads it (no timeline lookup, no `&only=`). `stitch.ts:17-44` parses `window`/`fromScene`, never uses except log (strip ±5 frames hardcoded `:51-60`; only `toScene` participates `:39-42`; `--from-scene`-only silently falls back to `25.60s`). Fix: onion resolves `scene→from/to` like `godview.ts:37-50` when `from/to` absent; stitch honors `window`, resolves `fromScene.end` when `toScene` absent.

#### V-C8 `godview` hard-coded doors/corridor (`godview.ts:92-97,175-196,272-286`)
Fallback curve `z=-2.2+u²*48`, walls `±1.8m`, doors every `2.2m`, ceiling `2.2m`, `maxZ=50` baked in. Claimed generic "product turntable / UI explode". Fix: derive bounds from samples + `SceneGraph`; gate corridor overlay behind `scene==doors*` or `--corridor`.

#### V-C9 `chromium.launch({channel:'chrome'})` no fallback (`render.ts:74-79`, `compare.ts:82`, `calibrate.ts:110-120`)
Requires installed Google Chrome; clean CI with only bundled Chromium throws, `render.ts:openPage` has no try/catch. Fix: try `channel:'chrome'`, catch → retry without, log executable.

#### V-C10 `compare.ts:111-117` hangs forever on bad base64
`await new Promise(res=>{imgA.onload...})` never rejects. Corrupt `__pdoom.png()` hangs dispatcher. Fix: `onerror→reject` + timeout guard.

### 2.2 Major

- **V-M1 Arg parser consumes next flag as value; no NaN/range validation** (`onion.ts:19-32`, `godview.ts:17-28`, `compare.ts:17-29`, `stitch.ts:17-28`, `render.ts:47-48`). `--out --t 5` → `out='--t'`; `parseFloat('--to')→NaN` → `toFixed` throw or `times[0]!` crash; `frames=0/1/NaN`, `samples=0/-5` → `Math.max(...[])` = `-Infinity`. Fix: guard `!startsWith('--')`, validate `Number.isFinite`, clamp `frames 2..32`, `samples 2..128`, exit with usage.
- **V-M2 Partial `--from`/`--to` ignored (onion); godview overwrites explicit bounds.** `onion.ts:41-49` requires both else falls back to `t/window` (discards single-sided `--from 8.2`). `godview.ts:37-50` overwrites explicit side from scene match. Fix: honor single-sided + explicit-wins precedence.
- **V-M3 Compare silent fallback poisons results (`compare.ts:98-101`).** On missing server/ref, `refBase64=activeBase64` → identical-image side-by-side labeled `[ACTIVE] vs [EXAMPLE BENCHMARK]` ("perfect match", vacuous). Fix: placeholder panel + `status:'reference_unavailable'` + non-zero exit or `--allow-fallback`.
- **V-M4 Ref Vite proc leaked (`compare.ts:63-94`).** `refProc` spawned `:68`; if `alive` false, `kill()` inside `if(alive)` skipped → orphan `vite --port 5189`. Fix `try/finally kill`.
- **V-M5 `--out ../out/...` cwd-dependent; dispatcher vs forwarder diverge.** Visual defaults `path.resolve(opts.out ?? path.join(process.cwd(),'../out/...'))` (`onion.ts:51`, `godview.ts:52`, `compare.ts:48`, `stitch.ts:46`). Forwarders `cwd=app` → `<toolset>/out`; `bun app/scripts/render.ts` from root → `<parent>/out`. `motion` correctly uses `ROOT` (`render.ts:239`). Fix: resolve defaults against `import.meta.dir`/`ROOT`, `mkdir -p`, document cwd.
- **V-M6 Stitch labels off-by-one (`stitch.ts:57-60,153-156`).** `stripTimes=[cut-5dt..cut+4dt]`; label `N${i<5?i-5:'+'+(i-4)}` gives index5 (`t=cut`, should be `N`) as `N+1`. Fix `' + '+(i-5)` for `i>=5`.
- **V-M7 `render.ts:sheet():131-152` ignores async + `SAMPLES`/shutter.** `times.forEach(t=>{P.still(t)...})` with defaults; if `engine.render` ever async, captures stale frames. Fix `for...of` + pass `SAMPLES/shutter`.
- **V-M8 Visual tools ignore `--only`/`--scale`.** Dispatcher boots full timeline (no `&only=`); `--scale>1` breaks fixed 1920×1080 in-page canvases (`onion.ts:66-67`, `stitch.ts:69-70`, `godview.ts:60-61`, `compare.ts:106-107`). Map `--scene→only` or document cost; respect `P.width/height`.
- **V-M9 Zero visual-tool coverage.** M1–M4 assert engine units only; no imports of `visual/*`, no CLI/parser/dispatcher/artifact tests. `test_milestone4.ts:328-355` exercises `AgentHeal` names but never invokes instruments. Green suite says nothing about this surface. Add `test_visual_tools.ts` (parser units, JSON-schema, label math, `--out` regression).

### 2.3 Minor
- **V-N1** Tint alphas ≠ docs; `continuity: max<150 ? continuous` hardcoded/undocumented (`onion.ts:122-151,221`).
- **V-N2** `mkdirSync` on file path throws `EEXIST`; `Bun.write` silent overwrite (all four tools `:47-52`). Check `stat`, log overwrites.
- **V-N3** Unbounded `--out` (path traversal by design). Warn if escapes `ROOT`; CI allowlist `<root>/out/`.
- **V-N4** Godview palette ≠ docs (3-band `#00D2FF/#EEE9DF/#FF4D12` vs documented 4-band indigo/bone/orange/vermilion); `toScreenX` not centered (`godview.ts:149-150,205-209` vs `01:42-46`).
- **V-N5** Compare tag `fillText(...,W-320,...)` truncates long IDs (`:195`). Right-align via `measureText`.
- **V-N6** Dead `await P.still` (sync `main.ts:131`) + missing `fonts.ready` gate before capture. Add `await document.fonts.ready` for visual modes.
- **V-N7** Forwarders `Bun.spawn([process.execPath,target,...])` assumes bun; breaks under node/tsx; no flag passthrough. Document "must run with bun" + guard.

### 2.4 Verified CLI table (per code)
| Doc example | Verdict |
|---|---|
| `README §5.1 onion --scene modal_reveal --t 2.40 --frames 12` | Runs but `--scene` ignored for windowing |
| `README §5.2 godview --scene product_turntable --from 4.0 --to 12.0` | Runs but corridor overlay wrong |
| `README §5.3 compare --scene dashboard_hud --t 5.20 --ref figma_keyframe` | Runs but missing ref → silent identical fallback |
| `README §5.4 stitch --from-scene macro_shot --to-scene wide_reveal --t 6.40` | Runs, `from-scene` ignored (`--t` wins) |
| `01:93 render.ts godview --scene product_reveal` | Runs if in timeline else silent `8.00–18.50` fallback |
| `01:96, 02:94,97, 03:93, 04:98` `bun scripts/visual/*.ts` | FAIL — path does not exist |
| `visual-diagnostic-tools.md` `bun scripts/*.ts` / `bun scripts/render.ts *` | Correct forms (subject to M1–M5) |

---

## 3. Calibrated motion telemetry (`app/scripts/motion/`, `calibrate.ts`, `calibration/`)

Refs: `current-motion-system.md`, `motion-report.md`, `calibration-notes.md`, `director-notes.md`.

Tier catalogue `config.ts:120-265` matches F01–F16 / Tier A/B/C philosophy. Math and calibration wiring do not.

### 3.1 Incorrect math
- **T-A1 `pixel-metrics.ts:165` CRITICAL — Contrast is stddev, spec says Michelson.** Spec `current-motion-system.md:159-161`: `C=(Lp99-Lp01)/(Lp99+Lp01+eps)`. Code: `sqrt(var)` [VERIFIED]. Calibration `contrastMean p50 0.12/max 0.23` is stddev range (Michelson ~0.9). Fix one side + recalibrate. F16 `contrast<0.02` assumes stddev.
- **T-A2 `pixel-metrics.ts:180` CRITICAL — `edgeDensity` is mean magnitude, not `% G>0.12`.** Spec §E: `% pixels where G>0.12`. Code sums `mag` with no threshold; 1px border stays `0` but in denominator (~0.8% bias). Fix: `count+= mag>0.12?1:0`.
- **T-A3 `pixel-metrics.ts:397` HIGH — FFT sign vs spec + invalid on flat frames.** Spec `R=F1*conj(F2)`; code `F2*conj(F1)` (code convention actually correct for `+dx` flow — spec has sign error). No guard for blank frames (`mag~1e-9` → random peak). `example.json:flowDxMean min -419/max +1583` is noise. Fix spec sign + `if(contrast<0.01) return {flow:0,invalid:true}`; ignore for `shake_px` in `render.ts:511` when invalid.
- **T-A4 `pixel-metrics.ts:249` HIGH — Palette 4x subsample + hardcoded ΔE.** Loops `y+=2,x+=2` (16k vs 129k px); docs claim full-frame. `minDe>12.0` hardcodes `CONFIG.palette_delta_e_threshold` (`:262,282`). Pass threshold param; document `step=2` or flag.
- **T-A5 `pixel-metrics.ts:461` MEDIUM — Shimmer gate `0.15` vs edge spec `0.12`.** `computeShimmer(threshold=0.15)` vs spec `0.12`; conflated with `CONFIG.shimmer_threshold:0.025` (flag threshold). Unify `EDGE_TH=0.12` vs `SHIMMER_FLAG_TH`.
- Verified correct: `pixel-metrics.ts:45,72,122` Rec.709 luma, `rgbToLab` D65 + ΔE76, `downscaleFrame.ts:80` Y-flip.

### 3.2 Calibration use vs hardcoded thresholds (philosophy violation)
README: "calibrated against `min,p10,p50,p90,max`". Code uses only `min`/`max`, never `p10/p90`, no fallback.
- **T-B1 `flags.ts:112,133,153` CRITICAL — F01/F02/F03 dead when `n=0`.** `example.json:121-145` lyric keys all `n:0`. Code `cal?min:null → silent skip`. `CONFIG.lyric_min_visible_pct:90.0` etc. dead. Docs `calibration-notes.md:71-73` claim `min 90%/4.8%/max 0.45s` — contradicts shipped JSON. Fix: fallback to `CONFIG` with `calibrated=false` + `no reference`, or ship real lyric calibration; fail generation if `n==0`.
- **T-B2 `flags.ts:318` HIGH — F09 `min:0.029` absurd, `CONFIG 1.15` ignored.** `example.json:106-113` `kickResponseRatioMedian min 0.029,p10 0.87,p50 1.63,max 160` vs docs `min 1.08,p10-p90 1.15-2.42`. `thresh=min` almost never fires. Use `p10`.
- **T-B3 `flags.ts:361,407,523` HIGH — F11/F12/F15 use `max` = worst reference.** `brightNonsignalPct max 73.25%`, `otherPct max 50.02%`, `shimmer max 0.3515` — only fires if worse than worst approved plate. `CONFIG` values dead. Use `p90` (`F11 p90 8.33%`, `F12 p90 41.5%`, `F15 p90 0.229`), keep `max` as evidence context.
- **T-B4 `flags.ts:484` HIGH — F14 wrong value + `>` vs `>=`.** Reports terminating-frame `spp` (e.g. `1`) when run was `4,4,4`; hardcodes `CONFIG.sampler_max_spp` 324 in trailing branch; `spp==324` wouldn't fire if `max 324`. Track `maxSpp`, use `>=`.
- **T-B5 `flags.ts:449` MEDIUM — F13 always fires.** `example.json:146-169 perfP50 min 42.9ms` > `CONFIG.perf_max_frame_ms:25.0`. Every headless run flags (by-design advisory per `calibration-notes.md:2.3`, but CI counting `tier_a_objective` will block). Gate CI on `class==blocking`, not `tier`; consider calibrated threshold.

Tier severity nit: `flags.ts:326,117` — F11/F12/F14/F15 `warn`, F09 `info`, F01 conditional — all `class:advisory`. Standardize Tier B → `warn`. No tier misclassification in `config.ts` itself (F04/F05/F10/F16 `blocking/tier_a`, F13 `advisory/tier_a` documented exception).

### 3.3 Off-by-one / frame assumptions
- **T-D1 `text-analyzer.ts:243` HIGH — Hardcoded 60fps, off-by-one, >100%.** `round(t*60)`, `total=max(1,end-start)` missing `+1` inclusive, no clamp, multi-`fillText`/shadow double-counts. At `--fps 30` denominator 2x large → false F01. Fix: pass `fps`, `total=round((end-start)*fps)+1`, `clamp(0,100)`.
- **T-D2 `text-analyzer.ts:323,86` MEDIUM — Collision merge fragile.** `|Δt|<=1/30` assumes 30fps; `pairName` order-dependent (sorted by `cy,cx`) splits one collision. Sort pair names, tolerance `1.5/fps`.
- **T-D3 `text-analyzer.ts:86,61` MEDIUM — Run split on single missing frame.** Requires `fIdx===last+1 && dist<200px`. One dropped/alpha-0 probe splits run → breaks `dur`/`cornerRuns`/lyric join. Allow gap `<=2` or document.
- **T-D4 `render.ts:305,424` MEDIUM — Window end exclusive.** `total=round(to*fps)-round(from*fps)`, `curT=from+i/fps` → last `to-1/fps`. Cut at `to` gets `cutIdx==count → diff 0/soft`. Bins `f.t<t1` drop `t==to`. Fix last bin `<=t1`, allow backward look.

### 3.4 Empty-window Div0
- **T-E1 `flags.ts:295,387,431,469,507,548,597` + `report.ts:365,505` HIGH.** `frames[len-1]!.t` throws when `from==to`; `reduce/len → NaN` → `summary.json null`; `Math.max(...[])` → `NaN` (`report.ts:508`). Early return on empty + `??0` guards.

### 3.5 CSV/JSON schema
- **T-F1 `report.ts:554` HIGH — `frames.csv` drops `other_pct`.** Header lacks `other_pct` though F12 flags on it. Not reproducible. `events/<label>.csv:573` extra `dt_to_event` → drift. Add `other_pct` (+ optional `palette_shares`).
- **T-F2 `report.ts:54,73` HIGH — `findings.json` evidence never links.** `ev.name.includes(f.id)` never matches `strip_*.png`; `includes(f.t0.toFixed(2))` fragile (`1.20` matches `11.20`). Most findings `evidenceFiles:[]`. Link by time proximity `|ev.t-f.t0|<0.5` + always include `timeline/slitscan` for Tier A.
- **T-F3 `report.ts:391` HIGH — Compare shows `above range` when `n=0`.** `if(dist)` no `n>0` check → `cutRatePerSec {n:0}`, `textMaxSizeRatioMedian {n:0}` false-positive. `flags.ts` correctly checks `n>0`. Add check.
- **T-F4 `report.ts:255,283` MEDIUM — Hardcoded run/slot + dead/blank thresholds diverge.** `distinct_strings_in_slot:1` hardcoded; lyric match `toLowerCase` not `normalizeText` (misses `Hello,` → double F05); static/dead hardcode `0.001/0.5/0.3` not `CONFIG.eps_energy/dead_motion_s/blank_max_run_s`. Use `CONFIG` + `normalizeText`.
- **T-F5 `report.ts:486,148` MEDIUM — `summary.json` duplication + truncation.** Contains both `flags[]` and `findings[]`; palette/bins slice `topN` (12 bins = 3s) loses long windows; `nTexts` counts lyric `words` only → 0 on non-lyric. Dedupe, note truncation, count `runs`.

### 3.6 Audio-sync (non-lyric)
- **T-G1 `render.ts:449,504` MEDIUM — `Infinity` downbeat + `ratio` inconsistency.** `nearestDownbeatDelta` init `0`, `downbeats:[]` → `minD=Infinity` → `cutsTable Infinity`. `hits ratio=E_peak/max(E_base,eps)` vs `calibrate.ts:336 base>0.0001?peak/base:1.0` — same kick scores differently. Fix: `null` when no beats; unify fallback; require `minBaseFrames>=3`. Lyric gating safe-by-empty, but leftover `lyrics.json` in commercial repo re-enables lyric flags — add explicit `--lyrics` opt or `skipped: no-lyrics` log.

### 3.7 Waivers missing
- **T-H1 `flags.ts:76` + `report.ts:73,619` HIGH.** All `waived:false,null`. No CLI, no loader, `render.ts:655` overwrites each run. Docs promise "1-line waiver, never loop on advisory" with no schema. Add `--waive F11:reason`, load+preserve priors, CI ignores `waived`.

### 3.8 Calibration file + generator
- **T-I1 `calibration/example.json` HIGH — Invalid as shipped.** Lyric keys + `textMaxSizeRatioMedian` + `cutRatePerSec` `n=0`. `textMaxSizeRatioMedian` never pushed unless `words>1`; `cutRatePerSec` never pushed (`calibrate.ts:97` zero pushes). Contradicts `calibration-notes.md:71-81` (only F11/F12/F15 match). Regenerate with lyrics, push `cutRate`, fail if required `n==0`.
- **T-I2 `calibrate.ts:31,359` HIGH — Wrong fps + synthetic perf.** `FPS 30` vs audit `60` → `E` incomparable. `perfP50=avg*0.9,p95=avg*1.2,max=avg*1.5` fabricated. Calibrate at 60, measure per-frame distribution.
- **T-J Visuals/report nits:** `visuals.ts:42` `Max Text h% max 20.0` clips large titles; `(f as any).max_text_h` in `render.ts:415` via `frameIdx===n` assumes window-relative idx — verify `t`-join. `visuals.ts:354` `tileTimes=clamp(eventT+dt)` duplicates edge tiles. `visuals.ts:382` `P.still(item.t)` omits `samples/shutter`. `flags.ts:566` F16 `blankKind` never updated mid-run; `allowBlank` requires full containment. `flags.ts:268` F08 discards in-progress dead run on flash entry. `config.ts:278` `loadCalibrationData` only checks `app/calibration/example.json` + cwd variants; `calibrate.ts:395` dual-writes `calibration/` + `app/calibration/` (latter untracked) — resolve to repo root.

---

## 4. Docs, repo health, cross-cutting

### 4.1 Version claims
- `engine-review-and-roadmap.md:4,8,71` — header `v2.4.0` but diagram `v2.2.0`.
- `README.md:34,147` + `engine-architecture.md:1,12` + `tooling documentation/README.md:44` — `v2.4.0` everywhere, no source of truth (no `version` in `package.json:1-20` [VERIFIED], no git tag; `git log`: `6536349,780782f,2dbf812…`).
- `engine-architecture.md:44-65` vs `README.md:40-54` — 12 vs 17 modules; actual 29 entries incl. `audio,camera3d,hud,lyrics,palette,scale,scene,stroke,util,type,glsl/`. Count `12` false — update to real module list or define "12 operational" explicitly.
- `engine-review-and-roadmap.md:108-132` vs `engine-architecture.md:73-81` — `CameraRig` API mismatch (`mode/waypoint/orbit/lens/track/shake/evaluate` vs `setLensMm/setPath/evalPath/evalCam/syncToThreeCamera/addTrauma`).
- `engine-review-and-roadmap.md:467-479` vs `engine-architecture.md:325-337` — `defineScene` mismatch; example `349-350` imports `Frame from '../engine/scene'` + `ease from '../engine/util'` — neither export verified.
- `tooling documentation/README.md:56` vs `heal.ts:1-4` — `AgentDirectorLoop & agent-heal` vs file `heal.ts` class `AgentHeal`. No `agent-heal.ts`.
- "9 instruments implemented" false (`engine-review-and-roadmap.md:46`, `README.md:63`, `engine-architecture.md:290,303-313`). Only 4 exist; 05–09 are ideas (known in-progress — see §0). Action for rev1: reword to "4 implemented + 5 proposed (in progress)" and feature-gate heal cases; do not treat as prod blocker.
- `README.md:92,160` duplicate `## 5.`; `tooling documentation/README.md:44,59` duplicate `### 4.`

### 4.2 Links, trees, renames
- `engine-architecture.md:32,37,69,89,113,133,153,178,196,217,236,257,285,289,321` — 15x `file:///c:/Users/brosf/...` absolute links. Replace with relative `../app/src/engine/*.ts`.
- `01:5,02:5,03:5,04:5,98` — wrong `bun scripts/visual/*.ts` (see V-C1).
- Output filename 3-way mismatch (see V-C5).
- `README.md:95-156` tree ≠ filesystem: omits `motion/visuals.ts`, 15+ engine files, `glsl/`, `vite.config.ts`, `package.json`, `index.html`, `public/`, `dist/`, `out/`, `song/`, `.gitignore`. `scripts/` (6), `calibration/`, `ideas/`, `docs/`, `tooling documentation/` (9) correct.
- `app/scripts/render.ts:89,698-699` + `engine-review-and-roadmap.md:54` — dangling `plates.json`/`analysis/` refs (`APP/../analysis/plates.json`, `APP/plates.json`, `public/plates`, header `:5`). None exist. `timeline.ts` "imports missing `plates.json`" still true.
- `app/public/audio:0 entries` vs `render.ts:159` (`ROOT/audio/whos-holding-on-to-who.mp3`), `main.ts:209` (`audio/pdoom.mp3`). `app/index.html:6` + `dist/index.html:6` titled `Who's Holding On to Who` — single-project leftover. `video` silently drops audio (`hasAudio` false).
- `ideas/08:70` — dangling `../data/sfx_cues.json` (only `app/public/data/{audio,lyrics}.json` exist).
- `song/:0 entries` — dead dir, no code refs. Data lives in `app/public/data/`. Delete or document. `director-notes.md:11-22` Sequences A–C (`0–45s` arch/terrain/hero) don't match single `demo.ts`.
- `README.md:23,147` `%20` encoded links fragile on Windows checkout; prefer rename to `tooling-documentation/` or quote.
- `calibrate.ts:392,396` dual-write `calibration/` (tracked) + `app/calibration/` (untracked stray).

### 4.3 Commands referencing non-existent scripts
- `ideas/05:63,66,69`, `06:56,59,62`, `07:57,60,63`, `08:64,67,70`, `09:62,65,68`, `ideas/README.md:28-32` — `bun scripts/{curves,saliency,legibility,rhythm,framing}.ts` do not exist (expected pre-release; fix docs to mark "proposed — not yet runnable" instead of copy-pasteable commands).
- `render.ts:735-746` — dispatcher has no 05–09 branches; falls through silently. Add usage error.
- `--scene/--from-scene/--to-scene` label-only (see V-C7). Docs examples (`README:165,171,177,183`) render wrong scene unless `--only` also passed.
- `engine-architecture.md:458-467,470` — wrong test invocation (`bun scripts/test_milestone1.ts`; real `app/scripts/test_milestone1.ts`, no root forwarders). `bun x tsc/vite` needs network; `typescript` is peerDep (see §4.4). Use `bun --cwd app run …` or `bunx` with local bins.
- `render.ts:68`, `calibrate.ts:46`, `compare.ts:68` — `Bun.spawn([execPath,'x','vite'…])` fragile (ad-hoc `vite@^8.3.0` drift, offline fail). Use local `node_modules/.bin/vite` pinned. Same for `channel:'chrome'` (see V-C9).
- Stale Example-project defaults: `compare.ts:42-45` (`boundary@27.50 vs loss@14.20`), `godview.ts:48-49` (`8.00–18.50`), `stitch.ts:43` (`25.60`), `onion.ts:45` (`t=10.0`). Current `demo.ts` single scene; `README:73,189` `--only hero_reveal`, `--scene modal_reveal/product_turntable/dashboard_hud` match nothing.
- Two `out/` roots, cwd-dependent (see V-M5). Tracked outputs are `app/out/test_motion/…`; `README:165` `--out ../out/visual/…` ambiguous.
- `motion-report.md:10`, `current-motion-system.md:43` correctly use `--only`; visual docs use `--scene`. Users mix them.

### 4.4 Config / packaging [package.json VERIFIED]
```json
{ "devDependencies": { "@types/bun": "latest", "vite": "^8.3.0", "playwright-core": "^1.63.0" }, "peerDependencies": { "typescript": "^7.0.2" } }
```
- No `scripts` (test/build/dev/typecheck). `typescript:^7.0.2` peer (not installed by default; TS 7 future). `vite:^8.3.0` future major, `@types/bun:latest` unbounded, `playwright-core` without browsers. No lockfile in `git ls-files` (100 files, no lock) → non-reproducible. `module:index.ts` Bun-only; `vite build`/`tsc` via `bun x` ad-hoc.
- `tsconfig.json:18` `include:["src"]` excludes `app/scripts/` (all logic). `tsconfig.scripts.json:1-4` covers `app/scripts/` only, drops `vite/client`. Root `scripts/*` covered by neither (no root tsconfig). Documented `bun x tsc --noEmit` checks ~half the code.
- `index.html:34` + `dist/index.html:9` + `vite.config.ts:1-12` — absolute `/src/main.ts`, `/assets/…` break subpath deploy; `import.meta.dirname` needs Node 20.11+/Bun (no `engines` field); `assetsInlineLimit:0` + `outDir:dist` → bloat (see §4.5).
- `.gitignore:1-31` (untracked) — line 31 `*.gitgnore` typo; no `**/out/` → `app/out/` committed; lines 18–19 `**/font/,**/fonts/` ignore `app/public/fonts/*.ttf` (34 files locally, zero in `git ls-files`) → fresh clone lacks fonts, `fonts.ready` gate (`dsl.ts:332-334`, `type.ts:68`) stalls. No `.env.example` despite line 24.
- `app/public/`: `data/{audio.json,lyrics.json}` tracked (good); `audio/` empty (§4.2); `fonts/src/,stroke/` locally present but ignored.
- `app/dist/` correctly not committed (`check-ignore → .gitignore:5:**/dist/`), but since `.gitignore` itself is `??`, collaborators will commit `dist/`. Do not commit `dist/`.
- `engine.ts:94,156,162` still `await AudioData.load()/Lyrics.load()` — verify no-crash when JSON missing.

### 4.5 Git health
`log --oneline -20`: `6536349 document rework … / 780782f Engine rework v0.5 / 2dbf812 v0.3 / 553d57b v0.2 / 8ce96fc v0.1 / 8b3fa39 …` (9 commits). `main` up to date. `status`: `?? .gitignore` only (dist/out/node_modules hidden locally by untracked gitignore). `ls-files`: 100 files, no lock, no `.gitignore`, no `song/*`, no `dist/*`, no `fonts/*`.
- CRITICAL: `.gitignore` never committed. `git add .gitignore` + add `**/out/`.
- MAJOR: Generated artifacts committed: `app/out/test_motion/{report.md,findings.json,frames.csv,text.csv,events.json,summary.json,timeline.png,slitscan.png,strip_*.png,…}` (14 files), `app/out/test_stills/f_000*.png`, `test_m2/`, `test_samples/` (added `8ce96fc`). `report.md:4` hardcodes motion command, `:172-179` leak `file:///C:/Users/brosf/…`. `git rm -r --cached app/out/`.
- MINOR: Fonts (~30 `.ttf`) + `node_modules/` local-only; fresh `bun install` + font-download step undocumented. `dist/assets/*.js` local-only (correct, keep ignored).
- Secrets: grep `sk-|API_KEY|SECRET|BEGIN .*PRIVATE KEY|ghp_|xox|AKIA` in `*.{ts,json,md}` → zero hits. Only leak is username path in committed `report.md`.

### 4.6 Cross-cutting: paths, OS, runtime
- `compare.ts:58`, `calibrate.ts:28` — hard sibling `Example project/app` with space. Repo absent → `compare` self-benchmark mislabeled `benchmarked` (`:229`); `calibrate:39-42` exits 1. Space breaks naive quoting; document where to clone or remove fallback.
- `visual/*.ts:48-52` + `render.ts:239` — `process.cwd()` + `path.join('../out')` invoker-dependent (44 `path.join` hits, zero `+ "/"` — join usage good, base wrong). Use `path.resolve(import.meta.dir,'../../out/…')` or `ROOT`. `render.ts:159` `path.join(ROOT,'audio/…')` vs `ROOT=APP/..` while audio lives `app/public/audio/` — wrong root.
- Bun-only, no Node fallback: 84 hits `bun scripts/…`; `Bun.spawn/file/write/serve/sleep` exclusively. No `engines:{bun}`, no "install Bun" prereq in Quick Start. `Bun.spawn([execPath,'x','vite'])` assumes Bun ≥1.x. `vite.config.ts:9` breaks Node <20.11.
- Tier/class drift: `calibration-notes.md:83` `F13 Tier A/advisory`, `motion-report.md:54` `F13 advisory`, `current-motion-system.md:253` `F13 objective/advisory`. `F10` blocking lyric-only but "ignore if no lyrics" — CI must special-case. `heal.ts:173,230,266` maps `F07→Tier B`, `F04/F05→Tier A` correctly while `F12→Tier C` (`:284-299`) vs docs Tier B — mismatch.

---

## 5. Remediation plan (pre-release priority)

1. **Engine correctness:** fix E-C1/C2/C5/C6, E-C3 heal patches, E-C4 telemetry guard, E-M15 cycle guard, E-M17 clip, E-M19 `measureText`. Add unit tests (roll orthonormality, `F=[0,±1,0]`, zero-duration, cycle-throw, patch-API existence).
2. **Visual contracts:** align 4 JSON schemas + filenames (standardize `compare_summary.json` + back-compat), fix `scripts/visual/` → `scripts/` in 01–04, 3840px or spec update, honor `--scene`/`--window`, `onerror`/timeout, `channel:'chrome'` fallback, `ROOT`-based `--out`, `try/finally kill`, label fix, `--scene→only` mapping. Add `test_visual_tools.ts`.
3. **Telemetry honesty:** implement Michelson + `% G>0.12` or update spec + recalibrate; switch to `p10/p90` with `CONFIG` fallback + `n>0`; regenerate `example.json` with lyrics; fix `cutRate` push, FPS 60, `maxSpp`, `fps` param, empty-window guards, `other_pct` CSV, evidence-by-time, waivers (`--waive`).
4. **Docs/version:** "4 implemented + 5 proposed (in progress)"; fix `v2.2.0` diagram, duplicate headings, `file:///` → relative, 12-vs-29 module list, `CameraRig`/`defineScene` drift, `plates.json`/`song/`/`audio` dangling refs, mark 05–09 commands as proposed-not-runnable, fix test invocation docs.
5. **Repo/packaging:** `git add .gitignore` (fix typo, add `**/out/`), `git rm --cached app/out/`, add `package.json` scripts, move `typescript` to devDeps, pin `vite/@types/bun`, commit lockfile, document Bun + Chrome/`playwright install` + fonts + `Example project` sibling, include `app/scripts` + root `scripts/` in typecheck, decide `song/` (delete), fix stale `index.html` title + audio paths.

---

## 6. Answer to "is it good, just needs fixes?"
Yes — strong pre-release foundation with correct direction (instrumentation, determinism, 3-tier, DSL). Not "just polish": the fixes above are load-bearing for trust (camera math, heal patches, schemas, calibration honesty). With §5 done, shippable as boilerplate + 4 instruments; 05–09 then land behind the already-defined heal matrix.

*End of `m_audit_rev1` — full detail preserved from sub-audits E/V/T/R. 05–09 non-implementation acknowledged as known in-progress per owner.*
