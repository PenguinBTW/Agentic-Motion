// Pixel-level analysis on 480x270 frames
// Motion energy E, 2D phase correlation flow, luma, contrast, edge density, palette distance, shimmer.

export interface PaletteEntry {
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  lab: [number, number, number];
}

export function parsePalette(paletteArg?: string): PaletteEntry[] {
  const defaultEntries = [
    { name: 'ink', hex: '#0A0A0B' },
    { name: 'bone', hex: '#EEE9DF' },
    { name: 'paper', hex: '#F7F4EC' },
    { name: 'signal', hex: '#FF4D12' },
    { name: 'signal-lite', hex: '#F9845A' },
  ];
  const list = paletteArg
    ? paletteArg.split(',').map((part) => {
        const [name, hex] = part.split('=');
        return { name: name!.trim(), hex: hex!.trim() };
      })
    : defaultEntries;

  return list.map((e) => {
    const hex = e.hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      name: e.name,
      hex: e.hex,
      r,
      g,
      b,
      lab: rgbToLab(r, g, b),
    };
  });
}

// Convert sRGB (0-255) to CIE Lab
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB to linear RGB
  let lr = r / 255, lg = g / 255, lb = b / 255;
  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

  // Linear RGB to XYZ (D65)
  let x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  let y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  let z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

  // Normalize for D65 white point
  x /= 0.95047;
  y /= 1.00000;
  z /= 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);
  return [L, a, bVal];
}

// Delta E 76
export function deltaE76(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

// 4x4 Box-filter downscale from (pw, ph) to (480, 270) with vertical flip
export function downscaleFrame(
  src: Uint8Array,
  pw: number,
  ph: number,
  outW = 480,
  outH = 270
): Uint8Array {
  const out = new Uint8Array(outW * outH * 4);
  const blockW = Math.round(pw / outW);
  const blockH = Math.round(ph / outH);
  const numPixels = blockW * blockH;

  for (let oy = 0; oy < outH; oy++) {
    // Invert Y because WebGL readPixels is bottom-up
    const iyBase = (ph - 1) - (oy * blockH);
    for (let ox = 0; ox < outW; ox++) {
      const ixBase = ox * blockW;
      let rSum = 0, gSum = 0, bSum = 0;

      for (let dy = 0; dy < blockH; dy++) {
        const iy = iyBase - dy;
        const rowOffset = iy * pw * 4;
        for (let dx = 0; dx < blockW; dx++) {
          const ix = ixBase + dx;
          const idx = rowOffset + ix * 4;
          rSum += src[idx]!;
          gSum += src[idx + 1]!;
          bSum += src[idx + 2]!;
        }
      }

      const outIdx = (oy * outW + ox) * 4;
      out[outIdx] = Math.round(rSum / numPixels);
      out[outIdx + 1] = Math.round(gSum / numPixels);
      out[outIdx + 2] = Math.round(bSum / numPixels);
      out[outIdx + 3] = 255;
    }
  }
  return out;
}

// Extract normalized luma (Rec. 709) for 480x270 frame
export function computeLuma(frameRGBA: Uint8Array, w = 480, h = 270): Float32Array {
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = frameRGBA[idx]! / 255;
    const g = frameRGBA[idx + 1]! / 255;
    const b = frameRGBA[idx + 2]! / 255;
    luma[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return luma;
}

// Motion energy between consecutive frames
export function computeMotionEnergy(lumaCur: Float32Array, lumaPrev: Float32Array): { E: number; E_p95: number } {
  const n = lumaCur.length;
  let sum = 0;
  // Use histogram for fast 95th percentile
  const BINS = 1000;
  const hist = new Uint32Array(BINS);

  for (let i = 0; i < n; i++) {
    const diff = Math.abs(lumaCur[i]! - lumaPrev[i]!);
    sum += diff;
    const b = Math.min(BINS - 1, Math.floor(diff * BINS));
    hist[b] = hist[b]! + 1;
  }

  const E = sum / n;
  const targetCount = Math.floor(n * 0.95);
  let count = 0;
  let E_p95 = 0;
  for (let b = 0; b < BINS; b++) {
    count += hist[b]!;
    if (count >= targetCount) {
      E_p95 = (b + 0.5) / BINS;
      break;
    }
  }

  return { E, E_p95 };
}

// Luma mean and contrast (standard deviation)
export function computeLumaAndContrast(luma: Float32Array): { lumaMean: number; contrast: number } {
  const n = luma.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += luma[i]!;
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = luma[i]! - mean;
    varSum += d * d;
  }
  return { lumaMean: mean, contrast: Math.sqrt(varSum / n) };
}

// Sobel edge density and edge map
export function computeSobelEdges(luma: Float32Array, w = 480, h = 270): { edgeDensity: number; edgeMap: Float32Array } {
  const edgeMap = new Float32Array(w * h);
  let sum = 0;

  for (let y = 1; y < h - 1; y++) {
    const yPrev = (y - 1) * w;
    const yCur = y * w;
    const yNext = (y + 1) * w;

    for (let x = 1; x < w - 1; x++) {
      const p00 = luma[yPrev + x - 1]!, p01 = luma[yPrev + x]!, p02 = luma[yPrev + x + 1]!;
      const p10 = luma[yCur + x - 1]!,                           p12 = luma[yCur + x + 1]!;
      const p20 = luma[yNext + x - 1]!, p21 = luma[yNext + x]!, p22 = luma[yNext + x + 1]!;

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;
      const mag = Math.sqrt(gx * gx + gy * gy) / 4.0;
      edgeMap[yCur + x] = mag;
      sum += mag;
    }
  }

  return { edgeDensity: sum / (w * h), edgeMap };
}

// Signal and bright non-signal pixel percentage
export function computeSignalMetrics(frameRGBA: Uint8Array, w = 480, h = 270): { signalPct: number; brightNonsignalPct: number } {
  const total = w * h;
  let signalCount = 0;
  let brightNonSignalCount = 0;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = frameRGBA[idx]!;
    const g = frameRGBA[idx + 1]!;
    const b = frameRGBA[idx + 2]!;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const sat = max > 0 ? delta / max : 0;

    let hue = 0;
    if (delta > 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }

    // Signal orange is ~15° (hue in [0, 30] or [345, 360], sat > 0.5)
    const isSignal = (hue <= 30 || hue >= 345) && sat > 0.5;
    if (isSignal) {
      signalCount++;
    } else {
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (luma > 0.85) {
        brightNonSignalCount++;
      }
    }
  }

  return {
    signalPct: (signalCount / total) * 100,
    brightNonsignalPct: (brightNonSignalCount / total) * 100,
  };
}

