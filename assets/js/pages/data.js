// "Âm thanh của tôi": dạy AI nhận âm thanh riêng theo 3 bước (đặt tên → thu 5 lần → thử ngay).
// Mỗi mẫu TỰ LƯU ngay khi thu xong (IndexedDB – mở lại web vẫn còn), web tự chấm chất lượng từng mẫu.

import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { GROUPS, GROUP_BY_ID } from '../categories.js';
import { LiveMic, decodeToMono16k, encodeWav, micErrorMessage, TARGET_SR, captureTabAudio } from '../audio.js';
import { parseYouTube, directUrl, fetchAudio, ytCommand, ytEmbed } from '../linksource.js';
import { rms, dbfs } from '../dsp.js';
import { makeZip } from '../zip.js';
import { analyzeWave, reloadPersonal } from '../classifier.js';
import { putSample, listSamples, deleteSamples, persist, safeName } from '../blobstore.js';
import { keyOf, labelStats } from '../personal.js';
import { supabase, currentUser } from '../auth.js';
import { recordTeach } from '../journey.js';

initLayout();
persist(); // xin trình duyệt không tự xóa kho mẫu

const GOAL = 5, SEC = 3;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const ICONS = ['bell', 'door', 'dog', 'cat', 'bird', 'baby', 'speech', 'horn', 'motorbike', 'car', 'music', 'alarm', 'water', 'fan', 'tv', 'star'];
const slug = (s) => safeName(s).toLowerCase().replace(/[-.]+/g, '_').replace(/^_|_$/g, '') || 'am_thanh';

let myLabels = [];
try { myLabels = JSON.parse(localStorage.getItem('tp.myLabels') || '[]'); } catch { myLabels = []; }
const saveLabels = () => { try { localStorage.setItem('tp.myLabels', JSON.stringify(myLabels)); } catch { /* bỏ qua */ } };

let samples = [];
let target = null; // {key, vi, icon, builtin}
let pickedIcon = 'bell';
const urls = new Map();

// ------------------------------------------------------------------ Bước
function go(n) {
  $$('.t-step').forEach((el) => (el.hidden = el.dataset.step !== String(n)));
  $$('#stepper li').forEach((li) => {
    const k = Number(li.dataset.s);
    li.classList.toggle('on', k === n);
    li.classList.toggle('done', k < n);
  });
  if (n === 2) renderTarget();
  if (n === 3) { $('#test-out').innerHTML = ''; $('#test-status').textContent = 'Bấm để nghe 3 giây'; }
  $('#teach').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('#stepper').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const n = Number(li.dataset.s);
  if (n === 1 || (target && (n === 2 || (n === 3 && mine().length)))) go(n);
});

// ------------------------------------------------------------------ Bước 1: đặt tên
$('#icon-pick').innerHTML = ICONS.map((i) => `<button type="button" role="radio" aria-checked="${i === pickedIcon}" data-i="${i}" title="${i}">${icon(i, { size: 22 })}</button>`).join('');
$('#icon-pick').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  pickedIcon = b.dataset.i;
  $$('#icon-pick [data-i]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
});
$('#name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const vi = $('#nl-name').value.trim();
  if (!vi) { $('#nl-name').focus(); return toast('Hãy đặt tên cho âm thanh, ví dụ "Chuông cửa nhà mình".'); }
  let key = slug(vi);
  if (GROUP_BY_ID[key] || key === 'khac') key = 'toi_' + key;
  let l = myLabels.find((x) => x.key === key);
  if (!l) { l = { key, vi, icon: pickedIcon, teach: true }; myLabels.unshift(l); saveLabels(); }
  $('#nl-name').value = '';
  target = l;
  go(2);
});
function renderKnown() {
  $('#known-wrap').hidden = !myLabels.length;
  $('#known').innerHTML = myLabels.map((l) => `<button type="button" class="chip" data-key="${esc(l.key)}">${icon(l.icon || 'star', { size: 15 })}${esc(l.vi)}<span class="badge">${countOf(l.key)}</span></button>`).join('');
}
$('#known').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (b) { target = myLabels.find((l) => l.key === b.dataset.key); go(2); }
});
$('#t-rename').addEventListener('click', () => go(1));

// ------------------------------------------------------------------ Bước 2: thu 5 lần, tự lưu
const countOf = (key) => samples.filter((s) => s.label === key).length;
const mine = () => samples.filter((s) => target && s.label === target.key);
const goal = () => (target?.builtin ? 30 : GOAL);

