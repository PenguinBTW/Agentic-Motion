// Milestone 2 Showcase Scene: Procedural Vectors, Analytic SDFs & Telemetry
// Exercises SDFBatch (GPU rounded rects, rings, trim paths, soft drop shadows),
// MotionBus (analytical springs with initial velocity v0, stagger, LFOs),
// KineticText (typographic hierarchy, knockout halos, telemetry bridge),
// and 3D camera pinhole math with zero external audio/lyric dependencies.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { LineBatch } from '../engine/lines';
import { SDFBatch } from '../engine/sdf';
import { KineticText } from '../engine/text';
import { motion } from '../engine/motion';
import { Layer2D, W, H } from '../engine/gl';
import { K, lerpKey, camFromKey } from '../engine/camera3d';
import { ViewportSpace } from '../engine/viewport';
import { rgba, LIN } from '../engine/palette';
import { ease, TAU } from '../engine/util';

export default class DemoScene extends Scene {
  private lines = new LineBatch(2048, { screen2D: false, blend: 'normal' });
  private sdf = new SDFBatch(2048);
  private layer2d = new Layer2D();
  private threeCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);

  // Kinetic typography nodes
  private heroTitle = new KineticText('AGENTIC MOTION DESIGN', {
    fontSize: 42,
    fontWeight: 900,
    color: rgba('bone', 0.98),
    letterSpacing: 6,
  }).withKnockoutHalo(3.5, rgba('ink', 0.95));

  private subtitle = new KineticText('PROCEDURAL VECTOR ENGINE & ANALYTIC SDFs', {
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

  // 3D camera keyframes
  private k0 = K([0, 1.8, -8.0], [0, 0, 0], 0, 950);
  private k1 = K([3.5, 2.2, -7.0], [0, 0, 0], 0.08, 950);
  private k2 = K([0, 0.5, -6.5], [0, 0, 0], 0, 1100);

  override async init(): Promise<void> {
    // Pure procedural setup
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): void {
    const { renderer } = this.ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    // 1. Evaluate smooth 3D camera trajectory
    let key: ReturnType<typeof lerpKey>;
    if (progress < 0.5) {
      const u = ease.inOutCubic(progress * 2);
      key = lerpKey(this.k0, this.k1, u);
    } else {
      const u = ease.inOutCubic((progress - 0.5) * 2);
      key = lerpKey(this.k1, this.k2, u);
    }
    const cam = camFromKey(key);
    ViewportSpace.camToThreeCamera(cam, this.threeCam, W, H);

    // 2. Clear render target
    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);

    // 3. Render Procedural 3D Geometry via LineBatch
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

    // 4. Render 2D Vector Primitives via SDFBatch
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

    this.sdf.render(renderer, out);

    // 5. Render 2D Kinetic Typography & HUD Overlays
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
      ctx.fillText(`STATUS: SDF GPU PIXEL-AA`, cardX + 112, cardY + 98);
      ctx.restore();
    }

    // Bottom telemetry bar
    ctx.save();
    ctx.fillStyle = rgba('ash', 0.75);
    ctx.font = '400 13px "IBMPlexMono", monospace';
    ctx.letterSpacing = '1px';
    ctx.fillText(`TIME: ${t.toFixed(3)}s | PROGRESS: ${(progress * 100).toFixed(1)}% | CLOSED-FORM f(t)`, 84, H - 80);
    ctx.fillText('STATUS: MILESTONE 2 COMPLETE | SDF BATCH + MOTION BUS + KINETIC TEXT', 84, H - 56);
    ctx.restore();

    // Composite 2D layer
    const layerTex = this.layer2d.upload();
    this.ctx.comp.draw(renderer, layerTex, out, { mode: 'normal', opacity: 1.0 });
  }

  override dispose(): void {
    this.lines.geo.dispose();
    this.lines.mat.dispose();
    this.sdf.dispose();
    this.layer2d.texture.dispose();
  }
}
