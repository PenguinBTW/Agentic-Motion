// Multi-Format Delivery & Headless Export Pipeline (ExportPipeline)
// Generates production-grade FFmpeg arguments, Playwright headless execution flags,
// and delivery configurations for transparent Alpha WebM, ProRes 4444, and H.264 MP4.

export type ExportFormat = 'mp4' | 'webm-alpha' | 'prores-4444' | 'prores-422hq' | 'png-sequence';

export interface ExportPresetConfig {
  format: ExportFormat;
  extension: string;
  codec: string;
  pixFmt: string;
  supportsAlpha: boolean;
  defaultBitrate?: string;
  defaultCrf?: number;
  extraArgs: string[];
  description: string;
}

export const EXPORT_PRESETS: Record<ExportFormat, ExportPresetConfig> = {
  'webm-alpha': {
    format: 'webm-alpha',
    extension: '.webm',
    codec: 'libvpx-vp9',
    pixFmt: 'yuva420p',
    supportsAlpha: true,
    defaultCrf: 20,
    extraArgs: ['-b:v', '0', '-auto-alt-ref', '0', '-lag-in-frames', '16'],
    description: 'Transparent VP9 WebM for modern web overlays and interactive graphics.',
  },
  'prores-4444': {
    format: 'prores-4444',
    extension: '.mov',
    codec: 'prores_ks',
    pixFmt: 'yuva444p10le',
    supportsAlpha: true,
    extraArgs: ['-profile:v', '4', '-vendor', 'apl0', '-bits_per_mb', '8000'],
    description: 'Apple ProRes 4444 10-bit with alpha channel for broadcast editorial and VFX compositing.',
  },
  'prores-422hq': {
    format: 'prores-422hq',
    extension: '.mov',
    codec: 'prores_ks',
    pixFmt: 'yuv422p10le',
    supportsAlpha: false,
    extraArgs: ['-profile:v', '3', '-vendor', 'apl0'],
    description: 'Apple ProRes 422 HQ high-bitrate mastering format for color grading and broadcast delivery.',
  },
  'mp4': {
    format: 'mp4',
    extension: '.mp4',
    codec: 'libx264',
    pixFmt: 'yuv420p',
    supportsAlpha: false,
    defaultCrf: 16,
    extraArgs: ['-preset', 'slow', '-tune', 'grain', '-x264-params', 'aq-mode=3', '-movflags', '+faststart'],
    description: 'High-quality H.264 MP4 with optimal AQ tune for motion graphics and universal playback.',
  },
  'png-sequence': {
    format: 'png-sequence',
    extension: '.png',
    codec: 'png',
    pixFmt: 'rgba',
    supportsAlpha: true,
    extraArgs: [],
    description: 'Uncompressed RGBA PNG image sequence preserving exact bit-identical pixels.',
  },
};

export interface ExportVideoOptions {
  format: ExportFormat;
  outPath: string;
  width?: number;
  height?: number;
  fps?: 60 | 30 | 24;
  from?: number;
  to?: number;
  audioTrack?: string;
  transparent?: boolean;
  samples?: number | 'auto';
  shutter?: number;
  gpu?: boolean;
  gpuEncoder?: 'h264_amf' | 'hevc_amf' | 'h264_nvenc' | 'hevc_nvenc';
}

export class ExportPipeline {
  /**
   * Get configuration preset for given format
   */
  static getPreset(format: ExportFormat): ExportPresetConfig {
    const p = EXPORT_PRESETS[format];
    if (!p) throw new Error(`Unknown export preset: ${format}`);
    return p;
  }

