// Trang Giám sát trực tiếp – trọng tâm của sản phẩm.
// Luồng: Micro → bộ đệm vòng → mỗi 0,5 s lấy ~1 s gần nhất → YAMNet (+ mô hình nhóm) → bỏ phiếu ổn định
//        → hiển thị kết quả, xác suất, dòng thời gian → cảnh báo (âm thanh nguy hiểm / tiếng ồn vượt ngưỡng).
// Độ ồn (dB ước tính) được đo riêng từ tín hiệu micro, KHÔNG phải kết quả của mô hình AI.

import { CONFIG } from '../config.js';
import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon, ILLUSTRATIONS } from '../icons.js';
import { LiveMic, listMics, micErrorMessage } from '../audio.js';
import { loadClassifier, classifyLive, groupDef } from '../classifier.js';
import { LiveStabilizer, displayConfidence } from '../analysis.js';
import { GROUPS, AMBIENT_IDS } from '../categories.js';
import { bandOf, colorOf, nearestReference, safeHours, formatDuration } from '../levels.js';
import { healthBanner, kindTone, borderTone, meter } from '../render.js';
import { LiveCaptions } from '../transcribe.js';
import { addEntry } from '../store.js';

initLayout();

const TICK_MS = 500;          // nhận diện mỗi nửa giây
const WINDOW_SEC = 0.975;     // đúng một khung YAMNet → nhanh và ổn định
const NOISE_WINDOW_SEC = 3;   // độ ồn trung bình 3 giây để xét cảnh báo
const SELF_ALARM_IDS = new Set(['alarm', 'siren', 'bell']); // bỏ qua khi chính web đang phát chuông

const S = {
  mic: null, running: false, muted: false, gen: 0, busy: false, t0: 0,
  sens: 'medium', limit: 85, levels: [], floor: -60, events: [],
  stat: { n: 0, e: 0, min: Infinity, max: -Infinity }, hist: [], timeline: [],
  cc: null, alarm: null, snoozeUntil: 0, selfSoundUntil: 0, lastRaw: {},
};
const stab = new LiveStabilizer({ ...CONFIG.SENSITIVITY.medium, cooldown: 6 });

// ================================================================ Trạng thái
const STATES = {
  off: 'Đang tắt', loading: 'Đang tải mô hình', listening: 'Đang nghe', processing: 'Đang xử lý',
  detected: 'Đã phát hiện', muted: 'Đã tắt tiếng micro', error: 'Lỗi micro',
};
function setState(st, text) {
  const chip = $('#status-chip');
  chip.dataset.state = st;
  $('#status-text').textContent = text || STATES[st];
}

// ================================================================ Lựa chọn cảnh báo
const WATCHABLE = ['siren', 'gunshot', 'alarm', 'glass', 'fire', 'shout', 'baby', 'children', 'dog', 'cat', 'horn', 'fireworks', 'construction', 'motorbike', 'speech', 'bell'];
const DEFAULT_WATCH = ['siren', 'gunshot', 'alarm', 'glass', 'fire', 'shout', 'baby', 'dog'];
const DANGER = new Set(['siren', 'gunshot', 'alarm', 'glass', 'fire']);
let watch;
try { watch = new Set(JSON.parse(localStorage.getItem('tp.watch2') || 'null') || DEFAULT_WATCH); } catch { watch = new Set(DEFAULT_WATCH); }
function renderWatch() {
  $('#watch').innerHTML = WATCHABLE.map((id) => GROUPS.find((g) => g.id === id)).filter(Boolean).map((g) => {
    const on = watch.has(g.id);
    return `<button type="button" class="chip" data-id="${g.id}" aria-pressed="${on}" style="${on ? 'border-color:var(--accent);color:var(--text)' : 'opacity:.6'}"><span class="dot tone-${kindTone(g.kind)} tone-bg" style="width:24px;height:24px;border-radius:50%">${icon(g.icon, { size: 13 })}</span>${esc(g.vi.replace(/ \(.*\)/, ''))}</button>`;
  }).join('');
}
$('#watch').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  const id = b.dataset.id;
  watch.has(id) ? watch.delete(id) : watch.add(id);
  try { localStorage.setItem('tp.watch2', JSON.stringify([...watch])); } catch { /* bỏ qua */ }
  renderWatch();
});
renderWatch();

