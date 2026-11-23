import { CONFIG } from '../config.js';
import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon, ILLUSTRATIONS } from '../icons.js';
import { LiveMic, listMics, micErrorMessage, toDb } from '../audio.js';
import { loadClassifier, classifyLive, groupDef } from '../classifier.js';
import { LiveStabilizer, displayConfidence } from '../analysis.js';
import { GROUPS, AMBIENT_IDS } from '../categories.js';
import { bandOf, colorOf, nearestReference } from '../levels.js';
import { healthBanner, kindTone, borderTone, meter } from '../render.js';
import { LiveCaptions } from '../transcribe.js';
import { addEntry } from '../store.js';

initLayout();

const S = {
  mic: null, running: false, muted: false, cam: null, rec: null, cc: null,
  sens: 'medium', limit: 85, stat: { n: 0, e: 0, min: Infinity, max: -Infinity }, hist: [], levels: [], blockDb: -100, floor: -60, lastNoiseWarn: 0, events: [], busy: false, t0: 0,
};
const stab = new LiveStabilizer({ ...CONFIG.SENSITIVITY.medium, cooldown: 4 });

// ---------------------------------------------------------------- Theo dõi nhóm
const DEFAULT_WATCH = new Set(['siren', 'gunshot', 'alarm', 'glass', 'shout', 'baby', 'dog', 'horn', 'fireworks']);
const WATCHABLE = ['siren', 'gunshot', 'alarm', 'glass', 'fire', 'shout', 'baby', 'children', 'dog', 'cat', 'horn', 'fireworks', 'construction', 'motorbike', 'bell', 'rain'];
const watchable = WATCHABLE.map((id) => GROUPS.find((g) => g.id === id)).filter(Boolean);
let watch;
try { watch = new Set(JSON.parse(localStorage.getItem('tp.watch') || 'null') || [...DEFAULT_WATCH]); } catch { watch = new Set(DEFAULT_WATCH); }
function renderWatch() {
  $('#watch').innerHTML = watchable.map((g) => `<button type="button" class="chip${watch.has(g.id) ? ' on' : ''}" data-id="${g.id}" aria-pressed="${watch.has(g.id)}" style="${watch.has(g.id) ? 'border-color:var(--accent);color:var(--text)' : 'opacity:.7'}"><span class="dot tone-${kindTone(g.kind)} tone-bg">${icon(g.icon, { size: 14 })}</span>${esc(g.vi.replace(/ \(.*\)/, ''))}</button>`).join('');
  $$('#watch .chip').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.id;
    watch.has(id) ? watch.delete(id) : watch.add(id);
    localStorage.setItem('tp.watch', JSON.stringify([...watch]));
    renderWatch();
  }));
}
renderWatch();

// ---------------------------------------------------------------- Độ nhạy & ngưỡng ồn
function segGroup(sel, cb) {
  $$(`${sel} button`).forEach((b) => b.addEventListener('click', () => {
    $$(`${sel} button`).forEach((x) => x.classList.toggle('on', x === b));
    cb(b.dataset.v);
  }));
}
segGroup('#sens', (v) => { S.sens = v; stab.setSensitivity(CONFIG.SENSITIVITY[v]); });
segGroup('#noise-limit', (v) => { S.limit = Number(v); });

const cal = $('#cal');
cal.value = localStorage.getItem('tp.calibration') ?? CONFIG.CALIBRATION_DB;
const calLabel = () => ($('#cal-v').textContent = `+${cal.value} dB`);
calLabel();
cal.addEventListener('input', () => { localStorage.setItem('tp.calibration', cal.value); calLabel(); });
$('#cooldown').addEventListener('input', (e) => { stab.cooldown = Number(e.target.value); $('#cd-v').textContent = `${e.target.value} giây`; });

