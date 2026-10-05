// Milestone 4 Showcase Scene: Declarative Scene DSL, CompositorGraph & SceneGraph
// Authored via defineScene() boilerplate shield, demonstrating:
// - CameraRig (centripetal Catmull-Rom arc-length spline flight)
// - AnalyticalParticles (stateless deterministic GPU emitter)
// - Procedural 3D line geometry via LineBatch
// - GPU rounded rects, rings, reticles & soft drop shadows via SDFBatch
// - KineticText typography with knockout halos & numeric rollers
// - Multi-layer compositing via CompositorGraph
// - Automatic SceneGraph entity registration and zero-annotation telemetry sync
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../engine/dsl';
import { type Frame } from '../engine/scene';
import { TAU, ease } from '../engine/util';

export default defineScene({
  id: 'demo',
  duration: 5.0,
  rigMode: 'perspective',
  particleCapacity: 1024,
  lineCapacity: 2048,
  sdfCapacity: 2048,

  setup: async (ctx: SceneContext) => {
    // 1. Configure CameraRig with smooth centripetal Catmull-Rom flight path
    ctx.rig.setLensMm(45);
    ctx.rig.setPath([
      { t: 0.0, pos: [0, 1.8, -8.0], target: [0, 0, 0], roll: 0, focalLength: 45 },
      { t: 0.5, pos: [3.5, 2.2, -7.0], target: [0, 0, 0], roll: 0.08, focalLength: 48 },
      { t: 1.0, pos: [0, 0.6, -6.5], target: [0, 0, 0], roll: 0, focalLength: 52 },
    ]);

    // 2. Add stateless analytical particle emitter at origin
    ctx.particles.addEmitter('gyro_core', {
      capacity: 384,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 1.2,
      spread: 0.6,
      lifetime: 2.2,
      gravity: [0, -0.3, 0],
      turbulence: 0.25,
      size: 0.05,
      color: [ctx.lin.ember[0], ctx.lin.ember[1], ctx.lin.ember[2], 0.85],
      glow: 1.8,
    });

    // 3. Register responsive 3D anchor layout node
    ctx.node('gyro_callout', { role: 'callout', size: [120, 32, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    // 1. Evaluate CameraRig flight trajectory & synchronize
    ctx.updateCamera(t, progress);

    // 2. Prepare Procedural 3D Geometry via LineBatch
    ctx.lines.clear();
    const ringSegments = 48;
    const ringRadius = 2.2;
    const rotSpeed = t * 0.8 + ctx.motion.lfo('noise', 0.5, t) * 0.1;

    for (let r = 0; r < 3; r++) {
      const tilt = (r * TAU) / 3 + t * 0.2;
      const ringCol: [number, number, number, number] = r === 0
        ? [lin.signal[0], lin.signal[1], lin.signal[2], 0.85]
        : [lin.bone[0], lin.bone[1], lin.bone[2], 0.45];

      for (let i = 0; i < ringSegments; i++) {
        const a0 = (i * TAU) / ringSegments + rotSpeed * (r % 2 === 0 ? 1 : -1);
        const a1 = ((i + 1) * TAU) / ringSegments + rotSpeed * (r % 2 === 0 ? 1 : -1);

        const p0x = Math.cos(a0) * ringRadius * Math.cos(tilt);
        const p0y = Math.sin(a0) * ringRadius;
        const p0z = Math.cos(a0) * ringRadius * Math.sin(tilt);

        const p1x = Math.cos(a1) * ringRadius * Math.cos(tilt);
        const p1y = Math.sin(a1) * ringRadius;
        const p1z = Math.cos(a1) * ringRadius * Math.sin(tilt);

        ctx.lines.seg(p0x, p0y, p0z, p1x, p1y, p1z, 1.25, ringCol[0], ringCol[1], ringCol[2], ringCol[3]);
      }
    }

    // Grid floor lines
    const gridDim = 8;
    const gridSpacing = 0.8;
    for (let x = -gridDim; x <= gridDim; x++) {
      const alpha = Math.max(0, 1 - Math.abs(x) / gridDim) * 0.25;
      const col: [number, number, number, number] = [lin.graphite[0], lin.graphite[1], lin.graphite[2], alpha];
      ctx.lines.seg(
        x * gridSpacing, -1.8, -gridDim * gridSpacing,
        x * gridSpacing, -1.8, gridDim * gridSpacing,
        0.75,
        col[0], col[1], col[2], col[3]
      );
    }

    // 3. Update LayoutNode 3D Anchor Pin to top of gyro ring
    const calloutNode = ctx.node('gyro_callout');
    const gyroApexWorld: [number, number, number] = [0, 2.2, 0];
    calloutNode.pinToWorldVertex(gyroApexWorld, ctx.threeCam, {
      screenOffset: [0, -32],
      minScale: 0.7,
      maxScale: 1.2,
    });

    // 4. Render 2D Vector Primitives via SDFBatch
    ctx.sdf.clear();

    // Physical spring entrance with initial velocity v0 for telemetry HUD card
    const cardEntrance = ctx.motion.spring(0.2, t, { freq: 3.0, damping: 0.72, v0: 2.5 });
    const cardW = 340, cardH = 140;
    const cardX = W - cardW - 80;
    const cardY = 80 + (1 - cardEntrance) * 40;
    const cardAlpha = Math.min(1, Math.max(0, cardEntrance));

    if (cardAlpha > 0.01) {
      // Draw card using ctx boilerplate shield
      ctx.card('hud_card', {
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
        radius: [12, 12, 12, 12],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.bone[0], lin.bone[1], lin.bone[2], 0.25 * cardAlpha],
        strokeWidth: 1.5,
        shadow: { blur: 24, color: [0, 0, 0, 0.45 * cardAlpha], offset: [0, 8] },
        role: 'hud',
        opacity: cardAlpha,
      });

      // Animated radial gauge ring with trim path
      const gaugeRadius = 36;
      const gaugeCx = cardX + 54;
      const gaugeCy = cardY + cardH / 2;
      const gaugeTrim = Math.min(1, Math.max(0, progress * 1.05));

      ctx.ring({
        cx: gaugeCx,
        cy: gaugeCy,
        radius: gaugeRadius,
        thickness: 4.0,
        trim: [0, 1],
        color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.3 * cardAlpha],
      });
      ctx.ring({
        cx: gaugeCx,
        cy: gaugeCy,
        radius: gaugeRadius,
        thickness: 4.0,
        trim: [0, gaugeTrim],
        color: [lin.signal[0], lin.signal[1], lin.signal[2], cardAlpha],
        glow: 1.2,
      });
    }

    // Reticle on 3D anchor if visible
    if (!calloutNode.isOccluded) {
      const calloutPos = calloutNode.position;
      ctx.reticle({
        cx: calloutPos[0],
        cy: calloutPos[1] + 32,
        size: 12,
        thickness: 1.25,
        color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.85],
      });
    }

    // 5. Render 2D Kinetic Typography & HUD Overlays
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    // Headline with staggered entrance
    ctx.text('hero_title', 'AGENTIC MOTION DESIGN', {
      fontSize: 42,
      fontWeight: 900,
      color: ctx.rgba('bone', 0.98),
      letterSpacing: 6,
      role: 'headline',
    }).withKnockoutHalo(3.5, ctx.rgba('ink', 0.95));

    ctx.text('subtitle', 'DUAL-MODE RIG, 3D ANCHORS & GPU PARTICLES', {
      fontSize: 16,
      fontWeight: 600,
      color: ctx.rgba('signal', 0.92),
      letterSpacing: 3,
      role: 'callout',
    }).withKnockoutHalo(2.0, ctx.rgba('ink', 0.9));

    const titleEnter = ease.outExpo(Math.min(1, progress * 3));
    ctx.renderText('hero_title', c2d, t, 80, 140 - (1 - titleEnter) * 30);
    ctx.renderText('subtitle', c2d, t, 84, 195);

    // Counter inside card
    if (cardAlpha > 0.01) {
      const counterText = ctx.text('counter', '00', {
        fontSize: 28,
        fontWeight: 700,
        color: ctx.rgba('bone', 0.95),
        align: 'center',
        role: 'hud',
      });
      const pct = Math.round(progress * 100);
      counterText.numericRoll(pct, (n) => `${n}%`);
      ctx.renderText('counter', c2d, t, cardX + 54, cardY + cardH / 2 - 14);

      // Card details
      c2d.save();
      c2d.fillStyle = ctx.rgba('bone', 0.9 * cardAlpha);
      c2d.font = '600 13px "IBMPlexMono", monospace';
      c2d.letterSpacing = '1px';
      c2d.fillText('ANALYTIC SDF SYSTEM', cardX + 112, cardY + 34);

      c2d.fillStyle = ctx.rgba('ash', 0.7 * cardAlpha);
      c2d.font = '400 11px "IBMPlexMono", monospace';
      c2d.fillText(`FRAME: ${(progress * 300).toFixed(0)} / 300`, cardX + 112, cardY + 58);
      c2d.fillText(`SPRING: ${cardEntrance.toFixed(2)} (v0=2.5)`, cardX + 112, cardY + 78);
      c2d.fillText(`RIG: CATMULL-ROM C1`, cardX + 112, cardY + 98);
      c2d.restore();
    }

    // Callout label
    if (!calloutNode.isOccluded) {
      ctx.text('callout_label', '3D GYROSCOPE ANCHOR', {
        fontSize: 12,
        fontWeight: 600,
        color: ctx.rgba('bone', 0.9),
        letterSpacing: 1,
        role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));

      const calloutPos = calloutNode.position;
      ctx.renderText('callout_label', c2d, t, calloutPos[0] + 16, calloutPos[1] + 24);
    }

    // Bottom telemetry bar
    c2d.save();
    c2d.fillStyle = ctx.rgba('ash', 0.75);
    c2d.font = '400 13px "IBMPlexMono", monospace';
    c2d.letterSpacing = '1px';
    c2d.fillText(`TIME: ${t.toFixed(3)}s | PROGRESS: ${(progress * 100).toFixed(1)}% | CLOSED-FORM f(t)`, 84, H - 80);
    c2d.fillText('STATUS: MILESTONE 4 COMPLETE | DSL + COMPOSITOR + SCENEGRAPH ACTIVE', 84, H - 56);
    c2d.restore();

    // 6. Evaluate Multi-Layer CompositorGraph
    ctx.compositor.clear();
    ctx.compositor.createLayer('stage_3d', {
      render: (target) => {
        ctx.particles.render(renderer, ctx.threeCam, target, t);
        ctx.lines.render(renderer, target, ctx.threeCam);
      },
      blend: 'normal',
      opacity: 1.0,
    });

    ctx.compositor.createLayer('hud_vectors', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal', opacity: 1.0 });
      },
      blend: 'normal',
      opacity: 1.0,
    });

    ctx.compositor.evaluate(renderer, out);

    // 7. Telemetry sync & WebGL state invariant
    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();
  },
});