function renderTarget() {
  if (!target) return;
  $('#t-ic').innerHTML = icon(target.icon || 'star', { size: 24 });
  $('#t-name').textContent = target.vi;
  const n = mine().length, g = goal();
  $('#dots').innerHTML = Array.from({ length: Math.max(g <= 10 ? g : 5, Math.min(n + 1, 10)) }, (_, i) => `<i class="${i < n ? 'on' : i === n ? 'next' : ''}"></i>`).join('') + (g > 10 ? `<span class="mono muted">${n}/${g}</span>` : '');
  if (!recording) $('#rec-status').innerHTML = n >= g ? `<b>Đã đủ ${g} mẫu.</b> Bấm "Xong, thử ngay" hoặc thu thêm cho chắc.` : `Mẫu <b>${n + 1}/${g}</b> · bấm nút rồi phát âm thanh gần micro`;
  $('#to-test').disabled = n < 1 || target.builtin;
  $('#t-count').textContent = n ? `${n} mẫu đã lưu` : '';
  $('#to-test').textContent = n < 3 && !target.builtin ? `Xong, thử ngay (nên có ít nhất 3 mẫu)` : 'Xong, thử ngay';
  // danh sách mẫu của âm thanh này + chấm chất lượng
  const xs = mine();
  const st = labelStats(xs.filter((s) => s.emb).map((s) => s.emb));
  const withEmb = xs.filter((s) => s.emb);
  $('#t-samples').innerHTML = xs.length ? xs.map((s, i) => {
    const k = withEmb.indexOf(s);
    const odd = st.n >= 3 && k >= 0 && st.each[k] < st.mean - 0.12;
    return `<div class="t-sample${odd ? ' odd' : ''}" data-id="${s.id}">
      <button class="icon-btn" data-act="play" type="button" aria-label="Nghe mẫu ${xs.length - i}">${icon('play', { size: 16 })}</button>
      <span>Mẫu ${xs.length - i}</span>
      <span class="q ${s.level < -40 ? 'weak' : 'good'}">${s.level < -40 ? 'hơi nhỏ' : odd ? 'khác các mẫu còn lại' : 'tốt'}</span>
      <button class="icon-btn" data-act="del" type="button" aria-label="Xóa mẫu">${icon('trash', { size: 15 })}</button>
    </div>`;
  }).join('') : '';
}

$('#t-samples').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const s = samples.find((x) => x.id === b.closest('[data-id]').dataset.id);
  if (!s) return;
  if (b.dataset.act === 'play') playSample(s);
  else { await deleteSamples(s.id); await afterChange(); }
});

function playSample(s) {
  if (!urls.has(s.id)) urls.set(s.id, URL.createObjectURL(s.blob));
  const a = new Audio(urls.get(s.id));
  a.play().catch(() => {});
}

let recording = false, mic = null, stopAll = false;
const ring = (el, p) => { el.style.strokeDashoffset = String(339.3 * (1 - p)); };

async function recordOne() {
  const fg = $('#rr-fg');
  // đếm ngược để kịp phát âm thanh
  for (let i = 2; i > 0 && !stopAll; i--) { $('#rec-status').innerHTML = `Chuẩn bị… <b>${i}</b>`; await new Promise((r) => setTimeout(r, 700)); }
  if (stopAll) return null;
  $('#rec-status').innerHTML = '<span class="rec-dot"></span> Đang thu… phát âm thanh ngay bây giờ';
  $('#teach').classList.add('is-rec');
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const p = (performance.now() - t0) / (SEC * 1000);
      ring(fg, Math.min(1, p));
      if (p >= 1 || stopAll) resolve(); else requestAnimationFrame(tick);
    };
    tick();
  });
  $('#teach').classList.remove('is-rec');
  ring(fg, 0);
  return stopAll ? null : mic.latest(SEC);
}

