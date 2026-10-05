// Milestone 4 Test & Verification Suite
// Tests CompositorGraph, SceneGraph, Declarative DSL (defineScene/SceneContext),
// ExportPipeline, and AgentHeal directorial self-correction.
if (typeof document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      width: 1920,
      height: 1080,
      getContext: () => ({
        setTransform: () => {},
        fillRect: () => {},
        fillText: () => {},
        strokeText: () => {},
        save: () => {},
        restore: () => {},
        measureText: () => ({ width: 100 }),
      }),
    }),
    fonts: {
      ready: Promise.resolve(),
    },
  };
}
import * as THREE from 'three';
import { CompositorGraph } from '../src/engine/graph';
import { SceneGraph } from '../src/engine/scenegraph';
import { TransformNode, LayoutNode } from '../src/engine/transform';
import { defineScene, SceneContext } from '../src/engine/dsl';
import { ExportPipeline, EXPORT_PRESETS } from '../src/engine/export';
import { AgentHeal, type DiagnosticSignal } from '../src/engine/heal';
import { CameraRig } from '../src/engine/rig';
import { Compositor, W, H } from '../src/engine/gl';
import type { SceneCtx, Frame } from '../src/engine/scene';

console.log('=== RUNNING MILESTONE 4 TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(cond: boolean, msg: string) {
  totalTests++;
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
  passedTests++;
}

// Mock WebGL Renderer & Target for test environment
const mockRenderer = {
  resetState: () => {},
  setRenderTarget: () => {},
  clear: () => {},
  render: () => {},
  getRenderTarget: () => null,
} as unknown as THREE.WebGLRenderer;

const mockTarget = {} as THREE.WebGLRenderTarget;

// ----------------------------------------------------------------------------
// 1. Test CompositorGraph
// ----------------------------------------------------------------------------
console.log('--- 1. Testing CompositorGraph ---');
const compGraph = new CompositorGraph();
let layer1Rendered = false;
let layer2Rendered = false;

compGraph.createLayer('bg', {
  render: () => { layer1Rendered = true; },
  blend: 'normal',
  opacity: 1.0,
});

compGraph.createLayer('fg', {
  render: () => { layer2Rendered = true; },
  matte: { source: 'bg', mode: 'alpha' },
  blend: 'screen',
  opacity: 0.9,
});

assert(typeof compGraph.evaluate === 'function', 'CompositorGraph.evaluate exists');
assert(typeof compGraph.dispose === 'function', 'CompositorGraph.dispose exists');

// Actually evaluate the graph and verify all layers are invoked
compGraph.evaluate(mockRenderer, mockTarget);
assert(layer1Rendered, 'CompositorGraph.evaluate successfully executes Layer 1 render');
assert(layer2Rendered, 'CompositorGraph.evaluate successfully executes Layer 2 render with track matte');

compGraph.dispose();

// ----------------------------------------------------------------------------
// 2. Test SceneGraph
// ----------------------------------------------------------------------------
console.log('\n--- 2. Testing SceneGraph ---');
const sg = new SceneGraph();

const nodeA = new LayoutNode('header_box');
nodeA.size = [400, 100, 0];
nodeA.position = [0, 0, 0];
nodeA.anchor = [0.5, 0.5, 0]; // Center anchor

const nodeB = new LayoutNode('body_box');
nodeB.size = [400, 100, 0];
nodeB.position = [0, -50, 0]; // Partially overlapping

sg.register({
  id: 'header',
  type: 'vector',
  role: 'headline',
  node: nodeA,
  opacity: 1.0,
});

sg.register({
  id: 'body',
  type: 'text',
  role: 'callout',
  node: nodeB,
  opacity: 1.0,
  text: 'CALLOUT COPY',
  fontPx: 24,
});

const headlines = sg.queryByRole('headline');
assert(headlines.length === 1 && headlines[0]?.id === 'header', 'SceneGraph.queryByRole finds registered entities');

const textEntities = sg.queryByType('text');
assert(textEntities.length === 1 && textEntities[0]?.id === 'body', 'SceneGraph.queryByType finds text entities');

// Test 3D-to-2D projection and anchor centering
const testCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
testCam.position.set(0, 0, 500);
testCam.lookAt(0, 0, 0);
testCam.updateMatrixWorld();
testCam.updateProjectionMatrix();