function segGroup(sel, cb) {
  $$(`${sel} button`).forEach((b) => b.addEventListener('click', () => {
    $$(`${sel} button`).forEach((x) => x.classList.toggle('on', x === b));
    cb(b.dataset.v);
  }));
}
segGroup('#sens', (v) => { S.sens = v; stab.setSensitivity(CONFIG.SENSITIVITY[v]); });
segGroup('#noise-limit', (v) => { S.limit = Number(v); drawMeterChart(); });

const cal = $('#cal');
cal.value = localStorage.getItem('tp.calibration') ?? CONFIG.CALIBRATION_DB;
const calLabel = () => ($('#cal-v').textContent = `+${cal.value} dB`);
calLabel();
cal.addEventListener('input', () => { localStorage.setItem('tp.calibration', cal.value); calLabel(); });
$('#cooldown').addEventListener('input', (e) => { stab.cooldown = Number(e.target.value); $('#cd-v').textContent = `${e.target.value} giây`; });
$('#alarm-vol').addEventListener('input', (e) => { $('#alarm-vol-v').textContent = `${e.target.value}%`; Siren.setVolume(); });

async function refreshMics() {
  const ms = await listMics();
  const cur = $('#mic-select').value;
  $('#mic-select').innerHTML = '<option value="">Mặc định</option>' + ms.map((m, i) => `<option value="${esc(m.deviceId)}">${esc(m.label || `Micro ${i + 1}`)}</option>`).join('');
  $('#mic-select').value = cur;
}
refreshMics();
$('#mic-select').addEventListener('change', async () => { if (S.running) { stop(); await start(); } });

// ================================================================ Bắt đầu / dừng (an toàn khi bấm liên tục)
$('#btn-start').addEventListener('click', () => (S.running ? stop() : start()));

async function start() {
  const gen = ++S.gen;
  const btn = $('#btn-start');
  btn.disabled = true;
  setState('loading', 'Đang mở micro');
  setCenter({ label: 'Đang mở micro…', sub: 'Hãy bấm “Cho phép” nếu trình duyệt hỏi.', icon: 'mic' });
  const mic = new LiveMic({ seconds: 4, onBlock });
  try {
    await mic.start($('#mic-select').value || undefined);
  } catch (e) {
    btn.disabled = false;
    setState('error');
    setCenter({ label: 'Chưa mở được micro', sub: micErrorMessage(e), icon: 'micOff' });
    toast(micErrorMessage(e), { tone: 'error', ms: 7000 });
    return;
  }
  if (gen !== S.gen) { mic.stop(); return; }
  S.mic = mic;
  S.running = true; S.muted = false; S.t0 = performance.now();
  S.levels = []; S.hist = []; S.timeline = []; S.floor = -60;
  S.stat = { n: 0, e: 0, min: Infinity, max: -Infinity };
  stab.reset();
  mic.track?.addEventListener('ended', () => {
    if (!S.running) return;
    stop();
    setState('error');
    setCenter({ label: 'Micro bị ngắt', sub: 'Micro vừa bị rút ra hoặc bị ứng dụng khác chiếm. Kiểm tra rồi bấm “Bắt đầu nghe” lại.', icon: 'micOff' });
  });
  btn.disabled = false; btn.classList.remove('active'); btn.classList.add('stop');
  btn.innerHTML = `${icon('stop', { size: 20 })}<span>Dừng</span>`;
  $('#btn-mic').disabled = false;
  updateMicBtn();
  clearInterval(S.uiTimer);
  S.uiTimer = setInterval(updateLevelUi, 200);
  drawSpec();
  refreshMics();

  setState('loading');
  setCenter({ label: 'Đang tải mô hình AI…', sub: 'Lần đầu mất vài giây, những lần sau nhanh hơn.', icon: 'cpu' });
  try {
    await loadClassifier((t, p) => { if (gen === S.gen) setCenter({ label: 'Đang tải mô hình AI…', sub: `${t}${p ? ` (${Math.round(p)}%)` : ''}`, icon: 'cpu' }); });
  } catch (e) {
    if (gen !== S.gen) return;
    setState('error', 'Lỗi tải mô hình');
    setCenter({ label: 'Không tải được mô hình', sub: e.message, icon: 'alert' });
    return;
  }
  if (gen !== S.gen) return;
  setState('listening');
  setCenter({ label: 'Đang nghe…', sub: 'Mọi âm thanh được xử lý ngay trên thiết bị của bạn.', icon: 'ear' });
  $('#pill-latency').hidden = false;
  loop(gen);
}

