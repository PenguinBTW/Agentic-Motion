import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testScripts = [
  'test_milestone1.ts',
  'test_milestone2.ts',
  'test_milestone3.ts',
  'test_milestone4.ts',
  'test_visual_and_telemetry.ts',
];

console.log('================================================================');
console.log('     UNIVERSAL AGENTIC MOTION GRAPHICS SUITE: ALL TESTS (v0.5.0)');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const script of testScripts) {
  const scriptPath = path.join(import.meta.dir, script);
  console.log(`>>> Running ${script}...`);
  const res = spawnSync('bun', [scriptPath], { stdio: 'inherit' });
  if (res.status === 0) {
    console.log(`\n[OK] ${script} finished successfully.\n`);
    totalPassed++;
  } else {
    console.error(`\n[FAIL] ${script} failed with exit code ${res.status}.\n`);
    totalFailed++;
    process.exit(res.status ?? 1);
  }
}

console.log('================================================================');
console.log(`SUMMARY: All ${totalPassed} test suites passed with 0 failures!`);
console.log('================================================================');