async function startRecording() {
  if (!target) return go(1);
  mic = new LiveMic({ seconds: SEC + 1, onBlock: (db) => { $('#level').style.width = `${Math.max(0, Math.min(100, (db - 20) * 1.4))}%`; } });
  try { await mic.start(); } catch (e) { mic = null; return toast(micErrorMessage(e), { tone: 'error', ms: 7000 }); }
  recording = true; stopAll = false;
  $('#rr-core').innerHTML = icon('stop', { size: 34 });
  $('#rec').classList.add('active');
  try {
    do {
      const wave = await recordOne();
      if (!wave) break;
      const ok = await saveSample(wave, 'mic');
      if (!ok) { $('#rec-status').innerHTML = '<b>Quá nhỏ, chưa lưu.</b> Đưa micro gần nguồn âm hơn rồi thu lại.'; await new Promise((r) => setTimeout(r, 1400)); }
      if (!$('#auto').checked) break;
    } while (!stopAll && mine().length < goal());
  } finally {
    recording = false;
    mic?.stop(); mic = null;
    $('#rr-core').innerHTML = icon('mic', { size: 38 });
    $('#rec').classList.remove('active');
    $('#level').style.width = '0%';
    renderTarget();
    if (!target?.builtin && mine().length >= GOAL && !stopAll) { toast(`Xong ${GOAL} mẫu! Giờ thử xem AI đã nhận ra chưa.`, { tone: 'success' }); setTimeout(() => go(3), 900); }
  }
}
$('#rec').addEventListener('click', () => { if (recording) stopAll = true; else startRecording(); });

/** Lưu ngay một mẫu (kèm "dấu vân tay" YAMNet để AI so khớp). */
async function saveSample(wave, source) {
  const level = dbfs(rms(wave));
  if (level < -55) return false;
  const s = { id: uid(), ts: Date.now(), label: target.key, labelVi: target.vi, icon: target.icon, teach: !target.builtin, blob: encodeWav(wave), dur: wave.length / TARGET_SR, level, source, uploaded: false };
  $('#rec-status').innerHTML = 'Đang lưu và cho AI học…';
  try {
    const { result, meta } = await analyzeWave(wave, { useDenoise: false });
    s.emb = meta.embedding ? Array.from(meta.embedding) : null;
    s.pred = result.top ? `${result.top.vi} ${result.top.conf}%` : '';
  } catch (e) { console.warn(e); }
  await putSample(s);
  if (s.teach) recordTeach();
  await afterChange();
  $('#rec-status').innerHTML = `<b>Đã lưu mẫu ${mine().length}.</b>`;
  return true;
}

// ------------------------------------------------------------------ Nguồn mẫu: ghi âm / file / link
$$('#src-tabs [data-src]').forEach((b) => b.addEventListener('click', () => {
  $$('#src-tabs [data-src]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $$('.src-pane').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.src));
}));

/**
 * Tìm các đoạn 3 giây CÓ ÂM THANH RÕ trong một bản ghi dài: trượt cửa sổ, tính độ to,
 * lấy những đoạn to hơn hẳn nền, không chồng lên nhau, to nhất trước.
 */
export function pickSegments(wave, sr = TARGET_SR, sec = SEC, max = 20) {
  const win = Math.round(sec * sr), hop = Math.round(win / 2);
  if (wave.length <= win) return dbfs(rms(wave)) > -55 ? [wave] : [];
  const cand = [];
  for (let a = 0; a + win <= wave.length; a += hop) cand.push({ a, db: dbfs(rms(wave, a, a + win)) });
  const sorted = [...cand].map((c) => c.db).sort((x, y) => x - y);
  const floor = sorted[Math.floor(sorted.length * 0.2)];
  const top = sorted[sorted.length - 1];
  // nhận đoạn to hơn nền rõ rệt HOẶC gần bằng đoạn to nhất (file toàn là âm thanh cần dạy)
  const need = sorted.length > 4 ? Math.min(floor + 6, top - 8) : -50;
  const out = [];
  for (const c of [...cand].sort((x, y) => y.db - x.db)) {
    if (out.length >= max || c.db < -50 || c.db < need) break;
    if (out.some((o) => Math.abs(o.a - c.a) < win)) continue;
    out.push(c);
  }
  return out.sort((x, y) => x.a - y.a).map((c) => wave.slice(c.a, c.a + win));
}

function progress(html) { const el = $('#src-progress'); el.hidden = !html; el.innerHTML = html || ''; }

async function importWave(wave, name) {
  const segs = pickSegments(wave);
  if (!segs.length) { toast(`${name}: không tìm thấy đoạn nào có âm thanh rõ.`, { tone: 'error' }); return 0; }
  let n = 0;
  for (const seg of segs) {
    progress(`<span class="rec-dot"></span> ${esc(name)}: đang lưu mẫu ${n + 1}/${segs.length}…`);
    if (await saveSample(seg, 'file')) n++;
  }
  return n;
}

async function importBlobs(list) {
  if (!target) return;
  let total = 0;
  for (const { blob, name } of list) {
    try {
      progress(`<span class="rec-dot"></span> Đang đọc ${esc(name)}…`);
      const { wave } = await decodeToMono16k(blob);
      total += await importWave(wave, name);
    } catch (err) { toast(`${name}: ${err.message}`, { tone: 'error', ms: 7000 }); }
  }
  progress('');
  renderTarget();
  if (total) toast(`Đã thêm ${total} mẫu. Nghe lại bên dưới, mẫu nào sai thì xóa.`, { tone: 'success', ms: 5000 });
  if (!target.builtin && mine().length >= GOAL) setTimeout(() => go(3), 1200);
  return total;
}

$('#t-files').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  await importBlobs(files.map((f) => ({ blob: f, name: f.name })));
});
const drop = $('#t-drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('drag')));
drop.addEventListener('drop', (e) => { e.preventDefault(); importBlobs([...e.dataTransfer.files].map((f) => ({ blob: f, name: f.name }))); });

let ytInfo = null;
$('#t-link-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = $('#t-link').value.trim();
  let url;
  try { url = new URL(raw); } catch { return toast('Link chưa đúng, phải bắt đầu bằng http:// hoặc https://', { tone: 'error' }); }
  const yt = parseYouTube(url.href);
  $('#t-yt').hidden = !yt; $('#t-link-note').hidden = !!yt;
  if (yt) {
    ytInfo = yt;
    $('#t-yt-frame').src = ytEmbed(yt);
    if (!navigator.mediaDevices?.getDisplayMedia) toast('Điện thoại không nghe được âm thanh từ video YouTube. Hãy dùng Chrome/Edge trên máy tính, hoặc tải file về rồi chọn "File âm thanh / video".', { tone: 'error', ms: 8000 });
    return;
  }
  const btn = $('#t-link-btn'); btn.disabled = true;
  try {
    progress('<span class="rec-dot"></span> Đang tải âm thanh từ link…');
    const blob = await fetchAudio(directUrl(url.href));
    await importBlobs([{ blob, name: decodeURIComponent(url.pathname.split('/').pop() || url.hostname) }]);
  } catch (err) { progress(''); toast(err.message, { tone: 'error', ms: 8000 }); }
  btn.disabled = false;
});

