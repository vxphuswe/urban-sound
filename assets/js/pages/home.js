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

// ------------------------------------------------------------------ Đường phố: xe chạy, người trò chuyện, cây, công nhân khoan đường.
// Mỗi bong bóng âm thanh bay ra từ đúng nguồn phát của nó.
const tree = (x, s = 1) => `<g class="st-tree" transform="translate(${x} 92) scale(${s})"><rect x="-4" y="-34" width="8" height="34" rx="3" class="st-trunk"/>
  <g class="st-crown"><circle cx="0" cy="-52" r="26"/><circle cx="-18" cy="-40" r="18"/><circle cx="18" cy="-40" r="18"/></g></g>`;
const lamp = (x) => `<g class="st-lamp" transform="translate(${x} 92)"><path d="M0 0v-70h18" class="st-pole"/><path class="st-glow" d="M14 -66l-30 66h64z"/><rect x="10" y="-72" width="16" height="6" rx="3" class="st-bulb"/></g>`;
const person = (x, shirt, skin, hair, flip = 1, cls = '') => `<g class="st-person ${cls}" transform="translate(${x} 92) scale(${flip} 1)">
  <path d="M-7 0l2-22h10l2 22" class="st-legs"/><path d="M-10 -20c0-12 4-18 10-18s10 6 10 18z" fill="${shirt}"/>
  <g class="st-head"><circle cx="0" cy="-46" r="8" fill="${skin}"/><path d="M-8 -48c0-7 4-10 8-10s8 3 8 10c-3-3-5-4-8-4s-5 1-8 4z" fill="${hair}"/>
  <path class="st-mouth" d="M3 -43h4" stroke="#7a2730" stroke-width="2" stroke-linecap="round"/></g>
  <path d="M8 -32l8 8" class="st-arm"/></g>`;