function stop() {
  S.gen++;
  S.running = false;
  clearInterval(S.uiTimer);
  S.mic?.stop(); S.mic = null;
  if (S.cc) { S.cc.stop(); S.cc = null; $('#btn-cc').classList.remove('active'); $('#live-cc').hidden = true; }
  closeAlarm();
  const btn = $('#btn-start');
  btn.disabled = false;
  btn.classList.add('active'); btn.classList.remove('stop');
  btn.innerHTML = `${icon('play', { size: 20 })}<span>Bắt đầu nghe</span>`;
  $('#btn-mic').disabled = true;
  $('#stage').dataset.tone = 'gray';
  $('#stage').classList.remove('alarm');
  $('#pill-latency').hidden = true;
  setState('off');
  setCenter({ label: 'Đã dừng', sub: 'Bấm “Bắt đầu nghe” để tiếp tục. Nhật ký vẫn được giữ lại.', icon: 'ear' });
  $('#pill-db-v').textContent = '-- dB';
  updateMicBtn();
}

// ================================================================ Mức âm từng khối (~43 ms)
function onBlock(db) {
  if (S.muted) return;
  const now = performance.now();
  if (now < S.selfSoundUntil) return; // đang phát chuông báo → không tính vào độ ồn
  S.levels.push({ t: now, db });
  const cut = now - 12000;
  while (S.levels.length && S.levels[0].t < cut) S.levels.shift();
  if (db > 5) { const st = S.stat; st.n++; st.e += 10 ** (db / 10); st.min = Math.min(st.min, db); st.max = Math.max(st.max, db); }
}

function leq(sec) {
  const cut = performance.now() - sec * 1000;
  let e = 0, n = 0;
  for (let i = S.levels.length - 1; i >= 0 && S.levels[i].t >= cut; i--) { e += 10 ** (S.levels[i].db / 10); n++; }
  return n ? 10 * Math.log10(e / n) : null;
}

let lastHealth = 0;
function updateLevelUi() {
  const cur = leq(0.5);
  if (cur == null) return;
  const b = bandOf(cur);
  $('#pill-db-v').textContent = `${Math.round(cur)} dB · ${b.word}`;
  $('#pill-db').style.borderColor = `var(--${b.tone})`;
  const sp = $('#speaking');
  if (sp) sp.style.opacity = cur > 55 && !S.muted ? '1' : '0';

  $('#lm-num').textContent = Math.round(cur);
  $('#lm-num').style.color = colorOf(cur);
  $('#lm-band').className = `badge tone-${b.tone} tone-bg`;
  $('#lm-band').innerHTML = `${icon(b.icon, { size: 14 })} ${b.label}`;
  $('#lm-meter').innerHTML = meter(cur) + `<p class="muted" style="font-size:.82rem;margin:8px 0 0">To như: ${esc(nearestReference(cur).text.toLowerCase())}</p>`;
  $('#do-on-truc-tiep').style.borderColor = `color-mix(in srgb, ${colorOf(cur)} 50%, transparent)`;
  const st = S.stat;
  if (st.n) {
    $('#lm-min').textContent = Math.round(st.min);
    $('#lm-max').textContent = Math.round(st.max);
    $('#lm-avg').textContent = Math.round(10 * Math.log10(st.e / st.n));
  }
  S.hist.push(cur);
  if (S.hist.length > 300) S.hist.shift();
  drawMeterChart();

  const now = performance.now();
  const l10 = leq(10);
  if (l10 != null && now - lastHealth > 1000) { lastHealth = now; $('#live-health').innerHTML = healthBanner(l10); }

  // Cảnh báo tiếng ồn: trung bình 3 giây vượt ngưỡng
  const l3 = leq(NOISE_WINDOW_SEC);
  if (l3 != null && (now - S.t0) / 1000 > NOISE_WINDOW_SEC) {
    if (l3 >= S.limit) raiseAlarm({ type: 'noise', db: l3 });
    else if (S.alarm?.type === 'noise') {
      if (!S.alarm.belowSince) S.alarm.belowSince = now;
      else if (now - S.alarm.belowSince > 6000) closeAlarm();
    }
    if (S.alarm?.type === 'noise' && l3 >= S.limit) { S.alarm.belowSince = 0; $('#alarm-value').textContent = `${Math.round(l3)} dB`; }
  }
}

