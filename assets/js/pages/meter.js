import { initLayout, $, toast, hydrateIcons, esc } from '../ui.js';
import { icon } from '../icons.js';
import { LiveMic, micErrorMessage } from '../audio.js';
import { REFERENCE_LEVELS, bandOf, colorOf, nearestReference, compareLevels } from '../levels.js';
import { referenceList, highlightReference, healthBanner } from '../render.js';

initLayout();

$('#ref-list').innerHTML = referenceList();
const ARC = 377; // chiều dài cung bán kính 120 (π·120)
const gv = $('#g-val');
gv.style.strokeDasharray = ARC;
gv.style.strokeDashoffset = ARC;

const S = { mic: null, run: false, hist: [], all: [], t0: 0, smooth: null, last: null, started: false, paused: 0, pauseAt: 0 };

$('#m-start').addEventListener('click', () => (S.run ? stop() : start()));
$('#m-reset').addEventListener('click', () => {
  S.all = []; S.hist = []; S.t0 = performance.now(); S.paused = 0; S.pauseAt = S.run ? 0 : performance.now();
  updateStats(); drawChart();
  toast('Đã xoá số liệu, bắt đầu đo lại.');
});

async function start() {
  S.mic = new LiveMic({ seconds: 1, onBlock: (db) => { S.smooth = S.smooth == null ? db : 0.8 * S.smooth + 0.2 * db; S.all.push(db); } });
  try {
    await S.mic.start();
  } catch (e) {
    return toast(micErrorMessage(e), { tone: 'error', ms: 6000 });
  }
  // "Đo tiếp" giữ nguyên số liệu cũ; chỉ nút "Đo lại từ đầu" mới xoá
  S.run = true;
  if (!S.started) { S.t0 = performance.now(); S.all = []; S.hist = []; S.started = true; S.paused = 0; }
  else if (S.pauseAt) { S.paused += performance.now() - S.pauseAt; S.pauseAt = 0; }
  $('#m-start').innerHTML = `${icon('stop', { size: 20 })}Dừng đo`;
  $('#m-start').classList.remove('btn-primary'); $('#m-start').classList.add('btn-danger');
  $('#m-reset').disabled = false;
  tick();
}

function stop() {
  S.run = false;
  S.pauseAt = performance.now();
  S.mic?.stop();
  $('#m-start').innerHTML = `${icon('mic', { size: 20 })}Đo tiếp`;
  $('#m-start').classList.add('btn-primary'); $('#m-start').classList.remove('btn-danger');
  if (S.last != null) { localStorage.setItem('tp.lastDb', String(Math.round(S.last))); fillCompare(); }
}

let lastHist = 0;
function tick() {
  if (!S.run) return;
  const db = S.smooth ?? 0;
  S.last = db;
  const p = Math.max(0, Math.min(1, db / 120));
  gv.style.strokeDashoffset = ARC * (1 - p);
  gv.style.stroke = colorOf(db);
  $('#g-num').textContent = Math.round(db);
  const b = bandOf(db);
  $('#g-band').className = `badge tone-${b.tone} tone-bg`;
  $('#g-band').innerHTML = `${icon(b.icon, { size: 15 })} ${b.label}`;
  $('#g-like').textContent = `· to như ${nearestReference(db).text.toLowerCase()}`;
  highlightReference($('#ref-list'), db);
  $('#meter-card').style.borderColor = `color-mix(in srgb, ${colorOf(db)} 55%, transparent)`;
  const now = performance.now();
  if (now - lastHist > 250) {
    lastHist = now;
    S.hist.push(db);
    if (S.hist.length > 240) S.hist.shift();
    updateStats();
    drawChart();
  }
  requestAnimationFrame(tick);
}

function updateStats() {
  const xs = S.all;
  if (!xs.length) { ['#s-min', '#s-avg', '#s-max'].forEach((s) => ($(s).textContent = '--')); return; }
  let mn = Infinity, mx = -Infinity, e = 0;
  for (const v of xs) { if (v < mn) mn = v; if (v > mx) mx = v; e += Math.pow(10, v / 10); }
  const avg = 10 * Math.log10(e / xs.length);
  $('#s-min').textContent = Math.round(mn);
  $('#s-avg').textContent = Math.round(avg);
  $('#s-max').textContent = Math.round(mx);
  const sec = ((S.pauseAt || performance.now()) - S.t0 - (S.paused || 0)) / 1000;
  $('#s-time').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  $('#m-health').innerHTML = healthBanner(avg);
}

