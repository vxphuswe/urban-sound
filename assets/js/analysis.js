// Hậu xử lý kết quả YAMNet để ra một câu trả lời dễ hiểu và ít báo sai.
// Thuần JavaScript (không phụ thuộc trình duyệt) để có thể kiểm thử bằng Node.
//
// Các bước chống nhận nhầm:
//  1. Cổng năng lượng: khung quá nhỏ so với nền (tạp âm, khoảng lặng) không được tính là "sự kiện".
//  2. Chạy mô hình trên cả âm thanh gốc và âm thanh đã lọc tạp âm; sự kiện lấy điểm cao hơn.
//  3. Gom 521 lớp vào nhóm; tiếng nền (máy lạnh, ồn nền) bị giảm trọng số nên không lấn tiếng chính.
//  4. Làm mượt theo thời gian: sự kiện phải xuất hiện ổn định ~1 giây mới được tính.
//  5. Ngưỡng tin cậy theo độ nhạy: dưới ngưỡng thì nói "chưa chắc chắn" thay vì đoán bừa.

import { GROUPS, GROUP_BY_ID, AMBIENT_IDS } from './categories.js';
import { percentile } from './dsp.js';

export const FRAME_HOP = 0.48;
export const FRAME_WIN = 0.96;

/** Điểm hiển thị (%) từ điểm sigmoid thô của YAMNet – hàm đơn điệu, chỉ để dễ đọc. */
export function displayConfidence(raw) {
  return Math.min(99, Math.round(100 * (1 - Math.exp(-3.5 * raw))));
}

export function confidenceWord(pct) {
  if (pct >= 80) return 'Rất chắc chắn';
  if (pct >= 60) return 'Khá chắc chắn';
  if (pct >= 40) return 'Có thể';
  return 'Chưa chắc chắn';
}

/**
 * Kết hợp mô hình nhóm tự train (head) với YAMNet cho một khung – chống lỗi "ép vào lớp đã biết".
 * Head chỉ biết các lớp đã train (không có tiếng người nói, âm nhạc…). Nếu cứ tin head, nói chuyện
 * sẽ bị gán thành "mèo kêu". Quy tắc:
 *  1. Chỉ dùng xác suất head >= minConf.
 *  2. Nếu YAMNet đang nghe rõ một nhóm mà head KHÔNG biết (ví dụ tiếng nói ≥ 0.35) và đủ mạnh → bỏ head ở khung này.
 *  3. Với nhóm có sẵn trong YAMNet (chó, mèo…), head chỉ được tăng điểm khi YAMNet cũng thấy dấu hiệu (≥ 0.05),
 *     trừ khi head cực chắc (≥ 0.95).
 *  4. Nhóm mới chỉ head biết (tiếng rao, mõ…) dùng trực tiếp khi head ≥ minConf.
 */
export function mergeHead(yam, head, headKnown, minConf = 0.7) {
  const out = { ...yam };
  if (!head) return out;
  let unknownMax = 0;
  for (const [id, v] of Object.entries(yam)) {
    if (headKnown.has(id) || AMBIENT_IDS.has(id) || id === 'noise' || id === 'silence') continue;
    if (v > unknownMax) unknownMax = v;
  }
  let headTop = 0;
  for (const v of Object.values(head)) headTop = Math.max(headTop, v);
  if (unknownMax >= 0.35 && unknownMax >= headTop * 0.6) return out;
  for (const [id, p] of Object.entries(head)) {
    if (p < minConf) continue;
    const builtin = id in yam;
    if (builtin && (yam[id] || 0) < 0.05 && p < 0.95) continue;
    out[id] = Math.max(out[id] || 0, p * 0.9);
  }
  return out;
}

/** Điểm từng nhóm của một khung: max điểm các lớp thành viên. */
export function groupScores(scores, offset, groupIndex) {
  const out = {};
  for (const g of GROUPS) {
    const idx = groupIndex.members[g.id];
    let m = 0;
    for (let k = 0; k < idx.length; k++) {
      const v = scores[offset + idx[k]];
      if (v > m) m = v;
    }
    out[g.id] = m;
  }
  return out;
}

