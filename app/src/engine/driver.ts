// Universal TimelineDriver Strategy Pattern
// Decouples the engine timeline from specific audio or lyric files.
// Supports ClockDriver (silent/procedural), AudioDriver (music/SFX), and SpeechDriver (narration).

export interface DriverSample {
  time: number;
  normalized: number; // 0..1 progress
  beat: number;
  isBeat: boolean;
  intensity: number;
  data?: Record<string, any>;
}

export interface TimelineDriver {
  readonly id: string;
  readonly duration: number;
  evaluate(t: number): DriverSample;
}

/**
 * ClockDriver: Pure procedural timeline driver with zero external dependencies.
 * Ideal for commercials, UI showcases, 3D product reveals, and looping motion graphics.
 */
export class ClockDriver implements TimelineDriver {
  readonly id = 'clock';
  readonly duration: number;
  readonly bpm: number;

  constructor(duration = 10.0, bpm = 120) {
    this.duration = Math.max(0.1, duration);
    this.bpm = bpm;
  }

  evaluate(t: number): DriverSample {
    const clampedT = Math.max(0, Math.min(this.duration, t));
    const normalized = clampedT / this.duration;
    const beatSec = 60 / this.bpm;
    const beatFraction = clampedT / beatSec;
    const beat = Math.floor(beatFraction);
    // Pulse intensity peaks on each beat
    const phase = beatFraction - beat;
    const intensity = Math.exp(-phase * 5.0);
    const isBeat = phase < 0.05;

    return {
      time: clampedT,
      normalized,
      beat,
      isBeat,
      intensity,
    };
  }
}

/**
 * AudioDriver: Wraps optional audio analysis data.
 * Falls back gracefully to synthesized beats if audio data is not provided.
 */
export class AudioDriver implements TimelineDriver {
  readonly id = 'audio';
  readonly duration: number;
  private audioData?: any;

  constructor(audioData?: any, fallbackDuration = 30.0) {
    this.audioData = audioData;
    this.duration = audioData?.duration ?? fallbackDuration;
  }

  evaluate(t: number): DriverSample {
    const clampedT = Math.max(0, Math.min(this.duration, t));
    const normalized = clampedT / this.duration;

    if (this.audioData && typeof this.audioData.beatAt === 'function') {
      const beatVal = this.audioData.beatAt(clampedT);
      const beat = Math.floor(beatVal);
      const phase = beatVal - beat;
      return {
        time: clampedT,
        normalized,
        beat,
        isBeat: phase < 0.05,
        intensity: Math.exp(-phase * 4.0),
        data: {
          rms: this.audioData.rmsAt ? this.audioData.rmsAt(clampedT) : 0,
        },
      };
    }

    // Fallback pulse
    const beatFraction = clampedT / 0.5; // default 120 bpm
    const beat = Math.floor(beatFraction);
    const phase = beatFraction - beat;
    return {
      time: clampedT,
      normalized,
      beat,
      isBeat: phase < 0.05,
      intensity: Math.exp(-phase * 4.0),
    };
  }
}

/**
 * SpeechDriver: Timeline driver for voiceover and narration explainer videos.
 */
export interface SpeechCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export class SpeechDriver implements TimelineDriver {
  readonly id = 'speech';
  readonly duration: number;
  readonly cues: SpeechCue[];

  constructor(cues: SpeechCue[], duration?: number) {
    this.cues = [...cues].sort((a, b) => a.start - b.start);
    const lastCueEnd = this.cues.length > 0 ? this.cues[this.cues.length - 1]!.end : 10.0;
    this.duration = duration ?? Math.max(10.0, lastCueEnd + 1.0);
  }

  evaluate(t: number): DriverSample {
    const clampedT = Math.max(0, Math.min(this.duration, t));
    const activeCue = this.cues.find((c) => clampedT >= c.start && clampedT <= c.end);

    return {
      time: clampedT,
      normalized: clampedT / this.duration,
      beat: 0,
      isBeat: Boolean(activeCue),
      intensity: activeCue ? 1.0 : 0.0,
      data: {
        cue: activeCue ?? null,
      },
    };
  }
}
