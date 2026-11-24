// Nạp và chạy mô hình YAMNet (TensorFlow.js) ngay trong trình duyệt – không cần máy chủ Python,
// nên deploy được lên Vercel như một trang tĩnh.

import { CONFIG } from './config.js';
import { GROUPS, GROUP_BY_ID, buildGroupIndex } from './categories.js';
import { denoise, frameLevels, rms, dbfs } from './dsp.js';
import { analyzeClip, groupScores, mergeHead, FRAME_HOP, FRAME_WIN } from './analysis.js';
import { loadPersonal, personalScores, personalGroups, hasPersonal, bestPersonalMatch, meanEmbedding } from './personal.js';

export const SR = 16000;
const MIN_SAMPLES = 15600;               // YAMNet cần tối thiểu ~0.975 s
const CHUNK_FRAMES = 120;                // xử lý từng khúc ~58 s để không tràn bộ nhớ GPU
const HOP_SAMPLES = Math.round(FRAME_HOP * SR);

const S = { tf: null, model: null, classNames: null, groupIndex: null, head: null, customGroups: {}, loading: null, demo: false, source: '' };

export function isDemo() {
  try { return new URLSearchParams(location.search).has('demo'); } catch { return false; }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = () => rej(new Error('Không tải được ' + src));
    document.head.appendChild(s);
  });
}

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur); rows.push(cells);
  }
  return rows;
}

async function loadClassMap() {
  try {
    const cached = localStorage.getItem('tp.yamnet.classes');
    if (cached) { const a = JSON.parse(cached); if (a.length === 521) return a; }
  } catch { /* bỏ qua */ }
  for (const url of CONFIG.CLASS_MAP_SOURCES) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const rows = parseCsv(await r.text());
      const names = rows.slice(1).map((c) => c[2]);
      if (names.length >= 500) {
        try { localStorage.setItem('tp.yamnet.classes', JSON.stringify(names)); } catch { /* đầy bộ nhớ */ }
        return names;
      }
    } catch { /* thử nguồn tiếp theo */ }
  }
  throw new Error('Không tải được danh sách lớp âm thanh.');
}

function b64ToF32(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
}

