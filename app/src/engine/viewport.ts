// Unified Viewport & Coordinate Space Architecture
// Harmonizes Logical Points (1920x1080), High-DPI Physical Pixels, and Three.js World Space.
import * as THREE from 'three';
import { W, H, SCALE } from './gl';
import type { Cam, V3 } from './camera3d';

export class ViewportSpace {
  /** Logical design dimensions (1920 x 1080) */
  static readonly logicalWidth = W;
  static readonly logicalHeight = H;

  /** Convert logical canvas coordinates to physical device pixels */
  static logicalToPhysical(x: number, y: number): [number, number] {
    return [x * SCALE, y * SCALE];
  }

  /** Convert physical device pixels to logical canvas points */
  static physicalToLogical(px: number, py: number): [number, number] {
    return [px / SCALE, py / SCALE];
  }

  /**
   * Convert pinhole focal length in screen pixels (Cam.f) to Three.js vertical FOV in degrees.
   * fov_y = 2 * arctan( H / (2 * f) ) * 180 / PI
   */
  static focalLengthToFov(f: number, h = H): number {
    return 2 * Math.atan(h / (2 * Math.max(1e-4, f))) * (180 / Math.PI);
  }

  /**
   * Convert Three.js vertical FOV in degrees to pinhole focal length in screen pixels.
   * f = H / (2 * tan( fov_y_rad / 2 ))
   */
  static fovToFocalLength(fovYDeg: number, h = H): number {
    const rad = (fovYDeg * Math.PI) / 180;
    if (Math.abs(rad) < 1e-6) return h / (2 * Math.tan(1e-6 / 2));
    return h / (2 * Math.tan(rad / 2));
  }

  /**
   * Synchronize an analytical pinhole `Cam` struct into a `THREE.PerspectiveCamera`.
   * Reconciles coordinate conventions: Cam forward is +F, Three.js camera looks down -Z.
   */
  static camToThreeCamera(cam: Cam, target: THREE.PerspectiveCamera, w = W, h = H): void {
    target.position.set(cam.p[0], cam.p[1], cam.p[2]);

    // Construct view matrix directly from orthonormal basis
    // Cam basis: R (Right), U (Up), F (Forward).
    // Three.js view space: +X = Right, +Y = Up, +Z = Backward (-F).
    const viewMatrix = new THREE.Matrix4();
    viewMatrix.set(
      cam.R[0], cam.R[1], cam.R[2], -(cam.p[0] * cam.R[0] + cam.p[1] * cam.R[1] + cam.p[2] * cam.R[2]),
      cam.U[0], cam.U[1], cam.U[2], -(cam.p[0] * cam.U[0] + cam.p[1] * cam.U[1] + cam.p[2] * cam.U[2]),
      -cam.F[0], -cam.F[1], -cam.F[2], (cam.p[0] * cam.F[0] + cam.p[1] * cam.F[1] + cam.p[2] * cam.F[2]),
      0, 0, 0, 1
    );
    target.matrixWorldInverse.copy(viewMatrix);
    target.matrixWorld.copy(viewMatrix).invert();
    target.matrixAutoUpdate = false;

    target.fov = ViewportSpace.focalLengthToFov(cam.f, h);
    target.aspect = w / h;
    target.updateProjectionMatrix();
  }

  /**
   * Project a 3D world-space coordinate to 2D logical screen coordinates [x, y].
   * Returns [x, y, depthZ] or null if behind camera near clip.
   */
  static worldToScreen(worldPos: V3, cam: THREE.Camera, w = W, h = H): [number, number, number] | null {
    const v = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]);
    v.applyMatrix4(cam.matrixWorldInverse);

    // Check view-space depth against camera near plane (Three.js camera looks down -Z)
    const near = (cam as THREE.PerspectiveCamera).near ?? 0.05;
    if (-v.z < near) return null;

    const viewZ = -v.z;
    v.applyMatrix4(cam.projectionMatrix);
    if (v.z > 1.0 || v.z < -1.0) return null;

    const screenX = ((v.x + 1) * 0.5) * w;
    const screenY = ((-v.y + 1) * 0.5) * h;
    return [screenX, screenY, viewZ];
  }
}
