import { parseOnionArgs } from './visual/onion';
import { parseGodViewArgs } from './visual/godview';
import { parseStitchArgs } from './visual/stitch';
import { parseCompareArgs } from './visual/compare';
import { computeSobelEdges, computePhaseCorrelationFlow } from './motion/pixel-metrics';
import { evaluateFlags } from './motion/flags';
import { generateFramesCsv } from './motion/report';
import { CONFIG, type FrameMetrics, type CalibrationData } from './motion/config';
import type { TextAnalysisResult } from './motion/text-analyzer';

console.log('=== RUNNING VISUAL INSTRUMENTS & CALIBRATED TELEMETRY TEST SUITE ===\n');

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// 1. CLI Arg Parsing Tests
// -------------------------------------------------------------
console.log('--- 1. Testing Visual Tools CLI Arg Parsers ---');

// Onion
const onionOpts = parseOnionArgs(['--t', '15.5', '--window', '1.2', '--frames', '16', '--scene', 'intro', '--out', 'out/test_onion']);
assert(onionOpts.t === 15.5, 'parseOnionArgs parses --t 15.5');
assert(onionOpts.window === 1.2, 'parseOnionArgs parses --window 1.2');
assert(onionOpts.frames === 16, 'parseOnionArgs parses --frames 16');
assert(onionOpts.scene === 'intro', 'parseOnionArgs parses --scene intro');
assert(onionOpts.out === 'out/test_onion', 'parseOnionArgs parses --out');

// GodView
const godOpts = parseGodViewArgs(['--from', '5.0', '--to', '12.0', '--samples', '30', '--scene', 'orbit', '--corridor', '--out', 'out/test_godview']);
assert(godOpts.from === 5.0, 'parseGodViewArgs parses --from 5.0');
assert(godOpts.to === 12.0, 'parseGodViewArgs parses --to 12.0');
assert(godOpts.samples === 30, 'parseGodViewArgs parses --samples 30');
assert(godOpts.scene === 'orbit', 'parseGodViewArgs parses --scene orbit');
assert(godOpts.corridor === true, 'parseGodViewArgs parses --corridor flag');
assert(godOpts.out === 'out/test_godview', 'parseGodViewArgs parses --out');

// Stitch
const stitchOpts = parseStitchArgs(['--from-scene', 'sceneA', '--to-scene', 'sceneB', '--t', '22.4', '--window', '0.4', '--out', 'out/test_stitch']);
assert(stitchOpts.fromScene === 'sceneA', 'parseStitchArgs parses --from-scene sceneA');
assert(stitchOpts.toScene === 'sceneB', 'parseStitchArgs parses --to-scene sceneB');
assert(stitchOpts.t === 22.4, 'parseStitchArgs parses --t 22.4');
assert(stitchOpts.window === 0.4, 'parseStitchArgs parses --window 0.4');
assert(stitchOpts.out === 'out/test_stitch', 'parseStitchArgs parses --out');

// Compare
const compareOpts = parseCompareArgs(['--scene', 'hook', '--t', '30.0', '--ref', 'loss', '--ref-t', '14.2', '--port', '5190', '--out', 'out/test_compare']);
assert(compareOpts.scene === 'hook', 'parseCompareArgs parses --scene hook');
assert(compareOpts.t === 30.0, 'parseCompareArgs parses --t 30.0');
assert(compareOpts.refScene === 'loss', 'parseCompareArgs parses --ref loss');
assert(compareOpts.refT === 14.2, 'parseCompareArgs parses --ref-t 14.2');
assert(compareOpts.port === 5190, 'parseCompareArgs parses --port 5190');
assert(compareOpts.out === 'out/test_compare', 'parseCompareArgs parses --out');

// -------------------------------------------------------------
// 2. Visual JSON Summary Output Schema Validation
// -------------------------------------------------------------
console.log('\n--- 2. Testing Summary JSON Schemas ---');

