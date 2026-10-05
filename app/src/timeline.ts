// Universal Timeline: Maps scenes to timeline intervals.
// Works seamlessly for procedural motion graphics with ClockDriver,
// as well as optional Audio/Speech driven sequences.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import type { TimelineDriver } from './engine/driver';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(
  ly?: Lyrics | null,
  au?: AudioData | null,
  driver?: TimelineDriver,
): TimelineEntry[] {
  // If an explicit non-audio driver is provided, honor its duration.
  // Otherwise, if real audio data exists, use its duration; else default to 5.0s for demo scenes.
  const duration = (driver && driver.id !== 'audio')
    ? driver.duration
    : (au && !au.isDummy && au.duration > 0 ? au.duration : 5.0);

  // Default procedural timeline entry
  const entries: TimelineEntry[] = [
    {
      id: 'demo',
      file: 'demo',
      load: scene('demo'),
      start: 0,
      end: duration,
      caption: { fig: '01', text: 'AGENTIC PROCEDURAL MOTION ENGINE', dur: 4.0 },
    },
  ];

  return entries;
}