sg.updateScreenProjections(testCam, W, H);
const headerMeta = sg.get('header');
assert(headerMeta?.screenBounds !== undefined, 'SceneGraph projects 3D nodes into 2D screenBounds');

// Verify center anchor [0.5, 0.5] projects centered at [W/2, H/2]
const [minX, minY, maxX, maxY] = headerMeta!.screenBounds!;
const centerX = (minX + maxX) / 2;
const centerY = (minY + maxY) / 2;
assert(Math.abs(centerX - W / 2) < 1.0, `Center anchor X projects to screen center (${centerX.toFixed(1)} ≈ ${W / 2})`);
assert(Math.abs(centerY - H / 2) < 1.0, `Center anchor Y projects to screen center (${centerY.toFixed(1)} ≈ ${H / 2})`);

// Test collision detector
const collisions = sg.detectCollisions();
assert(collisions.length >= 1, `SceneGraph detects geometric 2D bounding box collision (found ${collisions.length})`);
assert(collisions[0]!.overlapArea > 0, `Collision overlap area is positive (${collisions[0]!.overlapArea.toFixed(0)}px²)`);

// Test telemetry sync
(globalThis as any).window = {
  __pdoom: {
    probe: true,
    textProbes: [],
    recordText: true,
    currentFrameIdx: 42,
  },
};

sg.syncTelemetry(1.5);
const pdoom = (globalThis as any).window.__pdoom;
assert(pdoom.textProbes.length >= 1, 'SceneGraph synchronizes text entities to window.__pdoom.textProbes');
assert(pdoom.textProbes[0].text === 'CALLOUT COPY', 'Telemetry probe text matches entity text');

// ----------------------------------------------------------------------------
// 3. Test Declarative Scene DSL (defineScene, SceneContext)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Testing Declarative Scene DSL ---');
let setupExecuted = false;
let renderExecuted = false;

const TestSceneClass = defineScene({
  id: 'dsl_test_scene',
  duration: 5.0,
  rigMode: 'perspective',
  particleCapacity: 512,
  lineCapacity: 512,
  sdfCapacity: 512,

  setup: (ctx) => {
    setupExecuted = true;
    assert(ctx.rig instanceof CameraRig, 'SceneContext instantiates CameraRig');
    assert(ctx.sceneGraph instanceof SceneGraph, 'SceneContext instantiates SceneGraph');
    assert(ctx.compositor instanceof CompositorGraph, 'SceneContext instantiates CompositorGraph');

    // Test text boilerplate shield
    const tNode = ctx.text('test_title', 'DSL TITLE', { fontSize: 32, role: 'headline' });
    assert(tNode.text === 'DSL TITLE', 'ctx.text creates KineticText with content');

    // Test node boilerplate shield
    const lNode = ctx.node('test_badge', { role: 'callout', size: [100, 40, 0] });
    assert(lNode instanceof LayoutNode, 'ctx.node creates LayoutNode');
  },

  render: (ctx, f, out) => {
    renderExecuted = true;
    // Test card boilerplate shield
    ctx.card('test_card', {
      x: 100,
      y: 100,
      w: 200,
      h: 80,
      radius: 8,
      fill: [0.1, 0.1, 0.1, 1],
      role: 'hud',
    });

    const cardMeta = ctx.sceneGraph.get('test_card');
    assert(cardMeta?.screenBounds !== undefined, 'ctx.card registers screenBounds in SceneGraph');

    // Test zero-opacity clearing in SceneGraph
    ctx.card('fading_card', { x: 50, y: 50, w: 100, h: 50, opacity: 0.0 });
    const fadingMeta = ctx.sceneGraph.get('fading_card');
    assert(fadingMeta === undefined || fadingMeta.opacity === 0, 'Zero opacity elements are marked inactive in SceneGraph');

    // Test ctx.renderText bounds synchronization
    ctx.renderText('test_title', ctx.layer2d.ctx, f.t, 100, 100);
    const titleMeta = ctx.sceneGraph.get('test_title');
    assert(titleMeta?.screenBounds !== undefined, 'ctx.renderText synchronizes exact 2D screen bounds to SceneGraph');

    // Test LineBatch queuing and automatic flush
    ctx.lines.seg(0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1);
    assert(ctx.lines.count > 0, 'LineBatch queues line segments');
    ctx.flush(out);
  },
});

