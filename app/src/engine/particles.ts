// Stateless Analytical GPU Particles (AnalyticalParticles)
// Evaluates closed-form physics p_i(t) = p0 + v0*tau + 0.5*g*tau^2 + turbulence(tau)
// directly on the GPU without simulation history or numerical Euler drift.
// Bit-identical sampling in forward or reverse directions at any sub-frame (1..324 spp).
import * as THREE from 'three';
import { type V3 } from './camera3d';

export interface ParticleEmitterOpts {
  capacity?: number;
  origin?: V3;
  direction?: V3;
  speed?: number;
  spread?: number;       // cone angle in radians
  lifetime?: number;    // seconds (default: 2.5)
  gravity?: V3;
  turbulence?: number;  // amplitude of analytical noise
  size?: number;        // particle radius in world units
  color?: [number, number, number, number];
  glow?: number;        // HDR bloom boost
}

const VERT = /* glsl */ `
precision highp float;

in vec3 position;          // billboard quad corner [-1, 1], z=0
in vec3 iOrigin;           // particle base origin p0
in vec3 iVelocity;         // particle initial velocity v0
in vec2 iLifetime;         // [birthOffset, totalLifetime]
in vec4 iColor;            // base color
in vec2 iSize;             // [size, turbulenceAmp]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform vec3 gravity;

out vec2 vUv;
out vec4 vColor;
out float vLifeNorm;

// Analytical pseudo-random hash
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Analytical low-cost 3D noise
vec3 curlNoise(vec3 p, float t) {
  float n1 = sin(p.y * 1.5 + t * 2.0) * cos(p.z * 1.5);
  float n2 = sin(p.z * 1.5 + t * 2.0) * cos(p.x * 1.5);
  float n3 = sin(p.x * 1.5 + t * 2.0) * cos(p.y * 1.5);
  return vec3(n1, n2, n3);
}

void main() {
  vUv = position.xy;
  vColor = iColor;

  float birthOffset = iLifetime.x;
  float lifetime = max(iLifetime.y, 0.1);

  // Closed-form temporal phase tau = (time - birth) mod lifetime
  float elapsed = time - birthOffset;
  float tau = mod(elapsed, lifetime);
  vLifeNorm = tau / lifetime;

  // Closed-form ballistic trajectory
  vec3 p0 = iOrigin;
  vec3 v0 = iVelocity;
  vec3 p = p0 + v0 * tau + 0.5 * gravity * (tau * tau);

  // Add analytical curl turbulence
  float turb = iSize.y;
  if (turb > 0.001) {
    p += curlNoise(p * 0.8, time * 0.5) * (turb * sin(vLifeNorm * 3.14159));
  }

  // Camera billboard expansion in view space
  vec4 viewPos = modelViewMatrix * vec4(p, 1.0);
  float radius = iSize.x;
  viewPos.xy += position.xy * radius;

  gl_Position = projectionMatrix * viewPos;
}
`;

const FRAG = /* glsl */ `
precision highp float;

in vec2 vUv;
in vec4 vColor;
in float vLifeNorm;

out vec4 fragColor;

void main() {
  // Soft radial disc profile
  float d = length(vUv);
  if (d > 1.0) discard;

  float radialAlpha = smoothstep(1.0, 0.1, d);
  // Smooth sine fade over particle lifetime
  float lifeFade = sin(vLifeNorm * 3.14159265);

  float finalAlpha = radialAlpha * lifeFade * vColor.a;
  if (finalAlpha <= 0.001) discard;

  // Premultiplied alpha output
  fragColor = vec4(vColor.rgb * finalAlpha, finalAlpha);
}
`;

export class AnalyticalParticles {
  private geo: THREE.InstancedBufferGeometry;
  private mat: THREE.RawShaderMaterial;
  private mesh: THREE.Mesh;
  private scene = new THREE.Scene();

  private originArr: Float32Array;
  private velArr: Float32Array;
  private lifeArr: Float32Array;
  private colorArr: Float32Array;
  private sizeArr: Float32Array;

  private attrs: THREE.InstancedBufferAttribute[];
  private count = 0;

