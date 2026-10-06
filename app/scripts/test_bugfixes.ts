// Regression tests for audit bug fixes (pure-logic, no DOM/browser needed).
// Run: bun scripts/test_bugfixes.ts  (also wired into test_milestones.ts)
import { AudioDriver } from '../src/engine/driver';
import { AudioData } from '../src/engine/audio';
import { tokenToRgba } from '../src/engine/tokens';
import { hexToLinear } from '../src/engine/util';
import { parsePalette, computePaletteShares } from './motion/pixel-metrics';

console.log('--- Testing audit bug fixes ---');
let allPassed = true;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`); allPassed = false; }
};

// 1. AudioDriver rms falls back to env()/sample() when rmsAt is absent (AudioData has no rmsAt).
{
  const audio = AudioData.createDummy(5.0, 120);
  (audio as any).rmsAt = undefined;
  const driver = new AudioDriver(audio);
  const s = driver.evaluate(1.0);
  check('driver rms uses env fallback (finite number)', typeof s.data?.rms === 'number' && Number.isFinite(s.data.rms), `got ${s.data?.rms}`);
}

// 2. AudioData tolerates empty / missing beat tables (no NaN, no throw).
{
  const empty = new AudioData({ duration: 5, bpm: 120, fps: 60, beats: [], downbeats: [], sections: [], features: {}, onsets: {} } as any);
  const tb = empty.timeOfBeat(2.5);
  const nb = empty.nearestBeat(1.0);
  check('timeOfBeat/nearestBeat finite on empty beats', Number.isFinite(tb) && Number.isFinite(nb), `got ${tb}, ${nb}`);
  const missing = new AudioData({ duration: 5, bpm: 120 } as any);
  let threw = false;
  try { missing.beatAt(1.0); missing.timeOfBeat(1.0); missing.barAt(1.0); missing.section(1.0); } catch { threw = true; }
  check('missing beats/downbeats/sections default safely', !threw && Array.isArray(missing.beats));
}

// 3. tokenToRgba expands 3-digit hex (parity with palette.rgba) and guards invalid input.
{
  const short = tokenToRgba('#ABC');
  const full = tokenToRgba('#AABBCC');
  check("tokenToRgba('#ABC') === tokenToRgba('#AABBCC')", short === full, `got ${short} vs ${full}`);
  const bad = tokenToRgba('#ZZZZZZ');
  check('tokenToRgba invalid hex falls back to white', bad === 'rgba(255,255,255,1)', `got ${bad}`);
}

// 4. hexToLinear never returns NaN uniforms.
{
  const [r, g, b] = hexToLinear('not-a-hex');
  check('hexToLinear invalid input is finite', [r, g, b].every(Number.isFinite), `got [${r},${g},${b}]`);
}

// 5. parsePalette rejects malformed entries with an informative error; '' still yields defaults.
{
  let msg = '';
  try { parsePalette('foo'); } catch (e) { msg = String((e as Error)?.message ?? e); }
  check("parsePalette('foo') throws informative error", /Malformed|expected/i.test(msg), `got '${msg}'`);
  let msg2 = '';
  try { parsePalette('a=#FFF,b=zzz'); } catch (e) { msg2 = String((e as Error)?.message ?? e); }
  check('parsePalette rejects bad hex informatively', /Malformed|hex/i.test(msg2), `got '${msg2}'`);
  check("parsePalette('') yields defaults", parsePalette('').length >= 5);
}

// 6. computePaletteShares tolerates an empty palette (no crash).
{
  const frame = new Uint8Array(480 * 270 * 4).fill(128);
  let threw = false, other = -1;
  try { other = computePaletteShares(frame, [], 480, 270).otherPct; } catch { threw = true; }
  check('computePaletteShares([]) returns otherPct=100', !threw && other === 100, `threw=${threw} other=${other}`);
}

if (allPassed) {
  console.log('\n>>> ALL BUGFIX CHECKS PASSED <<<');
} else {
  process.exit(1);
}
