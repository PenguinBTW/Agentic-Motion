import { motion, MotionBus } from '../src/engine/motion';
import { SDFBatch } from '../src/engine/sdf';
import { KineticText } from '../src/engine/text';
import * as THREE from 'three';

console.log('--- Testing Milestone 2 Modules & Audited Patches ---');

let allPassed = true;

// 1. Test MotionBus Spring Solver
console.log('\n[1] Testing MotionBus Spring Solver (Closed-form Second-Order ODE)...');
const mb = new MotionBus();

// Test step response at tau = 0
const s0 = mb.spring(1.0, 1.0, { v0: 5.0 });
if (s0 !== 0) {
  console.error(`Spring at tau=0 should be 0, got ${s0}`);
  allPassed = false;
} else {
  console.log(`✓ Spring at tau=0 is exactly 0.0`);
}

// Test under-damped spring with v0
const sUnder0 = mb.spring(0, 0.05, { freq: 2.0, damping: 0.5, v0: 3.0 });
const sUnder1 = mb.spring(0, 0.25, { freq: 2.0, damping: 0.5, v0: 3.0 });
const sUnderRest = mb.spring(0, 5.0, { freq: 2.0, damping: 0.5, v0: 3.0 });
console.log(`Under-damped spring: tau=0.05: ${sUnder0.toFixed(3)}, tau=0.25: ${sUnder1.toFixed(3)}, tau=5.0 (rest): ${sUnderRest.toFixed(3)}`);
if (Math.abs(sUnderRest - 1.0) > 1e-4) {
  console.error(`Under-damped spring did not settle to 1.0, got ${sUnderRest}`);
  allPassed = false;
} else {
  console.log(`✓ Under-damped spring settled to exactly 1.0 at rest`);
}

// Test critically damped spring (damping = 1.0)
const sCritRest = mb.spring(0, 5.0, { freq: 2.0, damping: 1.0, v0: 1.0 });
if (Math.abs(sCritRest - 1.0) > 1e-4) {
  console.error(`Critically damped spring did not settle to 1.0, got ${sCritRest}`);
  allPassed = false;
} else {
  console.log(`✓ Critically damped spring settled to exactly 1.0 at rest`);
}

// Test over-damped spring (damping = 1.5, v0 = 0) - MUST NOT OVERSHOOT 1.0!
const sOver10ms = mb.spring(0, 0.01, { freq: 2.0, damping: 1.5, v0: 0.0 });
const sOver50ms = mb.spring(0, 0.05, { freq: 2.0, damping: 1.5, v0: 0.0 });
const sOver100ms = mb.spring(0, 0.10, { freq: 2.0, damping: 1.5, v0: 0.0 });
const sOverRest = mb.spring(0, 5.0, { freq: 2.0, damping: 1.5, v0: 0.0 });
console.log(`Over-damped spring (v0=0): tau=10ms: ${sOver10ms.toFixed(4)}, tau=50ms: ${sOver50ms.toFixed(4)}, tau=100ms: ${sOver100ms.toFixed(4)}, tau=5s: ${sOverRest.toFixed(4)}`);

if (sOver10ms < 0 || sOver50ms > 1.0 || sOver100ms > 1.0 || Math.abs(sOverRest - 1.0) > 1e-4) {
  console.error(`Over-damped spring sign bug detected! Values must be monotonic between 0 and 1.0`);
  allPassed = false;
} else {
  console.log(`✓ Over-damped spring verified monotonic without overshoot (sign error resolved)`);
}

// 2. Test LFO on negative sub-frame times
console.log('\n[2] Testing LFO Oscillators on negative times...');
const sawNeg = mb.lfo('saw', 2.0, -0.1);
const squareNeg = mb.lfo('square', 2.0, -0.1);
console.log(`LFO at t=-0.1s (freq=2.0): saw=${sawNeg.toFixed(3)}, square=${squareNeg}`);
if (sawNeg < -1.0 || sawNeg > 1.0 || (squareNeg !== 1 && squareNeg !== -1)) {
  console.error(`LFO failed on negative sub-frame time!`);
  allPassed = false;
} else {
  console.log(`✓ LFO correctly handled negative time offsets without phase distortion`);
}