$('#t-yt-go').addEventListener('click', async () => {
  if (!ytInfo) return;
  const sec = Number($('#t-yt-sec').value), btn = $('#t-yt-go'), frame = $('#t-yt-frame');
  btn.disabled = true;
  try {
    const blob = await captureTabAudio(sec, {
      onStart: () => ytCommand(frame, 'playVideo'),
      onTick: (left) => progress(`<span class="rec-dot"></span> Đang nghe âm thanh video… còn ${Math.ceil(left)} giây`),
    });
    ytCommand(frame, 'pauseVideo');
    await importBlobs([{ blob, name: `YouTube ${ytInfo.id}` }]);
  } catch (err) { progress(''); toast(err.message, { tone: 'error', ms: 8000 }); }
  btn.disabled = false;
});

$('#to-test').addEventListener('click', () => go(3));

// ------------------------------------------------------------------ Bước 3: thử ngay
$('#test').addEventListener('click', async () => {
  const btn = $('#test');
  if (btn.classList.contains('active')) return;
  const m = new LiveMic({ seconds: 4 });
  try { await m.start(); } catch (e) { return toast(micErrorMessage(e), { tone: 'error' }); }
  btn.classList.add('active');
  const fg = $('#rt-fg');
  for (let i = 2; i > 0; i--) { $('#test-status').innerHTML = `Chuẩn bị… <b>${i}</b>`; await new Promise((r) => setTimeout(r, 700)); }
  $('#test-status').innerHTML = '<span class="rec-dot"></span> Đang nghe…';
  const t0 = performance.now();
  await new Promise((res) => { const tick = () => { const p = (performance.now() - t0) / 3000; ring(fg, Math.min(1, p)); if (p >= 1) res(); else requestAnimationFrame(tick); }; tick(); });
  const wave = m.latest(3); m.stop(); ring(fg, 0);
  await showTest(wave);
  btn.classList.remove('active');
});