listMics().then((ms) => {
  $('#mic-select').innerHTML = '<option value="">Mặc định</option>' + ms.map((m, i) => `<option value="${m.deviceId}">${esc(m.label || `Micro ${i + 1}`)}</option>`).join('');
});
$('#mic-select').addEventListener('change', async () => { if (S.running) { await stop(); await start(); } });

// ---------------------------------------------------------------- Bắt đầu / dừng
$('#btn-start').addEventListener('click', () => (S.running ? stop() : start()));

async function start() {
  const btn = $('#btn-start');
  btn.disabled = true;
  setCenter({ label: 'Đang mở micro…', sub: 'Hãy bấm “Cho phép” nếu trình duyệt hỏi.' });
  S.mic = new LiveMic({ seconds: 4, onBlock: onBlock });
  try {
    await S.mic.start($('#mic-select').value || undefined);
  } catch (e) {
    btn.disabled = false;
    setCenter({ label: 'Chưa mở được micro', sub: micErrorMessage(e) });
    return toast(micErrorMessage(e), { tone: 'error', ms: 6000 });
  }
  S.running = true; S.muted = false; S.t0 = performance.now(); S.levels = [];
  S.stat = { n: 0, e: 0, min: Infinity, max: -Infinity }; S.hist = [];
  btn.disabled = false; btn.classList.remove('active'); btn.classList.add('stop');
  btn.innerHTML = `${icon('stop', { size: 20 })}<span>Dừng</span>`;
  $('#btn-mic').disabled = false;
  updatePills();
  clearInterval(S.levelTimer);
  S.levelTimer = setInterval(updateLevelUi, 200);
  setCenter({ label: 'Đang tải mô hình…', sub: 'Lần đầu mất vài giây.' });
  try {
    await loadClassifier((t) => setCenter({ label: 'Đang tải mô hình…', sub: t }));
  } catch (e) {
    setCenter({ label: 'Không tải được mô hình', sub: e.message });
    return;
  }
  setCenter({ label: 'Đang nghe…', sub: 'Mọi âm thanh được xử lý ngay trên thiết bị của bạn.' });
  drawSpec();
  loop();
  listMics().then((ms) => { if (ms.some((m) => m.label)) $('#mic-select').innerHTML = '<option value="">Mặc định</option>' + ms.map((m, i) => `<option value="${m.deviceId}">${esc(m.label || `Micro ${i + 1}`)}</option>`).join(''); });
}

async function stop() {
  S.running = false;
  clearInterval(S.levelTimer);
  S.mic?.stop(); S.mic = null;
  if (S.cc) { S.cc.stop(); S.cc = null; $('#btn-cc').classList.remove('active'); $('#cc-card').hidden = true; }
  const btn = $('#btn-start');
  btn.classList.add('active'); btn.classList.remove('stop');
  btn.innerHTML = `${icon('play', { size: 20 })}<span>Bắt đầu nghe</span>`;
  $('#btn-mic').disabled = true;
  $('#stage').dataset.tone = 'gray'; $('#stage').classList.remove('alarm');
  setCenter({ label: 'Đã dừng', sub: 'Bấm “Bắt đầu nghe” để tiếp tục.', icon: 'ear' });
  $('#pill-db-v').textContent = '-- dB';
  updatePills();
}

// ---------------------------------------------------------------- Mức âm từng khối (~43 ms)
function onBlock(db) {
  if (S.muted) return;
  S.blockDb = db;
  S.levels.push({ t: performance.now(), db });
  if (db > 5) { const st = S.stat; st.n++; st.e += Math.pow(10, db / 10); st.min = Math.min(st.min, db); st.max = Math.max(st.max, db); }
  const cut = performance.now() - 12000;
  while (S.levels.length && S.levels[0].t < cut) S.levels.shift();
}

function leq(sec) {
  const cut = performance.now() - sec * 1000;
  const xs = S.levels.filter((l) => l.t >= cut);
  if (!xs.length) return null;
  return 10 * Math.log10(xs.reduce((a, l) => a + Math.pow(10, l.db / 10), 0) / xs.length);
}