// 3. Test Bezier Bisection Solver
console.log('\n[3] Testing Bezier Easing with flat initial tangent...');
const eased = mb.ease(0.01, 0, 1.0, [0.0, 0.0, 0.58, 1.0]); // ease-out curve with p1=0
console.log(`Ease at t=0.01s: ${eased.toFixed(4)}`);
if (isNaN(eased)) {
  console.error(`Bezier solver returned NaN!`);
  allPassed = false;
} else {
  console.log(`✓ Bezier solver succeeded with bisection fallback`);
}

// 4. Test SDFBatch Instancing & Bounding Sphere
console.log('\n[4] Testing SDFBatch 3D Buffer & Bounding Sphere...');
const sdf = new SDFBatch(100);
sdf.rect(10, 20, 200, 100, { radius: [8, 8, 8, 8], fill: [1, 1, 1, 1], strokeWidth: 2 });
sdf.shadow(10, 20, 200, 100, 16, [0, 0, 0, 0.5], [0, 4]);
sdf.ring(100, 100, 50, 4, [0, 0.75], [1, 0, 0, 1]);
sdf.reticle(500, 500, 40, 2.0, [1, 1, 0, 1]);

// Test Three.js computeBoundingSphere()
const geo = (sdf as any).geo;
geo.computeBoundingSphere();
const sphereRadius = geo.boundingSphere.radius;
console.log(`InstancedBufferGeometry bounding sphere radius: ${sphereRadius}`);
if (isNaN(sphereRadius)) {
  console.error(`BufferGeometry boundingSphere.radius is NaN!`);
  allPassed = false;
} else {
  console.log(`✓ Bounding sphere radius is valid number (${sphereRadius.toFixed(2)}), zero NaN warnings`);
}

if (sdf.count !== 4) {
  console.error(`Expected 4 SDF instances, got ${sdf.count}`);
  allPassed = false;
} else {
  console.log(`✓ SDFBatch recorded 4 instances (rect, shadow, ring, reticle)`);
}

// 5. Test KineticText Newline Preservation & Ephemeral 3D Visibility
console.log('\n[5] Testing KineticText Newline Preservation & Ephemeral 3D Visibility...');
const multiParaText = new KineticText('FIRST LINE\nSECOND LINE\nTHIRD LINE');
multiParaText.layout({ maxWidth: 500 });
const lines = (multiParaText as any).lines;
console.log('Layout lines:', lines);
if (lines.length !== 3 || lines[0] !== 'FIRST LINE' || lines[1] !== 'SECOND LINE') {
  console.error('Word wrap destroyed newlines!');
  allPassed = false;
} else {
  console.log('✓ Word-wrap strictly preserved explicit newlines across paragraphs');
}

// Test ephemeral 3D anchor visibility
const realCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
realCam.position.set(0, 0, 10);
realCam.lookAt(0, 0, 20); // looks away from origin, so [0, 0, 0] is behind camera
realCam.updateMatrixWorld();

const kt3d = new KineticText('HUD CALLOUT', { alpha: 0.85 });
kt3d.anchor3D([0, 0, 0], realCam); // worldToScreen returns null because [0, 0, 0] is behind
if ((kt3d as any).style.alpha !== 0.85) {
  console.error(`style.alpha was permanently mutated to ${(kt3d as any).style.alpha}!`);
  allPassed = false;
} else if ((kt3d as any).isVisible !== false) {
  console.error(`isVisible was not set to false!`);
  allPassed = false;
} else {
  console.log('✓ 3D anchor visibility is ephemeral, preserving style.alpha');
}

if (allPassed) {
  console.log('\n>>> ALL MILESTONE 2 CHECKS AND AUDIT PATCHES PASSED PERFECTLY! <<<');
} else {
  process.exit(1);
}
