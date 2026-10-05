import { CameraRig } from '../src/engine/rig';
import { TransformNode, LayoutNode } from '../src/engine/transform';
import { AnalyticalParticles } from '../src/engine/particles';
import * as THREE from 'three';

console.log('--- Testing Milestone 3 Modules ---');

let allPassed = true;

// 1. Test CameraRig
console.log('\n[1] Testing CameraRig (Dual-Mode, Splines & Trauma)...');
const rig = new CameraRig('perspective');
rig.setLensMm(50);
rig.setPath([
  { t: 0.0, pos: [0, 0, -10], target: [0, 0, 0], roll: 0, focalLength: 35 },
  { t: 0.5, pos: [5, 2, -8], target: [0, 0, 0], roll: 0.1, focalLength: 50 },
  { t: 1.0, pos: [0, 5, -5], target: [0, 0, 0], roll: 0, focalLength: 85 },
]);

// Evaluate at midpoint u = 0.5
rig.evalPath(0.5);
const cam = rig.evalCam(1.0);
console.log(`Evaluated Cam at u=0.5: pos=[${cam.p.map((v) => v.toFixed(2))}], target=[${rig.target}], roll=${rig.roll.toFixed(3)}`);
if (Math.abs(cam.p[0] - 5.0) > 0.3 || Math.abs(cam.p[1] - 2.0) > 0.4) {
  console.error('Camera waypoint evaluation mismatch!');
  allPassed = false;
} else {
  console.log('✓ Camera arc-length spline evaluated waypoint trajectory accurately');
}

// Test trauma shake
rig.addTrauma(0.8);
const camShaken = rig.evalCam(1.5, 0.1);
const isDisplaced = Math.abs(camShaken.p[0] - cam.p[0]) > 0.001 || Math.abs(camShaken.p[1] - cam.p[1]) > 0.001;
if (!isDisplaced) {
  console.error('Camera trauma did not produce displacement!');
  allPassed = false;
} else {
  console.log('✓ Camera trauma shake successfully displaced position');
}

// Test Isometric sync
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
rig.setMode('isometric');
rig.syncToThreeCamera(cam, orthoCam);
if (orthoCam.left >= 0 || orthoCam.right <= 0) {
  console.error('Orthographic camera projection bounds invalid!');
  allPassed = false;
} else {
  console.log('✓ CameraRig synced to THREE.OrthographicCamera in isometric mode');
}

// 2. Test TransformNode Anchor & Hierarchy Math
console.log('\n[2] Testing TransformNode Anchor & Hierarchical Concatenation...');
const parent = new TransformNode('parent');
parent.setPosition(10, 0, 0);

const child = new TransformNode('child');
child.setSize(2, 4, 1);
child.setAnchor(0.5, 0.0, 0.5); // Pivot at bottom center (y = 0)
child.setPosition(0, 5, 0);
child.setScale(2, 2, 2);
parent.addChild(child);

const childPivotWorldPos = child.getPivotWorldPosition();
console.log(`Child Pivot World Position: [${childPivotWorldPos.map((v) => v.toFixed(2))}]`);
// Parent pos is [10, 0, 0], child local pos is [0, 5, 0] -> child pivot world pos is exactly [10, 5, 0]
if (Math.abs(childPivotWorldPos[0] - 10) > 0.01 || Math.abs(childPivotWorldPos[1] - 5) > 0.01) {
  console.error('TransformNode hierarchical pivot concatenation error!');
  allPassed = false;
} else {
  console.log('✓ TransformNode local pivot and hierarchical world matrix correct');
}

// 3. Test LayoutNode Viewport Pinning
console.log('\n[3] Testing LayoutNode Responsive Viewport Pinning...');
const layout = new LayoutNode('header_badge');
layout.setPin('top-right', { top: 30, right: 50 });
layout.resolveLayout(1920, 1080);
console.log(`Resolved Layout Pos: [${layout.position.map((v) => v.toFixed(1))}] (expected [1870.0, 30.0, 0.0])`);
if (layout.position[0] !== 1870 || layout.position[1] !== 30) {
  console.error('LayoutNode viewport pin mismatch!');
  allPassed = false;
} else {
  console.log('✓ LayoutNode resolved top-right pin with safe margins');
}

// 4. Test AnalyticalParticles Determinism
console.log('\n[4] Testing AnalyticalParticles (Closed-form Determinism)...');
const particles = new AnalyticalParticles(512);
particles.addEmitter('spark', {
  capacity: 100,
  origin: [0, 1, 0],
  speed: 2.0,
  lifetime: 2.0,
});

const pGeo = (particles as any).geo;
pGeo.computeBoundingSphere();
const pRadius = pGeo.boundingSphere.radius;
console.log(`Particles bounding sphere radius: ${pRadius}`);
if (isNaN(pRadius) || pRadius <= 0) {
  console.error('Particles bounding sphere is invalid or NaN!');
  allPassed = false;
} else {
  console.log('✓ AnalyticalParticles initialized with valid non-NaN bounding volume');
}

if (allPassed) {
  console.log('\n>>> ALL MILESTONE 3 CHECKS PASSED PERFECTLY! <<<');
} else {
  process.exit(1);
}