assert(typeof TestSceneClass === 'function', 'defineScene returns a valid SceneClass constructor');

const mockSceneCtx: SceneCtx = {
  renderer: mockRenderer,
  audio: {} as any,
  lyrics: {} as any,
  comp: new Compositor(),
  W: 1920,
  H: 1080,
  id: 'test',
  params: {},
  start: 0,
  end: 5,
};

const sceneInstance = new TestSceneClass(mockSceneCtx);
await sceneInstance.init();
assert(setupExecuted, 'defineScene setup callback executed during init');

const mockFrame: Frame = {
  t: 1.0,
  dt: 1 / 60,
  lt: 1.0,
  p: 0.2,
  start: 0,
  end: 5,
  seeked: false,
  preroll: false,
  beat: 2,
  bar: 1,
  beatPhase: 0,
  barPhase: 0,
  a: {} as any,
  under: null,
  tin: 1,
  tout: 0,
};

sceneInstance.render(mockFrame, mockTarget);
assert(renderExecuted, 'defineScene render callback executed successfully');
sceneInstance.dispose();

// ----------------------------------------------------------------------------
// 4. Test ExportPipeline
// ----------------------------------------------------------------------------
console.log('\n--- 4. Testing ExportPipeline ---');
const webmPreset = ExportPipeline.getPreset('webm-alpha');
assert(webmPreset.supportsAlpha === true, 'webm-alpha supports alpha');
assert(webmPreset.codec === 'libvpx-vp9', 'webm-alpha uses libvpx-vp9');

const proresPreset = ExportPipeline.getPreset('prores-4444');
assert(proresPreset.supportsAlpha === true, 'prores-4444 supports alpha');
assert(proresPreset.pixFmt === 'yuva444p10le', 'prores-4444 uses yuva444p10le 10-bit');

const mp4Preset = ExportPipeline.getPreset('mp4');
assert(mp4Preset.supportsAlpha === false, 'mp4 does not support alpha');

// Test validation
const validWebm = ExportPipeline.validate({ format: 'webm-alpha', transparent: true, outPath: 'out.webm' });
assert(validWebm.valid, 'Validation succeeds for transparent webm-alpha');

const invalidMp4 = ExportPipeline.validate({ format: 'mp4', transparent: true, outPath: 'out.mp4' });
assert(!invalidMp4.valid && invalidMp4.errors.length > 0, 'Validation rejects transparent mp4');

// Test GPU hardware encoder rejection on alpha format
const invalidGpuAlpha = ExportPipeline.validate({ format: 'webm-alpha', transparent: true, gpu: true, gpuEncoder: 'h264_nvenc', outPath: 'out.webm' });
assert(!invalidGpuAlpha.valid, 'Validation rejects GPU hardware encoding with alpha channels');

// Test FFmpeg args generation
const ffArgs = ExportPipeline.buildFFmpegArgs({
  format: 'webm-alpha',
  outPath: 'dist/out.webm',
  fps: 60,
  from: 0,
  to: 5,
  transparent: true,
  audioTrack: 'audio.mp3',
});
assert(ffArgs.includes('ffmpeg') && ffArgs.includes('libvpx-vp9'), 'ExportPipeline generates complete FFmpeg argument list');
assert(ffArgs.includes('yuva420p'), 'FFmpeg arguments include alpha pixel format');

const cliCmd = ExportPipeline.buildCLICommand({
  format: 'webm-alpha',
  outPath: 'dist/out.webm',
  fps: 60,
  from: 0,
  to: 5,
  transparent: true,
});
assert(cliCmd.includes('bun scripts/render.ts video'), 'ExportPipeline generates CLI execution command');

