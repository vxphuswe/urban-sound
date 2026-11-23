// Phiên âm: file/ghi âm dùng Whisper trong Web Worker; trực tiếp dùng Web Speech API của trình duyệt.

import { CONFIG } from './config.js';

let worker = null;
let seq = 0;

export function transcribe(wave16k, { model = CONFIG.ASR_DEFAULT, language = 'vietnamese', onStatus, onLoad } = {}) {
  if (!worker) worker = new Worker(new URL('./transcribe-worker.js', import.meta.url), { type: 'module' });
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      const d = e.data;
      if (d.type === 'status') onStatus?.(d.text);
      else if (d.type === 'load') onLoad?.(d);
      else if (d.type === 'result' && d.id === id) { worker.removeEventListener('message', handler); resolve(d); }
      else if (d.type === 'error' && d.id === id) { worker.removeEventListener('message', handler); reject(new Error(d.message)); }
    };
    worker.addEventListener('message', handler);
    // sao chép để worker nhận quyền sở hữu bộ nhớ
    const copy = new Float32Array(wave16k);
    worker.postMessage({ type: 'transcribe', id, url: CONFIG.TRANSFORMERS_URL, model, language, audio: copy }, [copy.buffer]);
  });
}

export function formatTime(s) {
  if (s == null || !isFinite(s)) return '--:--';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function toSrt(chunks) {
  const t = (s) => {
    const ms = Math.round((s || 0) * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`;
  };
  return chunks.map((c, i) => `${i + 1}\n${t(c.start)} --> ${t(c.end ?? c.start + 3)}\n${c.text}\n`).join('\n');
}

/** Phụ đề trực tiếp bằng Web Speech API (Chrome, Edge, Safari). */
export class LiveCaptions {
  static supported() { return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition); }
  constructor({ lang = 'vi-VN', onText, onFinal, onError } = {}) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.r = new R();
    this.r.lang = lang; this.r.continuous = true; this.r.interimResults = true;
    this.r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) onFinal?.(t.trim()); else interim += t;
      }
      onText?.(interim);
    };
    this.r.onerror = (e) => onError?.(e.error);
    this.r.onend = () => { if (this.on) try { this.r.start(); } catch { /* đang chạy */ } };
  }
  start() { this.on = true; this.r.start(); }
  stop() { this.on = false; try { this.r.stop(); } catch { /* đã dừng */ } }
}
