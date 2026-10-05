// Milestone 3 Showcase Scene: Spatial Hierarchies, Dual-Mode Camera & Analytical Particles
// Exercises CameraRig (centripetal Catmull-Rom arc-length spline flight, trauma shake),
// LayoutNode (responsive 3D anchor pinning & safe-zone viewport alignment),
// AnalyticalParticles (stateless deterministic closed-form GPU emitters),
// SDFBatch (GPU rounded rects, rings, reticles, soft shadows), and KineticText.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { CameraRig } from '../engine/rig';
import { LayoutNode } from '../engine/transform';
import { AnalyticalParticles } from '../engine/particles';
import { LineBatch } from '../engine/lines';
import { SDFBatch } from '../engine/sdf';
import { KineticText } from '../engine/text';
import { motion } from '../engine/motion';
import { Layer2D, W, H } from '../engine/gl';
import { rgba, LIN } from '../engine/palette';
import { ease, TAU } from '../engine/util';

export default class DemoScene extends Scene {
  private rig = new CameraRig('perspective');
  private particles = new AnalyticalParticles(1024);
  private lines = new LineBatch(2048, { screen2D: false, blend: 'normal' });
  private sdf = new SDFBatch(2048);
  private layer2d = new Layer2D();
  private threeCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);

  // Responsive Layout & 3D Anchor
  private gyroCallout = new LayoutNode('gyro_callout');

  // Kinetic typography nodes
  private heroTitle = new KineticText('AGENTIC MOTION DESIGN', {
    fontSize: 42,
    fontWeight: 900,
    color: rgba('bone', 0.98),
    letterSpacing: 6,
  }).withKnockoutHalo(3.5, rgba('ink', 0.95));

  private subtitle = new KineticText('DUAL-MODE RIG, 3D ANCHORS & GPU PARTICLES', {
    fontSize: 16,
    fontWeight: 600,
    color: rgba('signal', 0.92),
    letterSpacing: 3,
  }).withKnockoutHalo(2.0, rgba('ink', 0.9));

  private counterText = new KineticText('00', {
    fontSize: 28,
    fontWeight: 700,
    color: rgba('bone', 0.95),
    align: 'center',
  });

  private calloutText = new KineticText('3D GYROSCOPE ANCHOR', {
    fontSize: 12,
    fontWeight: 600,
    color: rgba('bone', 0.9),
    letterSpacing: 1,
  }).withKnockoutHalo(1.5, rgba('ink', 0.9));

  override async init(): Promise<void> {
    // 1. Configure CameraRig with smooth centripetal Catmull-Rom flight path
    this.rig.setLensMm(45);
    this.rig.setPath([
      { t: 0.0, pos: [0, 1.8, -8.0], target: [0, 0, 0], roll: 0, focalLength: 45 },
      { t: 0.5, pos: [3.5, 2.2, -7.0], target: [0, 0, 0], roll: 0.08, focalLength: 48 },
      { t: 1.0, pos: [0, 0.6, -6.5], target: [0, 0, 0], roll: 0, focalLength: 52 },
    ]);

    // 2. Add stateless analytical particle emitter at origin
    this.particles.addEmitter('gyro_core', {
      capacity: 384,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 1.2,
      spread: 0.6,
      lifetime: 2.2,
      gravity: [0, -0.3, 0],
      turbulence: 0.25,
      size: 0.05,
      color: [LIN.ember[0], LIN.ember[1], LIN.ember[2], 0.85],
      glow: 1.8,
    });
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): void {
    const { renderer } = this.ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    // 1. Evaluate CameraRig flight trajectory along arc length
    this.rig.evalPath(progress);
    const cam = this.rig.evalCam(t, f.dt);
    this.rig.syncToThreeCamera(cam, this.threeCam);

    // 2. Clear render target
    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);

    // 3. Render Procedural 3D Particles
    this.particles.render(renderer, this.threeCam, out, t);

    // 4. Render Procedural 3D Geometry via LineBatch
    this.lines.clear();

    const ringSegments = 48;
    const ringRadius = 2.2;
    const rotSpeed = t * 0.8 + motion.lfo('noise', 0.5, t) * 0.1;

    for (let r = 0; r < 3; r++) {
      const tilt = (r * TAU) / 3 + t * 0.2;
      const ringCol: [number, number, number, number] = r === 0
        ? [LIN.signal[0], LIN.signal[1], LIN.signal[2], 0.85]
        : [LIN.bone[0], LIN.bone[1], LIN.bone[2], 0.45];

      for (let i = 0; i < ringSegments; i++) {
        const a0 = (i * TAU) / ringSegments + rotSpeed * (r % 2 === 0 ? 1 : -1);
        const a1 = ((i + 1) * TAU) / ringSegments + rotSpeed * (r % 2 === 0 ? 1 : -1);

        const p0x = Math.cos(a0) * ringRadius * Math.cos(tilt);
        const p0y = Math.sin(a0) * ringRadius;
        const p0z = Math.cos(a0) * ringRadius * Math.sin(tilt);

        const p1x = Math.cos(a1) * ringRadius * Math.cos(tilt);
        const p1y = Math.sin(a1) * ringRadius;
        const p1z = Math.cos(a1) * ringRadius * Math.sin(tilt);

        this.lines.seg(p0x, p0y, p0z, p1x, p1y, p1z, 1.25, ringCol[0], ringCol[1], ringCol[2], ringCol[3]);
      }
    }

    // Grid floor lines
    const gridDim = 8;
    const gridSpacing = 0.8;
    for (let x = -gridDim; x <= gridDim; x++) {
      const alpha = Math.max(0, 1 - Math.abs(x) / gridDim) * 0.25;
      const col: [number, number, number, number] = [LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], alpha];
      this.lines.seg(
        x * gridSpacing, -1.8, -gridDim * gridSpacing,
        x * gridSpacing, -1.8, gridDim * gridSpacing,
        0.75,
        col[0], col[1], col[2], col[3]
      );
    }

    this.lines.render(renderer, out, this.threeCam);

    // 5. Update LayoutNode 3D Anchor Pin to top of gyro ring
    const gyroApexWorld: [number, number, number] = [0, 2.2, 0];
    this.gyroCallout.pinToWorldVertex(gyroApexWorld, this.threeCam, {
      screenOffset: [0, -32],
      minScale: 0.7,
      maxScale: 1.2,
    });

    // 6. Render 2D Vector Primitives via SDFBatch
    this.sdf.clear();

    // Physical spring entrance with initial velocity v0 for the telemetry HUD card
    const cardEntrance = motion.spring(0.2, t, { freq: 3.0, damping: 0.72, v0: 2.5 });
    const cardW = 340, cardH = 140;
    const cardX = W - cardW - 80;
    const cardY = 80 + (1 - cardEntrance) * 40;
    const cardAlpha = Math.min(1, Math.max(0, cardEntrance));

    if (cardAlpha > 0.01) {
      // Soft drop shadow
      this.sdf.shadow(cardX, cardY, cardW, cardH, 24, [0, 0, 0, 0.45 * cardAlpha], [0, 8], 12);

      // Translucent panel with rounded corners and bone stroke
      this.sdf.rect(cardX, cardY, cardW, cardH, {
        radius: [12, 12, 12, 12],
        fill: [LIN.ink2[0], LIN.ink2[1], LIN.ink2[2], 0.88 * cardAlpha],
        stroke: [LIN.bone[0], LIN.bone[1], LIN.bone[2], 0.25 * cardAlpha],
        strokeWidth: 1.5,
      });

      // Animated radial gauge ring with trim path
      const gaugeRadius = 36;
      const gaugeCx = cardX + 54;
      const gaugeCy = cardY + cardH / 2;
      const gaugeTrim = Math.min(1, Math.max(0, progress * 1.05));

      // Dim background track
      this.sdf.ring(gaugeCx, gaugeCy, gaugeRadius, 4.0, [0, 1], [LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.3 * cardAlpha]);
      // Active signal indicator with HDR bloom boost
      this.sdf.ring(gaugeCx, gaugeCy, gaugeRadius, 4.0, [0, gaugeTrim], [LIN.signal[0], LIN.signal[1], LIN.signal[2], cardAlpha], 1.2);
    }

    // Reticle on 3D anchor if visible
    if (!this.gyroCallout.isOccluded) {
      const calloutPos = this.gyroCallout.position;
      this.sdf.reticle(calloutPos[0], calloutPos[1] + 32, 12, 1.25, [LIN.signal[0], LIN.signal[1], LIN.signal[2], 0.85]);
    }

    this.sdf.flush(renderer, out);

    // 7. Render 2D Kinetic Typography & HUD Overlays
    this.layer2d.clear();
    const ctx = this.layer2d.ctx;

    // Headline with staggered entrance
    const titleEnter = ease.outExpo(Math.min(1, progress * 3));
    this.heroTitle.render(ctx, t, 80, 140 - (1 - titleEnter) * 30);
    this.subtitle.render(ctx, t, 84, 195);

    // Dynamic numeric gauge roller inside the SDF card
    if (cardAlpha > 0.01) {
      const pct = Math.round(progress * 100);
      this.counterText.numericRoll(pct, (n) => `${n}%`);
      this.counterText.render(ctx, t, cardX + 54, cardY + cardH / 2 - 14);

      // Telemetry card details
      ctx.save();
      ctx.fillStyle = rgba('bone', 0.9 * cardAlpha);
      ctx.font = '600 13px "IBMPlexMono", monospace';
      ctx.letterSpacing = '1px';
      ctx.fillText('ANALYTIC SDF SYSTEM', cardX + 112, cardY + 34);

      ctx.fillStyle = rgba('ash', 0.7 * cardAlpha);
      ctx.font = '400 11px "IBMPlexMono", monospace';
      ctx.fillText(`FRAME: ${(progress * 300).toFixed(0)} / 300`, cardX + 112, cardY + 58);
      ctx.fillText(`SPRING: ${cardEntrance.toFixed(2)} (v0=2.5)`, cardX + 112, cardY + 78);
      ctx.fillText(`RIG: CATMULL-ROM C1`, cardX + 112, cardY + 98);
      ctx.restore();
    }

    // Render 3D pinned callout label
    if (!this.gyroCallout.isOccluded) {
      const calloutPos = this.gyroCallout.position;
      this.calloutText.render(ctx, t, calloutPos[0] + 16, calloutPos[1] + 24);
    }

    // Bottom telemetry bar
    ctx.save();
    ctx.fillStyle = rgba('ash', 0.75);
    ctx.font = '400 13px "IBMPlexMono", monospace';
    ctx.letterSpacing = '1px';
    ctx.fillText(`TIME: ${t.toFixed(3)}s | PROGRESS: ${(progress * 100).toFixed(1)}% | CLOSED-FORM f(t)`, 84, H - 80);
    ctx.fillText('STATUS: MILESTONE 3 COMPLETE | RIG + TRANSFORMS + PARTICLES ACTIVE', 84, H - 56);
    ctx.restore();

    // Composite 2D layer
    const layerTex = this.layer2d.upload();
    this.ctx.comp.draw(renderer, layerTex, out, { mode: 'normal', opacity: 1.0 });
  }

  override dispose(): void {
    this.rig = null as any;
    this.particles.dispose();
    this.lines.dispose();
    this.sdf.dispose();
    this.layer2d.texture.dispose();
  }
}
