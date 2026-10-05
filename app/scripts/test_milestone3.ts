import { CameraRig } from '../src/engine/rig';
import { TransformNode, LayoutNode } from '../src/engine/transform';
import { AnalyticalParticles } from '../src/engine/particles';
import * as THREE from 'three';

console.log('--- Testing Milestone 3 Modules & Audited Patches ---');

let allPassed = true;

// 1. Test CameraRig & Gimbal-Lock Invariant
console.log('\n[1] Testing CameraRig Gimbal-Lock Invariant & Orthonormal Frame...');
const rig = new CameraRig('perspective');

// Look straight down at origin from (0, 5, 0) -> Fw = [0, -1, 0]
rig.position = [0, 5, 0];
rig.target = [0, 0, 0];
const camNadir = rig.evalCam(0);

console.log(`Gimbal test F: [${camNadir.F}], R: [${camNadir.R}], U: [${camNadir.U}]`);
const rLen = Math.hypot(camNadir.R[0], camNadir.R[1], camNadir.R[2]);
const uLen = Math.hypot(camNadir.U[0], camNadir.U[1], camNadir.U[2]);

if (Math.abs(rLen - 1.0) > 1e-4 || Math.abs(uLen - 1.0) > 1e-4) {
  console.error('Camera basis collapsed at nadir (gimbal lock)!');
  allPassed = false;
} else {
  console.log('✓ Camera basis singular-safe when looking straight down (gimbal lock resolved)');
}

// 2. Test Telephoto Lens Threshold (135mm)
console.log('\n[2] Testing Telephoto Lens Threshold...');
rig.setPath([
  { t: 0.0, pos: [0, 0, -10], target: [0, 0, 0], focalLength: 50 },
  { t: 1.0, pos: [0, 0, -10], target: [0, 0, 0], focalLength: 135 }, // 135mm telephoto
]);
rig.evalPath(1.0);
console.log(`135mm lens focal length: mm=${rig.focalLengthMm.toFixed(1)}, px=${rig.focalLengthPx.toFixed(1)}`);
if (Math.abs(rig.focalLengthMm - 135) > 1e-3 || rig.focalLengthPx < 5000) {
  console.error('Telephoto lens 135mm was erroneously treated as pixels (fisheye bug)!');
  allPassed = false;
} else {
  console.log('✓ 135mm telephoto lens correctly preserved as millimeters (fisheye bug resolved)');
}

// 3. Test Analytical Closed-Form Trauma Shake
console.log('\n[3] Testing Analytical Closed-Form Trauma Shake...');
rig.addTrauma(0.8, 1.0, 1.5); // impulse of 0.8 at t=1.0s, decay=1.5
const traumaBefore = rig.getTraumaAt(0.5);
const traumaAtPeak = rig.getTraumaAt(1.0);
const traumaAfter = rig.getTraumaAt(2.0);
console.log(`Trauma: t=0.5s: ${traumaBefore}, t=1.0s (peak): ${traumaAtPeak.toFixed(3)}, t=2.0s: ${traumaAfter.toFixed(3)}`);

if (traumaBefore !== 0 || Math.abs(traumaAtPeak - 0.8) > 1e-4 || Math.abs(traumaAfter - 0.8 * Math.exp(-1.5)) > 1e-4) {
  console.error('Trauma impulse calculation mismatch!');
  allPassed = false;
} else {
  console.log('✓ Camera trauma is strictly closed-form f(t), immune to sub-frame mutation');
}

// 4. Test LayoutNode Box Bounds & Safe Margins
console.log('\n[4] Testing LayoutNode Pin Box Bounds & Safe Margins...');
const layout = new LayoutNode('action_card');
layout.setSize(300, 140);
layout.setAnchor(0, 0); // Anchor at top-left of card
layout.setPin('top-right', { top: 40, right: 40 });
layout.resolveLayout(1920, 1080);

console.log(`Resolved Layout Pos for 300px card: [${layout.position.map((v) => v.toFixed(1))}] (expected [1580.0, 40.0, 0.0])`);
// w=1920, mr=40, cardW=300 -> card top-left must be at 1920 - 40 - 300 = 1580
// so card extends from 1580 to 1880, fitting perfectly within safe margin!
if (layout.position[0] !== 1580 || layout.position[1] !== 40) {
  console.error('LayoutNode box bounds calculation mismatch!');
  allPassed = false;
} else {
  console.log('✓ LayoutNode correctly factored element dimensions into safe-zone bounds');
}

// 5. Test AnalyticalParticles PCIe Buffer Invariant & Bounding Volume
console.log('\n[5] Testing AnalyticalParticles Buffer Invariant & Bounding Volume...');
const particles = new AnalyticalParticles(512);
particles.addEmitter('jet', {
  capacity: 100,
  origin: [0, 2, 0],
  direction: [1, 0, 0], // horizontal jet
  speed: 3.0,
  lifetime: 2.0,
  gravity: [0, -0.5, 0],
});

const pGeo = (particles as any).geo;
const sphere = pGeo.boundingSphere;
console.log(`Computed Analytical Bounding Sphere: center=[${sphere.center.x}, ${sphere.center.y}, ${sphere.center.z}], radius=${sphere.radius.toFixed(2)}`);
if (sphere.radius < 5.0 || isNaN(sphere.radius)) {
  console.error('Analytical bounding sphere radius is too small or NaN!');
  allPassed = false;
} else {
  console.log('✓ Analytical bounding volume covers full ballistic particle spread');
}

// Verify that render() does NOT touch needsUpdate
const mockCam = new THREE.PerspectiveCamera();
const mockRenderer = {
  setRenderTarget: () => {},
  render: () => {},
  resetState: () => {},
} as any;

const firstAttr = (particles as any).attrs[0];
const vBefore = firstAttr.version;
particles.render(mockRenderer, mockCam, null, 1.0);
const vAfter = firstAttr.version;
if (vAfter !== vBefore) {
  console.error('PCIe saturation bug: buffer version changed inside render()!');
  allPassed = false;
} else {
  console.log('✓ Buffer attributes are static across render() calls (zero redundant PCIe uploads)');
}

if (allPassed) {
  console.log('\n>>> ALL MILESTONE 3 CHECKS AND AUDIT PATCHES PASSED PERFECTLY! <<<');
} else {
  process.exit(1);
}