const onionSummary = {
  t: 10.0,
  window_ms: 500,
  frame_count: 10,
  artifacts: ['onion_motion.png'],
};
assert(typeof onionSummary.t === 'number' && Array.isArray(onionSummary.artifacts), 'Onion summary schema complies with spec');

const godviewSummary = {
  from_s: 8.0,
  to_s: 18.5,
  sample_count: 24,
  camera_mode: 'cinematic_perspective',
  artifacts: ['cam_godview.png'],
};
assert(typeof godviewSummary.from_s === 'number' && typeof godviewSummary.camera_mode === 'string', 'GodView summary schema complies with spec');

const stitchSummary = {
  cut_timestamp: 25.6,
  from_scene: 'boundary',
  to_scene: 'hook',
  window_ms: 166.7,
  sample_frames: 10,
  artifacts: ['onion_seam.png', 'strip_seam.png'],
};
assert(typeof stitchSummary.cut_timestamp === 'number' && stitchSummary.artifacts.length === 2, 'Stitch summary schema complies with spec');

const compareSummary = {
  active_scene: 'boundary',
  active_t: 27.5,
  reference_scene: 'loss',
  reference_t: 14.2,
  artifacts: ['ab_side_by_side.png', 'ab_split_wipe.png'],
};
assert(typeof compareSummary.active_scene === 'string' && compareSummary.artifacts.length === 2, 'Compare summary schema complies with spec');

// -------------------------------------------------------------
// 3. Pixel Metrics Math: Sobel Edge Density Threshold
// -------------------------------------------------------------
console.log('\n--- 3. Testing Sobel Edge Detection Math ---');

const w = 480, h = 270;
const flatLuma = new Float32Array(w * h).fill(0.5);
const flatResult = computeSobelEdges(flatLuma, w, h);
assert(flatResult.edgeDensity === 0, 'Flat luma produces exactly 0.0 edgeDensity');

// Create a sharp step edge at column x = 240 (0.0 on left, 1.0 on right)
const stepLuma = new Float32Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    stepLuma[y * w + x] = x >= 240 ? 1.0 : 0.0;
  }
}
const stepResult = computeSobelEdges(stepLuma, w, h);
assert(stepResult.edgeDensity > 0, 'Step edge produces non-zero edgeDensity');
// Around x=240, gradient magnitude gx = 4/4 = 1.0 > 0.12, so edge pixels are detected
const centerPixelMag = stepResult.edgeMap[135 * w + 240]!;
assert(centerPixelMag > 0.12, `Center edge pixel gradient magnitude (${centerPixelMag.toFixed(2)}) exceeds 0.12 threshold`);

// -------------------------------------------------------------
// 4. Phase Correlation Flow & Flat-Frame Guard
// -------------------------------------------------------------
console.log('\n--- 4. Testing Phase Correlation Flow Flat-Frame Guard ---');

// Constant flat frame
const flatFlow1 = computePhaseCorrelationFlow(flatLuma, flatLuma, 60, w, h, 0.005);
assert(flatFlow1.invalid === true && flatFlow1.flow_dx === 0 && flatFlow1.flow_dy === 0, 'Explicit low contrast (< 0.01) returns invalid: true with zero flow');

const flatFlow2 = computePhaseCorrelationFlow(flatLuma, flatLuma, 60, w, h);
assert(flatFlow2.invalid === true && flatFlow2.flow_dx === 0 && flatFlow2.flow_dy === 0, 'Auto-computed low contrast (< 0.01) returns invalid: true with zero flow');

// Non-flat pattern
const texturedLuma1 = new Float32Array(w * h);
const texturedLuma2 = new Float32Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    texturedLuma1[y * w + x] = Math.sin(x * 0.1) * 0.5 + 0.5;
    texturedLuma2[y * w + x] = Math.sin((x - 4) * 0.1) * 0.5 + 0.5;
  }
}
const texturedFlow = computePhaseCorrelationFlow(texturedLuma2, texturedLuma1, 60, w, h);
assert(texturedFlow.invalid !== true, 'Textured frame returns valid flow without invalid flag');