// ================================================================ Vòng nhận diện (mỗi 0,5 s, bỏ nhịp nếu máy còn bận)
async function loop(gen) {
  while (S.running && gen === S.gen) {
    const t = performance.now();
    if (!S.muted && S.mic && S.mic.filled > S.mic.sr * WINDOW_SEC && !S.busy) {
      S.busy = true;
      setState(stab.current ? 'detected' : 'processing', stab.current ? `Đã phát hiện: ${groupDef(stab.current.id)?.vi ?? ''}` : 'Đang xử lý');
      try {
        const wave = S.mic.latest(WINDOW_SEC);
        const res = await classifyLive(wave, { useDenoise: $('#opt-denoise').checked });
        if (!S.running || gen !== S.gen) break;
        handleResult(res, (t - S.t0) / 1000);
      } catch (e) {
        console.error(e);
      } finally {
        S.busy = false;
      }
    }
    const wait = Math.max(30, TICK_MS - (performance.now() - t));
    await new Promise((r) => setTimeout(r, wait));
  }
}

function handleResult({ raw, weighted, level, ms }, tSec) {
  $('#latency-v').textContent = `${ms} ms`;
  // Cổng năng lượng thích nghi (theo dõi mức nền chậm)
  S.floor = level < S.floor ? 0.7 * S.floor + 0.3 * level : S.floor + 0.05;
  const active = level > -62 && (level > S.floor + 4 || level > -42);
  const selfSound = performance.now() < S.selfSoundUntil + 1500;
  const ignore = selfSound ? SELF_ALARM_IDS : new Set();
  const out = stab.push(weighted, active, tSec, raw, ignore);
  S.lastRaw = raw;

  renderProbs(raw, weighted, ignore);
  S.timeline.push({ t: tSec, id: out.current?.id || null, active });
  if (S.timeline.length > 140) S.timeline.shift();
  drawTimeline(tSec);

  const dbNow = leq(1) ?? 0;
  if (out.current) {
    const g = groupDef(out.current.id);
    $('#stage').dataset.tone = borderTone(g.kind, dbNow);
    $('#stage').classList.toggle('alarm', g.kind === 'danger');
    setState('detected', `Đã phát hiện: ${g.vi}`);
    const pct = displayConfidence(raw[g.id] || 0);
    setCenter({ label: g.vi, sub: `Độ tin cậy ${pct}% · ${new Date().toLocaleTimeString('vi-VN')}`, group: g });
  } else if (out.candidate) {
    const g = groupDef(out.candidate.id);
    $('#stage').classList.remove('alarm');
    setState('listening');
    setCenter({ label: `Có thể là ${g.vi.toLowerCase()}…`, sub: `Đang xác nhận (${out.votes}/${out.need})`, group: g, soft: true });
  } else {
    $('#stage').classList.remove('alarm');
    $('#stage').dataset.tone = borderTone('ambient', dbNow);
    setState('listening');
    let amb = null, av = 0.15;
    for (const id of AMBIENT_IDS) if ((raw[id] || 0) > av) { av = raw[id]; amb = id; }
    if (!active) setCenter({ label: 'Yên tĩnh', sub: 'Không có âm thanh nổi bật.', icon: 'moon' });
    else setCenter({ label: 'Đang nghe…', sub: amb ? `Chỉ có tiếng nền: ${groupDef(amb).vi.toLowerCase()}` : 'Chưa có âm thanh nổi bật.', icon: 'ear' });
  }
  if (out.fired) onEvent(out.fired.id, raw[out.fired.id], dbNow);
}

