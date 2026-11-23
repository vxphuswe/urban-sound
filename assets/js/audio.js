// Đọc file âm thanh/video bất kỳ, ghi âm, và thu micro liên tục.

import { resample, rms, dbfs } from './dsp.js';
import { CONFIG } from './config.js';

export const TARGET_SR = 16000;
export const ACCEPT = 'audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.mp4,.mov,.m4v,.3gp,.amr,.wma';

// Tắt các bộ lọc dành cho cuộc gọi: chúng coi tiếng sủa, còi xe là "nhiễu" và làm méo âm thanh.
export const MIC_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };

let sharedCtx = null;
export function audioContext() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  return sharedCtx;
}

/** File (âm thanh hoặc video) -> sóng mono 16 kHz. */
export async function decodeToMono16k(fileOrBlob) {
  const buf = await fileOrBlob.arrayBuffer();
  const ctx = audioContext();
  let decoded;
  try {
    decoded = await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(buf.slice(0), res, rej);
      if (p && p.then) p.then(res, rej);
    });
  } catch {
    throw new Error('Trình duyệt không đọc được định dạng này. Hãy thử file .mp3, .m4a, .wav hoặc .mp4.');
  }
  const dur = decoded.duration;
  const len = Math.max(1, Math.ceil(dur * TARGET_SR));
  let mono;
  try {
    const off = new OfflineAudioContext(1, len, TARGET_SR);
    const src = off.createBufferSource();
    src.buffer = decoded; src.connect(off.destination); src.start();
    mono = (await off.startRendering()).getChannelData(0);
  } catch {
    // dự phòng: tự trộn kênh và đổi tần số
    const ch = decoded.numberOfChannels;
    const mix = new Float32Array(decoded.length);
    for (let c = 0; c < ch; c++) { const d = decoded.getChannelData(c); for (let i = 0; i < d.length; i++) mix[i] += d[i] / ch; }
    mono = resample(mix, decoded.sampleRate, TARGET_SR);
  }
  return { wave: new Float32Array(mono), duration: dur, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels };
}

/** dB ước tính từ dBFS (xem CONFIG.CALIBRATION_DB). */
export function toDb(dbfsValue) {
  const cal = Number(localStorage.getItem('tp.calibration') ?? CONFIG.CALIBRATION_DB);
  return Math.max(0, dbfsValue + cal);
}

/** Thống kê mức âm của cả đoạn: trung bình năng lượng (Leq), đỉnh (theo khối 125 ms), thấp nhất. */
export function levelStats(wave, sr = TARGET_SR) {
  const block = Math.round(sr * 0.125);
  const vals = [];
  let e = 0, n = 0;
  for (let a = 0; a + block <= wave.length || (a === 0 && wave.length); a += block) {
    const b = Math.min(wave.length, a + block);
    const r = rms(wave, a, b);
    vals.push(dbfs(r)); e += r * r * (b - a); n += b - a;
    if (b >= wave.length) break;
  }
  const leq = dbfs(Math.sqrt(e / Math.max(1, n)));
  return { avg: toDb(leq), max: toDb(Math.max(...vals)), min: toDb(Math.min(...vals)), series: vals.map(toDb) };
}

/** Ghi âm bằng MediaRecorder, đồng thời báo mức âm theo thời gian thực. */
export class Recorder {
  constructor({ onLevel } = {}) { this.onLevel = onLevel; }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    const ctx = audioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    this.src = ctx.createMediaStreamSource(this.stream);
    this.an = ctx.createAnalyser(); this.an.fftSize = 2048;
    this.src.connect(this.an);
    const tmp = new Float32Array(this.an.fftSize);
    const tick = () => {
      if (!this.an) return;
      this.an.getFloatTimeDomainData(tmp);
      this.onLevel?.(toDb(dbfs(rms(tmp))), tmp);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.t0 = performance.now();
  }
  get seconds() { return this.t0 ? (performance.now() - this.t0) / 1000 : 0; }
  stop() {
    return new Promise((res) => {
      if (!this.rec) return res(null);
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' });
        this.cleanup();
        res(blob);
      };
      this.rec.stop();
    });
  }
  cleanup() {
    cancelAnimationFrame(this.raf);
    try { this.src?.disconnect(); } catch { /* đã ngắt */ }
    this.an = null;
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}

/**
 * Thu micro liên tục cho chế độ trực tiếp và máy đo dB.
 * Giữ bộ đệm vòng vài giây ở tần số gốc, lấy đoạn gần nhất khi cần nhận diện.
 */
export class LiveMic {
  constructor({ seconds = 4, onBlock } = {}) { this.seconds = seconds; this.onBlock = onBlock; }