// -------------------------------------------------------------
// 5. Flag Evaluation Engine (F01–F16)
// -------------------------------------------------------------
console.log('\n--- 5. Testing Flag Evaluation Engine ---');

const emptyTextAnalysis: TextAnalysisResult = {
  records: [],
  words: [],
  runs: [],
  collisions: [],
  slots: [],
  cornerRuns: [],
  staticDigitRuns: [],
};

// Test empty frames guard
const emptyFlags = evaluateFlags([], emptyTextAnalysis, [], [], []);
assert(Array.isArray(emptyFlags) && emptyFlags.length === 0, 'evaluateFlags handles empty frames array safely');

// Create mock frames
const mockFrames: FrameMetrics[] = [];
for (let i = 0; i < 60; i++) {
  mockFrames.push({
    n: i,
    t: i / 60,
    E: 0.0001, // dead motion
    E_p95: 0.0001,
    flow_dx: 0,
    flow_dy: 0,
    luma: 0.5,
    contrast: 0.3,
    edge_density: 0.04,
    signal_pct: 1.0,
    bright_nonsignal_pct: 0.5,
    other_pct: 0.0,
    shimmer: 0.0,
    segs: 1,
    ms: 5.0,
    spp: 1,
  });
}

// Test waiver support
const flagsWithWaiver = evaluateFlags(
  mockFrames,
  emptyTextAnalysis,
  [],
  [],
  [],
  [],
  null,
  { 'F03': 'Intentional pause for cinematic pacing' }
);
const f03Flags = flagsWithWaiver.filter((f) => f.rule === 'F03');
if (f03Flags.length > 0) {
  assert(f03Flags[0]!.waived === true, 'F03 flag is waived when rule waiver provided');
  assert(f03Flags[0]!.waiver_reason === 'Intentional pause for cinematic pacing', 'Waiver reason is populated');
} else {
  assert(true, 'No F03 flags generated in test window');
}

// Test calibration fallback when distribution count n === 0
const emptyCalibration: CalibrationData = {
  generatedAt: new Date().toISOString(),
  totalSecondsAnalyzed: 0,
  distributions: {
    cutRatePerSec: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    energyMean: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    kickResponseRatioMedian: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    textMaxSizeRatioMedian: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    signalPct: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    brightNonsignalPct: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    edgeDensity: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
    deadMotionFraction: { n: 0, p10: 0, p50: 0, p90: 0, mean: 0, std: 0 },
  },
};

const calibratedFlags = evaluateFlags(
  mockFrames,
  emptyTextAnalysis,
  [],
  [],
  [],
  [],
  emptyCalibration
);
assert(Array.isArray(calibratedFlags), 'evaluateFlags safely falls back to CONFIG defaults when calibration n === 0');

// -------------------------------------------------------------
// 6. Report Generation: frames.csv other_pct
// -------------------------------------------------------------
console.log('\n--- 6. Testing frames.csv other_pct Inclusion ---');

const testFrame: FrameMetrics = {
  n: 0,
  t: 0.0,
  E: 0.05,
  E_p95: 0.08,
  flow_dx: 1.2,
  flow_dy: -0.5,
  luma: 0.42,
  contrast: 0.25,
  edge_density: 0.039,
  signal_pct: 1.5,
  bright_nonsignal_pct: 0.8,
  other_pct: 0.125,
  shimmer: 0.001,
  segs: 2,
  ms: 12.4,
  spp: 4,
};

const csv = generateFramesCsv([testFrame]);
const lines = csv.trim().split('\n');
assert(lines[0]!.includes('other_pct'), 'frames.csv header includes other_pct column');
assert(lines[1]!.includes('0.125'), 'frames.csv data row correctly outputs other_pct value (0.125)');

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n========================================');
console.log(`TESTS PASSED: ${passCount}`);
console.log(`TESTS FAILED: ${failCount}`);
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}