// ----------------------------------------------------------------------------
// 5. Test AgentHeal (Directorial Self-Correction Contract)
// ----------------------------------------------------------------------------
console.log('\n--- 5. Testing AgentHeal ---');
const sampleSignals: DiagnosticSignal[] = [
  { rule: 'onion', entityId: 'gyro_curve', t: 1.1, context: { target_file: 'src/scenes/hero.ts' } },
  { rule: 'godview', entityId: 'cam_rig', t: 4.0, value: 0.05, threshold: 0.10 },
  { rule: 'compare', entityId: 'brand_badge', t: 2.5 },
  { rule: 'stitch', entityId: 'cut_seam', t: 5.0 },
  { rule: 'curves', entityId: 'hero_box', t: 2.4, value: 7.8, threshold: 5.0 },
  { rule: 'saliency', entityId: 'hero_car', t: 2.0, value: 38, threshold: 60 },
  { rule: 'legibility', entityId: 'sub_text', t: 3.1, value: 2.8, threshold: 4.5 },
  { rule: 'rhythm', entityId: 'card_group', t: 1.2, value: 5, threshold: 3 },
  { rule: 'framing', entityId: 'side_badge', t: 1.8 },
  { rule: 'F04', entityId: 'card_a', t: 2.2 },
  { rule: 'F05', entityId: 'edge_text', t: 0.5 },
  { rule: 'F07', entityId: 'stagnant_badge', t: 8.5 },
  { rule: 'F12', t: 3.0 },
];

const findings = AgentHeal.processSignals(sampleSignals);
assert(findings.length === 13, 'AgentHeal processes all 13 diagnostic signals including 9 visual instruments');

// Test all 9 visual instrument mappings
assert(findings[0]!.rule === 'motion_trajectory_jitter' && findings[0]!.remediation_directive.action === 'TUNE_CURVE', 'Instrument 01 onion maps to TUNE_CURVE');
assert(findings[1]!.rule === 'camera_geometry_penetration' && findings[1]!.remediation_directive.action === 'ADJUST_CAMERA', 'Instrument 02 godview maps to ADJUST_CAMERA');
assert(findings[2]!.rule === 'reference_drift' && findings[2]!.remediation_directive.action === 'SWAP_PALETTE_TOKEN', 'Instrument 03 compare maps to SWAP_PALETTE_TOKEN');
assert(findings[3]!.rule === 'transition_cut_pop' && findings[3]!.remediation_directive.action === 'ADJUST_TIMING', 'Instrument 04 stitch maps to ADJUST_TIMING');
assert(findings[4]!.rule === 'arrival_impact_kink' && findings[4]!.remediation_directive.action === 'TUNE_CURVE', 'Instrument 05 curves maps to TUNE_CURVE');
assert(findings[5]!.rule === 'saliency_distraction' && findings[5]!.remediation_directive.action === 'MUTATE_PROPERTY', 'Instrument 06 saliency maps to MUTATE_PROPERTY');
assert(findings[6]!.rule === 'low_contrast_legibility' && findings[6]!.remediation_directive.action === 'ADD_KNOCKOUT_HALO', 'Instrument 07 legibility maps to ADD_KNOCKOUT_HALO');
assert(findings[7]!.rule === 'onset_traffic_jam' && findings[7]!.remediation_directive.action === 'STAGGER_ONSET', 'Instrument 08 rhythm maps to STAGGER_ONSET');
assert(findings[8]!.rule === 'mobile_framing_breach' && findings[8]!.remediation_directive.action === 'ADJUST_LAYOUT', 'Instrument 09 framing maps to ADJUST_LAYOUT');

// Test telemetry rule mappings
assert(findings[9]!.remediation_directive.action === 'ADJUST_LAYOUT', 'F04 collision maps to ADJUST_LAYOUT');
assert(findings[10]!.remediation_directive.action === 'ADJUST_LAYOUT', 'F05 clipping maps to ADJUST_LAYOUT');
assert(findings[11]!.remediation_directive.action === 'ADJUST_TIMING', 'F07 persistence maps to ADJUST_TIMING');
assert(findings[12]!.remediation_directive.action === 'SWAP_PALETTE_TOKEN', 'F12 off-palette maps to SWAP_PALETTE_TOKEN');

// Verify target_file population
assert(findings[0]!.remediation_directive.target_file === 'src/scenes/hero.ts', 'target_file correctly populated in directives');

// Test serialization & markdown report
const jsonOut = AgentHeal.serialize(findings);
const parsed = JSON.parse(jsonOut);
assert(parsed.findings.length === 13, 'AgentHeal serializes to valid JSON findings schema');

const mdReport = AgentHeal.formatMarkdownReport(findings);
assert(mdReport.includes('Autonomous Agent Self-Healing Directive Report') && mdReport.includes('TUNE_CURVE'), 'AgentHeal generates actionable Markdown report');

console.log(`\n========================================`);
console.log(`ALL MILESTONE 4 TESTS PASSED: ${passedTests}/${totalTests}`);
console.log(`========================================\n`);
