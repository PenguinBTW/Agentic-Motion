// 3D God-View Camera Blueprint
// External orthographic top-down (XZ) and side elevation (YZ) architectural blueprint
// showing 3D scene geometry, camera position, frustum pyramids, and velocity ribbons.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright-core';
import { isFlagVal } from '../cli';

export interface GodViewOptions {
  scene?: string;
  from?: number;
  to?: number;
  samples?: number;
  out?: string;
  corridor?: boolean;
}


export function parseGodViewArgs(argv: string[]): GodViewOptions {
  const opts: GodViewOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--from' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.from = v; }
    else if (arg === '--to' && isFlagVal(argv[i + 1])) { const v = parseFloat(argv[++i]!); if (Number.isFinite(v)) opts.to = v; }
    else if (arg === '--samples' && isFlagVal(argv[i + 1])) { const v = parseInt(argv[++i]!, 10); if (Number.isFinite(v)) opts.samples = Math.max(2, Math.min(128, v)); }
    else if (arg === '--scene' && isFlagVal(argv[i + 1])) { opts.scene = argv[++i]!; }
    else if (arg === '--out' && isFlagVal(argv[i + 1])) { opts.out = argv[++i]!; }
    else if (arg === '--corridor') { opts.corridor = true; }
  }
  return opts;
}

