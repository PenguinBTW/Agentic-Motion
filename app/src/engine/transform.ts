// Transform Hierarchy & Responsive Screen Layout (TransformNode & LayoutNode)
// Separates 3D spatial kinematics (hierarchical anchors, dirty-flag matrix concatenation)
// from responsive 2D screen layout (safe-zone pins, title-safe margins, 3D anchor pinning).
import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { type V3 } from './camera3d';
import { W, H } from './gl';

export type ViewportPin =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface LayoutMargin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export class TransformNode {
  // Spatial properties
  position: V3 = [0, 0, 0];
  rotation: V3 = [0, 0, 0]; // Euler angles (radians): [pitch, yaw, roll]
  scale: V3 = [1, 1, 1];
  anchor: V3 = [0, 0, 0];   // Normalized local pivot point [0..1]
  size: V3 = [0, 0, 0];     // Dimensions for anchor calculation

  // Hierarchy
  parent: TransformNode | null = null;
  children: TransformNode[] = [];

  // Matrix cache & dirty flag
  protected localMatrix = new THREE.Matrix4();
  protected worldMatrix = new THREE.Matrix4();
  protected isDirty = true;

  constructor(public id = 'node') {}

  setAnchor(x: number, y: number, z = 0): this {
    this.anchor = [x, y, z];
    this.markDirty();
    return this;
  }

  setPosition(x: number, y: number, z = 0): this {
    this.position = [x, y, z];
    this.markDirty();
    return this;
  }

  setRotation(pitch: number, yaw: number, roll: number): this {
    this.rotation = [pitch, yaw, roll];
    this.markDirty();
    return this;
  }

  setScale(x: number, y = x, z = x): this {
    this.scale = [x, y, z];
    this.markDirty();
    return this;
  }

  setSize(w: number, h: number, d = 0): this {
    this.size = [w, h, d];
    this.markDirty();
    return this;
  }

  addChild(child: TransformNode): this {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    child.markDirty();
    return this;
  }

  removeChild(child: TransformNode): this {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
      child.markDirty();
    }
    return this;
  }

  markDirty(): void {
    this.isDirty = true;
    for (const c of this.children) c.markDirty();
  }

  /**
   * Reconciles matrices with anchor offset:
   * M_local = T(pos) * R(rot) * S(scale) * T(-anchor * size)
   */
  updateMatrix(): void {
    if (!this.isDirty) return;

    // Pivot offset
    const px = this.anchor[0] * this.size[0];
    const py = this.anchor[1] * this.size[1];
    const pz = this.anchor[2] * this.size[2];

    const tPre = new THREE.Matrix4().makeTranslation(-px, -py, -pz);
    const s = new THREE.Matrix4().makeScale(this.scale[0], this.scale[1], this.scale[2]);
    const r = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(this.rotation[0], this.rotation[1], this.rotation[2], 'XYZ')
    );
    const tPost = new THREE.Matrix4().makeTranslation(this.position[0], this.position[1], this.position[2]);

    this.localMatrix.identity().multiply(tPost).multiply(r).multiply(s).multiply(tPre);

    if (this.parent) {
      this.parent.updateMatrix();
      this.worldMatrix.multiplyMatrices(this.parent.worldMatrix, this.localMatrix);
    } else {
      this.worldMatrix.copy(this.localMatrix);
    }

    this.isDirty = false;
  }

  getWorldMatrix(): THREE.Matrix4 {
    this.updateMatrix();
    return this.worldMatrix;
  }

  /**
   * World position of local (0, 0, 0)
   */
  getWorldPosition(): V3 {
    this.updateMatrix();
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(this.worldMatrix);
    return [pos.x, pos.y, pos.z];
  }

  /**
   * World position of the designated pivot / anchor point
   */
  getPivotWorldPosition(): V3 {
    const v = new THREE.Vector3(this.position[0], this.position[1], this.position[2]);
    if (this.parent) {
      v.applyMatrix4(this.parent.getWorldMatrix());
    }
    return [v.x, v.y, v.z];
  }
}

export class LayoutNode extends TransformNode {
  pin?: ViewportPin;
  margin: LayoutMargin = { top: 40, right: 40, bottom: 40, left: 40 };

  // 3D Anchor State
  isPinned3D = false;
  pinnedWorldPos?: V3;
  depthScale = 1.0;
  isOccluded = false;

  constructor(id = 'layout_node') {
    super(id);
  }

  setPin(pin: ViewportPin, margin: LayoutMargin = {}): this {
    this.pin = pin;
    this.margin = { ...this.margin, ...margin };
    this.markDirty();
    return this;
  }

  /**
   * Pins a 2D screen element to a 3D vertex in world space with depth scaling
   */
  pinToWorldVertex(worldPos: V3, cam: THREE.Camera, opts: { screenOffset?: [number, number]; minScale?: number; maxScale?: number } = {}): this {
    const proj = ViewportSpace.worldToScreen(worldPos, cam);
    if (!proj) {
      this.isPinned3D = false;
      this.isOccluded = true;
      return this;
    }

    this.isPinned3D = true;
    this.isOccluded = false;
    this.pinnedWorldPos = worldPos;

    let sx = proj[0] + (opts.screenOffset?.[0] ?? 0);
    let sy = proj[1] + (opts.screenOffset?.[1] ?? 0);

    const depthZ = Math.max(0.1, proj[2]);
    let dScale = 5.0 / depthZ;
    if (opts.minScale) dScale = Math.max(opts.minScale, dScale);
    if (opts.maxScale) dScale = Math.min(opts.maxScale, dScale);
    this.depthScale = dScale;

    this.setPosition(sx, sy, 0);
    this.setScale(dScale, dScale, 1);
    return this;
  }

  /**
   * Resolves declarative viewport pin to screen coordinates (1920x1080)
   */
  resolveLayout(w = W, h = H): void {
    if (this.isPinned3D || !this.pin) return;

    let x = 0, y = 0;
    const m = this.margin;
    const mt = m.top ?? 0, mr = m.right ?? 0, mb = m.bottom ?? 0, ml = m.left ?? 0;

    switch (this.pin) {
      case 'top-left':
        x = ml;
        y = mt;
        break;
      case 'top-center':
        x = w / 2;
        y = mt;
        break;
      case 'top-right':
        x = w - mr;
        y = mt;
        break;
      case 'center-left':
        x = ml;
        y = h / 2;
        break;
      case 'center':
        x = w / 2;
        y = h / 2;
        break;
      case 'center-right':
        x = w - mr;
        y = h / 2;
        break;
      case 'bottom-left':
        x = ml;
        y = h - mb;
        break;
      case 'bottom-center':
        x = w / 2;
        y = h - mb;
        break;
      case 'bottom-right':
        x = w - mr;
        y = h - mb;
        break;
    }

    this.setPosition(x, y, 0);
  }
}
