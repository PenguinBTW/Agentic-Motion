import { camFromKey, K, proj } from '../src/engine/camera3d';
import { ViewportSpace } from '../src/engine/viewport';
import { getDesignTokens, setDesignTokens, tokenToLinear, tokenToRgba } from '../src/engine/tokens';
import { LIN, rgba } from '../src/engine/palette';
import * as THREE from 'three';

console.log('--- Testing Milestone 1 Patches ---');

// 1. Camera Projection Alignment Test
const key = K([0, 1.8, -8.0], [0, 0, 0], 0, 950);
const cam = camFromKey(key);
const threeCam = new THREE.PerspectiveCamera(50, 1920 / 1080, 0.1, 1000);
ViewportSpace.camToThreeCamera(cam, threeCam, 1920, 1080);

const testPoints: [number, number, number][] = [
  [0, 0, 0],
  [1.5, 0.5, 2.0],
  [-2.0, -1.0, -1.0],
  [0.5, 2.5, 0],
];

let allPassed = true;
for (const p of testPoints) {
  const analyticalProj = proj(cam, p[0], p[1], p[2]);
  const threeProj = ViewportSpace.worldToScreen(p, threeCam, 1920, 1080);

  if (!analyticalProj || !threeProj) {
    console.error(`Projection failed for point ${JSON.stringify(p)}: analytical=${analyticalProj}, three=${threeProj}`);
    allPassed = false;
    continue;
  }

  const dx = Math.abs(analyticalProj[0] - threeProj[0]);
  const dy = Math.abs(analyticalProj[1] - threeProj[1]);

  if (dx > 0.05 || dy > 0.05) {
    console.error(`MISMATCH on point ${JSON.stringify(p)}: analytical=(${analyticalProj[0].toFixed(2)}, ${analyticalProj[1].toFixed(2)}) vs three=(${threeProj[0].toFixed(2)}, ${threeProj[1].toFixed(2)}), dx=${dx.toFixed(3)}, dy=${dy.toFixed(3)}`);
    allPassed = false;
  } else {
    console.log(`✓ Point ${JSON.stringify(p)} matched: analytical=(${analyticalProj[0].toFixed(2)}, ${analyticalProj[1].toFixed(2)}) === three=(${threeProj[0].toFixed(2)}, ${threeProj[1].toFixed(2)})`);
  }
}

// 2. Token Override & Dynamic Proxy Test
console.log('\n--- Testing Dynamic Tokens & LIN Proxy ---');
const origBone = LIN.bone;
const origSignal = LIN.signal;
console.log(`Original LIN.bone: [${origBone}]`);
console.log(`Original LIN.signal: [${origSignal}]`);

setDesignTokens({
  palette: {
    signal: '#00FF00',
    bone: '#112233',
  },
});

console.log(`Overridden LIN.signal: [${LIN.signal}] (expected linear green [0, 1, 0])`);
console.log(`Overridden rgba('signal'): ${rgba('signal')}`);

if (LIN.signal[1] !== 1 || LIN.signal[0] !== 0) {
  console.error('Dynamic LIN proxy failed to update!');
  allPassed = false;
} else {
  console.log('✓ Dynamic LIN and rgba proxy successfully reflected tokens override!');
}

if (allPassed) {
  console.log('\n>>> ALL MILESTONE 1 CHECKS PASSED PERFECTLY! <<<');
} else {
  process.exit(1);
}
