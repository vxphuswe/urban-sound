import { initLayout, $, esc } from '../ui.js';
import { icon } from '../icons.js';
import { publicGroups, KIND_INFO } from '../categories.js';
import { dot, referenceList, kindTone } from '../render.js';
import { faqHtml, FAQ } from '../faq.js';
import { SCENES } from '../scenes.js';
import { load, streak, nKinds, BADGES } from '../journey.js';

// ------------------------------------------------------------------ Dãy phố: cửa sổ sáng theo nhịp như cột equalizer
(function skyline() {
  const svg = $('#skyline');
  if (!svg) return;
  let x = 0, seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const blds = [], bars = [];
  while (x < 1440) {
    const w = 46 + Math.round(rnd() * 70), h = 90 + Math.round(rnd() * 210);
    const y = 360 - h;
    blds.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`);
    if (rnd() > 0.65) blds.push(`<rect x="${x + w / 2 - 1}" y="${y - 24}" width="2" height="24"/>`); // ăng-ten
    const lamp = rnd() > 0.35;
    bars.push(`<rect class="eq" x="${x}" y="${y}" width="${w}" height="${h}" fill="${lamp ? '#ffb547' : '#2ee6c5'}" style="animation-duration:${(1.4 + rnd() * 1.8).toFixed(2)}s;animation-delay:-${(rnd() * 3).toFixed(2)}s"/>`);
    x += w + 4 + Math.round(rnd() * 10);
  }
  svg.innerHTML = `<defs>
      <pattern id="win" width="14" height="18" patternUnits="userSpaceOnUse"><rect x="4" y="5" width="6" height="8" rx="1" fill="#fff"/></pattern>
      <mask id="winmask"><rect width="1440" height="360" fill="url(#win)"/></mask>
      <linearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bg)" stop-opacity="0"/><stop offset="1" stop-color="var(--bg)"/></linearGradient>
    </defs>
    <g class="blds">${blds.join('')}</g>
    <g mask="url(#winmask)">${bars.join('')}</g>
    <rect y="300" width="1440" height="60" fill="url(#sky-fade)"/>`;
})();

// ------------------------------------------------------------------ Bầu trời: sao (đêm), tiêu đề hiện từng chữ, bong bóng âm thanh bay lên từ dãy phố
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#stars').innerHTML = Array.from({ length: 46 }, () => `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 70).toFixed(1)}%;--s:${(1 + Math.random() * 2).toFixed(1)}px;animation-delay:-${(Math.random() * 4).toFixed(1)}s;animation-duration:${(2 + Math.random() * 3).toFixed(1)}s"></i>`).join('');

const h1 = document.querySelector('.hero-night h1');
if (h1 && !REDUCED) h1.innerHTML = h1.textContent.split(' ').map((w, i) => `<span class="w" style="animation-delay:${0.08 * i + 0.1}s">${esc(w)}</span>`).join(' ');

const SOUNDS = [['dog', 'Gâu gâu'], ['horn', 'Bíp bíp'], ['bird', 'Líu lo'], ['motorbike', 'Brừm brừm'], ['music', 'La la la'], ['speech', 'Bánh mì đây!'], ['bell', 'Reng reng'], ['baby', 'Oa oa'], ['rain', 'Lộp độp'], ['siren', 'Í o í o'], ['cat', 'Meo meo'], ['door', 'Cốc cốc']];
let bi = 0;
function bubble() {
  if (document.hidden || REDUCED) return;
  const box = $('#bubbles');
  if (!box || box.childElementCount > 6) return;
  const [ic, txt] = SOUNDS[bi++ % SOUNDS.length];
  const el = document.createElement('span');
  el.className = 'bubble';
  el.style.left = `${8 + Math.random() * 84}%`;
  el.style.setProperty('--drift', `${(Math.random() * 60 - 30).toFixed(0)}px`);
  el.innerHTML = `${icon(ic, { size: 15 })}<b>${txt}</b>`;
  box.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
setInterval(bubble, 1500); bubble();

// ------------------------------------------------------------------ Ví dụ kết quả (đổi cảnh mỗi vài giây)
const REEL = [
  { id: 'dog', name: 'Chó sủa', pct: 96, db: 72 },
  { id: 'siren', name: 'Còi hú cứu thương', pct: 91, db: 88 },
  { id: 'speech', name: 'Tiếng người nói', pct: 94, db: 60 },
  { id: 'rain', name: 'Mưa giông, sấm sét', pct: 88, db: 76 },
  { id: 'motorbike', name: 'Xe máy', pct: 90, db: 79 },
  { id: 'baby', name: 'Em bé khóc', pct: 93, db: 74 },
];
let ri = 0;
$('#reel-dots').innerHTML = REEL.map((_, i) => `<button type="button" aria-label="Ví dụ ${i + 1}" data-i="${i}"></button>`).join('');
function showReel(i) {
  ri = i;
  const r = REEL[i];
  $('#reel-scene').innerHTML = SCENES[r.id];
  $('#reel-name').textContent = r.name;
  $('#reel-pct').textContent = `${r.pct}%`;
  $('#reel-db').textContent = `${r.db} dB`;
  $('#reel-bar').style.width = `${r.pct}%`;
  [...$('#reel-dots').children].forEach((b, k) => b.classList.toggle('on', k === i));
}
let reelTimer = setInterval(() => showReel((ri + 1) % REEL.length), 3200);
$('#reel-dots').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  clearInterval(reelTimer);
  showReel(Number(b.dataset.i));
  reelTimer = setInterval(() => showReel((ri + 1) % REEL.length), 5000);
});
showReel(0);