const svgStreet = `
  <rect x="0" y="86" width="1440" height="12" class="st-walk"/>
  <rect x="0" y="98" width="1440" height="52" class="st-road"/>
  <path d="M0 124h1440" class="st-lane"/>
  ${tree(110, 1.05)}${tree(470, .9)}${tree(1110)}${tree(1360, .95)}
  ${lamp(300)}${lamp(840)}${lamp(1240)}
  <g class="st-bird" data-say="Líu lo" transform="translate(470 40)"><path d="M0 0c6-6 12-6 16 0-4 2-10 2-16 0z" fill="#3fa598"/><circle cx="13" cy="-2" r="1.5" fill="#1d2b2a"/><path d="M16 -1l5 1-5 1z" fill="#f29b38"/></g>
  <g data-say="Gâu gâu" class="st-dog" transform="translate(586 92)"><path class="st-tail" d="M-14 -14c-6-4-8-10-6-14" stroke="#b9763d" stroke-width="4" stroke-linecap="round" fill="none"/>
    <rect x="-16" y="-18" width="26" height="12" rx="6" fill="#d9944f"/><path d="M-12 -6v6M4 -6v6" stroke="#b9763d" stroke-width="4" stroke-linecap="round"/>
    <g class="st-dhead"><circle cx="12" cy="-22" r="8" fill="#e3a462"/><path d="M8 -28l-4-6 6 2z" fill="#8a5428"/><circle cx="15" cy="-23" r="1.5" fill="#24170e"/><circle cx="20" cy="-20" r="2" fill="#24170e"/></g></g>
  <g data-say="Hôm nay đi đâu?|Đi cà phê không?|Trời đẹp ghê!" class="st-chat">${person(660, '#5b8def', '#f4c7a1', '#2c2018', 1, 'talk-a')}${person(700, '#ef5d68', '#f0bf95', '#6b3b22', -1, 'talk-b')}</g>
  <g data-say="Bánh mì nóng giòn đây!" class="st-vendor" transform="translate(760 92)"><rect x="-6" y="-30" width="36" height="22" rx="4" fill="#f2c14e"/><rect x="-6" y="-34" width="36" height="6" rx="3" fill="#ef5d68"/>
    <circle cx="2" cy="-4" r="5" class="st-wheel"/><circle cx="22" cy="-4" r="5" class="st-wheel"/>
    <g transform="translate(-16 0)"><path d="M-6 0l2-22h10l2 22" class="st-legs"/><path d="M-9 -20c0-12 4-18 9-18s9 6 9 18z" fill="#3fa598"/><circle cx="0" cy="-46" r="8" fill="#f1c19c"/><path d="M-11 -50h22l-11-10z" fill="#e8d49a"/></g></g>
  <g data-say="Rè rè rè!|Khoan khoan!" class="st-work" transform="translate(960 92)">
    <path d="M-34 0l6-18 6 18z" fill="#ff7a2e"/><path d="M-32 -8h8" stroke="#fff" stroke-width="2"/>
    <rect x="40" y="-22" width="44" height="8" rx="2" class="st-barrier"/><path d="M44 -14v14M80 -14v14" stroke="#9aa4b1" stroke-width="3"/>
    <g class="st-jack"><path d="M-6 0l2-20h10l2 20" class="st-legs"/><path d="M-10 -18c0-12 4-18 10-18s10 6 10 18z" fill="#ff8c1a"/><path d="M-8 -26h16" stroke="#fff" stroke-width="2"/>
      <circle cx="0" cy="-44" r="8" fill="#e9b48e"/><path d="M-10 -46a10 9 0 0 1 20 0z" fill="#f2c14e"/>
      <rect x="12" y="-30" width="8" height="18" rx="2" fill="#5b6475"/><path d="M16 -12v12" stroke="#9aa4b1" stroke-width="3"/><path d="M6 -26h8" stroke="#e9b48e" stroke-width="4" stroke-linecap="round"/></g>
    <g class="st-dust"><circle cx="16" cy="-2" r="5"/><circle cx="24" cy="-4" r="4"/><circle cx="10" cy="-4" r="3"/></g></g>
  <g class="st-lane-a"><g data-say="Brừm brừm!|Brừm!" class="st-moto"><circle cx="0" cy="-6" r="8" class="st-wheel"/><circle cx="34" cy="-6" r="8" class="st-wheel"/>
    <path d="M0 -6l12-14h16l6 14" stroke="#ef5d68" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M10 -22c6-4 16-4 20 0v5H10z" fill="#ef5d68"/>
    <circle cx="20" cy="-40" r="7" fill="#f2c14e"/><path d="M20 -33l-3 13 12 2" stroke="#2f4b8a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path class="st-head-l" d="M40 -16l60 -10v22z"/><g class="st-exh"><circle cx="-8" cy="-8" r="4"/><circle cx="-16" cy="-12" r="5"/></g></g></g>
  <g class="st-lane-b"><g data-say="Bíp bíp!|Tin tin!" class="st-car"><path d="M0 -10l10-18h44l14 18h12v12H0z" fill="#3b82ff"/><path d="M14 -26h18v14H8zM36 -26h16l10 14H36z" class="st-glass"/>
    <circle cx="18" cy="2" r="8" class="st-wheel"/><circle cx="64" cy="2" r="8" class="st-wheel"/><path class="st-head-l" d="M0 -6l-70 -12v26z"/></g></g>`;
const st = $('#street');
if (st) st.innerHTML = `<g class="street-layer">${svgStreet}</g>`;

let bi = 0;
function bubble() {
  if (document.hidden || REDUCED) return;
  const box = $('#bubbles');
  if (!box || box.childElementCount > 5) return;
  const srcs = [...document.querySelectorAll('#street [data-say]')];
  const src = srcs[bi++ % srcs.length];
  if (!src) return;
  const sb = src.getBoundingClientRect(), bb = box.getBoundingClientRect();
  const cx = sb.left + sb.width / 2 - bb.left;
  if (cx < 20 || cx > bb.width - 20) return; // nguồn đang ở ngoài màn hình (điện thoại hẹp / xe chưa tới)
  const lines = src.dataset.say.split('|');
  const ICON = { 'st-moto': 'motorbike', 'st-car': 'horn', 'st-dog': 'dog', 'st-chat': 'speech', 'st-vendor': 'speech', 'st-work': 'drill', 'st-bird': 'bird' };
  const ic = ICON[[...src.classList].find((c) => ICON[c])] || 'wave';
  const el = document.createElement('span');
  el.className = 'bubble';
  el.style.left = `${cx}px`;
  el.style.bottom = `${bb.bottom - sb.top + 6}px`;
  el.style.setProperty('--drift', `${(Math.random() * 40 - 20).toFixed(0)}px`);
  el.innerHTML = `${icon(ic, { size: 15 })}<b>${esc(lines[Math.floor(Math.random() * lines.length)])}</b>`;
  box.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
setInterval(bubble, 1300); setTimeout(bubble, 600);

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
