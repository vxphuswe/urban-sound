// Các khối giao diện dùng chung: thẻ kết quả, băng sức khỏe, thanh đo, bảng mức tham chiếu.

import { icon } from './icons.js';
import { sceneFor } from './scenes.js';
import { KIND_INFO, GROUP_BY_ID } from './categories.js';
import { REFERENCE_LEVELS, bandOf, healthAdvice, percentOf, nearestReference } from './levels.js';
import { esc } from './ui.js';

const RANK = { gray: 0, blue: 0, green: 0, amber: 1, orange: 2, red: 3 };

export function kindTone(kind) {
  return KIND_INFO[kind]?.tone || 'gray';
}

/** Màu viền: lấy mức nghiêm trọng hơn giữa loại âm thanh và độ to. */
export function borderTone(kind, db) {
  const k = kindTone(kind);
  if (db == null) return k;
  const b = bandOf(db).tone;
  return RANK[b] > RANK[k] ? b : k;
}

export function dot(g, size = 18) {
  const tone = kindTone(g?.kind);
  return `<span class="dot tone-${tone} tone-bg">${icon(g?.icon || 'wave', { size })}</span>`;
}

function paws() {
  const spots = [[8, 70, 0], [16, 58, .4], [82, 18, .8], [90, 30, 1.2], [70, 80, 1.6]];
  return `<div class="paws" aria-hidden="true">${spots.map(([x, y, d]) => `<span style="left:${x}%;top:${y}%;animation-delay:${d}s">${icon('paw', { size: 20 })}</span>`).join('')}</div>`;
}

/**
 * Thẻ kết quả lớn.
 * @param {object} r  kết quả từ analyzeClip
 * @param {object} lv thống kê mức âm {avg, max}
 */
export function resultCard(r, lv, { source = 'file' } = {}) {
  const top = r.top;
  const kind = top?.kind || 'ambient';
  const tone = borderTone(r.status === 'detected' || r.status === 'uncertain' ? kind : 'ambient', lv?.max);
  const danger = r.status === 'detected' && kind === 'danger';
  const illo = top && (r.status === 'detected' || r.status === 'uncertain') ? sceneFor(top.id) : null;

  let kicker, title, sub = '';
  if (r.status === 'detected') {
    kicker = danger ? `${icon('alert', { size: 16 })} Cảnh báo · âm thanh nguy hiểm` : `${icon('check', { size: 16 })} Đã nhận diện · ${KIND_INFO[kind]?.label || ''}`;
    title = `Đây là tiếng <em>${esc(top.vi.toLowerCase())}</em> <span class="pct">(${top.conf}%)</span>`;
    sub = danger
      ? 'Nếu bạn đang ở gần nguồn âm, hãy quan sát xung quanh và giữ khoảng cách an toàn. Kết quả chỉ mang tính tham khảo.'
      : (top.fun || 'Âm thanh này thuộc nhóm bình thường, không cần lo lắng.');
  } else if (r.status === 'uncertain') {
    kicker = `${icon('info', { size: 16 })} Chưa chắc chắn`;
    title = `Có thể là tiếng <em>${esc(top.vi.toLowerCase())}</em> <span class="pct">(${top.conf}%)</span>`;
    sub = 'Âm thanh hơi nhỏ hoặc lẫn tạp âm. Thử ghi lại gần nguồn âm hơn, dài hơn 3 giây để kết quả chắc chắn hơn.';
  } else if (r.status === 'background') {
    kicker = `${icon('noise', { size: 16 })} Chỉ có tiếng nền`;
    title = `Chủ yếu là <em>${esc(top.vi.toLowerCase())}</em>`;
    sub = 'Không phát hiện âm thanh nổi bật nào khác (chó sủa, còi xe, tiếng nói…).';
  } else if (r.status === 'quiet') {
    kicker = `${icon('moon', { size: 16 })} Yên tĩnh`;
    title = 'Không gian <em>yên tĩnh</em>';
    sub = 'Hầu như không có âm thanh. Nếu bạn đang phát âm thanh, hãy kiểm tra micro hoặc tăng âm lượng file.';
  } else {
    kicker = `${icon('info', { size: 16 })} Chưa nhận ra`;
    title = 'Chưa nhận ra <em>âm thanh này</em>';
    sub = 'Có thể âm thanh không thuộc các nhóm hệ thống biết. Bạn có thể dạy AI âm thanh này ở trang “Âm thanh của tôi”.';
  }

  const visual = illo
    ? `<div class="result-visual">${illo}</div>`
    : `<div class="result-visual"><span class="ripple"></span><span class="ripple"></span><div class="big">${icon(top?.icon || 'wave', { size: 52, stroke: 1.6 })}</div></div>`;

  const conf = top && r.status !== 'quiet' && r.status !== 'background'
    ? `<div class="conf-bar"><span>${esc(top.word)}</span><div class="progress"><i style="width:${top.conf}%"></i></div><span class="mono">${top.conf}%</span></div>` : '';

  const alts = r.alternatives?.length ? `<div class="alts"><h4>Âm thanh khác nghe được</h4>${r.alternatives.map((a) => `
      <div class="alt-row tone-${kindTone(a.kind)}">${dot(a, 16)}<span>${esc(a.vi)}${a.background ? ' <small class="muted">(nền)</small>' : ''}</span>
      <div class="progress"><i style="width:${a.conf}%"></i></div><span class="mono">${a.conf}%</span></div>`).join('')}</div>` : '';

  return `<article class="result${danger ? ' danger' : ''}" data-tone="${tone}" aria-live="polite">
    ${illo && top.id === 'dog' ? paws() : ''}
    <div class="result-top">${visual}
      <div><div class="result-kicker">${kicker}</div><h2>${title}</h2><p class="fun">${esc(sub)}</p>${conf}</div>
    </div>
    ${alts}
    <div class="result-actions" id="result-actions"></div>
  </article>`;
}