let uiTimer = 0;
function updateLevelUi() {
  const now = performance.now();
  if (now - uiTimer < 200) return;
  uiTimer = now;
  const cur = leq(0.5);
  if (cur == null) return;
  const b = bandOf(cur);
  $('#pill-db-v').textContent = `${Math.round(cur)} dB · ${b.word}`;
  $('#pill-db').style.borderColor = `var(--${b.tone})`;
  $('#speaking').style.opacity = cur > 55 && !S.muted ? '1' : '0';
  updateMeterCard(cur, b);
  const l10 = leq(10);
  if (l10 != null) {
    $('#live-health').innerHTML = healthBanner(l10);
    if (l10 >= S.limit && now - S.lastNoiseWarn > 30000) {
      S.lastNoiseWarn = now;
      notify(`Tiếng ồn ~${Math.round(l10)} dB vượt mức ${S.limit} dB`, 'Hãy giảm âm lượng hoặc rời xa nguồn ồn.', 'orange');
      logEvent({ id: 'noise', vi: `Ồn vượt ${S.limit} dB`, icon: 'vol3', kind: 'caution', conf: null, db: l10 });
    }
  }
}

// ---------------------------------------------------------------- Thẻ đo độ ồn trực tiếp
function updateMeterCard(cur, b) {
  $('#lm-num').textContent = Math.round(cur);
  $('#lm-num').style.color = colorOf(cur);
  $('#lm-band').className = `badge tone-${b.tone} tone-bg`;
  $('#lm-band').innerHTML = `${icon(b.icon, { size: 14 })} ${b.label}`;
  $('#lm-meter').innerHTML = meter(cur);
  $('#lm-like').textContent = `To như: ${nearestReference(cur).text.toLowerCase()}.`;
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
}