/** Xác định khung nào "có âm thanh" dựa trên mức dBFS từng khung. */
export function activeMask(levels, opts = {}) {
  const n = levels.length;
  const floor = percentile(levels, 15);
  const med = percentile(levels, 50);
  const gateDb = opts.gateDb ?? 6;
  const absMin = opts.absMinDb ?? -62;
  const mask = new Array(n);
  for (let f = 0; f < n; f++) {
    const L = levels[f];
    mask[f] = L > absMin && (L > floor + gateDb || L >= med - 3);
  }
  return { mask, floor, median: med };
}

/**
 * Phân tích toàn bộ một đoạn âm thanh.
 * @param {object} p
 *  scores      Float32Array (nFrames*C) điểm YAMNet trên âm thanh gốc
 *  scoresDen   Float32Array | null       điểm trên âm thanh đã lọc tạp âm
 *  nFrames, nClasses
 *  levels      Float32Array(nFrames)     dBFS từng khung (trên âm thanh gốc)
 *  groupIndex  từ buildGroupIndex
 *  classNames  mảng tên lớp
 *  threshold   ngưỡng (theo độ nhạy)
 *  headFrames  mảng (nFrames) các object {groupId: xác suất} từ mô hình nhóm tự train (tùy chọn)
 *  customGroups  object {groupId: groupDef} cho nhóm mới do mô hình tự train thêm
 */