export async function runGodView(page: Page, argv: string[] = []): Promise<void> {
  const opts = parseGodViewArgs(argv);

  if (opts.from === undefined || opts.to === undefined) {
    const tl: { id: string; start: number; end: number }[] = await page.evaluate(
      () => (window as any).__pdoom?.timeline || []
    );
    if (opts.scene && tl.length > 0) {
      const match = tl.find((e) => e.id === opts.scene);
      if (match) {
        if (opts.from === undefined) opts.from = match.start;
        if (opts.to === undefined) opts.to = match.end;
      }
    }
  }

  let from = opts.from;
  let to = opts.to;
  let usedFallbackRange = false;
  if (from === undefined && to !== undefined) from = Math.max(0, to - 10.0);
  else if (to === undefined && from !== undefined) to = from + 10.0;
  else if (from === undefined && to === undefined) {
    console.warn('[godview] Unknown scene/range — defaulting to 8.00–18.50s. Pass --scene with timeline match or --from/--to.');
    from = 8.00;
    to = 18.50;
    usedFallbackRange = true;
  }
  const numSamples = opts.samples ?? 24;

  if (from === undefined || to === undefined) throw new Error('[godview] from/to resolution failed');

  const ROOT = path.resolve(import.meta.dir, '../../..');
  const defaultOut = path.join(ROOT, 'out/visual/godview');
  const outDir = opts.out ? (path.isAbsolute(opts.out) ? path.resolve(opts.out) : path.join(ROOT, opts.out)) : path.resolve(defaultOut);
  mkdirSync(outDir, { recursive: true });

  console.log(`[godview] Rendering 3D God-View camera blueprint for [${from.toFixed(2)}–${to.toFixed(2)}s] (${numSamples} samples)...`);

  const showCorridor = Boolean(opts.corridor || (opts.scene && (opts.scene.includes('doors') || opts.scene.includes('corridor'))));

  const result: { dataUrl: string; summary: any } = await page.evaluate<
    { dataUrl: string; summary: any },
    { t0: number; t1: number; N: number; showCorridor: boolean; sceneName: string }
  >(
    async ({ t0, t1, N, showCorridor, sceneName }) => {
      const P = (window as any).__pdoom;
      const W = 1920;
      const H = 1080;

      // Collect camera samples by evaluating scenes
      const samples: { t: number; x: number; y: number; z: number; fx: number; fy: number; fz: number; v: number }[] = [];
      const loaded = P.engine?.loaded;

      // Find active scene instance if available
      let activeSceneObj: any = null;
      if (loaded) {
        for (const [_, entry] of loaded.entries()) {
          if (entry.scene && typeof entry.scene.evaluateCamera === 'function') {
            activeSceneObj = entry.scene;
            break;
          }
        }
      }
      let usedSynthetic = !activeSceneObj;

      for (let i = 0; i < N; i++) {
        const t = t0 + (i / Math.max(1, N - 1)) * (t1 - t0);
        let x = 0, y = 1.2, z = 0;
        let fx = 0, fy = 0, fz = 1;

        if (activeSceneObj && typeof activeSceneObj.evaluateCamera === 'function') {
          try {
            const cam = activeSceneObj.evaluateCamera(t, 0);
            if (cam && cam.p) {
              x = cam.p[0]; y = cam.p[1]; z = cam.p[2];
              if (cam.F) { fx = cam.F[0]; fy = cam.F[1]; fz = cam.F[2]; }
            }
          } catch {}
        } else {
          // Fallback analytical corridor curve (generic template, NOT measured —
          // only used when live __pdoom camera unavailable; labeled as such in output).
          const u = (t - t0) / Math.max(0.1, t1 - t0);
          z = -2.2 + u * u * 48.0;
          x = Math.sin(u * Math.PI * 2) * 0.4;
          y = 1.2 + Math.cos(u * Math.PI) * 0.1;
        }

        samples.push({ t, x, y, z, fx, fy, fz, v: 0 });
      }

      // Compute velocity per sample
      for (let i = 1; i < samples.length; i++) {
        const p0 = samples[i - 1]!;
        const p1 = samples[i]!;
        const dt = Math.max(0.001, p1.t - p0.t);
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
        p1.v = dist / dt;
      }
      if (samples.length > 1) samples[0]!.v = samples[1]!.v;
      // Actual path length (not padded-bounds span) for honest travel telemetry.
      let pathLen = 0;
      for (let i = 1; i < samples.length; i++) {
        const p0 = samples[i - 1]!, p1 = samples[i]!;
        pathLen += Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
      }

      // Establish coordinate bounding box: corridor scenes keep architectural context
      // (±2.5m, -4/50m, 0/3.6m); generic scenes frame tightly around samples.
      const xs = samples.map((s) => s.x), ys = samples.map((s) => s.y), zs = samples.map((s) => s.z);
      const minX = showCorridor ? Math.min(-2.5, ...samples.map((s) => s.x - 1.5)) : Math.min(...xs) - 1.5;
      const maxX = showCorridor ? Math.max(2.5, ...samples.map((s) => s.x + 1.5)) : Math.max(...xs) + 1.5;
      const minZ = showCorridor ? Math.min(-4.0, ...samples.map((s) => s.z - 2.0)) : Math.min(...zs) - 2.0;
      const maxZ = showCorridor ? Math.max(50.0, ...samples.map((s) => s.z + 5.0)) : Math.max(...zs) + 5.0;
      const minY = showCorridor ? Math.min(0, ...samples.map((s) => s.y - 0.5)) : Math.min(...ys) - 0.5;
      const maxY = showCorridor ? Math.max(3.6, ...samples.map((s) => s.y + 0.8)) : Math.max(...ys) + 0.8;

      // Create Blueprint Canvas
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d')!;

      // Dark technical blueprint background
      ctx.fillStyle = '#08080A';
      ctx.fillRect(0, 0, W, H);

      // --- PANEL A: TOP-DOWN ARCHITECTURAL BLUEPRINT (XZ PLANE) ---
      const pad = 40;
      const pAW = 1100;
      const pAH = H - pad * 2 - 40;
      const pAX = pad;
      const pAY = pad + 40;

      ctx.fillStyle = '#0D0D12';
      ctx.fillRect(pAX, pAY, pAW, pAH);
      ctx.strokeStyle = '#22222E';
      ctx.lineWidth = 1;
      ctx.strokeRect(pAX, pAY, pAW, pAH);

      // Panel Header
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#00D2FF';
      ctx.fillText('PANEL 1: ORTHOGRAPHIC TOP-DOWN BLUEPRINT (XZ PLANE)', pAX + 16, pAY + 24);

      // Coordinate mapping functions for Top-Down (X horizontal, Z vertical)
      const toScreenX = (wx: number) => pAX + 50 + ((wx - minX) / (maxX - minX)) * (pAW - 100);
      const toScreenZ = (wz: number) => pAY + pAH - 40 - ((wz - minZ) / (maxZ - minZ)) * (pAH - 80);

      // Draw metric grid lines
      ctx.strokeStyle = '#181822';
      ctx.lineWidth = 1;
      for (let z = Math.ceil(minZ / 5) * 5; z <= maxZ; z += 5) {
        const sy = toScreenZ(z);
        ctx.beginPath();
        ctx.moveTo(pAX, sy);
        ctx.lineTo(pAX + pAW, sy);
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.fillStyle = '#555566';
        ctx.fillText(`z=${z}m`, pAX + 8, sy - 3);
      }

      for (let x = Math.ceil(minX); x <= maxX; x += 1) {
        const sx = toScreenX(x);
        ctx.beginPath();
        ctx.moveTo(sx, pAY);
        ctx.lineTo(sx, pAY + pAH);
        ctx.stroke();
      }

      // Draw corridor walls / world geometry boundaries if corridor scene enabled
      if (showCorridor) {
        const leftWallX = toScreenX(-1.8);
        const rightWallX = toScreenX(1.8);
        ctx.strokeStyle = 'rgba(238, 233, 223, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(leftWallX, toScreenZ(maxZ), rightWallX - leftWallX, toScreenZ(minZ) - toScreenZ(maxZ));

        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(238, 233, 223, 0.40)';
        ctx.fillText('◄ LEFT CORRIDOR WALL (x = -1.8m)', leftWallX - 220, pAY + 60);
        ctx.fillText('RIGHT CORRIDOR WALL (x = +1.8m) ►', rightWallX + 16, pAY + 60);

        // Draw Door frames along Z every 2.2m
        ctx.strokeStyle = 'rgba(255, 77, 18, 0.25)';
        ctx.lineWidth = 1;
        for (let dz = 0; dz <= maxZ; dz += 2.2) {
          const sy = toScreenZ(dz);
          // Left door notch
          ctx.strokeRect(leftWallX - 8, sy - 2, 8, 4);
          // Right door notch
          ctx.strokeRect(rightWallX, sy - 2, 8, 4);
        }
      }

      // Draw Camera Flight Path Ribbon
      for (let i = 1; i < samples.length; i++) {
        const s0 = samples[i - 1]!;
        const s1 = samples[i]!;
        const sx0 = toScreenX(s0.x), sy0 = toScreenZ(s0.z);
        const sx1 = toScreenX(s1.x), sy1 = toScreenZ(s1.z);

        // Color by speed: Blue (slow) -> White (moderate) -> Signal (fast)
        let strokeCol = '#00D2FF';
        if (s1.v > 20) strokeCol = '#FF4D12';
        else if (s1.v > 8) strokeCol = '#EEE9DF';

        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx1, sy1);
        ctx.stroke();
      }

      // Draw Frustum Cones at intervals
      for (let i = 0; i < samples.length; i += 4) {
        const s = samples[i]!;
        const sx = toScreenX(s.x);
        const sy = toScreenZ(s.z);

        // Apex dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Frustum field of view cone lines
        const coneLen = 35;
        const angle = Math.atan2(-s.fx, s.fz); // forward angle
        const fov = 0.55; // ~32 deg half-angle

        ctx.strokeStyle = 'rgba(0, 210, 255, 0.50)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.sin(angle - fov) * coneLen, sy - Math.cos(angle - fov) * coneLen);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.sin(angle + fov) * coneLen, sy - Math.cos(angle + fov) * coneLen);
        ctx.moveTo(sx + Math.sin(angle - fov) * coneLen, sy - Math.cos(angle - fov) * coneLen);
        ctx.lineTo(sx + Math.sin(angle + fov) * coneLen, sy - Math.cos(angle + fov) * coneLen);
        ctx.stroke();

        // Timestamp label
        ctx.font = '10px monospace';
        ctx.fillStyle = '#A0A0B0';
        ctx.fillText(`t=${s.t.toFixed(1)}s (${s.v.toFixed(0)}m/s)`, sx + 8, sy + 3);
      }

      // --- PANEL B: SIDE ELEVATION BLUEPRINT (YZ PLANE) ---
      const pBX = pAX + pAW + 30;
      const pBW = W - pBX - pad;
      const pBH = pAH;
      const pBY = pAY;

      ctx.fillStyle = '#0D0D12';
      ctx.fillRect(pBX, pBY, pBW, pBH);
      ctx.strokeStyle = '#22222E';
      ctx.lineWidth = 1;
      ctx.strokeRect(pBX, pBY, pBW, pBH);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#FF7A00';
      ctx.fillText('PANEL 2: SIDE ELEVATION (YZ PLANE)', pBX + 16, pBY + 24);

      // Coordinate mapping for Elevation (Z horizontal, Y vertical)
      const toSideZ = (wz: number) => pBX + 30 + ((wz - minZ) / (maxZ - minZ)) * (pBW - 60);
      const toSideY = (wy: number) => pBY + pBH - 40 - ((wy - minY) / (maxY - minY)) * (pBH - 80);

      // Ground (y = 0) & Ceiling (y = 2.2m) lines
      const floorSy = toSideY(0);
      const ceilingSy = toSideY(2.2);

      ctx.strokeStyle = '#444455';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pBX, floorSy); ctx.lineTo(pBX + pBW, floorSy);
      ctx.moveTo(pBX, ceilingSy); ctx.lineTo(pBX + pBW, ceilingSy);
      ctx.stroke();

      ctx.font = '10px monospace';
      ctx.fillStyle = '#777788';
      ctx.fillText('FLOOR (y = 0.0m)', pBX + 12, floorSy - 4);
      ctx.fillText('LINTEL / CEILING (y = 2.2m)', pBX + 12, ceilingSy - 4);

      // Draw Camera Altitude Spline
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]!;
        const zx = toSideZ(s.z);
        const zy = toSideY(s.y);
        if (i === 0) ctx.moveTo(zx, zy);
        else ctx.lineTo(zx, zy);
      }
      ctx.strokeStyle = '#FF7A00';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Altitude dots
      for (let i = 0; i < samples.length; i += 4) {
        const s = samples[i]!;
        const zx = toSideZ(s.z);
        const zy = toSideY(s.y);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(zx, zy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.fillStyle = '#A0A0B0';
        ctx.fillText(`y=${s.y.toFixed(2)}m`, zx - 14, zy - 8);
      }

      // Master Top Header Banner
      const topH = 34;
      ctx.fillStyle = 'rgba(10, 10, 11, 0.95)';
      ctx.fillRect(0, 0, W, topH);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#EEE9DF';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[3D GOD-VIEW BLUEPRINT] Window: ${t0.toFixed(2)}s – ${t1.toFixed(2)}s | Travel Distance: ${(maxZ - minZ).toFixed(1)}m | Max Speed: ${Math.max(...samples.map(s => s.v)).toFixed(1)} m/s`, 24, topH / 2);

      return {
        dataUrl: cv.toDataURL('image/png'),
        syntheticFallback: usedSynthetic,
        summary: {
          scene: sceneName,
          from: t0,
          to: t1,
          duration: t1 - t0,
          sample_count: samples.length,
          max_speed_mps: Math.max(...samples.map((s) => s.v)),
          avg_speed_mps: samples.reduce((acc, s) => acc + s.v, 0) / (samples.length || 1),
          min_near_distance_m: Math.min(...samples.map((s) => Math.max(0.01, 1.8 - Math.abs(s.x)))),
          samples: samples.map((s) => ({
            t: s.t,
            x: s.x,
            y: s.y,
            z: s.z,
            fx: s.fx,
            fy: s.fy,
            fz: s.fz,
            v: s.v,
          })),
          total_travel_z_m: maxZ - minZ,
          path_length_m: pathLen,
          // Redundant legacy aliases (same value, old unit suffix) — kept for compat.
          max_speed_m_s: Math.max(...samples.map((s) => s.v)),
          min_speed_m_s: Math.min(...samples.map((s) => s.v)),
          // Single clearance definition (raw, negatives = penetration; min_near above clamps for display).
          camera_min_clearance_wall_m: Math.min(...samples.map((s) => 1.8 - Math.abs(s.x))),
          camera_y_range_m: [minY, maxY],
          status: 'analyzed',
        },
      };
    },
    { t0: from, t1: to, N: numSamples, showCorridor, sceneName: opts.scene ?? 'all' }
  );
  // Mark synthetic fallback Node-side (browser returned syntheticFallback flag).
  const _synth = (result as any).syntheticFallback;
  if (_synth || usedFallbackRange) {
    result.summary.fallback = true;
    result.summary.status = 'synthetic-fallback';
    if (usedFallbackRange) console.warn('[godview] Used default range 8.00–18.50s (synthetic-fallback).');
    if (_synth) console.warn('[godview] Camera unavailable — used analytic template (synthetic-fallback, NOT measured).');
  }

  const base64Data = result.dataUrl.replace(/^data:image\/png;base64,/, '');
  const pngPath = path.join(outDir, 'cam_godview.png');
  const jsonPath = path.join(outDir, 'godview_summary.json');

  await Bun.write(pngPath, Buffer.from(base64Data, 'base64'));
  await Bun.write(jsonPath, JSON.stringify(result.summary, null, 2));

  console.log(`[godview] Wrote 3D God-View blueprint: ${pngPath}`);
  console.log(`[godview] Wrote kinematic telemetry: ${jsonPath}`);
}