// Palette class shares (ΔE76 in Lab)
export function computePaletteShares(
  frameRGBA: Uint8Array,
  palette: PaletteEntry[],
  w = 480,
  h = 270
): { shares: Record<string, number>; otherPct: number } {
  const total = w * h;
  const counts: Record<string, number> = {};
  for (const p of palette) counts[p.name] = 0;
  let otherCount = 0;

  // Process pixels (step by 2 in x and y for fast deterministic estimation)
  let sampled = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      sampled++;
      const idx = (y * w + x) * 4;
      const r = frameRGBA[idx]!;
      const g = frameRGBA[idx + 1]!;
      const b = frameRGBA[idx + 2]!;

      const lab = rgbToLab(r, g, b);
      let minDe = Infinity;
      let closestName = palette[0]!.name;

      for (const p of palette) {
        const de = deltaE76(lab, p.lab);
        if (de < minDe) {
          minDe = de;
          closestName = p.name;
        }
      }

      if (minDe > 12.0) {
        otherCount++;
      } else {
        counts[closestName] = (counts[closestName] ?? 0) + 1;
      }
    }
  }

  const shares: Record<string, number> = {};
  for (const p of palette) {
    shares[p.name] = ((counts[p.name] ?? 0) / sampled) * 100;
  }
  const otherPct = (otherCount / sampled) * 100;

  return { shares, otherPct };
}

// 1D Radix-2 FFT (power of 2)
function fft1D(real: Float64Array, imag: Float64Array, n: number, inverse = false) {
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let tr = real[i]!; real[i] = real[j]!; real[j] = tr;
      let ti = imag[i]!; imag[i] = imag[j]!; imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) { j -= k; k >>= 1; }
    j += k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (inverse ? 2 * Math.PI : -2 * Math.PI) / len;
    const wStepR = Math.cos(angle), wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const uR = real[i + k]!, uI = imag[i + k]!;
        const vR = real[i + k + half]! * wr - imag[i + k + half]! * wi;
        const vI = real[i + k + half]! * wi + imag[i + k + half]! * wr;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + half] = uR - vR;
        imag[i + k + half] = uI - vI;

        const nextWr = wr * wStepR - wi * wStepI;
        wi = wr * wStepI + wi * wStepR;
        wr = nextWr;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

