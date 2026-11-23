// Trang Giám sát trực tiếp – trọng tâm của sản phẩm.
// Luồng: Micro → bộ đệm vòng → mỗi 0,5 s lấy ~1 s gần nhất → YAMNet (+ mô hình nhóm) → bỏ phiếu ổn định
//        → hiển thị kết quả, xác suất, dòng thời gian → cảnh báo (âm thanh nguy hiểm / tiếng ồn vượt ngưỡng).
// Độ ồn (dB ước tính) được đo riêng từ tín hiệu micro, KHÔNG phải kết quả của mô hình AI.
// Camera (tùy chọn) chỉ để quan sát và ghi hình; AI không phân tích hình ảnh.

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
import { Camera, countCameras, cameraErrorMessage } from '../camera.js';
import { Scope } from '../scope.js';

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
  ccText: '', viewOn: false,
  // Dữ liệu cho lớp hiển thị trên camera / video quay
  hud: { status: 'off', group: null, pct: 0, votes: 0, need: 0, top: null, ms: 0, label: 'Sẵn sàng nghe', sub: '' },
};
const cam = new Camera($('#cam-video'));
const scope = new Scope();
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
  if (st === 'off' || st === 'error' || st === 'muted' || st === 'loading') { S.hud.status = st; S.hud.group = null; }
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
    let msg = micErrorMessage(e);
    if (e?.name === 'NotReadableError' && S.cc) msg += ' Phụ đề trình duyệt cũng đang dùng micro – hãy tắt Phụ đề rồi thử lại.';
    setCenter({ label: 'Chưa mở được micro', sub: msg, icon: 'micOff' });
    toast(msg, { tone: 'error', ms: 9000 });
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
  scope.reset();
  ensureView();
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
  if (S.cc) stopCaptions();
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
  S.hud.ms = $('#latency-v').textContent;
  S.hud.votes = out.votes; S.hud.need = out.need;
  if (out.current) {
    const g = groupDef(out.current.id);
    S.hud.status = 'detected'; S.hud.group = g; S.hud.pct = displayConfidence(raw[g.id] || 0);
    $('#stage').dataset.tone = borderTone(g.kind, dbNow);
    $('#stage').classList.toggle('alarm', g.kind === 'danger');
    setState('detected', `Đã phát hiện: ${g.vi}`);
    const pct = displayConfidence(raw[g.id] || 0);
    setCenter({ label: g.vi, sub: `Độ tin cậy ${pct}% · ${new Date().toLocaleTimeString('vi-VN')}`, group: g });
  } else if (out.candidate) {
    const g = groupDef(out.candidate.id);
    S.hud.status = 'candidate'; S.hud.group = g; S.hud.pct = displayConfidence(raw[g.id] || 0);
    $('#stage').classList.remove('alarm');
    setState('listening');
    setCenter({ label: `Có thể là ${g.vi.toLowerCase()}…`, sub: `Đang xác nhận (${out.votes}/${out.need})`, group: g, soft: true });
  } else {
    $('#stage').classList.remove('alarm');
    $('#stage').dataset.tone = borderTone('ambient', dbNow);
    setState('listening');
    S.hud.status = active ? 'listening' : 'quiet'; S.hud.group = null;
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
  S.hud.label = label; S.hud.sub = sub || '';
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
  S.hud.top = { g: groupDef(rows[0][0]), pct: displayConfidence(raw[rows[0][0]] || 0) };
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

// ================================================================ Lớp hình ảnh: phổ âm thanh, camera, ghi hình
const FRAME_MS = 1000 / 30;
const short = (vi) => vi.replace(/ \(.*\)/, '').replace(/,.*$/, '');

function hudTone() {
  const h = S.hud;
  if ((h.status === 'detected' || h.status === 'candidate') && h.group) return h.status === 'candidate' ? 'amber' : kindTone(h.group.kind);
  if (h.status === 'error') return 'red';
  if (h.status === 'listening' || h.status === 'quiet') return 'green';
  return 'gray';
}
const toneColor = (t) => cssVar(`--${t}`) || '#34d8bb';

function ensureView() {
  if (S.viewOn) return;
  S.viewOn = true;
  let last = 0;
  const frame = (t) => {
    if (!S.running && !cam.on && !Rec.on) {
      S.viewOn = false;
      const c = $('#spec');
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
      return;
    }
    requestAnimationFrame(frame);
    if (t - last < FRAME_MS - 3) return;
    last = t;
    if (S.running && S.mic?.analyser) scope.update(S.mic.analyser, { muted: S.muted, color: toneColor(hudTone() === 'gray' ? 'accent' : hudTone()) });
    if (cam.on || Rec.on) drawCam(); else drawStrip();
  };
  requestAnimationFrame(frame);
}

function fitCanvas(c, maxDpr = 2) {
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return null;
  // Khi đang quay, giữ nguyên kích thước điểm ảnh để file video không bị lỗi
  if (!Rec.on || !c.width) {
    const dpr = Math.min(maxDpr, devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  }
  const g = c.getContext('2d');
  g.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
  return { g, w, h };
}

function drawStrip() {
  const f = fitCanvas($('#spec'));
  if (!f) return;
  f.g.clearRect(0, 0, f.w, f.h);
  scope.draw(f.g, 0, 0, f.w, f.h);
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}

function wrapLines(g, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

const pad2 = (n) => String(n).padStart(2, '0');
function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function drawCam() {
  const f = fitCanvas($('#cam-canvas'));
  if (!f) return;
  const { g, w: W, h: H } = f;
  const now = performance.now();
  const h = S.hud;
  const tone = hudTone(), col = toneColor(tone);
  const k = W < 460 ? 0.82 : 1; // thu nhỏ chữ trên điện thoại

  // --- nền: hình camera (trước thì lật gương) hoặc nền tối khi chỉ quay âm thanh
  g.fillStyle = '#050808'; g.fillRect(0, 0, W, H);
  if (cam.ready) {
    const v = cam.video, sc = Math.max(W / v.videoWidth, H / v.videoHeight);
    const dw = v.videoWidth * sc, dh = v.videoHeight * sc;
    g.save();
    if (cam.mirror) { g.translate(W, 0); g.scale(-1, 1); }
    g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    g.restore();
  } else {
    const grd = g.createRadialGradient(W / 2, H * 0.35, 10, W / 2, H * 0.35, Math.max(W, H) * 0.7);
    grd.addColorStop(0, '#15221f');
    grd.addColorStop(1, '#050808');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = '#fff'; g.font = `700 ${Math.round(30 * k)}px ${FONT}`;
    g.fillText(cam.on ? 'Đang mở camera…' : h.label, W / 2, H * 0.42);
    g.fillStyle = 'rgba(255,255,255,.65)'; g.font = `400 ${Math.round(14 * k)}px ${FONT}`;
    wrapLines(g, cam.on ? '' : h.sub, W * 0.8).slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, H * 0.42 + 30 * k + i * 20 * k));
    g.textAlign = 'left';
  }

  // --- dải phổ + sóng âm phía dưới
  const sh = Math.round(Math.min(140, Math.max(84, H * 0.2)));
  if (S.running) scope.draw(g, 0, H - sh, W, sh);

  // --- viền theo trạng thái (nguy hiểm thì nhấp nháy)
  const danger = h.status === 'detected' && h.group?.kind === 'danger';
  g.save();
  g.lineWidth = danger ? 10 : h.status === 'detected' ? 7 : 4;
  g.strokeStyle = col;
  g.globalAlpha = danger ? 0.55 + 0.45 * Math.sin(now / 110) : h.status === 'detected' ? 1 : 0.75;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
  g.restore();

  // --- huy hiệu trạng thái (góc trên trái)
  const badge = {
    off: '●  CHƯA BẬT NGHE', loading: '●  ĐANG TẢI MÔ HÌNH', error: '●  LỖI MICRO', muted: '●  MICRO TẮT TIẾNG',
    quiet: '●  YÊN TĨNH', listening: '●  ĐANG NGHE',
    candidate: `◌  CÓ THỂ: ${short(h.group?.vi || '').toUpperCase()}`,
    detected: `⚠  ${short(h.group?.vi || '').toUpperCase()}`,
  }[h.status] || '●  ĐANG NGHE';
  g.font = `800 ${Math.round(15 * k)}px ${FONT}`;
  const bw = g.measureText(badge).width + 26 * k, bh = 34 * k, bx = 14, by = 14;
  rr(g, bx, by, bw, bh, 8); g.fillStyle = h.status === 'detected' ? col : 'rgba(0,0,0,.55)'; g.fill();
  if (h.status !== 'detected') { g.lineWidth = 2; g.strokeStyle = col; g.stroke(); }
  g.fillStyle = h.status === 'detected' ? '#fff' : col;
  g.fillText(badge, bx + 13 * k, by + bh / 2 + 5 * k);

  // --- đang quay
  if (Rec.on) {
    const sec = Math.floor((now - Rec.t0) / 1000);
    const txt = `REC ${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
    g.font = `700 ${Math.round(13 * k)}px ${MONO}`;
    const rw = g.measureText(txt).width + 34;
    rr(g, bx, by + bh + 8, rw, 26 * k, 6); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill();
    if (Math.floor(now / 500) % 2 === 0) { g.beginPath(); g.arc(bx + 14, by + bh + 8 + 13 * k, 5, 0, Math.PI * 2); g.fillStyle = '#ff3b3b'; g.fill(); }
    g.fillStyle = '#fff'; g.fillText(txt, bx + 26, by + bh + 8 + 17 * k);
  }

  // --- bảng số liệu (góc trên phải)
  const pw = Math.min(250 * k, W * 0.5), px = W - pw - 14, py = 14;
  const lines = [];
  const db = leq(0.5) ?? leq(8); // lúc đang phát chuông báo thì giữ số đo gần nhất
  if (S.running) {
    lines.push(`Phiếu: ${h.votes || 0}/${h.need || '-'}  ·  ${h.ms || '--'}`);
    lines.push(`Độ ồn ≈ ${db != null ? Math.round(db) : '--'} dB (ước tính)`);
  }
  lines.push(stamp());
  const top = S.running && h.top && !S.muted ? h.top : null;
  const ph = (top ? 58 * k : 10) + lines.length * 17 * k + 8;
  rr(g, px, py, pw, ph, 10); g.fillStyle = 'rgba(0,0,0,.58)'; g.fill();
  let yy = py + 8;
  if (top) {
    const tc = toneColor(kindTone(top.g.kind));
    g.font = `600 ${Math.round(12 * k)}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,.8)';
    const name = `P(${short(top.g.vi)})`;
    g.fillText(name.length > 22 ? name.slice(0, 21) + '…)' : name, px + 12, yy + 22 * k);
    g.font = `800 ${Math.round(22 * k)}px ${MONO}`; g.fillStyle = tc; g.textAlign = 'right';
    g.fillText(`${top.pct}%`, px + pw - 12, yy + 24 * k); g.textAlign = 'left';
    rr(g, px + 12, yy + 34 * k, pw - 24, 6, 3); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill();
    rr(g, px + 12, yy + 34 * k, Math.max(4, (pw - 24) * top.pct / 100), 6, 3); g.fillStyle = tc; g.fill();
    yy += 50 * k;
  }
  g.font = `500 ${Math.round(11.5 * k)}px ${MONO}`; g.fillStyle = 'rgba(255,255,255,.78)';
  lines.forEach((l, i) => g.fillText(l, px + 12, yy + 13 * k + i * 17 * k));

  // --- phụ đề (của trình duyệt)
  if (S.ccText) {
    g.font = `600 ${Math.round(17 * k)}px ${FONT}`;
    const ls = wrapLines(g, S.ccText, W - 70).slice(-2);
    const ch = ls.length * 24 * k + 16, cy = H - sh - ch - 34;
    rr(g, 20, cy, W - 40, ch, 10); g.fillStyle = 'rgba(0,0,0,.62)'; g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center';
    ls.forEach((l, i) => g.fillText(l, W / 2, cy + 8 + 18 * k + i * 24 * k));
    g.textAlign = 'left';
  }

  // --- chú thích dưới (trên dải phổ)
  g.font = `600 ${Math.round(11 * k)}px ${FONT}`;
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 4;
  g.fillText('Urban Sound · AI nghe âm thanh', 14, H - (S.running ? sh : 0) - 10);
  g.textAlign = 'right';
  g.fillText(cam.ready ? (cam.facing === 'environment' ? 'Camera sau' : 'Camera trước') : 'Không có camera', W - 14, H - (S.running ? sh : 0) - 10);
  g.textAlign = 'left'; g.shadowBlur = 0;
}

