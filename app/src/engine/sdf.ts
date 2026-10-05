// Analytic GPU Signed Distance Fields (SDFBatch)
// Renders procedural vector primitives (rounded rectangles, rings, compass reticles,
// soft drop shadows) via instanced quads in a WebGL fragment shader using analytic SDFs.
// All coordinates are strictly logical points (1920x1080) with sub-pixel anti-aliasing.
import * as THREE from 'three';
import { W, H, rtScale } from './gl';

export type SDFShapeType = 'rect' | 'circle' | 'ring' | 'shadow';

export interface SDFRectOpts {
  radius?: number | [number, number, number, number]; // uniform or [TL, TR, BR, BL]
  fill?: [number, number, number, number];           // Linear RGBA
  stroke?: [number, number, number, number];         // Linear RGBA
  strokeWidth?: number;
  glow?: number;                                     // Multiplier for HDR bloom
}

export interface SDFShadowOpts {
  radius?: number;
  offset?: [number, number];                         // [dx, dy] in logical px
  color?: [number, number, number, number];          // Linear RGBA
}

const VERT = /* glsl */ `
precision highp float;

in vec3 position;          // quad corner in [-1, 1], z=0
in vec4 iBounds;           // logical [x, y, w, h] (x, y is top-left)
in vec4 iParams;           // [type (0=rect, 1=ring, 2=shadow, 3=reticle), strokeWidth, trimStart, trimEnd]
in vec4 iRadii;            // [rTL, rTR, rBR, rBL] or for shadow: [radius, blur, dx, dy]
in vec4 iFillColor;        // linear RGBA
in vec4 iStrokeColor;      // linear RGBA

uniform vec2 res;          // logical target resolution (1920, 1080)
uniform float pxScale;     // physical scale factor

out vec2 vLocal;           // local pixel coordinate relative to shape center
out vec2 vHalfSize;        // half-extents of the shape in logical px
flat out vec4 vParams;
flat out vec4 vRadii;
flat out vec4 vFillColor;
flat out vec4 vStrokeColor;

void main() {
  vParams = iParams;
  vRadii = iRadii;
  vFillColor = iFillColor;
  vStrokeColor = iStrokeColor;

  float shapeType = iParams.x;
  float strokeW = iParams.y;
  vec2 halfSize = iBounds.zw * 0.5;
  vec2 center = iBounds.xy + halfSize;

  // Expand quad bounds for anti-aliasing fringe (+2px), stroke width, and drop shadow blur
  float padding = max(strokeW * 0.5, 0.0) + 2.0;
  if (shapeType > 1.5 && shapeType < 2.5) { // shadow
    float blur = iRadii.y;
    padding += blur * 2.5;
    center += iRadii.zw; // apply shadow offset to quad center
  }

  vec2 quadHalfExtent = halfSize + vec2(padding);
  vec2 logicalPos = center + position.xy * quadHalfExtent;

  // Pass local position and half extent to fragment shader
  vLocal = position.xy * quadHalfExtent;
  vHalfSize = halfSize;

  // Convert to clip space [-1, 1] with Y pointing up in WebGL
  vec2 ndc = vec2(logicalPos.x / res.x * 2.0 - 1.0, 1.0 - logicalPos.y / res.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

in vec2 vLocal;
in vec2 vHalfSize;
flat in vec4 vParams;
flat in vec4 vRadii;
flat in vec4 vFillColor;
flat in vec4 vStrokeColor;

out vec4 fragColor;

const float PI = 3.14159265358979323846;
const float TAU = 6.28318530717958647692;

// Analytical rounded box SDF with per-corner radius clamped to half dimensions
float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
  float maxR = min(b.x, b.y);
  // r: [TL, TR, BR, BL]. Top has y < 0, Bottom has y > 0
  float rawRad = (p.x > 0.0) ? ((p.y > 0.0) ? r.z : r.y) : ((p.y > 0.0) ? r.w : r.x);
  float rad = min(maxR, rawRad);
  vec2 q = abs(p) - (b - vec2(rad));
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rad;
}

void main() {
  float shapeType = vParams.x;
  float strokeW = vParams.y;
  float trimStart = vParams.z;
  float trimEnd = vParams.w;

  vec4 col = vec4(0.0);

  if (shapeType < 0.5) {
    // ------------------------------------------------------------- 0: Rounded Rect
    float d = sdRoundedBox(vLocal, vHalfSize, vRadii);
    float aa = max(fwidth(d), 0.7);

    // Fill
    if (vFillColor.a > 0.001) {
      float fillAlpha = clamp(0.5 - d / aa, 0.0, 1.0) * vFillColor.a;
      col = vec4(vFillColor.rgb * fillAlpha, fillAlpha);
    }

    // Stroke
    if (strokeW > 0.001 && vStrokeColor.a > 0.001) {
      float dStroke = abs(d + strokeW * 0.5) - strokeW * 0.5;
      float strokeAlpha = clamp(0.5 - dStroke / aa, 0.0, 1.0) * vStrokeColor.a;
      vec3 sRgb = vStrokeColor.rgb * strokeAlpha;
      col.rgb = sRgb + col.rgb * (1.0 - strokeAlpha);
      col.a = strokeAlpha + col.a * (1.0 - strokeAlpha);
    }
  } else if (shapeType < 1.5) {
    // ------------------------------------------------------------- 1: Circle / Ring
    float r = vHalfSize.x;
    float distToCenter = length(vLocal);
    float aa = max(fwidth(distToCenter), 0.7);

    if (strokeW > 0.001) {
      // Ring with thickness
      float d = abs(distToCenter - (r - strokeW * 0.5)) - strokeW * 0.5;
      float alpha = clamp(0.5 - d / aa, 0.0, 1.0);

      // Angular trim path with smooth anti-aliased caps
      if (trimEnd < 0.999 || trimStart > 0.001) {
        float angle = atan(vLocal.y, vLocal.x);
        float u = fract(angle / TAU + 0.25);
        float capAa = max(aa / (TAU * max(r, 1.0)), 0.002);
        float dTrim = 1.0;
        if (trimStart < trimEnd) {
          dTrim = smoothstep(trimStart - capAa, trimStart + capAa, u) * (1.0 - smoothstep(trimEnd - capAa, trimEnd + capAa, u));
        } else {
          dTrim = max(smoothstep(trimStart - capAa, trimStart + capAa, u), 1.0 - smoothstep(trimEnd - capAa, trimEnd + capAa, u));
        }
        alpha *= dTrim;
      }

      alpha *= vStrokeColor.a;
      col = vec4(vStrokeColor.rgb * alpha, alpha);
    } else {
      // Solid Circle
      float d = distToCenter - r;
      float alpha = clamp(0.5 - d / aa, 0.0, 1.0) * vFillColor.a;
      col = vec4(vFillColor.rgb * alpha, alpha);
    }
  } else if (shapeType < 2.5) {
    // ------------------------------------------------------------- 2: Soft Drop Shadow
    // Standard-compliant GLSL ES smoothstep (edge0 < edge1)
    float cornerR = vRadii.x;
    float blur = max(vRadii.y, 0.5);
    vec4 radii = vec4(cornerR);
    float d = sdRoundedBox(vLocal, vHalfSize, radii);

    float shadowAlpha = (1.0 - smoothstep(-blur * 0.5, blur * 1.5, d)) * vFillColor.a;
    col = vec4(vFillColor.rgb * shadowAlpha, shadowAlpha);
  } else {
    // ------------------------------------------------------------- 3: Reticle Widget
    float r = vHalfSize.x;
    float dist = length(vLocal);
    float aa = max(fwidth(dist), 0.7);

    // Outer circle
    float dCircle = abs(dist - r) - strokeW * 0.5;
    float aCircle = clamp(0.5 - dCircle / aa, 0.0, 1.0);

    // Crosshair ticks
    float dCross = min(abs(vLocal.x), abs(vLocal.y)) - strokeW * 0.5;
    float inCross = step(length(vLocal), r * 1.35) * (1.0 - step(length(vLocal), r * 0.45));
    float aCross = clamp(0.5 - dCross / aa, 0.0, 1.0) * inCross;

    float alpha = clamp(aCircle + aCross, 0.0, 1.0) * vStrokeColor.a;
    col = vec4(vStrokeColor.rgb * alpha, alpha);
  }

  if (col.a <= 0.0001) discard;
  fragColor = col;
}
`;