  /**
   * Validate export configuration options
   */
  static validate(opts: ExportVideoOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const preset = EXPORT_PRESETS[opts.format];

    if (!preset) {
      errors.push(`Invalid format: ${opts.format}`);
    } else if (opts.transparent && !preset.supportsAlpha) {
      errors.push(`Format ${opts.format} does not support alpha transparency. Use 'webm-alpha' or 'prores-4444'.`);
    } else if (opts.gpu && preset.supportsAlpha) {
      errors.push(`Hardware GPU encoding (${opts.gpuEncoder ?? 'gpu'}) does not support alpha channel pixel formats (${preset.pixFmt}). Use software encoding.`);
    }

    if (opts.from !== undefined && opts.to !== undefined && opts.to <= opts.from) {
      errors.push(`Invalid time range: to (${opts.to}) must be greater than from (${opts.from}).`);
    }
    const w = opts.width ?? 1920, h = opts.height ?? 1080, fps = opts.fps ?? 60, smp = (opts as any).samples ?? 1;
    if (!Number.isFinite(w) || w < 320 || w > 7680) errors.push(`Invalid width ${opts.width} (320–7680)`);
    if (!Number.isFinite(h) || h < 240 || h > 4320) errors.push(`Invalid height ${opts.height} (240–4320)`);
    if (!Number.isFinite(fps) || fps < 15 || fps > 120) errors.push(`Invalid fps ${opts.fps} (15–120)`);
    if (!Number.isFinite(smp) || smp < 1 || smp > 324) errors.push(`Invalid samples ${smp} (1–324)`);
    for (const p of [opts.outPath, (opts as any).audioTrack]) {
      if (typeof p === 'string' && (/["`\n\r$;|&]/.test(p) || p.includes('..'))) errors.push(`Unsafe path '${p}' (quotes/shell metachars/.. rejected)`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Build complete FFmpeg command arguments for receiving raw RGBA frames over pipe
   */
  static buildFFmpegArgs(opts: ExportVideoOptions): string[] {
    const w = opts.width ?? 1920;
    const h = opts.height ?? 1080;
    const fps = opts.fps ?? 60;
    const preset = this.getPreset(opts.format);

    const args: string[] = [
      'ffmpeg',
      '-y',
      '-loglevel', 'error',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${w}x${h}`,
      '-r', String(fps),
      '-i', 'pipe:0',
    ];

    // Optional audio track input
    if (opts.audioTrack) {
      if (opts.from !== undefined) {
        args.push('-ss', String(opts.from));
      }
      if (opts.from !== undefined && opts.to !== undefined) {
        args.push('-t', String(opts.to - opts.from));
      }
      args.push('-i', opts.audioTrack);
    }

    // Video filter: vertical flip (WebGL framebuffer readback is inverted)
    args.push('-vf', 'vflip');

    // Codec & encoding options
    if (opts.gpu && opts.gpuEncoder) {
      args.push(
        '-c:v', opts.gpuEncoder,
        '-quality', 'quality',
        '-rc', 'cqp',
        '-qp_i', String(preset.defaultCrf ?? 20),
        '-qp_p', String(preset.defaultCrf ?? 20),
        '-pix_fmt', preset.pixFmt,
      );
    } else {
      args.push('-c:v', preset.codec);
      if (preset.defaultCrf !== undefined) {
        args.push('-crf', String(preset.defaultCrf));
      }
      args.push('-pix_fmt', preset.pixFmt);
      args.push(...preset.extraArgs);
    }

    // Audio encoding options
    if (opts.audioTrack) {
      args.push('-c:a', 'aac', '-b:a', '320k', '-shortest');
    }

    args.push(opts.outPath);
    return args;
  }

  /**
   * Build recommended headless Chromium launch flags for hardware-accelerated offscreen WebGL
   */
  static buildChromiumFlags(): string[] {
    return [
      '--use-angle=vulkan',
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ];
  }

  /**
   * Format terminal command string for executing render.ts with the selected preset
   */
  static buildCLICommand(opts: ExportVideoOptions): string {
    const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const parts = [
      'bun',
      'scripts/render.ts',
      'video',
      `--out ${q(opts.outPath)}`,
      `--fps ${opts.fps ?? 60}`,
    ];

    if (opts.from !== undefined) parts.push(`--from ${opts.from}`);
    if (opts.to !== undefined) parts.push(`--to ${opts.to}`);
    if (opts.samples !== undefined) parts.push(`--samples ${opts.samples}`);
    if (opts.shutter !== undefined) parts.push(`--shutter ${opts.shutter}`);
    if (opts.transparent) parts.push('--transparent');
    if (opts.gpu) parts.push('--gpu');
    if (opts.gpuEncoder) parts.push(`--gpu-encoder ${opts.gpuEncoder}`);

    return parts.join(' ');
  }
}
