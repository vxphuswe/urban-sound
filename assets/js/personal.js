// "Âm thanh của tôi": người dùng thu vài mẫu (chuông cửa nhà mình, tiếng rao quen…) → lần sau web nhận ra.
// Cách làm (few-shot, không cần train lại): mỗi mẫu lưu một vector đặc trưng 1024 chiều của YAMNet
// (trung bình các khung có âm thanh). Khi nghe âm thanh mới, so độ giống (cosine) với từng mẫu;
// giống nhất vượt ngưỡng thì báo tên nhãn người dùng đặt. Tất cả chạy và lưu trên trình duyệt.

import { listSamples } from './blobstore.js';

export const PREFIX = 'my_';
// cosine ≤ LOW coi như khác hẳn, ≥ HIGH coi như rất giống (YAMNet embedding không âm nên cosine thường > 0.4)
const LOW = 0.74, HIGH = 0.93;

const P = { protos: [], groups: {}, loaded: false };

function normalize(v) {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = v[i] / n;
  return o;
}

export function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Vector đặc trưng của một đoạn: trung bình các khung đủ to (bỏ khung lặng). */
export function meanEmbedding(emb, nFrames, levels) {
  if (!emb || !nFrames) return null;
  const D = emb.length / nFrames;
  let use = [];
  if (levels?.length) {
    const sorted = [...levels].slice(0, nFrames).sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.2)] ?? -90;
    use = levels.slice(0, nFrames).map((l, i) => (l > floor + 4 || l > -40 ? i : -1)).filter((i) => i >= 0);
  }
  if (!use.length) use = Array.from({ length: nFrames }, (_, i) => i);
  const m = new Float32Array(D);
  for (const f of use) for (let d = 0; d < D; d++) m[d] += emb[f * D + d];
  for (let d = 0; d < D; d++) m[d] /= use.length;
  return m;
}

export function keyOf(label) { return PREFIX + label; }

/** Nạp lại các mẫu được đánh dấu "dạy AI" từ kho mẫu. */
export async function loadPersonal() {
  const all = await listSamples();
  P.protos = all.filter((s) => s.teach && s.emb).map((s) => ({ label: s.label, vi: s.labelVi || s.label, emb: normalize(Float32Array.from(s.emb)), icon: s.icon }));
  P.groups = {};
  for (const p of P.protos) {
    const id = keyOf(p.label);
    P.groups[id] = P.groups[id] || { id, vi: p.vi, icon: p.icon || 'star', kind: 'personal', weight: 1.1, n: 0, personal: true };
    P.groups[id].n++;
  }
  // Ngưỡng riêng cho từng âm thanh: dựa trên độ giống trung bình giữa các mẫu của chính nó.
  // Âm thanh có mẫu rất đồng đều → ngưỡng cao (khó báo nhầm); mẫu đa dạng → ngưỡng mềm hơn.
  for (const g of Object.values(P.groups)) {
    const st = labelStats(P.protos.filter((p) => keyOf(p.label) === g.id).map((p) => p.emb));
    g.low = st.n >= 2 ? Math.max(0.62, Math.min(LOW, st.mean - 0.14)) : LOW;
    g.high = st.n >= 2 ? Math.max(g.low + 0.1, Math.min(0.97, st.mean + 0.02)) : HIGH;
  }
  P.loaded = true;
  return P.groups;
}

/** Thống kê độ đồng đều của một nhóm mẫu: trung bình cosine từng cặp, và mẫu nào lạc loài nhất. */
export function labelStats(embs) {
  const v = embs.map((e) => (e instanceof Float32Array && Math.abs(e.reduce((a, x) => a + x * x, 0) - 1) < 1e-3 ? e : normalize(Float32Array.from(e))));
  const n = v.length;
  if (n < 2) return { n, mean: n ? 1 : 0, each: v.map(() => 1) };
  const each = new Array(n).fill(0);
  let sum = 0, cnt = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const c = cosine(v[i], v[j]);
    sum += c; cnt++; each[i] += c; each[j] += c;
  }
  return { n, mean: sum / cnt, each: each.map((x) => x / (n - 1)) };
}

export function personalGroups() { return P.groups; }
export function hasPersonal() { return P.protos.length > 0; }

export function simToProb(c) { return Math.max(0, Math.min(1, (c - LOW) / (HIGH - LOW))); }

/**
 * Điểm giống cho từng nhãn của người dùng.
 * @param emb  Float32Array nFrames × D (embedding từng khung của YAMNet)
 * @returns {{[id]: number}} xác suất 0..1 (lấy khung giống nhất)
 */
export function personalScores(emb, nFrames) {
  const out = {};
  if (!emb || !nFrames || !P.protos.length) return out;
  const D = emb.length / nFrames;
  for (let f = 0; f < nFrames; f++) {
    const e = normalize(emb.subarray(f * D, (f + 1) * D));
    for (const p of P.protos) {
      const id = keyOf(p.label);
      const g = P.groups[id];
      const c = cosine(e, p.emb);
      const prob = Math.max(0, Math.min(1, (c - (g?.low ?? LOW)) / ((g?.high ?? HIGH) - (g?.low ?? LOW))));
      if (prob > (out[id] || 0)) out[id] = prob;
    }
  }
  return out;
}

/** Giống nhất trên cả đoạn (dùng cho trang Nhận diện): {id, vi, prob, sim} hoặc null. */
export function bestPersonalMatch(emb, nFrames, min = 0.5) {
  const sc = personalScores(emb, nFrames);
  let best = null;
  for (const [id, prob] of Object.entries(sc)) if (prob >= min && (!best || prob > best.prob)) best = { id, prob, ...P.groups[id] };
  return best;
}