  async start(deviceId) {
    const audio = { ...MIC_CONSTRAINTS };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    const ctx = audioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    this.ctx = ctx;
    this.sr = ctx.sampleRate;
    this.buf = new Float32Array(Math.ceil(this.sr * this.seconds));
    this.w = 0; this.filled = 0;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;
    this.src.connect(this.analyser);
    this.sink = ctx.createGain(); this.sink.gain.value = 0; this.sink.connect(ctx.destination);

    const push = (block) => {
      for (let i = 0; i < block.length; i++) { this.buf[this.w] = block[i]; this.w = (this.w + 1) % this.buf.length; }
      this.filled = Math.min(this.buf.length, this.filled + block.length);
      this.onBlock?.(toDb(dbfs(rms(block))), block);
    };
    try {
      await ctx.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
      this.node = new AudioWorkletNode(ctx, 'capture-processor');
      this.node.port.onmessage = (e) => push(e.data);
    } catch {
      this.node = ctx.createScriptProcessor(2048, 1, 1);
      this.node.onaudioprocess = (e) => push(new Float32Array(e.inputBuffer.getChannelData(0)));
    }
    this.src.connect(this.node);
    this.node.connect(this.sink);
    this.running = true;
  }

  /** `sec` giây gần nhất, đã đổi về 16 kHz */
  latest(sec) {
    const n = Math.min(this.filled, Math.round(sec * this.sr));
    const out = new Float32Array(n);
    let r = (this.w - n + this.buf.length) % this.buf.length;
    for (let i = 0; i < n; i++) { out[i] = this.buf[r]; r = (r + 1) % this.buf.length; }
    return resample(out, this.sr, TARGET_SR);
  }

  get track() { return this.stream?.getAudioTracks()[0]; }
  setMuted(m) { if (this.track) this.track.enabled = !m; }

  stop() {
    this.running = false;
    try { this.src?.disconnect(); this.node?.disconnect(); this.sink?.disconnect(); } catch { /* đã ngắt */ }
    if (this.node?.port) this.node.port.onmessage = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

export async function listMics() {
  try {
    const d = await navigator.mediaDevices.enumerateDevices();
    return d.filter((x) => x.kind === 'audioinput');
  } catch { return []; }
}

export function micErrorMessage(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Bạn chưa cho phép dùng micro. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ → Cho phép Micro, rồi thử lại.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Không tìm thấy micro. Hãy cắm tai nghe có micro hoặc kiểm tra cài đặt âm thanh.';
  if (n === 'NotReadableError') return 'Micro đang được ứng dụng khác dùng (Zoom, Meet…). Hãy đóng ứng dụng đó rồi thử lại.';
  if (!window.isSecureContext) return 'Micro chỉ hoạt động trên HTTPS hoặc localhost.';
  return 'Không mở được micro: ' + (e?.message || n);
}

/** Ghi sóng mono thành file WAV 16-bit (dùng cho trang đóng góp dữ liệu). */
export function encodeWav(wave, sr = TARGET_SR) {
  const n = wave.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, wave[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Nghe âm thanh đang phát trong thẻ trình duyệt (ví dụ video YouTube nhúng) trong `seconds` giây.
 * Dùng getDisplayMedia – người dùng phải chọn "Thẻ này" và bật "Chia sẻ âm thanh". Chrome/Edge máy tính.
 */
export async function captureTabAudio(seconds, { onStart, onTick } = {}) {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Trình duyệt này không hỗ trợ nghe âm thanh từ thẻ. Hãy dùng Chrome hoặc Edge trên máy tính.');
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include', surfaceSwitching: 'exclude',
    });
  } catch (e) {
    if (e?.name === 'NotAllowedError') throw new Error('Bạn đã huỷ chia sẻ. Bấm lại và chọn "Thẻ này", nhớ bật "Chia sẻ âm thanh của thẻ".');
    throw e;
  }
  const audio = stream.getAudioTracks();
  stream.getVideoTracks().forEach((t) => t.stop());
  if (!audio.length) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Chưa có âm thanh: khi chia sẻ, hãy bật công tắc "Chia sẻ âm thanh của thẻ" (Share tab audio).');
  }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
  const rec = new MediaRecorder(new MediaStream(audio), mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(250);
  onStart?.();
  const t0 = performance.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const left = seconds - (performance.now() - t0) / 1000;
      onTick?.(Math.max(0, left));
      if (left <= 0 || audio[0].readyState === 'ended') { clearInterval(iv); res(); }
    }, 200);
  });
  if (rec.state !== 'inactive') rec.stop();
  await done;
  audio.forEach((t) => t.stop());
  return new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
}
