// Semantic Scene Graph & Entity Introspection (SceneGraph)
// Central entity registry providing automatic 3D-to-2D screen bounds projection,
// role querying, geometric collision detection, and zero-annotation telemetry synchronization.
import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { type V3 } from './camera3d';
import { TransformNode } from './transform';
import { W, H } from './gl';

export type EntityType = 'mesh' | 'text' | 'vector' | 'camera' | 'light' | 'emitter';
export type EntityRole = 'hero_subject' | 'headline' | 'callout' | 'hud' | 'background';

export interface EntityMetadata {
  id: string;
  type: EntityType;
  role: EntityRole;
  node?: TransformNode;
  worldPos?: V3;
  worldBounds?: [number, number, number, number, number, number]; // [minX, minY, minZ, maxX, maxY, maxZ]
  screenBounds?: [number, number, number, number];               // [minX, minY, maxX, maxY]
  opacity: number;
  text?: string;
  fontPx?: number;
}

export interface CollisionEvent {
  entityA: string;
  entityB: string;
  overlapArea: number;
  overlapPctA: number;
  overlapPctB: number;
}

export class SceneGraph {
  private entities = new Map<string, EntityMetadata>();

  register(entity: EntityMetadata): this {
    this.entities.set(entity.id, entity);
    return this;
  }

  unregister(id: string): this {
    this.entities.delete(id);
    return this;
  }

  get(id: string): EntityMetadata | undefined {
    return this.entities.get(id);
  }

  clear(): void {
    this.entities.clear();
  }

  queryByRole(role: EntityRole): EntityMetadata[] {
    const res: EntityMetadata[] = [];
    for (const e of this.entities.values()) {
      if (e.role === role) res.push(e);
    }
    return res;
  }

  queryByType(type: EntityType): EntityMetadata[] {
    const res: EntityMetadata[] = [];
    for (const e of this.entities.values()) {
      if (e.type === type) res.push(e);
    }
    return res;
  }

  /**
   * Project 3D bounding boxes to 2D screen space for all registered nodes
   */
  updateScreenProjections(cam: THREE.Camera, w = W, h = H): void {
    for (const e of this.entities.values()) {
      if (!e.node) continue;

      const worldMat = e.node.getWorldMatrix();
      const pos = e.node.getWorldPosition();
      e.worldPos = pos;

      // If entity has local bounds, project 8 corners of the bounding box
      const wb = e.worldBounds ?? [
        0, 0, 0,
        e.node.size[0], e.node.size[1], e.node.size[2],
      ];

      const corners: V3[] = [
        [wb[0], wb[1], wb[2]],
        [wb[3], wb[1], wb[2]],
        [wb[0], wb[4], wb[2]],
        [wb[3], wb[4], wb[2]],
        [wb[0], wb[1], wb[5]],
        [wb[3], wb[1], wb[5]],
        [wb[0], wb[4], wb[5]],
        [wb[3], wb[4], wb[5]],
      ];

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let anyVisible = false;

      for (const c of corners) {
        const v = new THREE.Vector3(c[0], c[1], c[2]).applyMatrix4(worldMat);
        const proj = ViewportSpace.worldToScreen([v.x, v.y, v.z], cam, w, h);
        if (proj) {
          anyVisible = true;
          minX = Math.min(minX, proj[0]);
          minY = Math.min(minY, proj[1]);
          maxX = Math.max(maxX, proj[0]);
          maxY = Math.max(maxY, proj[1]);
        }
      }

      if (anyVisible) {
        e.screenBounds = [minX, minY, maxX, maxY];
      } else {
        e.screenBounds = undefined;
      }
    }
  }

  /**
   * Geometric collision detector: flags intersecting 2D bounding boxes
   */
  detectCollisions(roleA?: EntityRole, roleB?: EntityRole): CollisionEvent[] {
    const list = Array.from(this.entities.values()).filter((e) => e.screenBounds && e.opacity > 0.05);
    const collisions: CollisionEvent[] = [];

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!, b = list[j]!;
        if (roleA && a.role !== roleA && b.role !== roleA) continue;
        if (roleB && a.role !== roleB && b.role !== roleB) continue;

        const boxA = a.screenBounds!, boxB = b.screenBounds!;
        const ix0 = Math.max(boxA[0], boxB[0]);
        const iy0 = Math.max(boxA[1], boxB[1]);
        const ix1 = Math.min(boxA[2], boxB[2]);
        const iy1 = Math.min(boxA[3], boxB[3]);

        if (ix1 > ix0 && iy1 > iy0) {
          const overlapArea = (ix1 - ix0) * (iy1 - iy0);
          const areaA = Math.max(1, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]));
          const areaB = Math.max(1, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]));

          collisions.push({
            entityA: a.id,
            entityB: b.id,
            overlapArea,
            overlapPctA: (overlapArea / areaA) * 100,
            overlapPctB: (overlapArea / areaB) * 100,
          });
        }
      }
    }

    return collisions;
  }

  /**
   * Synchronize registered typography / HUD entities into window.__pdoom.textProbes
   */
  syncTelemetry(t: number): void {
    if (typeof window === 'undefined') return;
    const P = (window as any).__pdoom;
    if (!P || !P.probe || !P.textProbes || !P.recordText) return;

    for (const e of this.entities.values()) {
      if (e.type !== 'text' || !e.screenBounds || e.opacity <= 0.001) continue;

      const [minX, minY, maxX, maxY] = e.screenBounds;
      const w = maxX - minX, h = maxY - minY;

      P.textProbes.push({
        frameIdx: P.currentFrameIdx ?? 0,
        t,
        text: e.text ?? e.id,
        fontFamily: 'Archivo, sans-serif',
        fontPx: e.fontPx ?? 24,
        fillStyle: '#FFFFFF',
        globalAlpha: e.opacity,
        layerId: 'scenegraph',
        bbox: [minX, minY, maxX, maxY],
        w,
        h,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        hPct: ((e.fontPx ?? 24) / 1080) * 100,
        isStroke: false,
      });
    }
  }
}
