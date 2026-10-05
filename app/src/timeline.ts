// The edit: which scene plays when. Boundaries are anchored to lyric lines
// and snapped to the beat grid, so they follow the aligned data
// (app/public/data/lyrics.json, app/public/data/audio.json).
//
// Plate order and anchor queries live ONCE in analysis/plates.json (validated
// by validate_data.py). This file only maps anchors to seconds — there are
// zero hardcoded timestamps here. Retiming the alignment re-times the video.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import plates from '../../analysis/plates.json';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

interface Anchor { q: string; nth?: number }

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first word of the matching line (never after the word). */
  const cut = (a: Anchor | null, fallback: number): number => {
    if (!a) return fallback;
    const s = ly.get(a.q, a.nth ?? 0).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + 0.02)));
  };

  return (plates as { id: string; file: string; params?: Record<string, any>; from: Anchor | null; to: Anchor | null }[]).map(
    (p, i, all) => {
      const start = i === 0 ? 0 : cut(p.from, 0);
      const end = i === all.length - 1 ? au.duration : cut(p.to, au.duration);
      if (!(end > start)) throw new Error(`timeline: plate ${p.id} has empty window [${start}, ${end}]`);
      return {
        id: p.id,
        file: p.file,
        load: scene(p.file),
        start,
        end,
        ...(p.params ? { params: p.params } : {}),
      } as TimelineEntry;
    },
  );
}