export function healthBanner(db) {
  const a = healthAdvice(db);
  return `<div class="banner${a.safe ? '' : ' warn'}" data-tone="${a.tone}">
    <span class="b-ic">${icon(a.safe ? 'shield' : 'alert', { size: 22 })}</span>
    <div><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div></div>`;
}

export function meter(db) {
  const p = percentOf(db);
  return `<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="120" aria-valuenow="${Math.round(db)}" aria-label="Mức âm thanh">
      <div class="meter-mask" style="left:${p}%"></div><div class="meter-pin" style="left:${p}%"></div></div>
    <div class="meter-scale"><span>0</span><span>30</span><span>60</span><span>85</span><span>120 dB</span></div>`;
}

export function levelSummary(lv) {
  const b = bandOf(lv.max);
  const near = nearestReference(lv.avg);
  return `<div class="level-big"><span class="num" style="color:var(--${b.tone === 'orange' ? 'orange' : b.tone})">${Math.round(lv.avg)}</span><span class="unit">dB trung bình</span></div>
    <div class="row" style="margin:8px 0 16px;gap:8px"><span class="badge tone-${b.tone} tone-bg">${icon(b.icon, { size: 15 })} ${b.word}</span><span class="muted" style="font-size:.88rem">To như: ${esc(near.text.toLowerCase())}</span></div>
    ${meter(lv.avg)}
    <div class="stat-row" style="margin-top:16px">
      <div class="stat"><small>Trung bình</small><b>${Math.round(lv.avg)}</b></div>
      <div class="stat"><small>Cao nhất</small><b>${Math.round(lv.max)}</b></div>
      <div class="stat"><small>Thấp nhất</small><b>${Math.round(lv.min)}</b></div>
    </div>`;
}

export function referenceList(activeDb = null) {
  const near = activeDb == null ? null : nearestReference(activeDb).db;
  return `<ul class="levels">${REFERENCE_LEVELS.map((l) => `
    <li class="${l.db === near ? 'here' : ''}" data-db="${l.db}"><span class="ldot" style="background:${l.color}"></span><span class="ldb">${l.db} dB</span><span>${esc(l.text)}</span><span class="you">● Bạn</span></li>`).join('')}</ul>`;
}

export function highlightReference(root, db) {
  const near = nearestReference(db).db;
  root.querySelectorAll('.levels li').forEach((li) => li.classList.toggle('here', Number(li.dataset.db) === near));
}

export function groupChip(g) {
  return `<span class="chip">${dot(g, 15)}${esc(g.vi)}</span>`;
}

export { GROUP_BY_ID };
