// Phổ âm thanh cuộn (spectrogram) + đường sóng, vẽ từ AnalyserNode của micro.
// Dùng chung cho dải phổ dưới khung trực tiếp và cho khung camera/ghi hình.

const STOPS = [
  [0, 0, 0, 4], [0.13, 40, 11, 84], [0.27, 101, 21, 110], [0.4, 159, 42, 99],
  [0.53, 212, 72, 66], [0.67, 245, 125, 21], [0.82, 250, 193, 39], [1, 252, 255, 164],
];
const LUT = (() => {
  const t = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let k = 1;
    while (k < STOPS.length - 1 && STOPS[k][0] < x) k++;
    const [x0, r0, g0, b0] = STOPS[k - 1], [x1, r1, g1, b1] = STOPS[k];
    const f = (x - x0) / (x1 - x0 || 1);
    t[i * 3] = r0 + (r1 - r0) * f; t[i * 3 + 1] = g0 + (g1 - g0) * f; t[i * 3 + 2] = b0 + (b1 - b0) * f;
  }
  return t;
})();

export class Scope {
  constructor({ cols = 320, rows = 96, minHz = 60, maxHz = 8000 } = {}) {
    this.cols = cols; this.rows = rows; this.minHz = minHz; this.maxHz = maxHz;
    this.spec = document.createElement('canvas');
    this.spec.width = cols; this.spec.height = rows;
    this.sctx = this.spec.getContext('2d');
    this.sctx.fillStyle = '#000004'; this.sctx.fillRect(0, 0, cols, rows);
    this.col = this.sctx.createImageData(1, rows);
    this.env = new Float32Array(cols);
    this.envColor = new Array(cols).fill('#34d8bb');
  }

  reset() {
    this.sctx.fillStyle = '#000004'; this.sctx.fillRect(0, 0, this.cols, this.rows);
    this.env.fill(0);
  }

  /** Thêm một cột mới (gọi mỗi khung hình). */
  update(analyser, { muted = false, color = '#34d8bb' } = {}) {
    if (!analyser) return;
    if (!this.freq || this.freq.length !== analyser.frequencyBinCount) {
      this.freq = new Uint8Array(analyser.frequencyBinCount);
      this.time = new Float32Array(analyser.fftSize);
      analyser.minDecibels = -100; analyser.maxDecibels = -25;
    }
    const sr = analyser.context.sampleRate;
    const n = this.freq.length;
    let peak = 0;
    if (!muted) {
      analyser.getByteFrequencyData(this.freq);
      analyser.getFloatTimeDomainData(this.time);
      for (let i = 0; i < this.time.length; i++) { const a = Math.abs(this.time[i]); if (a > peak) peak = a; }
    } else this.freq.fill(0);
    const d = this.col.data;
    const ratio = this.maxHz / this.minHz;
    for (let r = 0; r < this.rows; r++) {
      const hz = this.minHz * ratio ** (r / (this.rows - 1));
      const v = this.freq[Math.min(n - 1, Math.round((hz / (sr / 2)) * n))];
      const y = this.rows - 1 - r;
      d[y * 4] = LUT[v * 3]; d[y * 4 + 1] = LUT[v * 3 + 1]; d[y * 4 + 2] = LUT[v * 3 + 2]; d[y * 4 + 3] = 255;
    }
    this.sctx.drawImage(this.spec, -1, 0);
    this.sctx.putImageData(this.col, this.cols - 1, 0);
    this.env.copyWithin(0, 1); this.env[this.cols - 1] = Math.min(1, Math.sqrt(peak) * 1.1);
    this.envColor.shift(); this.envColor.push(color);
  }

  /** Vẽ phổ + sóng vào vùng (x, y, w, h) của một context 2D (đơn vị CSS px). */
  draw(g, x, y, w, h, { labels = true, waveRatio = 0.3 } = {}) {
    const wh = Math.round(h * waveRatio), sh = h - wh;
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.spec, x, y, w, sh);
    g.fillStyle = 'rgba(5,8,8,.88)';
    g.fillRect(x, y + sh, w, wh);
    const mid = y + sh + wh / 2, step = w / this.cols;
    for (let i = 0; i < this.cols; i++) {
      const a = this.env[i] * (wh / 2 - 2);
      if (a < 0.5) continue;
      g.fillStyle = this.envColor[i];
      g.fillRect(x + i * step, mid - a, Math.max(1, step), a * 2);
    }
    if (labels) {
      g.font = '600 10px "Be Vietnam Pro", system-ui, sans-serif';
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillText('PHỔ ÂM THANH', x + 8, y + 14);
      g.fillText('SÓNG ÂM', x + 8, y + sh + 12);
      g.textAlign = 'right';
      g.fillText('8 kHz', x + w - 6, y + 12);
      g.fillText('60 Hz', x + w - 6, y + sh - 4);
    }
    g.restore();
  }
}
