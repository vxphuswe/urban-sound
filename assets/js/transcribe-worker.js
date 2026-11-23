// Web Worker: phiên âm giọng nói bằng Whisper (Transformers.js), chạy hoàn toàn trên máy người dùng.
// Mô hình được tải từ Hugging Face lần đầu và trình duyệt tự lưu cache cho các lần sau.

let lib = null;
let asr = null;
let currentModel = null;

async function getPipeline(url, model) {
  if (!lib) {
    lib = await import(url);
    lib.env.allowLocalModels = false;
  }
  if (asr && currentModel === model) return asr;
  const files = {};
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.file) {
      files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
      let l = 0, t = 0;
      for (const f of Object.values(files)) { l += f.loaded; t += f.total; }
      self.postMessage({ type: 'load', progress: t ? l / t : 0, loadedMB: l / 1048576, totalMB: t / 1048576 });
    }
  };
  asr = await lib.pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: 'wasm', progress_callback });
  currentModel = model;
  return asr;
}

// Câu "ảo giác" quen thuộc của Whisper khi gặp đoạn không có lời nói
const HALLUCINATIONS = [
  /hãy subscribe/i, /đăng ký kênh/i, /cảm ơn các bạn đã (theo dõi|xem)/i, /ghiền mì gõ/i, /subtitles? by/i,
  /amara\.org/i, /thanks for watching/i, /like và subscribe/i, /la la school/i, /bỏ lỡ những video hấp dẫn/i,
];

function clean(chunks) {
  return (chunks || [])
    .map((c) => ({ start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? null, text: (c.text || '').trim() }))
    .filter((c) => c.text && !HALLUCINATIONS.some((r) => r.test(c.text)))
    .filter((c, i, arr) => i === 0 || c.text !== arr[i - 1].text);
}

self.onmessage = async (e) => {
  const { type, url, model, audio, language, id } = e.data;
  if (type !== 'transcribe') return;
  try {
    self.postMessage({ type: 'status', text: 'Đang chuẩn bị mô hình phiên âm…' });
    const pipe = await getPipeline(url, model);
    self.postMessage({ type: 'status', text: 'Đang chuyển giọng nói thành văn bản…' });
    const opts = { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true };
    if (language && language !== 'auto') opts.language = language;
    const out = await pipe(audio, opts);
    const chunks = clean(out.chunks);
    self.postMessage({ type: 'result', id, text: chunks.map((c) => c.text).join(' ').trim(), chunks });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err?.message || err) });
  }
};
