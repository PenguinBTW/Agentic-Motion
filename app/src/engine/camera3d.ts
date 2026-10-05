// Shared 6-DOF Orthonormal Pinhole Camera Engine & 3D Projector
// Extracted from Example project/app/src/scenes/room.ts and loss.ts
import { clamp, lerp, ease, springStep, noise1, TAU } from './util';
import { W, H } from './gl';

export type V3 = [number, number, number];
export type RGB = [number, number, number];

export const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vsc = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const vdot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vcross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vnorm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const vlerp = (a: V3, b: V3, k: number): V3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
];

/** Rodrigues rotation of v about unit axis k by angle a. */
export const vrot = (v: V3, k: V3, a: number): V3 => {
  const c = Math.cos(a), s = Math.sin(a), kv = vdot(k, v), x = vcross(k, v);
  return [
    v[0] * c + x[0] * s + k[0] * kv * (1 - c),
    v[1] * c + x[1] * s + k[1] * kv * (1 - c),
    v[2] * c + x[2] * s + k[2] * kv * (1 - c),
  ];
};

/** Orthonormal pinhole camera: position, basis (right, up, forward), focal length in px. */
export interface Cam {
  p: V3;
  R: V3;
  U: V3;
  F: V3;
  f: number;
  cx: number;
  cy: number;
}

export interface Key {
  p: V3;
  tg: V3;
  roll: number;
  f: number;
}

export const K = (p: V3, tg: V3, roll: number, f: number): Key => ({ p, tg, roll, f });

export const lerpKey = (a: Key, b: Key, k: number): Key => ({
  p: vlerp(a.p, b.p, k),
  tg: vlerp(a.tg, b.tg, k),
  roll: lerp(a.roll, b.roll, k),
  f: lerp(a.f, b.f, k),
});

export interface Shot {
  t0: number;
  t1: number;
  a?: Key;
  b?: Key;
  e?: (x: number) => number;
  snap: number;                  // snap duration (e.g. 0.09 - 0.16s outExpo)
  kick?: number;                 // kick roll impulse
  rollSpring?: [number, number]; // [freq, damp] spring parameters
  key?: (t: number) => Key;
}

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Evaluates the active keyframe from a list of shots. */
export function keyAt(shots: Shot[], t: number): Key {
  let i = 0;
  while (i + 1 < shots.length && t >= shots[i + 1]!.t0) i++;
  const s = shots[i]!;
  let k = shotKey(s, t);
  if (i > 0 && s.snap > 0 && t - s.t0 < s.snap) {
    k = lerpKey(shotKey(shots[i - 1]!, t), k, ease.outExpo(clamp((t - s.t0) / s.snap, 0, 1)));
  }
  if (s.kick && t >= s.t0) {
    k.roll += s.kick * Math.sin(TAU * 2.6 * (t - s.t0)) * Math.exp(-(t - s.t0) * 6);
  }
  return k;
}

function shotKey(s: Shot, t: number): Key {
  if (s.key) return s.key(t);
  const u = clamp((t - s.t0) / Math.max(1e-4, s.t1 - s.t0), 0, 1);
  const k = lerpKey(s.a!, s.b!, (s.e ?? ease.linear)(u));
  if (s.rollSpring) {
    k.roll = lerp(s.a!.roll, s.b!.roll, springStep(t - s.t0, s.rollSpring[0], s.rollSpring[1]));
  }
  return k;
}

/** Constructs an orthonormal Cam from a Key with hit shake/tremor. */
export function camFromKey(k: Key, hit = 0, t = 0, cx = W / 2, cy = H / 2): Cam {
  let p = k.p;
  let roll = k.roll;
  if (hit > 0.001) {
    p = vadd(p, [noise1(t * 37, 11) * 0.05 * hit, noise1(t * 41, 12) * 0.05 * hit, 0]);
    roll += noise1(t * 29, 13) * 0.012 * hit;
  }
  const Fw = vnorm(vsub(k.tg, p));
  // Singular-safe reference up fallback when looking straight up or down (|Fw.y| > 0.99)
  let upRef: V3 = [0, 1, 0];
  if (Math.abs(Fw[1]) > 0.99) {
    upRef = [0, 0, Fw[1] > 0 ? -1 : 1];
  }
  // Camera backward vector in world space: B = -Fw; basis maintaining det = +1
  const B: V3 = [-Fw[0], -Fw[1], -Fw[2]];
  const R0 = vnorm(vcross(upRef, B));
  const U0 = vcross(B, R0);
  const c = Math.cos(roll), s = Math.sin(roll);
  return {
    p,
    F: Fw,
    R: vadd(vsc(R0, c), vsc(U0, s)),
    U: vsub(vsc(U0, c), vsc(R0, s)),
    f: k.f,
    cx,
    cy,
  };
}