// ---------------------------------------------------------------- Camera
function updateVisual() {
  const stage = $('#stage');
  const v = cam.on || Rec.on;
  stage.classList.toggle('cam-mode', v);
  const vid = cam.video;
  // Điện thoại cầm dọc: khung dọc 3:4 (giống quay video trên điện thoại); máy tính: theo tỉ lệ camera
  if (matchMedia('(max-width: 640px)').matches) stage.style.setProperty('--ar', '3 / 4');
  else stage.style.setProperty('--ar', cam.ready ? `${vid.videoWidth} / ${vid.videoHeight}` : '16 / 9');
  $('#btn-snap').hidden = !v;
}
cam.video.addEventListener('loadedmetadata', updateVisual);
cam.video.addEventListener('resize', updateVisual);

async function afterCam() {
  const on = cam.on;
  const b = $('#btn-cam');
  b.classList.toggle('active', on);
  b.innerHTML = icon(on ? 'cam' : 'camOff', { size: 22 });
  $('#cam-note').hidden = !on;
  updateVisual();
  if (on) {
    ensureView();
    $('#btn-flip').hidden = (await countCameras()) < 2;
    cam.track?.addEventListener('ended', () => { cam.stop(); afterCam(); toast('Camera vừa bị ngắt.', { tone: 'error' }); }, { once: true });
  }
}