function drawMeterChart() {
  const c = $('#lm-chart');
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  const y85 = h - (85 / 120) * h;
  g.strokeStyle = css.getPropertyValue('--orange'); g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(0, y85); g.lineTo(w, y85); g.stroke(); g.setLineDash([]);
  g.fillStyle = css.getPropertyValue('--muted'); g.font = '10px JetBrains Mono, monospace'; g.fillText('85 dB', 4, y85 - 3);
  const n = 300, step = w / (n - 1), H = S.hist;
  for (let i = 0; i < H.length; i++) {
    const x = w - (H.length - 1 - i) * step;
    const bh = Math.max(1, (Math.min(120, H[i]) / 120) * h);
    g.fillStyle = colorOf(H[i]);
    g.globalAlpha = 0.85;
    g.fillRect(x, h - bh, Math.max(1, step - 0.5), bh);
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- Vòng nhận diện (mỗi ~1 giây)
async function loop() {
  while (S.running) {
    const t = performance.now();
    if (!S.muted && S.mic && S.mic.filled > S.mic.sr * 1) {
      try {
        const wave = S.mic.latest(1.92);
        const { raw, weighted, level } = await classifyLive(wave, { useDenoise: $('#opt-denoise').checked });
        // Cổng năng lượng thích nghi: theo dõi mức nền chậm
        S.floor = level < S.floor ? 0.7 * S.floor + 0.3 * level : S.floor + 0.08;
        const active = level > -62 && (level > S.floor + 5 || level > -40);
        const out = stab.push(weighted, active, (t - S.t0) / 1000);
        show(out, raw, active);
        if (out.fired) onEvent(out.fired.id, raw[out.fired.id]);
      } catch (e) {
        console.error(e);
      }
    }
    const wait = Math.max(150, 1000 - (performance.now() - t));
    await new Promise((r) => setTimeout(r, wait));
  }
}

function show(out, raw, active) {
  const dbNow = leq(1) ?? 0;
  if (out.current) {
    const g = groupDef(out.current.id);
    const tone = borderTone(g.kind, dbNow);
    $('#stage').dataset.tone = tone;
    $('#stage').classList.toggle('alarm', g.kind === 'danger');
    setCenter({ label: g.vi, sub: `Độ tin cậy ${displayConfidence(raw[g.id] || 0)}% · liên tiếp ${Math.min(out.streakCount, 9)} lần`, group: g });
  } else if (out.candidate) {
    const g = groupDef(out.candidate.id);
    $('#stage').classList.remove('alarm');
    setCenter({ label: `Có thể là ${g.vi.toLowerCase()}…`, sub: `Đang xác nhận (${out.streakCount}/${CONFIG.SENSITIVITY[S.sens].streak})`, group: g, soft: true });
  } else {
    $('#stage').classList.remove('alarm');
    let amb = null, av = 0.15;
    for (const id of AMBIENT_IDS) if ((raw[id] || 0) > av) { av = raw[id]; amb = id; }
    $('#stage').dataset.tone = borderTone('ambient', dbNow);
    if (!active) setCenter({ label: 'Yên tĩnh', sub: 'Không có âm thanh nổi bật.', icon: 'moon' });
    else setCenter({ label: 'Đang nghe…', sub: amb ? `Chỉ có tiếng nền: ${groupDef(amb).vi.toLowerCase()}` : 'Chưa có âm thanh nổi bật.', icon: 'ear' });
  }
}

let lastCenter = '';
function setCenter({ label, sub, group, icon: ic, soft }) {
  const key = `${label}|${group?.id || ic}`;
  $('#live-label').textContent = label;
  $('#live-sub').textContent = sub || '';
  $('#live-label').style.opacity = soft ? '.75' : '1';
  if (key === lastCenter) return;
  lastCenter = key;
  const v = $('#live-visual');
  const illo = group && !soft ? ILLUSTRATIONS[group.id] : null;
  v.innerHTML = illo || `<span class="ripple"></span><span class="ripple"></span><div class="big" style="${group ? `color:var(--${kindTone(group.kind)})` : ''}">${icon(group?.icon || ic || 'ear', { size: 52, stroke: 1.6 })}</div>`;
}

// ---------------------------------------------------------------- Sự kiện
function onEvent(id, rawScore) {
  const g = groupDef(id);
  const conf = displayConfidence(rawScore || 0);
  const db = leq(2) ?? 0;
  const snap = S.cam ? snapshot() : null;
  logEvent({ id, vi: g.vi, icon: g.icon, kind: g.kind, conf, db, snap });
  if (watch.has(id)) {
    const danger = g.kind === 'danger';
    notify(danger ? `Cảnh báo: ${g.vi}` : `Phát hiện: ${g.vi}`, danger ? 'Hãy kiểm tra xung quanh và giữ an toàn.' : `Độ tin cậy ${conf}%`, danger ? 'red' : kindTone(g.kind));
  }
  if ($('#opt-save').checked) {
    addEntry({ source: 'live', fileName: 'Giám sát trực tiếp', groupId: id, label: g.vi, conf, kind: g.kind, icon: g.icon, status: 'detected', levelDb: Math.round(db), peakDb: Math.round(db), duration: 2 }).catch(() => {});
  }
}

function logEvent(ev) {
  const t = new Date();
  S.events.unshift({ ...ev, t });
  if (S.events.length > 200) S.events.pop();
  const li = document.createElement('li');
  li.className = `tone-${ev.kind === 'caution' && ev.id === 'noise' ? 'orange' : kindTone(ev.kind)}`;
  li.innerHTML = `<span class="dot tone-bg">${icon(ev.icon || 'wave', { size: 16 })}</span>
    <div><b>${esc(ev.vi)}</b><small>${t.toLocaleTimeString('vi-VN')} · ${Math.round(ev.db)} dB${ev.conf != null ? ` · ${ev.conf}%` : ''}</small></div>
    ${ev.snap ? `<img src="${ev.snap}" alt="Ảnh hiện trường">` : '<span></span>'}`;
  const log = $('#log');
  log.querySelector('.empty')?.remove();
  log.prepend(li);
  while (log.children.length > 60) log.lastChild.remove();
}

$('#log-clear').addEventListener('click', () => { S.events = []; $('#log').innerHTML = '<li class="empty" style="display:block;background:none">Chưa có sự kiện nào.</li>'; });
$('#log-csv').addEventListener('click', () => {
  if (!S.events.length) return toast('Chưa có sự kiện để xuất.');
  const rows = [['thoi_gian', 'am_thanh', 'do_tin_cay_%', 'muc_on_dB'], ...S.events.map((e) => [e.t.toISOString(), e.vi, e.conf ?? '', Math.round(e.db)])];
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `nhat-ky-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
});

// ---------------------------------------------------------------- Cảnh báo: toast + âm báo + rung + thông báo hệ thống
let beepCtx;
function notify(title, body, tone) {
  toast(`${title} – ${body}`, { tone: tone === 'red' ? 'error' : 'default', ms: 5000 });
  if (!$('#opt-sound').checked) return;
  try {
    beepCtx = beepCtx || new AudioContext();
    const o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.frequency.value = tone === 'red' ? 880 : 660; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, beepCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, beepCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, beepCtx.currentTime + 0.5);
    o.connect(g).connect(beepCtx.destination); o.start(); o.stop(beepCtx.currentTime + 0.5);
  } catch { /* không phát được âm báo */ }
  navigator.vibrate?.(tone === 'red' ? [200, 100, 200] : 120);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body });
}
$('#opt-sound').addEventListener('change', (e) => { if (e.target.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); });

// ---------------------------------------------------------------- Micro / Camera (giống Discord, Teams)
function updatePills() {
  const pm = $('#pill-mic'), pc = $('#pill-cam');
  const micOn = S.running && !S.muted;
  pm.className = `pill ${micOn ? 'on' : 'off'}`;
  pm.lastElementChild.textContent = S.running ? (S.muted ? 'Micro: đang tắt tiếng' : 'Micro: đang bật') : 'Micro: tắt';
  pc.className = `pill ${S.cam ? 'on' : 'off'}`;
  pc.lastElementChild.textContent = S.cam ? 'Camera: đang bật' : 'Camera: tắt';
  const bm = $('#btn-mic');
  bm.classList.toggle('muted', S.running && S.muted);
  bm.innerHTML = `<span class="speaking" id="speaking"></span>${icon(S.running && S.muted ? 'micOff' : 'mic', { size: 22 })}`;
  const bc = $('#btn-cam');
  bc.classList.toggle('active', Boolean(S.cam));
  bc.innerHTML = icon(S.cam ? 'cam' : 'camOff', { size: 22 });
  $('#btn-clip').disabled = !S.cam;
}

$('#btn-mic').addEventListener('click', () => {
  if (!S.running) return;
  S.muted = !S.muted;
  S.mic.setMuted(S.muted);
  if (S.muted) setCenter({ label: 'Micro đang tắt tiếng', sub: 'Bấm nút micro để nghe tiếp.', icon: 'micOff' });
  updatePills();
});

$('#btn-cam').addEventListener('click', async () => {
  if (S.cam) {
    S.cam.getTracks().forEach((t) => t.stop());
    S.cam = null;
    $('#cam-video').hidden = true;
  } else {
    try {
      S.cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
      const v = $('#cam-video');
      v.srcObject = S.cam; v.hidden = false; await v.play();
    } catch (e) {
      toast('Không mở được camera: ' + (e.name === 'NotAllowedError' ? 'bạn chưa cho phép.' : e.message), { tone: 'error' });
    }
  }
  updatePills();
});

function snapshot() {
  const v = $('#cam-video');
  if (!v.videoWidth) return null;
  const c = document.createElement('canvas');
  c.width = 160; c.height = Math.round((160 * v.videoHeight) / v.videoWidth);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

$('#btn-clip').addEventListener('click', () => {
  if (!S.cam) return;
  const btn = $('#btn-clip');
  if (S.rec) { S.rec.stop(); return; }
  const tracks = [...S.cam.getVideoTracks(), ...(S.mic?.stream?.getAudioTracks() || [])];
  const chunks = [];
  S.rec = new MediaRecorder(new MediaStream(tracks));
  S.rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  S.rec.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: S.rec.mimeType || 'video/webm' }));
    a.download = `hien-truong-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    a.click();
    S.rec = null; btn.classList.remove('muted'); $('#clip-label').textContent = 'Quay';
    toast('Đã lưu đoạn video hiện trường', { tone: 'success' });
  };
  S.rec.start();
  btn.classList.add('muted'); $('#clip-label').textContent = 'Dừng quay';
});

// ---------------------------------------------------------------- Phụ đề trực tiếp
$('#btn-cc').addEventListener('click', () => {
  if (!LiveCaptions.supported()) return toast('Trình duyệt này chưa hỗ trợ phụ đề trực tiếp. Hãy dùng Chrome hoặc Edge.', { tone: 'error' });
  if (S.cc) { S.cc.stop(); S.cc = null; $('#btn-cc').classList.remove('active'); $('#cc-card').hidden = true; return; }
  const box = $('#captions');
  let finals = [];
  S.cc = new LiveCaptions({
    lang: $('#cc-lang').value,
    onText: (t) => { box.innerHTML = `${finals.slice(-4).map((f) => `<div>${esc(f)}</div>`).join('')}<div class="interim">${esc(t)}</div>`; },
    onFinal: (t) => { if (t) finals.push(t); box.innerHTML = finals.slice(-5).map((f) => `<div>${esc(f)}</div>`).join(''); },
    onError: (e) => { if (e === 'not-allowed') toast('Bạn chưa cho phép nhận dạng giọng nói.', { tone: 'error' }); },
  });
  S.cc.start();
  $('#btn-cc').classList.add('active');
  $('#cc-card').hidden = false;
});
$('#cc-lang').addEventListener('change', () => { if (S.cc) { $('#btn-cc').click(); $('#btn-cc').click(); } });

// ---------------------------------------------------------------- Phổ tần số
function drawSpec() {
  const c = $('#spec');
  const g = c.getContext('2d');
  const an = S.mic?.analyser;
  if (!an) return;
  const data = new Uint8Array(an.frequencyBinCount);
  const css = getComputedStyle(document.documentElement);
  const frame = () => {
    if (!S.running) { g.clearRect(0, 0, c.width, c.height); return; }
    const dpr = devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    an.getByteFrequencyData(data);
    g.clearRect(0, 0, w, h);
    const tone = $('#stage').dataset.tone;
    const color = css.getPropertyValue(tone === 'gray' ? '--accent' : `--${tone}`).trim() || '#34d8bb';
    const bars = Math.floor(w / 6);
    for (let i = 0; i < bars; i++) {
      const idx = Math.floor(Math.pow(i / bars, 1.8) * data.length * 0.7);
      const v = S.muted ? 0 : data[idx] / 255;
      const bh = Math.max(2, v * h);
      g.fillStyle = color;
      g.globalAlpha = 0.25 + v * 0.7;
      g.fillRect(i * 6, h - bh, 4, bh);
    }
    requestAnimationFrame(frame);
  };
  frame();
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  if (e.key === 'm' || e.key === 'M') $('#btn-mic').click();
  if (e.key === 'c' || e.key === 'C') $('#btn-cam').click();
});
window.addEventListener('beforeunload', () => { S.mic?.stop(); S.cam?.getTracks().forEach((t) => t.stop()); });

$('#live-health').innerHTML = '';
$('#lm-meter').innerHTML = meter(0);
updatePills();
hydrateIcons();
export { toDb };