/** Project a 3D world point; returns null if behind near plane (0.05m). */
export function proj(c: Cam, X: number, Y: number, Z: number): [number, number] | null {
  const rx = X - c.p[0], ry = Y - c.p[1], rz = Z - c.p[2];
  const z = rx * c.F[0] + ry * c.F[1] + rz * c.F[2];
  if (z < 0.05) return null;
  const x = rx * c.R[0] + ry * c.R[1] + rz * c.R[2];
  const y = rx * c.U[0] + ry * c.U[1] + rz * c.U[2];
  return [c.cx + (c.f * x) / z, c.cy - (c.f * y) / z];
}

/** Returns the signed forward depth of a world point along camera line of sight. */
export function depth(c: Cam, X: number, Y: number, Z: number): number {
  return (X - c.p[0]) * c.F[0] + (Y - c.p[1]) * c.F[1] + (Z - c.p[2]) * c.F[2];
}

/** Near-clips and projects a line segment into outP[0..3]; outP[4] = mean depth. Returns false if culled. */
export function clipSeg(
  c: Cam,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  outP: number[],
  near = 0.08,
): boolean {
  let da = depth(c, ax, ay, az), db = depth(c, bx, by, bz);
  if (da < near && db < near) return false;
  if (da < near) {
    const u = (near - da) / (db - da);
    ax += (bx - ax) * u; ay += (by - ay) * u; az += (bz - az) * u; da = near;
  } else if (db < near) {
    const u = (near - db) / (da - db);
    bx += (ax - bx) * u; by += (ay - by) * u; bz += (az - bz) * u; db = near;
  }
  const pa = proj(c, ax, ay, az);
  const pb = proj(c, bx, by, bz);
  if (!pa || !pb) return false;
  outP[0] = pa[0]; outP[1] = pa[1]; outP[2] = pb[0]; outP[3] = pb[1]; outP[4] = (da + db) / 2;
  if (
    (outP[0] < -300 && outP[2] < -300) ||
    (outP[0] > W + 300 && outP[2] > W + 300) ||
    (outP[1] < -300 && outP[3] < -300) ||
    (outP[1] > H + 300 && outP[3] > H + 300)
  ) return false;
  return true;
}

/** Computes a 2D affine transform mapping canvas local space (px) onto a world plane at P. */
export function planeAffine(
  c: Cam,
  P: V3,
  ux: V3,
  uy: V3,
  m: number,       // meters per canvas px
  cx: number,      // anchor x on canvas
  cy: number,      // anchor y on canvas
  scale = 1.0,
): Affine | null {
  const d = 10;
  const p0 = proj(c, P[0], P[1], P[2]);
  const pa = proj(c, P[0] + ux[0] * m * d, P[1] + ux[1] * m * d, P[2] + ux[2] * m * d);
  const pb = proj(c, P[0] + uy[0] * m * d, P[1] + uy[1] * m * d, P[2] + uy[2] * m * d);
  if (!p0 || !pa || !pb) return null;
  const [x0, y0] = p0, [xa, ya] = pa, [xb, yb] = pb;
  const a = ((xa - x0) / d) * scale;
  const b = ((ya - y0) / d) * scale;
  const cc = ((xb - x0) / d) * scale;
  const dd = ((yb - y0) / d) * scale;
  return {
    a,
    b,
    c: cc,
    d: dd,
    e: x0 - a * cx - cc * cy,
    f: y0 - b * cx - dd * cy,
  };
}

/** Billboard affine: guarantees upright, left-to-right text facing camera directly. */
export function billboardAffine(
  c: Cam,
  P: V3,
  m: number,
  cx = 0,
  cy = 0,
  scale = 1.0,
): Affine | null {
  return planeAffine(c, P, c.R, vsc(c.U, -1), m, cx, cy, scale);
}

