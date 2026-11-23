// Xử lý tín hiệu thuần JavaScript (không phụ thuộc thư viện) – chạy được cả trong trình duyệt lẫn Node để kiểm thử.

/** RMS của đoạn x[a:b] */
export function rms(x, a = 0, b = x.length) {
  let s = 0;
  const n = Math.max(1, b - a);
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / n);
}

/** dBFS (mức so với biên độ số tối đa, luôn <= 0). */
export function dbfs(r) {
  return Math.max(-100, 20 * Math.log10(r + 1e-10));
}

/** Đỉnh tuyệt đối */
export function peak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; }
  return m;
}

/** Đổi tần số lấy mẫu bằng nội suy tuyến tính, có lọc trung bình chống chồng phổ khi hạ tần số. */
export function resample(x, from, to) {
  if (from === to) return Float32Array.from(x);
  const ratio = from / to;
  let src = x;
  if (ratio > 1.5) {
    // lọc thông thấp đơn giản: trung bình trượt độ rộng ~ratio mẫu
    const w = Math.floor(ratio);
    src = new Float32Array(x.length);
    let acc = 0;
    for (let i = 0; i < x.length; i++) {
      acc += x[i];
      if (i >= w) acc -= x[i - w];
      src[i] = acc / Math.min(i + 1, w);
    }
  }
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio;
    const k = Math.floor(p);
    const f = p - k;
    const a = src[k] || 0;
    const b = src[k + 1] ?? a;
    out[i] = a + (b - a) * f;
  }
  return out;
}

// ------------------------------------------------------------------ FFT (radix-2, tại chỗ)
function makeFFT(n) {
  const levels = Math.log2(n);
  if (levels % 1) throw new Error('FFT size phải là lũy thừa của 2');
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r = (r << 1) | ((i >>> b) & 1);
    rev[i] = r;
  }
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  return function fft(re, im, inverse = false) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    const sgn = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const wr = cos[k];
          const wi = sgn * sin[k];
          const a = i + j;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };
}

/**
 * Lọc tạp âm nền dừng (máy lạnh, quạt, ù điện, xe chạy đều) bằng "spectral gating":
 * 1. Ước lượng phổ nhiễu từ 15% khung yên tĩnh nhất (hoặc từ noiseProfile truyền vào).
 * 2. Mỗi bin tần số được nhân hệ số giảm khi biên độ gần mức nhiễu, có làm mượt theo thời gian.
 * Âm thanh ngắn, đột ngột như tiếng sủa, còi xe gần như giữ nguyên.
 * Trả về { y: Float32Array, profile: Float32Array, reductionDb: number }
 */
export function denoise(x, opts = {}) {
  const N = opts.n || 512;
  const H = N / 4;
  const alpha = opts.strength ?? 1.6;     // mức trừ nhiễu
  const floorGain = opts.floor ?? 0.12;   // không giảm dưới mức này (tránh tiếng "rè" nhân tạo)
  const fft = makeFFT(N);
  const bins = N / 2 + 1;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));

  const nFrames = Math.max(1, Math.ceil((x.length + N) / H));
  const padded = new Float32Array(nFrames * H + N);
  padded.set(x, N / 2);

  // STFT
  const mags = new Array(nFrames);
  const phR = new Array(nFrames);
  const phI = new Array(nFrames);
  const energy = new Float32Array(nFrames);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let f = 0; f < nFrames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = padded[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const m = new Float32Array(bins);
    const r = new Float32Array(bins);
    const ii = new Float32Array(bins);
    let e = 0;
    for (let k = 0; k < bins; k++) {
      m[k] = Math.hypot(re[k], im[k]);
      r[k] = re[k]; ii[k] = im[k];
      e += m[k] * m[k];
    }
    mags[f] = m; phR[f] = r; phI[f] = ii; energy[f] = e;
  }

  // Phổ nhiễu
  let profile = opts.noiseProfile;
  let adaptive = 1;
  if (!profile) {
    const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]);
    const take = Math.max(3, Math.floor(nFrames * 0.15));
    profile = new Float32Array(bins);
    for (let t = 0; t < take; t++) {
      const m = mags[order[Math.min(t, nFrames - 1)]];
      for (let k = 0; k < bins; k++) profile[k] += m[k] / take;
    }
    // Nếu khung yên nhất cũng gần bằng mức trung vị => tín hiệu đều (không có đoạn lặng): trừ nhẹ tay
    const med = energy[order[Math.floor(nFrames / 2)]] + 1e-12;
    const low = energy[order[Math.floor(take / 2)]] + 1e-12;
    if (10 * Math.log10(med / low) < 6) adaptive = 0.6;
  }

  // Hệ số giảm theo bin, làm mượt theo thời gian
  const out = new Float32Array(padded.length);
  const prevG = new Float32Array(bins).fill(1);
  let inE = 0, outE = 0;
  for (let f = 0; f < nFrames; f++) {
    const m = mags[f];
    const g = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      const sub = 1 - (alpha * adaptive * profile[k]) / (m[k] + 1e-9);
      g[k] = Math.max(floorGain, sub);
    }
    // làm mượt theo tần số (3 bin) và theo thời gian (attack nhanh, release chậm)
    for (let k = 0; k < bins; k++) {
      const s = (g[Math.max(0, k - 1)] + g[k] + g[Math.min(bins - 1, k + 1)]) / 3;
      const p = prevG[k];
      const v = s > p ? s : 0.6 * p + 0.4 * s;
      prevG[k] = v;
      g[k] = v;
    }
    for (let k = 0; k < bins; k++) {
      re[k] = phR[f][k] * g[k]; im[k] = phI[f][k] * g[k];
      inE += m[k] * m[k]; outE += (m[k] * g[k]) ** 2;
    }
    for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    fft(re, im, true);
    const o = f * H;
    for (let i = 0; i < N; i++) out[o + i] += re[i] * win[i];
  }
  // sqrt-hann phân tích + tổng hợp, bước N/4 => tổng cửa sổ = 2
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = out[i + N / 2] / 2;
  return { y, profile, reductionDb: 10 * Math.log10((inE + 1e-12) / (outE + 1e-12)) };
}

/** Mức năng lượng (dBFS) của từng khung YAMNet: cửa sổ 0.96 s, bước 0.48 s ở 16 kHz. */
export function frameLevels(x, sr = 16000, win = 0.96, hop = 0.48, nFrames = null) {
  const W = Math.round(win * sr);
  const Hs = Math.round(hop * sr);
  const n = nFrames ?? Math.max(1, Math.floor(Math.max(0, x.length - W) / Hs) + 1);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    const a = f * Hs;
    out[f] = dbfs(rms(x, a, Math.min(x.length, a + W)));
  }
  return out;
}

/** Bao biên độ để vẽ dạng sóng gọn nhẹ */
export function envelope(x, bins = 600) {
  const out = new Float32Array(bins);
  const step = x.length / bins;
  for (let b = 0; b < bins; b++) {
    let m = 0;
    const a = Math.floor(b * step);
    const e = Math.min(x.length, Math.floor((b + 1) * step));
    for (let i = a; i < e; i++) { const v = Math.abs(x[i]); if (v > m) m = v; }
    out[b] = m;
  }
  return out;
}

/** Bách phân vị của mảng số */
export function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = Array.from(arr).sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
}
