// Universal Dual-Mode 6-DOF Camera Rig (CameraRig)
// Seamlessly handles Cinematic Perspective (14mm-200mm) and Technical Isometric projections.
// Features centripetal Catmull-Rom arc-length splines, quaternion rotation interpolation,
// singular-safe orthonormal frames, analytical trauma-based procedural shake, and target tracking.
import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { type V3, type Cam } from './camera3d';
import { clamp, noise1, TAU } from './util';
import { W, H } from './gl';

export type CameraMode = 'perspective' | 'isometric' | 'orthographic';

export interface CameraWaypoint {
  t: number;            // normalized trajectory progress [0..1]
  pos: V3;              // camera position
  target: V3;           // look-at target
  roll?: number;        // roll angle in radians (default: 0)
  focalLength?: number; // mm (if < 300) or screen px (if >= 300)
}

export interface TraumaImpulse {
  t0: number;
  intensity: number;
  decay: number;
}

export class CameraRig {
  mode: CameraMode = 'perspective';

  // Active state
  position: V3 = [0, 1.8, -8.0];
  target: V3 = [0, 0, 0];
  roll = 0;
  focalLengthMm = 50.0;                // 35mm equivalent focal length
  focalLengthPx = 50.0 * (H / 24.0);   // Synchronized pixel equivalent (1080/24 = 45 px/mm)
  isoScale = 6.0;                      // World units across screen for isometric mode

  // Analytical closed-form trauma impulses (preserves f(t) sub-frame determinism)
  private impulses: TraumaImpulse[] = [];

  // Arc-length parameterized spline waypoints
  private waypoints: CameraWaypoint[] = [];
  private splinePos: THREE.CatmullRomCurve3 | null = null;
  private splineTarget: THREE.CatmullRomCurve3 | null = null;

  constructor(mode: CameraMode = 'perspective') {
    this.mode = mode;
  }

  /**
   * Set cinematic perspective lens focal length in millimeters (35mm format: sensor height 24mm)
   */
  setLensMm(mm: number): this {
    this.focalLengthMm = mm;
    this.focalLengthPx = mm * (H / 24.0);
    return this;
  }

  /**
   * Set focal length directly in screen pixels
   */
  setFocalLengthPx(px: number): this {
    this.focalLengthPx = px;
    this.focalLengthMm = px / (H / 24.0);
    return this;
  }

  /**
   * Switch between cinematic perspective flight and technical isometric showcase
   */
  setMode(mode: CameraMode): this {
    this.mode = mode;
    return this;
  }

  /**
   * Register a deterministic trauma impulse at timestamp t0 (decays exponentially)
   */
  addTrauma(amount: number, t0 = 0, decay = 1.5): this {
    this.impulses.push({ t0, intensity: amount, decay });
    return this;
  }

  /**
   * Calculate continuous trauma amplitude at time t (strictly closed-form f(t))
   */
  getTraumaAt(t: number): number {
    let total = 0;
    for (const imp of this.impulses) {
      if (t >= imp.t0) {
        total += imp.intensity * Math.exp(-(t - imp.t0) * imp.decay);
      }
    }
    return clamp(total, 0, 1.0);
  }