  constructor(public readonly capacity = 4096, private readonly seed = 1337) {
    this.geo = new THREE.InstancedBufferGeometry();

    // Quad covering [-1, 1] with z=0 and itemSize: 3 (eliminates boundingSphere NaN)
    const quadVertices = new Float32Array([
      -1, -1, 0,
       1, -1, 0,
       1,  1, 0,
      -1, -1, 0,
       1,  1, 0,
      -1,  1, 0,
    ]);
    this.geo.setAttribute('position', new THREE.BufferAttribute(quadVertices, 3));

    this.originArr = new Float32Array(capacity * 3);
    this.velArr = new Float32Array(capacity * 3);
    this.lifeArr = new Float32Array(capacity * 2);
    this.colorArr = new Float32Array(capacity * 4);
    this.sizeArr = new Float32Array(capacity * 2);

    this.attrs = [
      new THREE.InstancedBufferAttribute(this.originArr, 3),
      new THREE.InstancedBufferAttribute(this.velArr, 3),
      new THREE.InstancedBufferAttribute(this.lifeArr, 2),
      new THREE.InstancedBufferAttribute(this.colorArr, 4),
      new THREE.InstancedBufferAttribute(this.sizeArr, 2),
    ];
    // StaticDrawUsage: emitter configuration written once on CPU, never re-uploaded per frame
    this.attrs.forEach((a) => a.setUsage(THREE.StaticDrawUsage));

    this.geo.setAttribute('iOrigin', this.attrs[0]!);
    this.geo.setAttribute('iVelocity', this.attrs[1]!);
    this.geo.setAttribute('iLifetime', this.attrs[2]!);
    this.geo.setAttribute('iColor', this.attrs[3]!);
    this.geo.setAttribute('iSize', this.attrs[4]!);

    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        time: { value: 0 },
        gravity: { value: new THREE.Vector3(0, -0.4, 0) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor, // Additive glow
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  clear(): void {
    this.count = 0;
    this.geo.instanceCount = 0;
    this.emitterIds.clear();
    this.emitterIndex = 0;
  }

  private emitterIds = new Set<string>();
  private emitterIndex = 0;

  /**
   * Add a procedural emitter with closed-form seed generation and direction-aligned velocity cone.
   * NOTE: gravity is scene-global (single shared uniform). Per-emitter gravity overwrites.
   */
  addEmitter(id: string, opts: ParticleEmitterOpts = {}): this {
    if (this.emitterIds.has(id)) console.warn(`[particles] Duplicate emitter id '${id}' — particles will stack. Use unique ids.`);
    this.emitterIds.add(id);
    const eIdx = this.emitterIndex++;
    const emitterCount = opts.capacity ?? 256;
    const origin = opts.origin ?? [0, 0, 0];
    const dir = opts.direction ?? [0, 1, 0];
    const speed = opts.speed ?? 1.5;
    const spread = opts.spread ?? 0.4;
    const lifetime = opts.lifetime ?? 2.5;
    const turb = opts.turbulence ?? 0.2;
    const size = opts.size ?? 0.06;
    const col = opts.color ?? [1, 0.4, 0.1, 0.8];
    const glow = opts.glow ?? 1.5;

    if (opts.gravity) {
      const cur = this.mat.uniforms.gravity.value as THREE.Vector3;
      if ((cur.x !== 0 || cur.y !== -0.4 || cur.z !== 0) &&
          (cur.x !== opts.gravity[0] || cur.y !== opts.gravity[1] || cur.z !== opts.gravity[2])) {
        console.warn('[particles] Per-emitter gravity overwrites shared uniform — all emitters share one gravity. Second value wins.');
      }
      cur.set(opts.gravity[0], opts.gravity[1], opts.gravity[2]);
    }

    // Construct orthonormal frame around direction vector D
    const dLen = Math.hypot(dir[0], dir[1], dir[2]) || 1.0;
    const D: V3 = [dir[0] / dLen, dir[1] / dLen, dir[2] / dLen];
    const upRef: V3 = Math.abs(D[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];

    // R = norm(upRef x D)
    const rx = upRef[1] * D[2] - upRef[2] * D[1];
    const ry = upRef[2] * D[0] - upRef[0] * D[2];
    const rz = upRef[0] * D[1] - upRef[1] * D[0];
    const rLen = Math.hypot(rx, ry, rz) || 1.0;
    const R: V3 = [rx / rLen, ry / rLen, rz / rLen];

    // U = D x R
    const U: V3 = [
      D[1] * R[2] - D[2] * R[1],
      D[2] * R[0] - D[0] * R[2],
      D[0] * R[1] - D[1] * R[0],
    ];

    for (let i = 0; i < emitterCount; i++) {
      if (this.count >= this.capacity) break;
      const idx = this.count++;
      // Seeded by (constructor seed, emitter index, particle i) — decorrelates emitters.
      const s = this.seed + eIdx * 101.7 + idx * 0.137;

      // Seeded jitter on origin (seeded by constructor seed + particle index)
      const jitter = 0.1;
      const ox = origin[0] + (Math.sin((i + s) * 12.9898) * jitter);
      const oy = origin[1] + (Math.cos((i + s) * 78.233) * jitter);
      const oz = origin[2] + (Math.sin((i + s) * 45.164) * jitter);

      this.originArr[idx * 3 + 0] = ox;
      this.originArr[idx * 3 + 1] = oy;
      this.originArr[idx * 3 + 2] = oz;

      // Cone velocity rotated along direction D (seeded — decorrelates emitters)
      const theta = (Math.sin((i + s) * 93.123) * 0.5 + 0.5) * spread;
      const phi = (Math.cos((i + s) * 37.456) * 0.5 + 0.5) * Math.PI * 2;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);

      const vx = (D[0] * cosT + (R[0] * Math.cos(phi) + U[0] * Math.sin(phi)) * sinT) * speed;
      const vy = (D[1] * cosT + (R[1] * Math.cos(phi) + U[1] * Math.sin(phi)) * sinT) * speed;
      const vz = (D[2] * cosT + (R[2] * Math.cos(phi) + U[2] * Math.sin(phi)) * sinT) * speed;

      this.velArr[idx * 3 + 0] = vx;
      this.velArr[idx * 3 + 1] = vy;
      this.velArr[idx * 3 + 2] = vz;

      // Staggered birth offsets uniformly distributed across lifetime (seeded offset per emitter)
      const birthOffset = ((i + (eIdx * 0.61803398875) % 1) / emitterCount) * lifetime;
      this.lifeArr[idx * 2 + 0] = birthOffset;
      this.lifeArr[idx * 2 + 1] = lifetime;

      // Color with HDR glow
      this.colorArr[idx * 4 + 0] = col[0] * glow;
      this.colorArr[idx * 4 + 1] = col[1] * glow;
      this.colorArr[idx * 4 + 2] = col[2] * glow;
      this.colorArr[idx * 4 + 3] = col[3];

      this.sizeArr[idx * 2 + 0] = size;
      this.sizeArr[idx * 2 + 1] = turb;
    }

    // Upload buffer data ONCE when emitter is added (prevents PCIe bandwidth saturation)
    for (const at of this.attrs) {
      at.needsUpdate = true;
      at.addUpdateRange(0, this.count * at.itemSize);
    }
    this.geo.instanceCount = this.count;

    // Compute analytical bounding box and bounding sphere for Three.js culling
    this.updateBounds(origin, speed, lifetime, opts.gravity, turb, size);

    return this;
  }

  private updateBounds(origin: V3, speed: number, lifetime: number, gravity?: V3, turbulence = 0, size = 0): void {
    const g = gravity ? Math.hypot(gravity[0], gravity[1], gravity[2]) : 0.4;
    // Bounds include ballistic term 0.5*g*t² + turbulence wander + particle size.
    // Note: mesh.frustumCulled=false currently disables culling; bounds kept accurate
    // for future use and for diagnostics. Union across emitters (last-wins replaced).
    const maxRadius = speed * lifetime + 0.5 * g * lifetime * lifetime + turbulence * lifetime + size + 1.0;
    const center = new THREE.Vector3(origin[0], origin[1], origin[2]);
    if (!this.geo.boundingSphere) {
      this.geo.boundingSphere = new THREE.Sphere(center.clone(), maxRadius);
      this.geo.boundingBox = new THREE.Box3(
        new THREE.Vector3(origin[0] - maxRadius, origin[1] - maxRadius, origin[2] - maxRadius),
        new THREE.Vector3(origin[0] + maxRadius, origin[1] + maxRadius, origin[2] + maxRadius)
      );
    } else {
      // Expand existing sphere/box to enclose new emitter.
      const s = this.geo.boundingSphere;
      const d = center.distanceTo(s.center);
      const need = d + maxRadius;
      if (need > s.radius) {
        // Move center toward new emitter proportionally and grow to enclose.
        const t = maxRadius / need;
        s.center.lerp(center, t);
        s.radius = need;
      }
      this.geo.boundingBox!.expandByPoint(new THREE.Vector3(origin[0] - maxRadius, origin[1] - maxRadius, origin[2] - maxRadius));
      this.geo.boundingBox!.expandByPoint(new THREE.Vector3(origin[0] + maxRadius, origin[1] + maxRadius, origin[2] + maxRadius));
    }
  }

  /**
   * Render particles into target at time t. Enforces WebGL State Cache Invariant.
   * Zero per-frame buffer uploads: only the temporal uniform advances.
   */
  render(renderer: THREE.WebGLRenderer, cam: THREE.Camera, target: THREE.WebGLRenderTarget | null, t: number): void {
    if (this.count === 0) return;

    this.mat.uniforms.time.value = t;

    renderer.setRenderTarget(target);
    renderer.render(this.scene, cam);

    // Enforce WebGL state cache invariant
    renderer.resetState();
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