// ================================================================ Hiển thị
let lastCenter = '';
function setCenter({ label, sub, group, icon: ic, soft }) {
  $('#live-label').textContent = label;
  $('#live-sub').textContent = sub || '';
  $('#live-label').style.opacity = soft ? '.75' : '1';
  const key = `${group?.id || ic}|${soft ? 1 : 0}`;
  if (key === lastCenter) return;
  lastCenter = key;
  const illo = group && !soft ? ILLUSTRATIONS[group.id] : null;
  $('#live-visual').innerHTML = illo || `<span class="ripple"></span><span class="ripple"></span><div class="big" style="${group ? `color:var(--${kindTone(group.kind)})` : ''}">${icon(group?.icon || ic || 'ear', { size: 52, stroke: 1.6 })}</div>`;
}

function renderProbs(raw, weighted, ignore) {
  const rows = Object.entries(weighted)
    .filter(([id]) => id !== 'noise' && id !== 'silence' && !ignore.has(id) && groupDef(id))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!rows.length) return;
  $('#prob-list').innerHTML = rows.map(([id], i) => {
    const g = groupDef(id);
    const pct = displayConfidence(raw[id] || 0);
    return `<div class="prob-row${i === 0 && pct >= 40 ? ' top' : ''}" style="--tone:var(--${kindTone(g.kind)})">
      <span class="dot tone-${kindTone(g.kind)} tone-bg">${icon(g.icon, { size: 15 })}</span>
      <div style="min-width:0"><div class="pname"><span>${i === 0 && pct >= 40 ? `<b>${esc(g.vi)}</b>` : esc(g.vi)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
      <span class="mono">${pct}%</span></div>`;
  }).join('');
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function drawTimeline(tNow) {
  const c = $('#live-timeline');
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const px = w / 60;
  const seen = new Map();
  for (const e of S.timeline) {
    const x = w - (tNow - e.t) * px;
    if (x < -px) continue;
    if (e.id) {
      const grp = groupDef(e.id);
      g.fillStyle = cssVar(`--${kindTone(grp.kind)}`) || '#34d8bb';
      g.globalAlpha = 0.9;
      g.fillRect(x, 6, Math.ceil(px * 0.5) + 1, h - 12);
      seen.set(e.id, grp);
    } else if (e.active) {
      g.fillStyle = cssVar('--muted');
      g.globalAlpha = 0.25;
      g.fillRect(x, h / 2 - 3, Math.ceil(px * 0.5) + 1, 6);
    }
  }
  g.globalAlpha = 1;
  $('#tl-legend').innerHTML = [...seen.values()].slice(-4).map((grp) => `<span style="color:var(--${kindTone(grp.kind)})">●</span> ${esc(grp.vi)}`).join(' &nbsp; ');
}

function drawMeterChart() {
  const c = $('#lm-chart');
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const y = h - (S.limit / 120) * h;
  g.strokeStyle = cssVar('--orange'); g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
  g.fillStyle = cssVar('--muted'); g.font = '10px JetBrains Mono, monospace'; g.fillText(`ngưỡng ${S.limit} dB`, 4, y - 3);
  const H = S.hist, step = w / 299;
  for (let i = 0; i < H.length; i++) {
    const x = w - (H.length - 1 - i) * step;
    const bh = Math.max(1, (Math.min(120, H[i]) / 120) * h);
    g.fillStyle = colorOf(H[i]);
    g.globalAlpha = 0.85;
    g.fillRect(x, h - bh, Math.max(1, step - 0.4), bh);
  }
  g.globalAlpha = 1;
}