/** So khớp một đoạn âm thanh với các âm thanh đã dạy và hiện kết quả. */
async function showTest(wave) {
  const btn = $('#test');
  $('#test-status').textContent = 'Đang so sánh…';
  try {
    await reloadPersonal();
    const { result, meta } = await analyzeWave(wave, { useDenoise: false });
    const p = meta.personal;
    const isTarget = p && target && p.id === keyOf(target.key);
    $('#test-out').innerHTML = p
      ? `<div class="test-hit${isTarget ? '' : ' other'}">${icon(p.icon || 'star', { size: 32 })}<div><small>${isTarget ? 'AI nhận ra rồi!' : 'AI nghe giống'}</small><b>${esc(p.vi)}</b></div><span class="mono">${Math.round(p.prob * 100)}%</span></div>`
      : `<div class="test-miss">${icon('info', { size: 22 })}<div><b>AI chưa nhận ra âm thanh riêng nào.</b><small>Mô hình chung nghe ra: ${esc(result.top ? `${result.top.vi} (${result.top.conf}%)` : 'không rõ')}. Nếu vừa phát đúng âm thanh đã dạy, hãy bấm "Thu thêm mẫu" ở đúng chỗ đó.</small></div></div>`;
    if (isTarget) btn.closest('.t-step').classList.add('celebrate');
    setTimeout(() => btn.closest('.t-step').classList.remove('celebrate'), 1500);
  } catch (e) { $('#test-out').innerHTML = `<div class="test-miss">${esc(e.message)}</div>`; }
  $('#test-status').textContent = 'Bấm để thử lại';
}
$('#test-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    $('#test-status').textContent = `Đang đọc ${f.name}…`;
    const { wave } = await decodeToMono16k(f);
    await showTest(wave.length > 30 * TARGET_SR ? wave.subarray(0, 30 * TARGET_SR) : wave);
  } catch (err) { toast(`${f.name}: ${err.message}`, { tone: 'error' }); }
});
$('#more').addEventListener('click', () => go(2));
$('#another').addEventListener('click', () => { target = null; go(1); $('#nl-name').focus(); });

// ------------------------------------------------------------------ Những âm thanh AI đã học
function renderLearned() {
  const keys = [...new Set(samples.map((s) => s.label))];
  const own = keys.filter((k) => myLabels.some((l) => l.key === k));
  $('#n-learned').textContent = own.length;
  if (!own.length) {
    $('#learned').innerHTML = `<div class="empty">${icon('sparkles', { size: 30 })}Chưa có âm thanh nào. Làm theo 3 bước ở trên, chỉ mất khoảng 1 phút.</div>`;
  } else {
    $('#learned').innerHTML = own.map((k) => {
      const l = myLabels.find((x) => x.key === k);
      const xs = samples.filter((s) => s.label === k);
      const st = labelStats(xs.filter((s) => s.emb).map((s) => s.emb));
      // "Độ nhớ": đủ mẫu + các mẫu giống nhau
      const strength = Math.round(100 * Math.min(1, xs.length / GOAL) * (st.n >= 2 ? Math.max(0.4, Math.min(1, (st.mean - 0.5) / 0.4)) : 0.6));
      const on = xs.some((s) => s.teach);
      return `<article class="learn-card${on ? '' : ' off'}" data-key="${esc(k)}">
        <span class="lc-ic">${icon(l.icon || 'star', { size: 24 })}</span>
        <div class="lc-main"><b>${esc(l.vi)}</b><small>${xs.length} mẫu · ${on ? 'AI đang nhận' : 'đang tắt'}</small>
          <div class="lc-bar" title="Độ nhớ ${strength}%"><i style="width:${strength}%"></i></div><small class="lc-hint">Độ nhớ ${strength}%${strength < 70 ? ' · thu thêm vài mẫu để AI nhớ chắc hơn' : ''}</small></div>
        <div class="lc-acts">
          <button class="btn btn-sm" data-act="add" type="button">${icon('mic', { size: 15 })}Thu thêm</button>
          <button class="btn btn-sm btn-ghost" data-act="test" type="button">${icon('ear', { size: 15 })}Thử</button>
          <button class="icon-btn" data-act="toggle" type="button" title="${on ? 'Tạm tắt nhận âm thanh này' : 'Bật lại'}" aria-label="Bật/tắt">${icon(on ? 'check' : 'x', { size: 17 })}</button>
          <button class="icon-btn" data-act="remove" type="button" title="Xóa âm thanh này" aria-label="Xóa">${icon('trash', { size: 17 })}</button>
        </div></article>`;
    }).join('');
  }
  const total = samples.reduce((n, s) => n + (s.blob?.size || 0), 0) / 1048576;
  $('#d-storage').textContent = samples.length ? `${samples.length} mẫu · ${total.toFixed(1)} MB · tự lưu trên trình duyệt này, đóng web mở lại vẫn còn.` : '';
  $('#d-zip').disabled = !samples.length;
}