export function analyzeClip(p) {
  const { scores, scoresDen, nFrames, nClasses: C, levels, groupIndex, classNames } = p;
  const threshold = p.threshold ?? 0.28;
  const groups = [...GROUPS, ...Object.values(p.customGroups || {})];
  const byId = { ...GROUP_BY_ID, ...(p.customGroups || {}) };
  const { mask, floor, median } = activeMask(levels, p.gate);
  const nActive = mask.filter(Boolean).length;

  // 1. điểm nhóm từng khung (thô và có trọng số)
  const raw = new Array(nFrames);
  const weighted = new Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    const g = groupScores(scores, f * C, groupIndex);
    if (scoresDen) {
      const gd = groupScores(scoresDen, f * C, groupIndex);
      for (const id in g) if (!AMBIENT_IDS.has(id)) g[id] = Math.max(g[id], gd[id]);
    }
    const merged = p.headFrames && p.headFrames[f] ? mergeHead(g, p.headFrames[f], p.headKnown || new Set(Object.keys(p.headFrames[f])), p.headMinConf ?? 0.7) : g;
    raw[f] = merged;
    const g2 = merged;
    const w = {};
    for (const id in g2) w[id] = g2[id] * (byId[id]?.weight ?? 1);
    weighted[f] = w;
  }

  // 2. điểm sự kiện: đỉnh của điểm đã làm mượt, chỉ trên khung có âm thanh
  const eventIds = groups.map((g) => g.id).filter((id) => !AMBIENT_IDS.has(id) && id !== 'silence' && id !== 'noise');
  const ev = {};
  for (const id of eventIds) {
    let best = 0, bestF = -1, sum = 0, cnt = 0;
    for (let f = 0; f < nFrames; f++) {
      if (!mask[f]) continue;
      const cur = weighted[f][id] || 0;
      const prev = f > 0 && mask[f - 1] ? weighted[f - 1][id] || 0 : 0;
      const next = f < nFrames - 1 && mask[f + 1] ? weighted[f + 1][id] || 0 : 0;
      // một khung đơn lẻ (đoạn rất ngắn) vẫn được tính nhưng bị giảm nhẹ
      const s = nFrames === 1 ? cur : (cur + Math.max(prev, next, cur * 0.6)) / 2;
      if (s > best) { best = s; bestF = f; }
      sum += cur; cnt++;
    }
    ev[id] = { id, score: best, frame: bestF, raw: bestF >= 0 ? raw[bestF][id] || 0 : 0, presence: cnt ? sum / cnt : 0 };
  }

  // 3. tiếng nền: trung bình trên mọi khung
  const amb = {};
  for (const id of [...AMBIENT_IDS, 'silence', 'noise']) {
    let s = 0;
    for (let f = 0; f < nFrames; f++) s += raw[f][id] || 0;
    amb[id] = { id, score: s / Math.max(1, nFrames) };
  }

  const ranked = Object.values(ev).sort((a, b) => b.score - a.score);
  const ambRanked = Object.values(amb).sort((a, b) => b.score * (byId[b.id]?.weight ?? 1) - a.score * (byId[a.id]?.weight ?? 1));
  const best = ranked[0];
  const bestAmb = ambRanked.find((a) => a.id !== 'noise' && a.id !== 'silence' && a.score > 0.12) || ambRanked[0];

  let status;
  let top;
  if (nActive === 0 || (median < -60 && (!best || best.score < threshold))) {
    status = 'quiet';
    top = { id: 'silence', raw: Math.max(amb.silence?.score || 0, 0.6) };
  } else if (best && best.score >= threshold) {
    status = 'detected';
    top = best;
  } else if (best && best.score >= threshold * 0.6) {
    status = 'uncertain';
    top = best;
  } else if (bestAmb && bestAmb.score > 0.12) {
    status = 'background';
    top = { id: bestAmb.id, raw: bestAmb.score };
  } else {
    status = 'unknown';
    top = null;
  }

  const describe = (r) => {
    const g = byId[r.id];
    const pct = displayConfidence(r.raw ?? r.score);
    return { id: r.id, vi: g?.vi ?? r.id, icon: g?.icon ?? 'wave', kind: g?.kind ?? 'ambient', fun: g?.fun, conf: pct, word: confidenceWord(pct), score: r.score, raw: r.raw };
  };

  // "Tiếng động vật" chung chung là thừa khi đã biết cụ thể là chó/mèo/chim…
  const SPECIFIC_ANIMALS = new Set(['dog', 'cat', 'bird', 'poultry', 'livestock', 'insect']);
  const alternatives = ranked
    .filter((r) => (!top || r.id !== top.id) && r.score >= threshold * 0.45)
    .filter((r) => !(r.id === 'animal' && top && SPECIFIC_ANIMALS.has(top.id)))
    .slice(0, 3)
    .map(describe);
  if (status !== 'background' && bestAmb && bestAmb.score > 0.2 && alternatives.length < 4) {
    alternatives.push({ ...describe({ id: bestAmb.id, raw: bestAmb.score, score: bestAmb.score }), background: true });
  }

  // 4. dòng thời gian các sự kiện
  const timeline = [];
  let cur = null;
  for (let f = 0; f < nFrames; f++) {
    let lab = null, lv = 0;
    if (mask[f]) {
      for (const id of eventIds) {
        const v = weighted[f][id] || 0;
        if (v > lv) { lv = v; lab = id; }
      }
      if (lv < threshold * 0.8) lab = null;
    }
    if (cur && lab === cur.id) {
      cur.end = f * FRAME_HOP + FRAME_WIN; cur.peak = Math.max(cur.peak, raw[f][lab]);
    } else if (cur && lab === null && f + 1 < nFrames && mask[f + 1] && topId(weighted[f + 1], eventIds) === cur.id) {
      // cho phép hở 1 khung
    } else {
      if (cur) timeline.push(cur);
      cur = lab ? { id: lab, start: f * FRAME_HOP, end: f * FRAME_HOP + FRAME_WIN, peak: raw[f][lab] } : null;
    }
  }
  if (cur) timeline.push(cur);
  const timelineOut = timeline.map((t) => ({ ...t, vi: byId[t.id]?.vi ?? t.id, icon: byId[t.id]?.icon, kind: byId[t.id]?.kind, conf: displayConfidence(t.peak) }));

  // 5. top lớp YAMNet thô (cho phần "chi tiết kỹ thuật")
  const mean = new Float32Array(C);
  for (let f = 0; f < nFrames; f++) for (let c = 0; c < C; c++) mean[c] += scores[f * C + c] / nFrames;
  const topClasses = Array.from(mean.keys()).sort((a, b) => mean[b] - mean[a]).slice(0, 8)
    .map((i) => ({ index: i, name: classNames?.[i] ?? String(i), score: mean[i] }));

  return {
    status,
    top: top ? describe(top) : null,
    alternatives,
    ambient: bestAmb ? describe({ id: bestAmb.id, raw: bestAmb.score, score: bestAmb.score }) : null,
    timeline: timelineOut,
    topClasses,
    frames: { total: nFrames, active: nActive, floorDb: floor, medianDb: median },
    ranked: ranked.slice(0, 10).map(describe),
  };
}