/** Mô hình nhóm tự train (training/03_train_head.py) – một mạng Dense nhỏ trên embedding 1024 chiều của YAMNet. */
async function loadHead() {
  try {
    const r = await fetch(CONFIG.CUSTOM_HEAD_URL, { cache: 'no-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    const layers = j.layers.map((L) => ({ w: b64ToF32(L.w), b: b64ToF32(L.b), inDim: L.shape[0], outDim: L.shape[1], act: L.activation }));
    const custom = {};
    for (const c of j.classes) {
      const gid = c.group || c.id;
      if (!GROUP_BY_ID[gid]) custom[gid] = { id: gid, vi: c.vi || c.id, icon: c.icon || 'wave', kind: c.kind || 'people', weight: 1, names: [], custom: true };
    }
    const known = new Set(j.classes.map((c) => c.group || c.id));
    return { ...j, layers, custom, known, minConf: Math.max(0.6, j.min_confidence ?? 0.7) };
  } catch {
    return null;
  }
}

function headForward(head, x) {
  let h = x;
  for (const L of head.layers) {
    const out = new Float32Array(L.outDim);
    for (let o = 0; o < L.outDim; o++) out[o] = L.b[o];
    for (let i = 0; i < L.inDim; i++) {
      const xi = h[i];
      if (xi === 0) continue;
      const row = i * L.outDim;
      for (let o = 0; o < L.outDim; o++) out[o] += xi * L.w[row + o];
    }
    if (L.act === 'relu') for (let o = 0; o < L.outDim; o++) out[o] = Math.max(0, out[o]);
    if (L.act === 'softmax') {
      let m = -Infinity; for (const v of out) m = Math.max(m, v);
      let s = 0; for (let o = 0; o < L.outDim; o++) { out[o] = Math.exp(out[o] - m); s += out[o]; }
      for (let o = 0; o < L.outDim; o++) out[o] /= s;
    }
    h = out;
  }
  return h;
}
export { headForward as _headForward };

function headFramesFrom(emb, nFrames) {
  if (!S.head || !emb) return null;
  const out = [];
  for (let f = 0; f < nFrames; f++) {
    const p = headForward(S.head, emb.subarray(f * 1024, (f + 1) * 1024));
    const g = {};
    S.head.classes.forEach((c, i) => {
      if (p[i] < 0.2) return;
      const gid = c.group || c.id;
      g[gid] = Math.max(g[gid] || 0, p[i]);
    });
    out.push(g);
  }
  return out;
}

/** Nạp mô hình (chỉ một lần). onStatus(text, percent?) để cập nhật giao diện. */
export async function loadClassifier(onStatus = () => {}) {
  if (S.model || S.demo) return S;
  if (S.loading) return S.loading;
  S.loading = (async () => {
    if (isDemo()) {
      S.demo = true;
      S.classNames = DEMO_NAMES;
      S.groupIndex = buildGroupIndex(DEMO_NAMES);
      S.source = 'demo';
      await loadPersonal().catch(() => {});
      onStatus('Chế độ demo giao diện (không dùng mô hình thật)', 100);
      return S;
    }
    onStatus('Đang tải thư viện AI…', 5);
    if (!window.tf) {
      try { await loadScript(CONFIG.TFJS_URL); } catch { throw new Error('Không tải được thư viện AI. Hãy kiểm tra kết nối mạng rồi thử lại (lần đầu cần Internet để tải mô hình).'); }
    }
    const tf = window.tf;
    S.tf = tf;
    try { await tf.setBackend('webgl'); } catch { /* dùng backend mặc định */ }
    await tf.ready();

    onStatus('Đang tải mô hình nhận diện (~15 MB, chỉ tải lần đầu)…', 20);
    let model = null;
    try { model = await tf.loadGraphModel('indexeddb://taipho-yamnet'); S.source = 'bộ nhớ trình duyệt'; } catch { /* chưa có bản lưu */ }
    if (!model) {
      for (const src of CONFIG.YAMNET_SOURCES) {
        try {
          if (src.local) {
            const r = await fetch(src.url, { method: 'HEAD' });
            if (!r.ok) continue;
          }
          model = await tf.loadGraphModel(src.url, {
            fromTFHub: src.fromTFHub,
            onProgress: (p) => onStatus('Đang tải mô hình nhận diện…', 20 + Math.round(p * 60)),
          });
          S.source = src.url;
          try { await model.save('indexeddb://taipho-yamnet'); } catch { /* trình duyệt chặn IndexedDB */ }
          break;
        } catch (e) {
          console.warn('YAMNet source failed', src.url, e);
        }
      }
    }
    if (!model) throw new Error('Không tải được mô hình nhận diện. Hãy kiểm tra kết nối mạng rồi tải lại trang.');
    S.model = model;

    onStatus('Đang tải danh sách âm thanh…', 85);
    S.classNames = await loadClassMap();
    S.groupIndex = buildGroupIndex(S.classNames);
    S.head = await loadHead();
    S.customGroups = S.head?.custom || {};
    await loadPersonal().catch(() => {});

    onStatus('Khởi động mô hình…', 92);
    const warm = model.predict(tf.zeros([MIN_SAMPLES]));
    (Array.isArray(warm) ? warm : [warm]).forEach((t) => t.dispose());
    onStatus('Sẵn sàng', 100);
    return S;
  })();
  try {
    return await S.loading;
  } catch (e) {
    S.loading = null;
    throw e;
  }
}

/** Nạp lại danh sách "Âm thanh của tôi" (sau khi thêm/xóa mẫu). */
export { loadPersonal as reloadPersonal } from './personal.js';

export function classifierInfo() {
  return { ready: Boolean(S.model || S.demo), demo: S.demo, source: S.source, classes: S.classNames?.length || 0, head: S.head ? S.head.classes.map((c) => c.vi || c.id) : [] };
}

/** Chạy YAMNet trên sóng 16 kHz. Trả về điểm (nFrames x 521) và embedding (nFrames x 1024). */
export async function runYamnet(wave, onProgress) {
  if (S.demo) return demoScores(wave);
  const tf = S.tf;
  let x = wave;
  if (x.length < MIN_SAMPLES) { const p = new Float32Array(MIN_SAMPLES); p.set(x); x = p; }
  const chunkLen = CHUNK_FRAMES * HOP_SAMPLES + Math.round(FRAME_WIN * SR);
  const scores = [], embs = [];
  let nFrames = 0;
  for (let start = 0; start < x.length; start += CHUNK_FRAMES * HOP_SAMPLES) {
    let seg = x.subarray(start, Math.min(x.length, start + chunkLen));
    if (seg.length < MIN_SAMPLES) {
      if (start > 0) break; // phần đuôi quá ngắn đã nằm trong khúc trước
      const p = new Float32Array(MIN_SAMPLES); p.set(seg); seg = p;
    }
    const input = tf.tensor1d(seg);
    const out = S.model.predict(input);
    const [s, e] = Array.isArray(out) ? out : [out, null];
    const n = s.shape[0];
    const isLast = start + chunkLen >= x.length;
    const take = isLast ? n : Math.min(n, CHUNK_FRAMES);
    const sd = await s.data();
    const ed = e ? await e.data() : null;
    scores.push(sd.slice(0, take * 521));
    if (ed) embs.push(ed.slice(0, take * 1024));
    nFrames += take;
    input.dispose(); (Array.isArray(out) ? out : [out]).forEach((t) => t.dispose());
    onProgress?.(Math.min(1, (start + chunkLen) / x.length));
    await new Promise((r) => setTimeout(r, 0)); // nhường luồng cho giao diện
    if (isLast) break;
  }
  return { scores: concat(scores, nFrames * 521), emb: embs.length ? concat(embs, nFrames * 1024) : null, nFrames, nClasses: 521 };
}

function concat(parts, total) {
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) { out.set(p.subarray(0, Math.min(p.length, total - o)), o); o += p.length; }
  return out;
}

/**
 * Phân tích một đoạn âm thanh hoàn chỉnh (file, ghi âm, video).
 * @returns {Promise<{result, meta}>}
 */
export async function analyzeWave(wave, { useDenoise = CONFIG.DENOISE_DEFAULT, sensitivity = 'medium', onProgress, signal } = {}) {
  const check = () => { if (signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError'); };
  await loadClassifier();
  const maxLen = CONFIG.MAX_ANALYZE_SEC * SR;
  const truncated = wave.length > maxLen;
  const x = truncated ? wave.subarray(0, maxLen) : wave;
  const t0 = performance.now();

  onProgress?.('Đang nghe âm thanh…', 10);
  check();
  const a = await runYamnet(x, (p) => { check(); onProgress?.('Đang nghe âm thanh…', 10 + p * (useDenoise ? 40 : 80)); });
  check();
  let b = null, den = null;
  if (useDenoise) {
    onProgress?.('Đang lọc tạp âm nền…', 52);
    await new Promise((r) => setTimeout(r, 0));
    den = denoise(x);
    check();
    b = await runYamnet(den.y, (p) => { check(); onProgress?.('Đang nghe lại sau khi lọc…', 55 + p * 35); });
  }
  const nFrames = Math.min(a.nFrames, b ? b.nFrames : Infinity);
  const levels = frameLevels(x, SR, FRAME_WIN, FRAME_HOP, nFrames);
  const sens = CONFIG.SENSITIVITY[sensitivity] || CONFIG.SENSITIVITY.medium;
  onProgress?.('Đang tổng hợp kết quả…', 95);
  const result = analyzeClip({
    scores: a.scores, scoresDen: b ? b.scores : null, nFrames, nClasses: a.nClasses, levels,
    groupIndex: S.groupIndex, classNames: S.classNames, threshold: sens.threshold,
    headFrames: headFramesFrom(a.emb, nFrames), customGroups: S.customGroups,
    headKnown: S.head?.known, headMinConf: S.head?.minConf,
  });
  const personal = hasPersonal() ? bestPersonalMatch(a.emb, nFrames) : null;
  return {
    result,
    meta: {
      duration: wave.length / SR, analyzedSec: x.length / SR, truncated, levels: Array.from(levels),
      denoiseDb: den ? den.reductionDb : 0, ms: Math.round(performance.now() - t0), source: S.source, demo: S.demo,
      personal, embedding: meanEmbedding(a.emb, nFrames, levels),
    },
  };
}

/**
 * Nhận diện nhanh cho chế độ trực tiếp (đoạn ~1–2 s gần nhất).
 * Trả về điểm nhóm (thô và có trọng số) – độ ổn định xử lý bởi LiveStabilizer.
 */
export async function classifyLive(wave, { useDenoise = false } = {}) {
  await loadClassifier();
  const t0 = performance.now();
  const a = await runYamnet(wave);
  let b = null;
  if (useDenoise && !S.demo) b = await runYamnet(denoise(wave).y);
  const hf = headFramesFrom(a.emb, a.nFrames);
  const raw = {};
  for (let f = 0; f < a.nFrames; f++) {
    let g = groupScores(a.scores, f * a.nClasses, S.groupIndex);
    if (b && f < b.nFrames) {
      const gd = groupScores(b.scores, f * b.nClasses, S.groupIndex);
      for (const id in g) g[id] = Math.max(g[id], gd[id]);
    }
    if (hf) g = mergeHead(g, hf[f], S.head.known, S.head.minConf);
    for (const id in g) raw[id] = Math.max(raw[id] || 0, g[id]);
  }
  // Âm thanh riêng người dùng đã dạy
  if (hasPersonal()) Object.assign(raw, personalScores(a.emb, a.nFrames));
  const weighted = {};
  const all = { ...GROUP_BY_ID, ...S.customGroups, ...personalGroups() };
  for (const id in raw) weighted[id] = raw[id] * (all[id]?.weight ?? 1);
  // 5 lớp YAMNet thô cao nhất (cho phần "chi tiết")
  let top = [];
  if (!S.demo && S.classNames) {
    const C = a.nClasses, m = new Float32Array(C);
    for (let f = 0; f < a.nFrames; f++) for (let c = 0; c < C; c++) m[c] = Math.max(m[c], a.scores[f * C + c]);
    top = Array.from(m.keys()).sort((x, y) => m[y] - m[x]).slice(0, 5).map((i) => ({ name: S.classNames[i], score: m[i] }));
  }
  return { raw, weighted, level: dbfs(rms(wave)), ms: Math.round(performance.now() - t0), top };
}

export function groupDef(id) {
  return GROUP_BY_ID[id] || S.customGroups[id] || personalGroups()[id] || null;
}

// ------------------------------------------------------------------ chế độ demo (kiểm thử giao diện khi không có mạng)
const DEMO_NAMES = (() => {
  const set = new Set();
  for (const g of GROUPS) for (const n of g.names) set.add(n);
  return ['Speech', ...[...set].filter((n) => n !== 'Speech' && n !== 'Wind'), 'Music', 'Guitar', 'Wind'];
})();

function demoScores(wave) {
  const C = DEMO_NAMES.length;
  const n = Math.max(1, Math.floor(Math.max(0, wave.length - MIN_SAMPLES) / HOP_SAMPLES) + 1);
  const lv = frameLevels(wave, SR, FRAME_WIN, FRAME_HOP, n);
  const scores = new Float32Array(n * C);
  const idx = (name) => DEMO_NAMES.indexOf(name);
  const loud = Math.max(...lv);
  for (let f = 0; f < n; f++) {
    scores[f * C + idx('Air conditioning')] = 0.45;
    scores[f * C + idx('Hum')] = 0.3;
    if (lv[f] > loud - 8 && loud > -60) {
      scores[f * C + idx('Bark')] = 0.82; scores[f * C + idx('Dog')] = 0.76; scores[f * C + idx('Animal')] = 0.6;
      scores[f * C + idx('Speech')] = 0.12;
    }
    if (loud <= -60) scores[f * C + idx('Silence')] = 0.85;
  }
  // Đặc trưng giả lập (chỉ để chạy thử giao diện "Âm thanh của tôi"): tự tương quan quanh chỗ to nhất của khung
  // (không phụ thuộc vị trí âm thanh trong khung), lặp thành 1024 chiều. Mô hình thật dùng embedding YAMNet.
  const emb = new Float32Array(n * 1024);
  for (let f = 0; f < n; f++) {
    const a = f * HOP_SAMPLES, end = Math.min(wave.length, a + MIN_SAMPLES);
    let pk = a, pv = 0;
    for (let i = a; i < end; i += 16) { const v = Math.abs(wave[i]); if (v > pv) { pv = v; pk = i; } }
    const s0 = Math.max(0, Math.min(wave.length - 1024, pk - 512));
    const feat = new Float32Array(64);
    let e0 = 1e-9;
    for (let i = 0; i < 1024 && s0 + i < wave.length; i++) e0 += wave[s0 + i] * wave[s0 + i];
    for (let lag = 1; lag <= 64; lag++) {
      let c = 0;
      for (let i = 0; i + lag < 1024 && s0 + i + lag < wave.length; i++) c += wave[s0 + i] * wave[s0 + i + lag];
      feat[lag - 1] = 1 + c / e0;
    }
    for (let d = 0; d < 1024; d++) emb[f * 1024 + d] = feat[d % 64];
  }
  return { scores, emb, nFrames: n, nClasses: C };
}
