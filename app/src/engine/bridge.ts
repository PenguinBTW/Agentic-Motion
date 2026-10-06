// Typed Contract for the Browser <-> Tooling Bridge
// Replaces the untyped window.__pdoom seam with a strongly-typed, versioned contract.
// Backwards-compatible: window.__motion is canonical, window.__pdoom aliases window.__motion.

import type { Engine, TimelineEntry } from './engine';

export const BRIDGE_VERSION = '0.5.0';

export interface TextProbeRecord {
  frameIdx: number;
  t: number;
  text: string;
  fontFamily: string;
  fontPx: number;
  fillStyle: string;
  globalAlpha: number;
  layerId: string;
  bbox: [number, number, number, number];
  w: number;
  h: number;
  cx: number;
  cy: number;
  hPct: number;
  isStroke: boolean;
}

export interface FrameMeta {
  frameIdx: number;
  t: number;
  spp: number;
  dtMs: number;
}

export interface BridgeTimelineEntry {
  id: string;
  start: number;
  end: number;
  caption?: { fig: string; text: string; dur?: number; delay?: number };
}

export interface StreamResult {
  used: Record<number, number>;
  frameMeta?: FrameMeta[];
  textProbes?: TextProbeRecord[];
}

export interface StreamOptions {
  ws?: string;
  from?: number;
  to?: number;
  fps?: number;
  samples?: number | any;
  shutter?: number;
  port?: number;
  probe?: boolean;
  scale?: number;
  inflight?: number;
}

export interface EngineBridge {
  version: string;
  engine: Engine;
  duration: number;
  errors: string[];
  scale: number;
  width: number;
  height: number;
  probe: boolean;
  recordText: boolean;
  textProbes: TextProbeRecord[];
  currentFrameIdx: number;
  currentTime: number;
  timeline: BridgeTimelineEntry[];
  still: (t: number, samples?: any, shutter?: number) => Promise<number> | number;
  png: () => Promise<string> | string;
  stream: (opts?: StreamOptions | any) => Promise<Record<number, number> | StreamResult>;
  ready: boolean;
  error?: string;
}

declare global {
  interface Window {
    __motion?: EngineBridge;
    __pdoom?: EngineBridge;
    __textHookActive?: boolean;
    __pdoom_hookActive?: boolean;
  }
}