function topId(w, ids) {
  let best = null, v = 0;
  for (const id of ids) if ((w[id] || 0) > v) { v = w[id]; best = id; }
  return best;
}

/**
 * Bộ ổn định cho chế độ trực tiếp (bỏ phiếu trên các nhịp gần nhất).
 * - Ứng viên: nhóm có điểm (đã trọng số) cao nhất trong nhịp và ≥ ngưỡng.
 * - Xác nhận: xuất hiện ít nhất `streak` lần trong `streak + 1` nhịp gần nhất (không bắt buộc liên tiếp),
 *   hoặc ngay lập tức nếu điểm thô rất cao (≥ strong).
 * - Giữ kết quả thêm `hold` giây sau lần cuối được ủng hộ để không nhấp nháy.
 * - Cùng một nhóm chỉ "báo" lại sau `cooldown` giây.
 */
export class LiveStabilizer {
  constructor({ threshold = 0.28, streak = 2, cooldown = 4, strong = 0.6, hold = 2 } = {}) {
    Object.assign(this, { threshold, streak, cooldown, strong, hold });
    this.reset();
  }
  reset() { this.history = []; this.lastFire = {}; this.current = null; this.lastSeen = {}; }
  setSensitivity({ threshold, streak }) { this.threshold = threshold; this.streak = streak; }

  /**
   * @param {object} weighted  điểm nhóm có trọng số của nhịp hiện tại
   * @param {boolean} active   nhịp này có âm thanh (vượt cổng năng lượng) không
   * @param {number} t         thời điểm (giây)
   * @param {object} raw       điểm thô (để xét "rất chắc chắn"); mặc định = weighted
   * @param {Set} ignore       nhóm tạm bỏ qua (ví dụ khi web đang phát còi báo động)
   */
  push(weighted, active, t, raw = weighted, ignore = new Set()) {
    let best = null, bv = 0;
    if (active) {
      for (const [id, v] of Object.entries(weighted)) {
        if (AMBIENT_IDS.has(id) || id === 'silence' || id === 'noise' || ignore.has(id)) continue;
        if (v > bv) { bv = v; best = id; }
      }
    }
    const top = best && bv >= this.threshold ? best : null;
    this.history.push({ top, score: bv, t });
    const win = this.streak + 1;
    if (this.history.length > win) this.history.splice(0, this.history.length - win);
    const votes = top ? this.history.filter((h) => h.top === top).length : 0;
    const strongHit = top && (raw[top] || 0) >= this.strong;

    const out = { candidate: top ? { id: top, score: bv } : null, confirmed: null, fired: null, votes, need: this.streak };
    if (top && (votes >= this.streak || strongHit)) {
      out.confirmed = { id: top, score: bv };
      this.current = out.confirmed;
      this.lastSeen[top] = t;
      if (this.lastFire[top] == null || t - this.lastFire[top] >= this.cooldown) {
        this.lastFire[top] = t;
        out.fired = out.confirmed;
      }
    } else if (this.current && t - (this.lastSeen[this.current.id] ?? -Infinity) > this.hold) {
      this.current = null;
    } else if (this.current && top === this.current.id) {
      this.lastSeen[top] = t;
    }
    out.current = this.current;
    return out;
  }
}