function drawSpec() {
  const c = $('#spec');
  const g = c.getContext('2d');
  const an = S.mic?.analyser;
  if (!an) return;
  const data = new Uint8Array(an.frequencyBinCount);
  const frame = () => {
    if (!S.running || !S.mic) { g.clearRect(0, 0, c.width, c.height); return; }
    const dpr = devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    an.getByteFrequencyData(data);
    g.clearRect(0, 0, w, h);
    const tone = $('#stage').dataset.tone;
    g.fillStyle = cssVar(tone === 'gray' ? '--accent' : `--${tone}`) || '#34d8bb';
    const bars = Math.floor(w / 6);
    for (let i = 0; i < bars; i++) {
      const v = S.muted ? 0 : data[Math.floor(Math.pow(i / bars, 1.8) * data.length * 0.7)] / 255;
      g.globalAlpha = 0.25 + v * 0.7;
      const bh = Math.max(2, v * h);
      g.fillRect(i * 6, h - bh, 4, bh);
    }
    requestAnimationFrame(frame);
  };
  frame();
}

// ================================================================ Sự kiện & nhật ký
function onEvent(id, rawScore, db) {
  const g = groupDef(id);
  const conf = displayConfidence(rawScore || 0);
  logEvent({ id, vi: g.vi, icon: g.icon, kind: g.kind, conf, db });
  if (watch.has(id)) {
    if (DANGER.has(id)) raiseAlarm({ type: 'danger', group: g, conf, db });
    else notify(`Phát hiện: ${g.vi}`, `Độ tin cậy ${conf}%`, kindTone(g.kind));
  }
  if ($('#opt-save').checked) {
    addEntry({ source: 'live', fileName: 'Giám sát trực tiếp', groupId: id, label: g.vi, conf, kind: g.kind, icon: g.icon, status: 'detected', levelDb: Math.round(db), peakDb: Math.round(db), duration: 1 }).catch(() => {});
  }
}

function logEvent(ev) {
  const t = new Date();
  S.events.unshift({ ...ev, t });
  if (S.events.length > 500) S.events.pop();
  const li = document.createElement('li');
  li.className = `tone-${ev.id === 'noise' ? 'orange' : kindTone(ev.kind)}`;
  li.innerHTML = `<span class="dot tone-bg">${icon(ev.icon || 'wave', { size: 16 })}</span>
    <div><b>${esc(ev.vi)}</b><small>${t.toLocaleTimeString('vi-VN')} · ${Math.round(ev.db)} dB${ev.conf != null ? ` · ${ev.conf}%` : ''}</small></div><span></span>`;
  const log = $('#log');
  log.querySelector('.empty')?.remove();
  log.prepend(li);
  while (log.children.length > 80) log.lastChild.remove();
}