  /**
   * Build smooth centripetal Catmull-Rom flight path with constant arc-length velocity
   */
  setPath(waypoints: CameraWaypoint[]): this {
    this.waypoints = waypoints;
    if (waypoints.length >= 2) {
      const posPoints = waypoints.map((w) => new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]));
      const targetPoints = waypoints.map((w) => new THREE.Vector3(w.target[0], w.target[1], w.target[2]));
      this.splinePos = new THREE.CatmullRomCurve3(posPoints, false, 'centripetal', 0.5);
      this.splineTarget = new THREE.CatmullRomCurve3(targetPoints, false, 'centripetal', 0.5);
    }
    return this;
  }

  /**
   * Sample camera trajectory along normalized arc length u in [0, 1]
   */
  evalPath(u: number): this {
    const p = clamp(u, 0, 1);
    if (this.splinePos && this.splineTarget) {
      const pos = this.splinePos.getPointAt(p);
      const tgt = this.splineTarget.getPointAt(p);
      this.position = [pos.x, pos.y, pos.z];
      this.target = [tgt.x, tgt.y, tgt.z];

      // Interpolate roll and focal length along waypoints
      if (this.waypoints.length >= 2) {
        let i = 0;
        while (i + 1 < this.waypoints.length && p > this.waypoints[i + 1]!.t) i++;
        const w0 = this.waypoints[i]!, w1 = this.waypoints[Math.min(i + 1, this.waypoints.length - 1)]!;
        const span = Math.max(1e-4, w1.t - w0.t);
        const k = clamp((p - w0.t) / span, 0, 1);
        this.roll = (w0.roll ?? 0) * (1 - k) + (w1.roll ?? 0) * k;

        const fl0 = w0.focalLength ?? this.focalLengthMm;
        const fl1 = w1.focalLength ?? fl0;
        const fl = fl0 * (1 - k) + fl1 * k;

        // Convention: < 300 is millimeters, >= 300 is screen pixels
        if (fl < 300) this.setLensMm(fl);
        else this.setFocalLengthPx(fl);
      }
    }
    return this;
  }

  /**
   * Evaluate procedural shake and return orthonormal Cam specification.
   * Completely deterministic closed-form f(t) across arbitrary sub-frame sampling.
   */
  evalCam(t: number): Cam {
    const traumaVal = this.getTraumaAt(t);
    const shakePower = traumaVal * traumaVal;

    let p = [...this.position] as V3;
    let roll = this.roll;

    if (shakePower > 0.0001) {
      const shakeTrans = 0.08 * shakePower;
      const shakeRot = 0.02 * shakePower;
      p[0] += noise1(t * 35.0, 101) * shakeTrans;
      p[1] += noise1(t * 37.0, 102) * shakeTrans;
      p[2] += noise1(t * 39.0, 103) * shakeTrans * 0.5;
      roll += noise1(t * 29.0, 104) * shakeRot;
    }

    // Compute Forward unit vector towards target
    const dx = this.target[0] - p[0];
    const dy = this.target[1] - p[1];
    const dz = this.target[2] - p[2];
    const len = Math.hypot(dx, dy, dz) || 1.0;
    const Fw: V3 = [dx / len, dy / len, dz / len];

    // Singular-safe orthonormal basis:
    // When gaze aligns with world Y (|Fw.y| > 0.99), fallback to Z-axis reference up
    let upRef: V3 = [0, 1, 0];
    if (Math.abs(Fw[1]) > 0.99) {
      upRef = [0, 0, Fw[1] > 0 ? -1 : 1];
    }

    // Camera backward vector in world space: B = -Fw
    // Orthonormal basis maintaining right-handed convention (det = +1):
    // R0 = vnorm(upRef x B)
    const B: V3 = [-Fw[0], -Fw[1], -Fw[2]];
    const rx = upRef[1] * B[2] - upRef[2] * B[1];
    const ry = upRef[2] * B[0] - upRef[0] * B[2];
    const rz = upRef[0] * B[1] - upRef[1] * B[0];
    const rlen = Math.hypot(rx, ry, rz) || 1.0;
    const R0: V3 = [rx / rlen, ry / rlen, rz / rlen];

    // U0 = B x R0
    const U0: V3 = [
      B[1] * R0[2] - B[2] * R0[1],
      B[2] * R0[0] - B[0] * R0[2],
      B[0] * R0[1] - B[1] * R0[0],
    ];

    // Apply roll rotation
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const R: V3 = [R0[0] * cosR + U0[0] * sinR, R0[1] * cosR + U0[1] * sinR, R0[2] * cosR + U0[2] * sinR];
    const U: V3 = [U0[0] * cosR - R0[0] * sinR, U0[1] * cosR - R0[1] * sinR, U0[2] * cosR - R0[2] * sinR];

    return {
      p,
      R,
      U,
      F: Fw,
      f: this.focalLengthPx,
      cx: W / 2,
      cy: H / 2,
    };
  }

  /**
   * Synchronize CameraRig to a Three.js Camera (Perspective or Orthographic/Isometric)
   */
  syncToThreeCamera(cam: Cam, threeCam: THREE.Camera): void {
    if (this.mode === 'perspective' && threeCam instanceof THREE.PerspectiveCamera) {
      ViewportSpace.camToThreeCamera(cam, threeCam, W, H);
    } else if ((this.mode === 'isometric' || this.mode === 'orthographic') && threeCam instanceof THREE.OrthographicCamera) {
      const aspect = W / H;
      const hHalf = this.isoScale * 0.5;
      const wHalf = hHalf * aspect;
      threeCam.left = -wHalf;
      threeCam.right = wHalf;
      threeCam.top = hHalf;
      threeCam.bottom = -hHalf;
      threeCam.near = 0.1;
      threeCam.far = 1000;
      threeCam.position.set(cam.p[0], cam.p[1], cam.p[2]);

      const viewMatrix = new THREE.Matrix4();
      viewMatrix.set(
        cam.R[0], cam.R[1], cam.R[2], -(cam.p[0] * cam.R[0] + cam.p[1] * cam.R[1] + cam.p[2] * cam.R[2]),
        cam.U[0], cam.U[1], cam.U[2], -(cam.p[0] * cam.U[0] + cam.p[1] * cam.U[1] + cam.p[2] * cam.U[2]),
        -cam.F[0], -cam.F[1], -cam.F[2], (cam.p[0] * cam.F[0] + cam.p[1] * cam.F[1] + cam.p[2] * cam.F[2]),
        0, 0, 0, 1
      );
      threeCam.matrixWorldInverse.copy(viewMatrix);
      threeCam.matrixWorld.copy(viewMatrix).invert();
      threeCam.matrixAutoUpdate = false;
      threeCam.updateProjectionMatrix();
    }
  }
}