function drawChart() {
  const c = $('#chart');
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  // vạch 30/60/85 dB
  g.font = '10px JetBrains Mono, monospace';
  for (const L of [30, 60, 85, 110]) {
    const y = h - (L / 120) * h;
    g.strokeStyle = L === 85 ? css.getPropertyValue('--orange') : css.getPropertyValue('--line-2');
    g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = css.getPropertyValue('--muted'); g.fillText(String(L), 2, y - 3);
  }
  const n = 240;
  const step = w / (n - 1);
  const pts = S.hist.map((v, i) => [w - (S.hist.length - 1 - i) * step, h - (Math.max(0, Math.min(120, v)) / 120) * h]);
  if (pts.length < 2) return;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#dc3b3b'); grad.addColorStop(0.3, '#e0a426'); grad.addColorStop(0.5, '#3f9b68'); grad.addColorStop(1, '#4b77d1');
  g.beginPath(); g.moveTo(pts[0][0], h);
  pts.forEach(([x, y]) => g.lineTo(x, y));
  g.lineTo(pts[pts.length - 1][0], h); g.closePath();
  g.globalAlpha = 0.18; g.fillStyle = grad; g.fill(); g.globalAlpha = 1;
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = grad; g.lineWidth = 2; g.stroke();
}

// ---------------------------------------------------------------- So sánh
function options(selected) {
  const mine = localStorage.getItem('tp.lastDb');
  const items = [
    ...(mine ? [{ db: Number(mine), text: `Âm thanh bạn vừa đo` }] : []),
    ...REFERENCE_LEVELS.filter((l) => l.db > 0),
  ];
  return items.map((l, i) => `<option value="${l.db}" ${l.db === selected || (selected == null && i === 0) ? 'selected' : ''}>${l.db} dB – ${esc(l.text)}</option>`).join('');
}
function fillCompare() {
  const a = $('#cmp-a').value ? Number($('#cmp-a').value) : 80;
  const b = $('#cmp-b').value ? Number($('#cmp-b').value) : 60;
  $('#cmp-a').innerHTML = options(a);
  $('#cmp-b').innerHTML = options(b);
  compare();
}
function compare() {
  const A = Number($('#cmp-a').value), B = Number($('#cmp-b').value);
  const ta = $('#cmp-a').selectedOptions[0]?.text.split('– ')[1] || '';
  const tb = $('#cmp-b').selectedOptions[0]?.text.split('– ')[1] || '';
  const c = compareLevels(Math.max(A, B), Math.min(A, B));
  const louder = A >= B ? ta : tb, softer = A >= B ? tb : ta;
  const fmt = (x) => (x >= 100 ? Math.round(x).toLocaleString('vi-VN') : x.toLocaleString('vi-VN', { maximumFractionDigits: 1 }));
  $('#cmp-out').innerHTML = A === B
    ? 'Hai âm thanh to <b>bằng nhau</b>.'
    : `<span class="muted">${esc(louder)}</span> nghe to gấp khoảng <b>${fmt(c.perceived)} lần</b> <span class="muted">${esc(softer)}</span><br><small class="muted">Chênh ${Math.round(c.diff)} dB · năng lượng âm thanh gấp ${fmt(c.energy)} lần</small>`;
  const max = Math.max(A, B, 1);
  $('#cmp-bars').innerHTML = [[A, ta], [B, tb]].map(([v, t]) => `<div class="bar" style="width:${(v / max) * 100}%;background:${colorOf(v)}">${v} dB · ${esc(t)}</div>`).join('');
}
$('#cmp-a').addEventListener('change', compare);
$('#cmp-b').addEventListener('change', compare);
$('#cmp-a').innerHTML = options(localStorage.getItem('tp.lastDb') ? Number(localStorage.getItem('tp.lastDb')) : 80);
$('#cmp-b').innerHTML = options(60);
$('#cmp-b').value = '60';
compare();

window.addEventListener('beforeunload', () => S.mic?.stop());
hydrateIcons();