$('#learned').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const key = b.closest('[data-key]').dataset.key;
  const l = myLabels.find((x) => x.key === key);
  const act = b.dataset.act;
  if (act === 'add') { target = l; go(2); }
  else if (act === 'test') { target = l; go(3); }
  else if (act === 'toggle') {
    const xs = samples.filter((s) => s.label === key);
    const on = !xs.some((s) => s.teach);
    for (const s of xs) { s.teach = on; await putSample(s); }
    await afterChange();
    toast(on ? `Đã bật lại "${l.vi}".` : `Đã tạm tắt "${l.vi}". AI sẽ không báo âm thanh này.`);
  } else if (act === 'remove') {
    if (!confirm(`Xóa "${l.vi}" và toàn bộ mẫu của nó?`)) return;
    await deleteSamples(samples.filter((s) => s.label === key).map((s) => s.id));
    myLabels = myLabels.filter((x) => x.key !== key); saveLabels();
    if (target?.key === key) target = null;
    await afterChange();
  }
});

async function afterChange() {
  samples = await listSamples();
  await reloadPersonal().catch(() => {});
  renderLearned(); renderKnown(); renderTarget();
}

// ------------------------------------------------------------------ Nhóm phát triển
$('#label-select').innerHTML = GROUPS.filter((g) => g.id !== 'noise' && g.id !== 'silence')
  .map((g) => `<option value="${g.id}">${esc(g.vi)} (${g.id})</option>`).join('') + '<option value="khac">Tiếng nền / không có gì đặc biệt (khac)</option>';
const pickGroup = () => { const id = $('#label-select').value, g = GROUP_BY_ID[id]; return { key: id, vi: g ? g.vi : 'Tiếng nền (khác)', icon: g?.icon || 'noise', builtin: true }; };
$('#group-rec').addEventListener('click', () => { target = pickGroup(); $('#auto').checked = true; go(2); });

const fileName = (s) => { const d = new Date(s.ts); return `${s.label}_${d.toISOString().replace(/[-:T]/g, '').slice(0, 15)}_${s.id.slice(0, 4)}.wav`; };
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#d-zip').addEventListener('click', async () => {
  const files = [];
  for (const s of samples) files.push({ name: `${s.label}/${fileName(s)}`, data: new Uint8Array(await s.blob.arrayBuffer()) });
  files.push({ name: 'DOC_TOI.txt', data: new TextEncoder().encode(`Gói mẫu Urban Sound – ${new Date().toLocaleString('vi-VN')}\nGiải nén vào training/data/my_sounds/ (mỗi thư mục là một nhãn). WAV mono 16 kHz.\n`) });
  saveBlob(makeZip(files), `mau-am-thanh-${new Date().toISOString().slice(0, 10)}.zip`);
});
$('#d-upload').addEventListener('click', async () => {
  const u = await currentUser().catch(() => null);
  if (!u || u.demo) return toast('Hãy đăng nhập để gửi mẫu lên kho chung của nhóm.', { tone: 'error' });
  const sb = await supabase();
  const xs = samples.filter((s) => !s.uploaded);
  if (!xs.length) return toast('Các mẫu đều đã được gửi.');
  const btn = $('#d-upload'); btn.disabled = true;
  let ok = 0;
  for (const s of xs) {
    const { error } = await sb.storage.from('samples').upload(`${u.id}/${s.label}/${fileName(s)}`, s.blob, { contentType: 'audio/wav', upsert: true });
    if (error) { toast(/bucket/i.test(error.message) ? 'Kho chung chưa được tạo: chạy supabase/samples.sql trong Supabase.' : `Lỗi gửi: ${error.message}`, { tone: 'error', ms: 8000 }); break; }
    s.uploaded = true; await putSample(s); ok++;
  }
  btn.disabled = false;
  if (ok) toast(`Đã gửi ${ok} mẫu lên kho chung.`, { tone: 'success' });
});
try { $('#dev-box').open = localStorage.getItem('tp.devmode') === '1'; } catch { /* bỏ qua */ }
$('#dev-box').addEventListener('toggle', (e) => { try { localStorage.setItem('tp.devmode', e.target.open ? '1' : '0'); } catch { /* bỏ qua */ } });

// ------------------------------------------------------------------ Khởi động
const pre = new URLSearchParams(location.search).get('label');
afterChange().then(() => {
  if (pre && (GROUP_BY_ID[pre] || pre === 'khac')) { // đến từ "Kết quả sai? Góp mẫu đúng"
    $('#dev-box').open = true; $('#label-select').value = pre; target = pickGroup(); go(2);
  }
});
hydrateIcons();
