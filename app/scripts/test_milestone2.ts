import { motion, MotionBus } from '../src/engine/motion';
import { SDFBatch } from '../src/engine/sdf';
import { KineticText } from '../src/engine/text';

console.log('--- Testing Milestone 2 Modules ---');

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

// Test over-damped spring (damping = 1.5)
const sOverRest = mb.spring(0, 5.0, { freq: 2.0, damping: 1.5, v0: 1.0 });
if (Math.abs(sOverRest - 1.0) > 1e-4) {
  console.error(`Over-damped spring did not settle to 1.0, got ${sOverRest}`);
  allPassed = false;
} else {
  console.log(`✓ Over-damped spring settled to exactly 1.0 at rest`);
}

// 2. Test Stagger Engine
console.log('\n[2] Testing Stagger Engine...');
const stLinear = mb.stagger(5, 1.0, 'start');
console.log('Stagger (start):', stLinear.map((v) => v.toFixed(2)));
if (stLinear[0] !== 0 || Math.abs(stLinear[4]! - 1.0) > 1e-5) {
  console.error('Linear stagger failed boundary checks');
  allPassed = false;
} else {
  console.log('✓ Linear stagger bounded [0, 1.0]');
}

const stCenter = mb.stagger(5, 1.0, 'center-out');
console.log('Stagger (center-out):', stCenter.map((v) => v.toFixed(2)));
if (stCenter[2] !== 0) {
  console.error('Center-out stagger center element should start at 0');
  allPassed = false;
} else {
  console.log('✓ Center-out stagger center element starts at delay 0');
}

// 3. Test LFO Oscillators
console.log('\n[3] Testing LFO Oscillators...');
const sineVal = mb.lfo('sine', 1.0, 0.25);
console.log(`LFO Sine at 0.25s (freq=1.0Hz): ${sineVal.toFixed(3)} (expected 1.0)`);
if (Math.abs(sineVal - 1.0) > 1e-5) {
  console.error(`LFO Sine failed: ${sineVal}`);
  allPassed = false;
} else {
  console.log('✓ LFO Sine peak matched');
}

// 4. Test SDFBatch
console.log('\n[4] Testing SDFBatch Instancing...');
const sdf = new SDFBatch(100);
sdf.rect(10, 20, 200, 100, { radius: [8, 8, 8, 8], fill: [1, 1, 1, 1], strokeWidth: 2 });
sdf.shadow(10, 20, 200, 100, 16, [0, 0, 0, 0.5], [0, 4]);
sdf.ring(100, 100, 50, 4, [0, 0.75], [1, 0, 0, 1]);
if (sdf.count !== 3) {
  console.error(`SDFBatch instance count should be 3, got ${sdf.count}`);
  allPassed = false;
} else {
  console.log(`✓ SDFBatch recorded 3 instances (rect, shadow, ring)`);
}
sdf.clear();
if (sdf.count !== 0) {
  console.error(`SDFBatch clear() failed, got ${sdf.count}`);
  allPassed = false;
} else {
  console.log(`✓ SDFBatch cleared successfully`);
}

// 5. Test KineticText & Telemetry Bridge
console.log('\n[5] Testing KineticText & Telemetry Bridge...');
(globalThis as any).window = {
  __pdoom: {
    recordText: true,
    currentFrameIdx: 42,
    textProbes: [],
  },
};

const kt = new KineticText('CYBERNETIC CONTROL SYSTEM', {
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: 4,
}).withKnockoutHalo(2.5, 'rgba(0,0,0,1)');

kt.syncTelemetry(1.5, 120, 240);

const probes = (globalThis as any).window.__pdoom.textProbes;
if (probes.length !== 1) {
  console.error(`Expected 1 telemetry probe, got ${probes.length}`);
  allPassed = false;
} else {
  const p = probes[0];
  console.log('Emitted text probe:', JSON.stringify(p, null, 2));
  if (p.text !== 'CYBERNETIC CONTROL SYSTEM' || p.t !== 1.5 || p.bbox[0] !== 120) {
    console.error('Telemetry probe payload mismatch!');
    allPassed = false;
  } else {
    console.log('✓ KineticText telemetry probe correctly synchronized to window.__pdoom.textProbes');
  }
}

if (allPassed) {
  console.log('\n>>> ALL MILESTONE 2 CHECKS PASSED PERFECTLY! <<<');
} else {
  process.exit(1);
}