// ------------------------------------------------------------------ Hành trình nghe
function renderJourney() {
  const j = load();
  const st = streak(j);
  const groups = publicGroups();
  const found = groups.filter((g) => j.kinds[g.id]).length;
  $('#j-streak').innerHTML = `<span class="streak-flame${st ? ' on' : ''}">${icon('fire', { size: 30 })}</span><div><b class="mono">${st}</b><span>ngày liên tiếp</span></div>
    <div class="week">${Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return `<i class="${j.days.includes(key) ? 'on' : ''}" title="${d.toLocaleDateString('vi-VN')}">${'CN T2 T3 T4 T5 T6 T7'.split(' ')[d.getDay()]}</i>`; }).join('')}</div>`;
  $('#j-nums').innerHTML = [
    [j.detections, 'lần nhận diện'], [nKinds(j), 'loại âm thanh đã gặp'], [Math.round(j.liveSec / 60), 'phút giám sát'], [j.taught, 'mẫu đã dạy AI'],
  ].map(([n, l]) => `<div><b class="mono">${n}</b><span>${l}</span></div>`).join('');
  $('#j-count').textContent = `${found}/${groups.length}`;
  $('#j-collection').innerHTML = groups.map((g) => {
    const n = j.kinds[g.id];
    return n
      ? `<span class="col-item on tone-${kindTone(g.kind)}" title="${esc(g.vi)} · gặp ${n} lần">${icon(g.icon, { size: 20 })}</span>`
      : `<span class="col-item" title="Chưa gặp – hãy thử nhận diện thêm âm thanh">${icon(g.icon, { size: 20 })}</span>`;
  }).join('');
  $('#j-badges').innerHTML = BADGES.map((b) => {
    const on = !!j.badges[b.id];
    return `<div class="medal${on ? ' on' : ''}" title="${esc(b.hint)}"><span class="medal-ic">${icon(on ? b.icon : 'lock', { size: 20 })}</span><b>${esc(b.name)}</b><small>${esc(on ? new Date(j.badges[b.id]).toLocaleDateString('vi-VN') : b.hint)}</small></div>`;
  }).join('');
}
window.addEventListener('tp:journey', renderJourney);

// ------------------------------------------------------------------ Phần còn lại của trang
const order = ['danger', 'caution', 'people', 'nature', 'ambient'];
const byKind = {};
for (const g of publicGroups()) (byKind[g.kind] ||= []).push(g);
$('#kinds').innerHTML = order.filter((k) => byKind[k]).map((k) => `
  <div class="card card-pad">
    <div class="row" style="gap:8px;margin-bottom:12px"><span class="badge tone-${KIND_INFO[k].tone} tone-bg">${KIND_INFO[k].label}</span></div>
    <div style="display:grid;gap:8px">${byKind[k].map((g) => `<div class="row" style="gap:10px;font-size:.92rem;flex-wrap:nowrap;line-height:1.3">${dot(g, 15)}<span>${esc(g.vi)}</span></div>`).join('')}</div>
  </div>`).join('');
$('#kinds').style.gridTemplateColumns = 'repeat(auto-fit, minmax(210px, 1fr))';

$('#home-levels').innerHTML = referenceList(60);
$('#home-faq').innerHTML = faqHtml(FAQ.slice(0, 6));

initLayout();
renderJourney();