$('#btn-cam').addEventListener('click', async () => {
  const b = $('#btn-cam');
  if (cam.on) { cam.stop(); afterCam(); return; }
  b.disabled = true;
  try { await cam.start(); } catch (e) { toast(cameraErrorMessage(e), { tone: 'error', ms: 7000 }); }
  b.disabled = false;
  afterCam();
});

$('#btn-flip').addEventListener('click', async () => {
  const b = $('#btn-flip');
  b.disabled = true;
  try {
    await cam.flip();
    toast(cam.facing === 'environment' ? 'Đã chuyển sang camera sau' : 'Đã chuyển sang camera trước');
  } catch (e) { toast(cameraErrorMessage(e), { tone: 'error' }); }
  b.disabled = false;
  afterCam();
});

function fileStamp() { return stamp().replace(/[: ]/g, '-'); }
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

$('#btn-snap').addEventListener('click', () => {
  $('#cam-canvas').toBlob((b) => { if (b) { download(b, `urban-sound-${fileStamp()}.png`); toast('Đã lưu ảnh.'); } }, 'image/png');
});

// ---------------------------------------------------------------- Ghi hình (khung hình + lớp kết quả + âm thanh micro)
const Rec = {
  on: false, mr: null, chunks: [], t0: 0, timer: null, tracks: [], mime: '',
  MAX_SEC: 300,
  pickMime() {
    const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
  },
  start() {
    const c = $('#cam-canvas');
    if (!('MediaRecorder' in window) || !c.captureStream) return toast('Trình duyệt này chưa hỗ trợ quay video. Hãy dùng Chrome, Edge hoặc Safari bản mới.', { tone: 'error' });
    if (!cam.on && !S.running) return toast('Hãy bật Camera hoặc bấm “Bắt đầu nghe” trước khi quay.');
    this.on = true;
    updateVisual(); ensureView(); drawCam();
    this.tracks = [...c.captureStream(30).getVideoTracks()];
    const at = S.mic?.track;
    if (at && at.readyState === 'live') this.tracks.push(at.clone());
    const mime = this.pickMime();
    try {
      this.mr = new MediaRecorder(new MediaStream(this.tracks), mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
    } catch (e) {
      this.cleanup();
      return toast('Không quay được: ' + e.message, { tone: 'error' });
    }
    this.mime = this.mr.mimeType || mime || 'video/webm';
    this.chunks = [];
    this.mr.ondataavailable = (e) => { if (e.data?.size) this.chunks.push(e.data); };
    this.mr.onstop = () => { this.save(); this.tracks.forEach((t) => t.stop()); this.tracks = []; };
    this.mr.start(1000);
    this.t0 = performance.now();
    const b = $('#btn-rec');
    b.classList.add('rec');
    b.innerHTML = icon('stop', { size: 20 });
    this.timer = setInterval(() => {
      const s = Math.floor((performance.now() - this.t0) / 1000);
      $('#rec-label').textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
      if (s >= this.MAX_SEC) { this.stop(); toast('Đã dừng quay sau 5 phút để tránh file quá lớn.'); }
    }, 500);
    if (!at) toast('Đang quay hình không có tiếng (micro chưa bật).');
  },
  stop() {
    if (!this.on) return;
    try { if (this.mr && this.mr.state !== 'inactive') this.mr.stop(); else this.tracks.forEach((t) => t.stop()); } catch { /* đã dừng */ }
    this.cleanup();
  },
  cleanup() {
    this.on = false;
    clearInterval(this.timer);
    const b = $('#btn-rec');
    b.classList.remove('rec');
    b.innerHTML = icon('record', { size: 22 });
    $('#rec-label').textContent = 'Quay';
    updateVisual();
  },
  save() {
    if (!this.chunks.length) return;
    const blob = new Blob(this.chunks, { type: this.mime });
    this.chunks = [];
    const ext = this.mime.includes('mp4') ? 'mp4' : 'webm';
    download(blob, `urban-sound-${fileStamp()}.${ext}`);
    toast(`Đã lưu video ${ext.toUpperCase()} (${(blob.size / 1e6).toFixed(1)} MB).`);
  },
};
$('#btn-rec').addEventListener('click', () => (Rec.on ? Rec.stop() : Rec.start()));

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
function stopCaptions() {
  S.cc?.stop(); S.cc = null; S.ccText = '';
  $('#btn-cc').classList.remove('active'); $('#live-cc').hidden = true;
  $('#stage').classList.remove('cc-on');
}
$('#btn-cc').addEventListener('click', () => {
  if (!LiveCaptions.supported()) return toast('Trình duyệt này chưa hỗ trợ phụ đề. Hãy dùng Chrome hoặc Edge.', { tone: 'error' });
  if (S.cc) { stopCaptions(); return; }
  const box = $('#captions');
  const finals = [];
  box.innerHTML = '<span class="interim">Hãy nói gì đó…</span>';
  S.cc = new LiveCaptions({
    lang: 'vi-VN',
    onText: (t) => { box.innerHTML = `${finals.slice(-2).map((f) => `<div>${esc(f)}</div>`).join('')}<div class="interim">${esc(t)}</div>`; S.ccText = [...finals.slice(-1), t].join(' '); },
    onFinal: (t) => { if (t) finals.push(t); box.innerHTML = finals.slice(-3).map((f) => `<div>${esc(f)}</div>`).join(''); S.ccText = finals.slice(-2).join(' '); },
    onError: (e) => { if (e === 'not-allowed') toast('Bạn chưa cho phép nhận dạng giọng nói.', { tone: 'error' }); },
  });
  S.cc.start();
  S.ccText = '';
  $('#btn-cc').classList.add('active');
  $('#live-cc').hidden = false;
  $('#stage').classList.add('cc-on');
});

// ================================================================ Phím tắt & dọn dẹp
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea,button,summary,a')) return;
  if ((e.key === 'm' || e.key === 'M') && S.running) $('#btn-mic').click();
  if (e.key === 'c' || e.key === 'C') $('#btn-cam').click();
  if (e.key === 'r' || e.key === 'R') $('#btn-rec').click();
  if (e.key === ' ' && !S.alarm) { e.preventDefault(); $('#btn-start').click(); }
});
window.addEventListener('pagehide', () => { Rec.stop(); S.mic?.stop(); cam.stop(); Siren.stop(); });

$('#lm-meter').innerHTML = meter(0);
setState('off');
updateMicBtn();
hydrateIcons();
