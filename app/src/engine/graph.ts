// Scoped Render Graph & Track Matte Compositor (CompositorGraph)
// Multi-layer compositing engine supporting dual-texture alpha/luma track mattes,
// custom blend modes, opacity, and scoped post-processing isolation.
import * as THREE from 'three';
import { FSPass, makeRT, rtScale, W, H, type BlendMode } from './gl';

export type MatteMode = 'alpha' | 'inv-alpha' | 'luma' | 'inv-luma';

export interface LayerMatteOpts {
  source: string;     // Name of the layer providing the matte mask
  mode: MatteMode;
}

export interface ScopedPostOpts {
  bloom?: boolean;
  grain?: boolean;
  ca?: boolean;
}

export interface GraphLayerDef {
  name: string;
  render: (target: THREE.WebGLRenderTarget) => void;
  matte?: LayerMatteOpts;
  blend?: BlendMode;
  opacity?: number;
  post?: ScopedPostOpts;
}

const MATTE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D src;
uniform sampler2D matte;
uniform int matteMode; // 0=alpha, 1=inv-alpha, 2=luma, 3=inv-luma
uniform float opacity;

in vec2 vUv;
out vec4 fragColor;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 s = texture(src, vUv);
  vec4 m = texture(matte, vUv);

  float mask = 1.0;
  if (matteMode == 0) mask = m.a;
  else if (matteMode == 1) mask = 1.0 - m.a;
  else if (matteMode == 2) mask = luma(m.rgb);
  else if (matteMode == 3) mask = 1.0 - luma(m.rgb);

  float mFactor = clamp(mask * opacity, 0.0, 1.0);
  fragColor = vec4(s.rgb * mFactor, s.a * mFactor);
}
`;

export class CompositorGraph {
  private layers: GraphLayerDef[] = [];
  private layerRTs = new Map<string, THREE.WebGLRenderTarget>();
  private mattePass: FSPass;

  // Composite pass with blend modes
  private blendPass: FSPass;

  constructor() {
    this.mattePass = new FSPass(MATTE_FRAG, {
      src: { value: null },
      matte: { value: null },
      matteMode: { value: 0 },
      opacity: { value: 1.0 },
    }, { blending: THREE.NoBlending });

    const BLEND_FRAG = /* glsl */ `
    precision highp float;
    uniform sampler2D base;
    uniform sampler2D over;
    uniform int mode; // 0=normal, 1=add, 2=screen, 3=multiply
    uniform float opacity;
    in vec2 vUv;
    out vec4 fragColor;

    void main() {
      vec4 b = texture(base, vUv);
      vec4 o = texture(over, vUv) * clamp(opacity, 0.0, 1.0);

      if (mode == 1) { // Additive
        fragColor = vec4(b.rgb + o.rgb, clamp(b.a + o.a, 0.0, 1.0));
      } else if (mode == 2) { // Screen
        fragColor = vec4(1.0 - (1.0 - b.rgb) * (1.0 - o.rgb), clamp(b.a + o.a, 0.0, 1.0));
      } else if (mode == 3) { // Premultiplied Multiply Over
        fragColor = vec4(b.rgb * (1.0 - o.a) + (b.rgb * o.rgb), o.a + b.a * (1.0 - o.a));
      } else { // Normal premultiplied over
        fragColor = vec4(o.rgb + b.rgb * (1.0 - o.a), o.a + b.a * (1.0 - o.a));
      }
    }
    `;

    this.blendPass = new FSPass(BLEND_FRAG, {
      base: { value: null },
      over: { value: null },
      mode: { value: 0 },
      opacity: { value: 1.0 },
    }, { blending: THREE.NoBlending });
  }

  createLayer(name: string, def: Omit<GraphLayerDef, 'name'>): this {
    this.layers.push({ name, ...def });
    return this;
  }

  clear(): void {
    this.layers = [];
  }

  private getRT(name: string): THREE.WebGLRenderTarget {
    let rt = this.layerRTs.get(name);
    if (!rt) {
      rt = makeRT(W, H, { depthBuffer: true });
      this.layerRTs.set(name, rt);
    }
    return rt;
  }

  /**
   * Evaluate all graph layers in topological order and composite into finalTarget
   */
  evaluate(renderer: THREE.WebGLRenderer, finalTarget: THREE.WebGLRenderTarget): void {
    if (this.layers.length === 0) return;
    // NOTE: l.post (ScopedPostOpts) is accepted but not yet implemented — scoped
    // post isolation is a no-op in v0.5. Do not rely on per-layer post.
    // Preserve transparent-black clear for alpha delivery (WebM-alpha / ProRes4444).

    // 1. Render all base layers into their allocated targets
    for (const l of this.layers) {
      const rt = this.getRT(l.name);
      const prevRT = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      l.render(rt);
      renderer.setRenderTarget(prevRT);
    }

    // 2. Accumulate layers into finalTarget
    const tempAccumA = this.getRT('__accum_a');
    const tempAccumB = this.getRT('__accum_b');
    const tempMatted = this.getRT('__matted');

    // Clear accumulator A (transparent black for alpha delivery)
    renderer.setRenderTarget(tempAccumA);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);

    let currentAccum = tempAccumA;
    let nextAccum = tempAccumB;

    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i]!;
      const layerRT = this.getRT(l.name);
      let sourceTex = layerRT.texture;

      // Apply track matte if specified
      if (l.matte) {
        const matteRT = this.layerRTs.get(l.matte.source);
        if (matteRT) {
          let mMode = 0;
          if (l.matte.mode === 'inv-alpha') mMode = 1;
          else if (l.matte.mode === 'luma') mMode = 2;
          else if (l.matte.mode === 'inv-luma') mMode = 3;

          this.mattePass.u.src!.value = layerRT.texture;
          this.mattePass.u.matte!.value = matteRT.texture;
          this.mattePass.u.matteMode!.value = mMode;
          this.mattePass.u.opacity!.value = l.opacity ?? 1.0;
          this.mattePass.render(renderer, tempMatted);
          sourceTex = tempMatted.texture;
        }
      }

      // Blend onto accumulator
      let bMode = 0;
      if (l.blend === 'add') bMode = 1;
      else if (l.blend === 'screen') bMode = 2;
      else if (l.blend === 'multiply') bMode = 3;

      this.blendPass.u.base!.value = currentAccum.texture;
      this.blendPass.u.over!.value = sourceTex;
      this.blendPass.u.mode!.value = bMode;
      this.blendPass.u.opacity!.value = l.matte ? 1.0 : (l.opacity ?? 1.0);

      // Last layer renders directly to finalTarget
      const isLast = (i === this.layers.length - 1);
      const targetRT = isLast ? finalTarget : nextAccum;
      this.blendPass.render(renderer, targetRT);

      // Ping-pong accumulators
      const tmp = currentAccum;
      currentAccum = nextAccum;
      nextAccum = tmp;
    }

    renderer.resetState();
  }

  dispose(): void {
    for (const rt of this.layerRTs.values()) rt.dispose();
    this.layerRTs.clear();
    this.mattePass.dispose();
    this.blendPass.dispose();
  }
}