export class SDFBatch {
  private geo: THREE.InstancedBufferGeometry;
  private mat: THREE.RawShaderMaterial;
  private mesh: THREE.Mesh;
  private scene = new THREE.Scene();
  private cam2D = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);

  private boundsArr: Float32Array;
  private paramsArr: Float32Array;
  private radiiArr: Float32Array;
  private fillArr: Float32Array;
  private strokeArr: Float32Array;

  private attrs: THREE.InstancedBufferAttribute[];
  count = 0;

  constructor(public readonly capacity = 2048) {
    this.geo = new THREE.InstancedBufferGeometry();

    // Quad geometry covering [-1, 1] with itemSize: 3 (eliminates Three.js boundingSphere NaN)
    const quadVertices = new Float32Array([
      -1, -1, 0,
       1, -1, 0,
       1,  1, 0,
      -1, -1, 0,
       1,  1, 0,
      -1,  1, 0,
    ]);
    this.geo.setAttribute('position', new THREE.BufferAttribute(quadVertices, 3));

    this.boundsArr = new Float32Array(capacity * 4);
    this.paramsArr = new Float32Array(capacity * 4);
    this.radiiArr = new Float32Array(capacity * 4);
    this.fillArr = new Float32Array(capacity * 4);
    this.strokeArr = new Float32Array(capacity * 4);

    this.attrs = [
      new THREE.InstancedBufferAttribute(this.boundsArr, 4),
      new THREE.InstancedBufferAttribute(this.paramsArr, 4),
      new THREE.InstancedBufferAttribute(this.radiiArr, 4),
      new THREE.InstancedBufferAttribute(this.fillArr, 4),
      new THREE.InstancedBufferAttribute(this.strokeArr, 4),
    ];
    this.attrs.forEach((a) => a.setUsage(THREE.DynamicDrawUsage));

    this.geo.setAttribute('iBounds', this.attrs[0]!);
    this.geo.setAttribute('iParams', this.attrs[1]!);
    this.geo.setAttribute('iRadii', this.attrs[2]!);
    this.geo.setAttribute('iFillColor', this.attrs[3]!);
    this.geo.setAttribute('iStrokeColor', this.attrs[4]!);

    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        res: { value: new THREE.Vector2(W, H) },
        pxScale: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  clear(): void {
    this.count = 0;
  }

  /**
   * Draw an analytic rounded rectangle with optional stroke and glow
   */
  rect(x: number, y: number, w: number, h: number, opts: SDFRectOpts = {}): this {
    if (this.count >= this.capacity) return this;
    const idx = this.count++;
    const glow = opts.glow ?? 1.0;

    // Bounds [x, y, w, h]
    this.boundsArr[idx * 4 + 0] = x;
    this.boundsArr[idx * 4 + 1] = y;
    this.boundsArr[idx * 4 + 2] = w;
    this.boundsArr[idx * 4 + 3] = h;

    // Params: [type=0, strokeWidth, trimStart=0, trimEnd=1]
    const strokeW = opts.strokeWidth ?? 0;
    this.paramsArr[idx * 4 + 0] = 0;
    this.paramsArr[idx * 4 + 1] = strokeW;
    this.paramsArr[idx * 4 + 2] = 0;
    this.paramsArr[idx * 4 + 3] = 1;

    // Radii: [TL, TR, BR, BL]
    const r = opts.radius ?? 0;
    if (Array.isArray(r)) {
      this.radiiArr[idx * 4 + 0] = r[0];
      this.radiiArr[idx * 4 + 1] = r[1];
      this.radiiArr[idx * 4 + 2] = r[2];
      this.radiiArr[idx * 4 + 3] = r[3];
    } else {
      this.radiiArr[idx * 4 + 0] = r;
      this.radiiArr[idx * 4 + 1] = r;
      this.radiiArr[idx * 4 + 2] = r;
      this.radiiArr[idx * 4 + 3] = r;
    }

    // Fill
    const fill = opts.fill ?? [0, 0, 0, 0];
    this.fillArr[idx * 4 + 0] = fill[0] * glow;
    this.fillArr[idx * 4 + 1] = fill[1] * glow;
    this.fillArr[idx * 4 + 2] = fill[2] * glow;
    this.fillArr[idx * 4 + 3] = fill[3];

    // Stroke
    const stroke = opts.stroke ?? [0, 0, 0, 0];
    this.strokeArr[idx * 4 + 0] = stroke[0] * glow;
    this.strokeArr[idx * 4 + 1] = stroke[1] * glow;
    this.strokeArr[idx * 4 + 2] = stroke[2] * glow;
    this.strokeArr[idx * 4 + 3] = stroke[3];
    return this;
  }

  /**
   * Draw an analytic soft drop shadow for a card or panel
   */
  shadow(x: number, y: number, w: number, h: number, blur = 16, color: [number, number, number, number] = [0, 0, 0, 0.4], offset: [number, number] = [0, 6], radius = 8): this {
    if (this.count >= this.capacity) return this;
    const idx = this.count++;

    // Bounds
    this.boundsArr[idx * 4 + 0] = x;
    this.boundsArr[idx * 4 + 1] = y;
    this.boundsArr[idx * 4 + 2] = w;
    this.boundsArr[idx * 4 + 3] = h;

    // Params: [type=2, 0, 0, 0]
    this.paramsArr[idx * 4 + 0] = 2;
    this.paramsArr[idx * 4 + 1] = 0;
    this.paramsArr[idx * 4 + 2] = 0;
    this.paramsArr[idx * 4 + 3] = 0;

    // Radii: [radius, blur, dx, dy]
    this.radiiArr[idx * 4 + 0] = radius;
    this.radiiArr[idx * 4 + 1] = blur;
    this.radiiArr[idx * 4 + 2] = offset[0];
    this.radiiArr[idx * 4 + 3] = offset[1];

    // Color (stored in fill)
    this.fillArr[idx * 4 + 0] = color[0];
    this.fillArr[idx * 4 + 1] = color[1];
    this.fillArr[idx * 4 + 2] = color[2];
    this.fillArr[idx * 4 + 3] = color[3];

    this.strokeArr[idx * 4 + 0] = 0;
    this.strokeArr[idx * 4 + 1] = 0;
    this.strokeArr[idx * 4 + 2] = 0;
    this.strokeArr[idx * 4 + 3] = 0;
    return this;
  }

  /**
   * Draw an analytic ring or trimmed circular gauge
   */
  ring(cx: number, cy: number, radius: number, thickness: number, trim: [number, number] = [0, 1], color: [number, number, number, number] = [1, 1, 1, 1], glow = 1.0): this {
    if (this.count >= this.capacity) return this;
    const idx = this.count++;

    const d = radius * 2;
    this.boundsArr[idx * 4 + 0] = cx - radius;
    this.boundsArr[idx * 4 + 1] = cy - radius;
    this.boundsArr[idx * 4 + 2] = d;
    this.boundsArr[idx * 4 + 3] = d;

    // Params: [type=1, strokeWidth, trimStart, trimEnd]
    this.paramsArr[idx * 4 + 0] = 1;
    this.paramsArr[idx * 4 + 1] = thickness;
    this.paramsArr[idx * 4 + 2] = trim[0];
    this.paramsArr[idx * 4 + 3] = trim[1];

    this.radiiArr[idx * 4 + 0] = radius;
    this.radiiArr[idx * 4 + 1] = radius;
    this.radiiArr[idx * 4 + 2] = radius;
    this.radiiArr[idx * 4 + 3] = radius;

    this.fillArr[idx * 4 + 0] = 0;
    this.fillArr[idx * 4 + 1] = 0;
    this.fillArr[idx * 4 + 2] = 0;
    this.fillArr[idx * 4 + 3] = 0;

    this.strokeArr[idx * 4 + 0] = color[0] * glow;
    this.strokeArr[idx * 4 + 1] = color[1] * glow;
    this.strokeArr[idx * 4 + 2] = color[2] * glow;
    this.strokeArr[idx * 4 + 3] = color[3];
    return this;
  }

  /**
   * Draw an analytic solid circle
   */
  circle(cx: number, cy: number, radius: number, color: [number, number, number, number] = [1, 1, 1, 1], glow = 1.0): this {
    if (this.count >= this.capacity) return this;
    const idx = this.count++;

    const d = radius * 2;
    this.boundsArr[idx * 4 + 0] = cx - radius;
    this.boundsArr[idx * 4 + 1] = cy - radius;
    this.boundsArr[idx * 4 + 2] = d;
    this.boundsArr[idx * 4 + 3] = d;

    // Params: [type=1, strokeWidth=0, 0, 1]
    this.paramsArr[idx * 4 + 0] = 1;
    this.paramsArr[idx * 4 + 1] = 0;
    this.paramsArr[idx * 4 + 2] = 0;
    this.paramsArr[idx * 4 + 3] = 1;

    this.radiiArr[idx * 4 + 0] = radius;
    this.radiiArr[idx * 4 + 1] = radius;
    this.radiiArr[idx * 4 + 2] = radius;
    this.radiiArr[idx * 4 + 3] = radius;

    this.fillArr[idx * 4 + 0] = color[0] * glow;
    this.fillArr[idx * 4 + 1] = color[1] * glow;
    this.fillArr[idx * 4 + 2] = color[2] * glow;
    this.fillArr[idx * 4 + 3] = color[3];

    this.strokeArr[idx * 4 + 0] = 0;
    this.strokeArr[idx * 4 + 1] = 0;
    this.strokeArr[idx * 4 + 2] = 0;
    this.strokeArr[idx * 4 + 3] = 0;
    return this;
  }

  /**
   * Draw an analytic HUD reticle / crosshair target
   */
  reticle(cx: number, cy: number, radius: number, thickness = 1.5, color: [number, number, number, number] = [1, 1, 1, 1], glow = 1.0): this {
    if (this.count >= this.capacity) return this;
    const idx = this.count++;

    const d = radius * 2.8;
    this.boundsArr[idx * 4 + 0] = cx - d * 0.5;
    this.boundsArr[idx * 4 + 1] = cy - d * 0.5;
    this.boundsArr[idx * 4 + 2] = d;
    this.boundsArr[idx * 4 + 3] = d;

    // Params: [type=3, strokeWidth, 0, 1]
    this.paramsArr[idx * 4 + 0] = 3;
    this.paramsArr[idx * 4 + 1] = thickness;
    this.paramsArr[idx * 4 + 2] = 0;
    this.paramsArr[idx * 4 + 3] = 1;

    this.radiiArr[idx * 4 + 0] = radius;
    this.radiiArr[idx * 4 + 1] = radius;
    this.radiiArr[idx * 4 + 2] = radius;
    this.radiiArr[idx * 4 + 3] = radius;

    this.fillArr[idx * 4 + 0] = 0;
    this.fillArr[idx * 4 + 1] = 0;
    this.fillArr[idx * 4 + 2] = 0;
    this.fillArr[idx * 4 + 3] = 0;

    this.strokeArr[idx * 4 + 0] = color[0] * glow;
    this.strokeArr[idx * 4 + 1] = color[1] * glow;
    this.strokeArr[idx * 4 + 2] = color[2] * glow;
    this.strokeArr[idx * 4 + 3] = color[3];
    return this;
  }

  /**
   * Flush batch into render target. Enforces WebGL State Cache Invariant.
   */
  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void {
    if (this.count === 0) return;

    for (const at of this.attrs) {
      at.needsUpdate = true;
      at.addUpdateRange(0, this.count * at.itemSize);
    }
    this.geo.instanceCount = this.count;

    const s = rtScale(target);
    (this.mat.uniforms.res.value as THREE.Vector2).set(target ? target.width / s : W, target ? target.height / s : H);
    this.mat.uniforms.pxScale.value = s;

    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam2D);

    // Enforce WebGL state cache invariant
    renderer.resetState();

    for (const at of this.attrs) at.clearUpdateRanges();
  }

  /** Alias for render() matching Roadmap DSL specifications */
  flush(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void {
    this.render(renderer, target);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