// 2D Phase correlation flow between consecutive frames (downscaled to 128x128)
const FFT_SIZE = 128;
export function computePhaseCorrelationFlow(
  lumaCur: Float32Array,
  lumaPrev: Float32Array,
  fps = 60,
  w = 480,
  h = 270
): { flow_dx: number; flow_dy: number } {
  const N = FFT_SIZE;
  const r1 = new Float64Array(N * N), i1 = new Float64Array(N * N);
  const r2 = new Float64Array(N * N), i2 = new Float64Array(N * N);

  // Resample luma to 128x128 with 2D Hann window
  for (let y = 0; y < N; y++) {
    const sy = Math.floor((y * h) / N);
    const winY = 0.5 * (1 - Math.cos((2 * Math.PI * y) / (N - 1)));
    for (let x = 0; x < N; x++) {
      const sx = Math.floor((x * w) / N);
      const winX = 0.5 * (1 - Math.cos((2 * Math.PI * x) / (N - 1)));
      const win = winX * winY;
      const idx = y * N + x;
      r1[idx] = lumaPrev[sy * w + sx]! * win;
      r2[idx] = lumaCur[sy * w + sx]! * win;
    }
  }

  // 2D FFT on image 1
  for (let y = 0; y < N; y++) {
    const rowR = r1.subarray(y * N, (y + 1) * N);
    const rowI = i1.subarray(y * N, (y + 1) * N);
    fft1D(rowR, rowI, N, false);
  }
  for (let x = 0; x < N; x++) {
    const colR = new Float64Array(N), colI = new Float64Array(N);
    for (let y = 0; y < N; y++) { colR[y] = r1[y * N + x]!; colI[y] = i1[y * N + x]!; }
    fft1D(colR, colI, N, false);
    for (let y = 0; y < N; y++) { r1[y * N + x] = colR[y]!; i1[y * N + x] = colI[y]!; }
  }

  // 2D FFT on image 2
  for (let y = 0; y < N; y++) {
    const rowR = r2.subarray(y * N, (y + 1) * N);
    const rowI = i2.subarray(y * N, (y + 1) * N);
    fft1D(rowR, rowI, N, false);
  }
  for (let x = 0; x < N; x++) {
    const colR = new Float64Array(N), colI = new Float64Array(N);
    for (let y = 0; y < N; y++) { colR[y] = r2[y * N + x]!; colI[y] = i2[y * N + x]!; }
    fft1D(colR, colI, N, false);
    for (let y = 0; y < N; y++) { r2[y * N + x] = colR[y]!; i2[y * N + x] = colI[y]!; }
  }

  // Cross-power spectrum: R = (F2 * conj(F1)) / |F2 * conj(F1)|
  const cpR = new Float64Array(N * N), cpI = new Float64Array(N * N);
  for (let k = 0; k < N * N; k++) {
    // F2 * conj(F1) = (r2 + i2*j) * (r1 - i1*j) = (r2*r1 + i2*i1) + (i2*r1 - r2*i1)*j
    const numR = r2[k]! * r1[k]! + i2[k]! * i1[k]!;
    const numI = i2[k]! * r1[k]! - r2[k]! * i1[k]!;
    const mag = Math.hypot(numR, numI) + 1e-9;
    cpR[k] = numR / mag;
    cpI[k] = numI / mag;
  }

  // Inverse 2D FFT
  for (let y = 0; y < N; y++) {
    const rowR = cpR.subarray(y * N, (y + 1) * N);
    const rowI = cpI.subarray(y * N, (y + 1) * N);
    fft1D(rowR, rowI, N, true);
  }
  for (let x = 0; x < N; x++) {
    const colR = new Float64Array(N), colI = new Float64Array(N);
    for (let y = 0; y < N; y++) { colR[y] = cpR[y * N + x]!; colI[y] = cpI[y * N + x]!; }
    fft1D(colR, colI, N, true);
    for (let y = 0; y < N; y++) { cpR[y * N + x] = colR[y]!; }
  }

  // Find peak
  let maxVal = -Infinity;
  let peakX = 0, peakY = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = cpR[y * N + x]!;
      if (v > maxVal) {
        maxVal = v;
        peakX = x;
        peakY = y;
      }
    }
  }

  let shiftX = peakX > N / 2 ? peakX - N : peakX;
  let shiftY = peakY > N / 2 ? peakY - N : peakY;

  // Parabolic interpolation for subpixel shift
  const xLeft = (peakX - 1 + N) % N, xRight = (peakX + 1) % N;
  const vL = cpR[peakY * N + xLeft]!, vC = maxVal, vR = cpR[peakY * N + xRight]!;
  const denomX = 2 * (2 * vC - vL - vR);
  if (Math.abs(denomX) > 1e-6) {
    shiftX += (vR - vL) / denomX;
  }

  const yUp = (peakY - 1 + N) % N, yDown = (peakY + 1) % N;
  const vU = cpR[yUp * N + peakX]!, vD = cpR[yDown * N + peakX]!;
  const denomY = 2 * (2 * vC - vU - vD);
  if (Math.abs(denomY) > 1e-6) {
    shiftY += (vD - vU) / denomY;
  }

  // Scale back to logical 1920x1080 px/s
  const flow_dx = shiftX * (1920 / N) * fps;
  const flow_dy = shiftY * (1080 / N) * fps;

  return { flow_dx, flow_dy };
}

// Shimmer index: second difference magnitude on edge pixels
export function computeShimmer(
  lumaPrev: Float32Array,
  lumaCur: Float32Array,
  lumaNext: Float32Array,
  edgeMap: Float32Array,
  threshold = 0.15
): number {
  const n = lumaCur.length;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    if (edgeMap[i]! >= threshold) {
      const d2 = Math.abs(lumaNext[i]! - 2 * lumaCur[i]! + lumaPrev[i]!);
      sum += d2;
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}
