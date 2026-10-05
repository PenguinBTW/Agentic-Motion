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

in vec2 position;          // billboard quad corner [-1, 1]
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
  vUv = position;
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
  viewPos.xy += position * radius;

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

  constructor(public readonly capacity = 4096, seed = 1337) {
    this.geo = new THREE.InstancedBufferGeometry();

    // Quad covering [-1, 1] with z=0
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
    this.attrs.forEach((a) => a.setUsage(THREE.DynamicDrawUsage));

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
  }

  /**
   * Add a procedural emitter with closed-form seed generation
   */
  addEmitter(id: string, opts: ParticleEmitterOpts = {}): this {
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

    for (let i = 0; i < emitterCount; i++) {
      if (this.count >= this.capacity) break;
      const idx = this.count++;

      // Seeded jitter on origin
      const jitter = 0.1;
      const ox = origin[0] + (Math.sin(i * 12.9898) * jitter);
      const oy = origin[1] + (Math.cos(i * 78.233) * jitter);
      const oz = origin[2] + (Math.sin(i * 45.164) * jitter);

      this.originArr[idx * 3 + 0] = ox;
      this.originArr[idx * 3 + 1] = oy;
      this.originArr[idx * 3 + 2] = oz;

      // Cone velocity
      const theta = (Math.sin(i * 93.123) * 0.5 + 0.5) * spread;
      const phi = (Math.cos(i * 37.456) * 0.5 + 0.5) * Math.PI * 2;
      const vx = dir[0] * speed + Math.sin(theta) * Math.cos(phi) * speed * 0.6;
      const vy = dir[1] * speed + Math.cos(theta) * speed * 0.6;
      const vz = dir[2] * speed + Math.sin(theta) * Math.sin(phi) * speed * 0.6;

      this.velArr[idx * 3 + 0] = vx;
      this.velArr[idx * 3 + 1] = vy;
      this.velArr[idx * 3 + 2] = vz;

      // Staggered birth offsets uniformly distributed across lifetime
      const birthOffset = (i / emitterCount) * lifetime;
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

    return this;
  }

  /**
   * Render particles into target at time t. Enforces WebGL State Cache Invariant.
   */
  render(renderer: THREE.WebGLRenderer, cam: THREE.Camera, target: THREE.WebGLRenderTarget | null, t: number): void {
    if (this.count === 0) return;

    for (const at of this.attrs) {
      at.needsUpdate = true;
      at.addUpdateRange(0, this.count * at.itemSize);
    }
    this.geo.instanceCount = this.count;

    this.mat.uniforms.time.value = t;

    renderer.setRenderTarget(target);
    renderer.render(this.scene, cam);

    // Enforce WebGL state cache invariant
    renderer.resetState();

    for (const at of this.attrs) at.clearUpdateRanges();
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