$('#log-clear').addEventListener('click', () => { S.events = []; $('#log').innerHTML = '<li class="empty" style="display:block;background:none">Chưa có sự kiện nào.</li>'; });
$('#log-csv').addEventListener('click', () => {
  if (!S.events.length) return toast('Chưa có sự kiện để xuất.');
  const rows = [['thoi_gian', 'su_kien', 'do_tin_cay_%', 'muc_on_dB_uoc_tinh'], ...S.events.map((e) => [e.t.toISOString(), e.vi, e.conf ?? '', Math.round(e.db)])];
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `nhat-ky-giam-sat-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ================================================================ Âm báo (tổng hợp bằng Web Audio, không cần file)
const Siren = {
  ctx: null, gain: null, timer: null, kind: 'fire',
  vol() { return (Number($('#alarm-vol').value) / 100) * 0.3; },
  setVolume() { if (this.gain) this.gain.gain.value = this.vol(); },
  tone(freq, start, dur, type = 'sine') {
    const o = this.ctx.createOscillator(), env = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(1, start + 0.02);
    env.gain.setValueAtTime(1, start + dur - 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(env).connect(this.gain);
    o.start(start); o.stop(start + dur + 0.02);
  },
  cycle() {
    const t = this.ctx.currentTime + 0.05;
    let len;
    if (this.kind === 'fire') {        // kiểu chuông báo cháy (3 tiếng bíp rồi nghỉ)
      for (let i = 0; i < 3; i++) this.tone(3000, t + i, 0.5);
      len = 4;
    } else if (this.kind === 'hilo') { // còi hai tông
      for (let i = 0; i < 4; i++) this.tone(i % 2 ? 770 : 960, t + i * 0.5, 0.48, 'triangle');
      len = 2;
    } else {                           // bíp nhẹ
      this.tone(880, t, 0.15); this.tone(880, t + 0.25, 0.15);
      len = 2;
    }
    S.selfSoundUntil = performance.now() + len * 1000 + 300;
    return len;
  },
  start(kind) {
    this.stop();
    this.kind = kind || $('#alarm-sound').value;
    if (this.kind === 'off') return;
    try {
      this.ctx = this.ctx || new AudioContext();
      this.ctx.resume();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.vol();
      this.gain.connect(this.ctx.destination);
      const loopSound = () => { const len = this.cycle(); this.timer = setTimeout(loopSound, len * 1000); };
      loopSound();
    } catch { /* trình duyệt không cho phát âm thanh */ }
  },
  stop() {
    clearTimeout(this.timer); this.timer = null;
    try { this.gain?.disconnect(); } catch { /* đã ngắt */ }
    this.gain = null;
  },
};

$('#alarm-test').addEventListener('click', () => {
  Siren.start();
  setTimeout(() => Siren.stop(), Siren.kind === 'fire' ? 3600 : 2000);
});

// ================================================================ Báo động toàn màn hình
function raiseAlarm(a) {
  const now = performance.now();
  if (now < S.snoozeUntil) return;
  if (S.alarm) return;
  S.alarm = { ...a, at: now };
  const box = $('#alarm');
  const isNoise = a.type === 'noise';
  box.classList.toggle('warn', isNoise && a.db < 100);
  if (isNoise) {
    const hrs = safeHours(a.db);
    $('#alarm-kicker').textContent = 'Cảnh báo tiếng ồn';
    $('#alarm-title').textContent = a.db >= 100 ? 'Tiếng ồn nguy hiểm cho tai' : a.db >= CONFIG.HEALTH_LIMIT_DB ? 'Tiếng ồn có thể hại tai' : 'Tiếng ồn vượt ngưỡng bạn đặt';
    $('#alarm-value').textContent = `${Math.round(a.db)} dB`;
    $('#alarm-text').textContent = (isFinite(hrs)
      ? `Ở khoảng ${Math.round(a.db)} dB, chỉ nên tiếp xúc tối đa ${formatDuration(hrs)} mỗi ngày (NIOSH). `
      : `Mức này chưa gây hại cho tai nhưng đã vượt ngưỡng ${S.limit} dB bạn đặt. `) + 'Hãy giảm âm lượng, rời xa nguồn ồn hoặc dùng nút bịt tai. Số đo dB là ước tính.';
    $('#alarm-ic').innerHTML = icon('vol3', { size: 56 });
    logEvent({ id: 'noise', vi: `Ồn vượt ${S.limit} dB`, icon: 'vol3', kind: 'caution', conf: null, db: a.db });
  } else {
    $('#alarm-kicker').textContent = 'Phát hiện âm thanh nguy hiểm';
    $('#alarm-title').textContent = a.group.vi;
    $('#alarm-value').textContent = `${a.conf}%`;
    $('#alarm-text').textContent = 'Hãy quan sát xung quanh và giữ an toàn. Nếu có nguy hiểm thật, gọi 114 (cứu hỏa) hoặc 113 (công an). Kết quả nhận diện chỉ mang tính tham khảo.';
    $('#alarm-ic').innerHTML = icon(a.group.icon, { size: 56 });
    S.alarm.autoClose = setTimeout(closeAlarm, 15000);
  }
  box.hidden = false;
  $('#alarm-ok').focus();
  Siren.start();
  if ($('#opt-vibrate').checked) {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(isNoise ? `Tiếng ồn ${Math.round(a.db)} dB` : `Cảnh báo: ${a.group.vi}`, { body: $('#alarm-text').textContent });
    }
  }
}

function closeAlarm() {
  if (!S.alarm) return;
  clearTimeout(S.alarm.autoClose);
  S.alarm = null;
  Siren.stop();
  navigator.vibrate?.(0);
  $('#alarm').hidden = true;
}
$('#alarm-ok').addEventListener('click', () => { closeAlarm(); S.snoozeUntil = performance.now() + 20000; });
$('#alarm-snooze').addEventListener('click', () => { closeAlarm(); S.snoozeUntil = performance.now() + 5 * 60000; toast('Đã tạm ngưng cảnh báo trong 5 phút.'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.alarm) $('#alarm-ok').click(); });
$('#opt-vibrate').addEventListener('change', (e) => { if (e.target.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); });

function notify(title, body, tone) {
  toast(`${title} – ${body}`, { tone: tone === 'red' ? 'error' : 'default', ms: 4000 });
  if ($('#alarm-sound').value !== 'off' && !S.alarm) {
    Siren.start('beep');
    setTimeout(() => { if (!S.alarm) Siren.stop(); }, 700);
  }
  if ($('#opt-vibrate').checked) navigator.vibrate?.(150);
}

// ================================================================ Micro (tắt tiếng)
function updateMicBtn() {
  const bm = $('#btn-mic');
  bm.classList.toggle('muted', S.running && S.muted);
  bm.innerHTML = `<span class="speaking" id="speaking"></span>${icon(S.running && S.muted ? 'micOff' : 'mic', { size: 22 })}`;
}
$('#btn-mic').addEventListener('click', () => {
  if (!S.running) return;
  S.muted = !S.muted;
  S.mic.setMuted(S.muted);
  if (S.muted) { setState('muted'); setCenter({ label: 'Micro đang tắt tiếng', sub: 'Bấm nút micro để nghe tiếp.', icon: 'micOff' }); }
  else setState('listening');
  updateMicBtn();
});

// ================================================================ Phụ đề lời nói (của trình duyệt – không phải AI của Urban Sound)
$('#btn-cc').addEventListener('click', () => {
  if (!LiveCaptions.supported()) return toast('Trình duyệt này chưa hỗ trợ phụ đề. Hãy dùng Chrome hoặc Edge.', { tone: 'error' });
  if (S.cc) { S.cc.stop(); S.cc = null; $('#btn-cc').classList.remove('active'); $('#live-cc').hidden = true; return; }
  const box = $('#captions');
  const finals = [];
  box.innerHTML = '<span class="interim">Hãy nói gì đó…</span>';
  S.cc = new LiveCaptions({
    lang: 'vi-VN',
    onText: (t) => { box.innerHTML = `${finals.slice(-2).map((f) => `<div>${esc(f)}</div>`).join('')}<div class="interim">${esc(t)}</div>`; },
    onFinal: (t) => { if (t) finals.push(t); box.innerHTML = finals.slice(-3).map((f) => `<div>${esc(f)}</div>`).join(''); },
    onError: (e) => { if (e === 'not-allowed') toast('Bạn chưa cho phép nhận dạng giọng nói.', { tone: 'error' }); },
  });
  S.cc.start();
  $('#btn-cc').classList.add('active');
  $('#live-cc').hidden = false;
});

// ================================================================ Phím tắt & dọn dẹp
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea,button,summary,a')) return;
  if ((e.key === 'm' || e.key === 'M') && S.running) $('#btn-mic').click();
  if (e.key === ' ' && !S.alarm) { e.preventDefault(); $('#btn-start').click(); }
});
window.addEventListener('pagehide', () => { S.mic?.stop(); Siren.stop(); });

$('#lm-meter').innerHTML = meter(0);
setState('off');
updateMicBtn();
hydrateIcons();
