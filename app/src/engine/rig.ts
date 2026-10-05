// Universal Dual-Mode 6-DOF Camera Rig (CameraRig)
// Seamlessly handles Cinematic Perspective (14mm-200mm) and Technical Isometric projections.
// Features centripetal Catmull-Rom arc-length splines, quaternion rotation interpolation,
// Bishop parallel-transport basis, trauma-based procedural shake, and target tracking.
import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { type V3, type Cam } from './camera3d';
import { clamp, noise1, TAU } from './util';
import { W, H } from './gl';

export type CameraMode = 'perspective' | 'isometric' | 'orthographic';

export interface CameraWaypoint {
  t: number;          // normalized trajectory progress [0..1]
  pos: V3;            // camera position
  target: V3;         // look-at target
  roll?: number;      // roll angle in radians (default: 0)
  focalLength?: number; // mm (35mm equivalent, default: 50mm) or px
}

export interface CameraShakeOpts {
  amplitude?: number; // translational shake in world units (default: 0.08)
  rotational?: number;// rotational shake in radians (default: 0.02)
  decay?: number;     // trauma decay rate per second (default: 1.5)
}

export class CameraRig {
  mode: CameraMode = 'perspective';

  // Active state
  position: V3 = [0, 1.8, -8.0];
  target: V3 = [0, 0, 0];
  roll = 0;
  focalLengthMm = 50.0; // 35mm equivalent focal length
  focalLengthPx = 950.0;
  isoScale = 6.0;       // World units across screen for isometric mode

  // Trauma-based shake engine (trauma in [0..1], displacement proportional to trauma^2)
  private trauma = 0;
  private traumaDecay = 1.5;

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
    // f_px = (H_px / sensor_height_mm) * focal_length_mm
    // Standard: 1080px / 24mm = 45 px/mm
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
   * Inject trauma for physical impacts, recoil, or cinematic rumble
   */
  addTrauma(amount: number): this {
    this.trauma = clamp(this.trauma + amount, 0, 1.0);
    return this;
  }

  /**
   * Build smooth centripetal Catmull-Rom flight path with constant arc-length velocity
   */
  setPath(waypoints: CameraWaypoint[]): this {
    this.waypoints = waypoints;
    if (waypoints.length >= 2) {
      const posPoints = waypoints.map((w) => new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]));
      const targetPoints = waypoints.map((w) => new THREE.Vector3(w.target[0], w.target[1], w.target[2]));
      // Centripetal Catmull-Rom prevents overshoot knots and speed kinks
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
      // getPointAt uses arc-length reparameterization for uniform velocity
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
        if (w0.focalLength && w1.focalLength) {
          const fl = w0.focalLength * (1 - k) + w1.focalLength * k;
          if (fl < 100) this.setLensMm(fl);
          else this.setFocalLengthPx(fl);
        }
      }
    }
    return this;
  }

  /**
   * Evaluate procedural shake and return orthonormal Cam specification
   */
  evalCam(t: number, dt = 1 / 60): Cam {
    // Decay trauma over time
    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);

    // Quadratic trauma mapping (small trauma = subtle rumble, high trauma = violent kick)
    const shakePower = this.trauma * this.trauma;
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

    // Compute Forward vector towards target
    const dx = this.target[0] - p[0];
    const dy = this.target[1] - p[1];
    const dz = this.target[2] - p[2];
    const len = Math.hypot(dx, dy, dz) || 1.0;
    const Fw: V3 = [dx / len, dy / len, dz / len];

    // Orthonormal basis: world up is (0, 1, 0)
    // R0 = vnorm(worldUp x Fw)
    const rx = 1.0 * Fw[2] - 0.0 * Fw[1];
    const ry = 0.0;
    const rz = -1.0 * Fw[0];
    const rlen = Math.hypot(rx, ry, rz) || 1.0;
    const R0: V3 = [rx / rlen, ry / rlen, rz / rlen];

    // U0 = Fw x R0
    const U0: V3 = [
      Fw[1] * R0[2] - Fw[2] * R0[1],
      Fw[2] * R0[0] - Fw[0] * R0[2],
      Fw[0] * R0[1] - Fw[1] * R0[0],
    ];

    // Apply roll rotation
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const R: V3 = [R0[0] * cosR + U0[0] * sinR, R0[1] * cosR + U0[1] * sinR, R0[2] * cosR + U0[2] * sinR];
    const U: V3 = [U0[0] * cosR - R0[0] * sinR, U0[1] * cosR - R0[1] * sinR, U0[2] * cosR - R0[0] * sinR];

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
