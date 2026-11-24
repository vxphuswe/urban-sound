// Trang "Âm thanh của tôi": thu/lưu mẫu (IndexedDB, còn nguyên khi mở lại web), dạy AI nhận âm thanh riêng,
// nghe lại – đổi nhãn – tải về – gửi lên kho chung (Supabase Storage) để nhóm train thêm.

import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { GROUPS, GROUP_BY_ID } from '../categories.js';
import { LiveMic, decodeToMono16k, encodeWav, micErrorMessage, TARGET_SR } from '../audio.js';
import { rms, dbfs } from '../dsp.js';
import { makeZip } from '../zip.js';
import { analyzeWave, reloadPersonal } from '../classifier.js';
import { putSample, listSamples, deleteSamples, storageInfo, persist, safeName } from '../blobstore.js';
import { keyOf } from '../personal.js';
import { supabase, currentUser } from '../auth.js';
import { recordTeach } from '../journey.js';

initLayout();
persist(); // xin trình duyệt không tự xóa kho mẫu

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const ICONS = ['star', 'bell', 'door', 'dog', 'cat', 'bird', 'baby', 'speech', 'horn', 'motorbike', 'car', 'music', 'alarm', 'water', 'fan', 'keyboard', 'tv', 'steps'];
const ICON_VI = { star: 'Ngôi sao', bell: 'Chuông', door: 'Cửa', dog: 'Chó', cat: 'Mèo', bird: 'Chim', baby: 'Em bé', speech: 'Giọng nói', horn: 'Còi', motorbike: 'Xe máy', car: 'Ô tô', music: 'Nhạc', alarm: 'Báo thức', water: 'Nước', fan: 'Quạt', keyboard: 'Bàn phím', tv: 'TV', steps: 'Bước chân' };

// ------------------------------------------------------------------ Nhãn
const slug = (s) => safeName(s).toLowerCase().replace(/[-.]+/g, '_').replace(/^_|_$/g, '') || 'am_thanh';
let myLabels = [];
try { myLabels = JSON.parse(localStorage.getItem('tp.myLabels') || '[]'); } catch { myLabels = []; }
const saveLabels = () => { try { localStorage.setItem('tp.myLabels', JSON.stringify(myLabels)); } catch { /* bỏ qua */ } };

let mode = 'mine';
let current = null; // {key, vi, icon, builtin}

$('#nl-icon').innerHTML = ICONS.map((i) => `<option value="${i}">${ICON_VI[i] || i}</option>`).join('');
$('#label-select').innerHTML = GROUPS.filter((g) => g.id !== 'noise' && g.id !== 'silence')
  .map((g) => `<option value="${g.id}">${esc(g.vi)} (${g.id})</option>`).join('') + '<option value="khac">Tiếng nền / không có gì đặc biệt (khac)</option>';

function renderMyLabels() {
  const counts = countByLabel();
  $('#my-labels').innerHTML = myLabels.length
    ? myLabels.map((l) => `<button type="button" class="chip lbl-chip${current?.key === l.key ? ' on' : ''}" data-key="${esc(l.key)}">${icon(l.icon || 'star', { size: 15 })}${esc(l.vi)}<span class="badge">${counts[l.key] || 0}</span><span class="x" data-rm="${esc(l.key)}" title="Xóa nhãn" aria-label="Xóa nhãn ${esc(l.vi)}">×</span></button>`).join('')
    : '<span class="muted" style="font-size:.9rem">Chưa có âm thanh riêng nào. Đặt tên ở ô bên dưới để bắt đầu.</span>';
}

function select(l) {
  current = l;
  $('#opt-teach').checked = l ? (l.teach ?? !l.builtin) : false;
  $('#label-now').innerHTML = l
    ? `<span class="dot tone-blue tone-bg">${icon(l.icon || 'star', { size: 18 })}</span><div><small>Đang thu cho</small><b>${esc(l.vi)}</b> <span class="mono muted">(${esc(l.key)})</span></div>`
    : '<div class="muted">Hãy chọn hoặc tạo một âm thanh trước khi thu.</div>';
  renderMyLabels();
}

$('#my-labels').addEventListener('click', async (e) => {
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    e.stopPropagation();
    const key = rm.dataset.rm;
    const n = countByLabel()[key] || 0;
    if (!confirm(n ? `Xóa nhãn này và ${n} mẫu của nó?` : 'Xóa nhãn này?')) return;
    await deleteSamples(samples.filter((s) => s.label === key).map((s) => s.id));
    myLabels = myLabels.filter((l) => l.key !== key); saveLabels();
    if (current?.key === key) select(myLabels[0] || null);
    await refresh();
    return;
  }
  const b = e.target.closest('[data-key]');
  if (b) select(myLabels.find((l) => l.key === b.dataset.key));
});

$('#new-label').addEventListener('submit', (e) => {
  e.preventDefault();
  const vi = $('#nl-name').value.trim();
  if (!vi) return $('#nl-name').focus();
  let key = slug(vi);
  if (GROUP_BY_ID[key] || key === 'khac') key = 'toi_' + key;
  const exist = myLabels.find((l) => l.key === key);
  const l = exist || { key, vi, icon: $('#nl-icon').value, teach: true };
  if (!exist) { myLabels.unshift(l); saveLabels(); }
  $('#nl-name').value = '';
  select(l);
  toast(`Đã tạo “${vi}”. Giờ bấm nút micro để thu 3–5 mẫu.`, { tone: 'success' });
});

$$('#label-mode [data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  $$('#label-mode [data-mode]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $('#mode-mine').hidden = mode !== 'mine';
  $('#mode-group').hidden = mode !== 'group';
  if (mode === 'group') pickGroup(); else select(myLabels[0] || null);
}));
function pickGroup() {
  const id = $('#label-select').value;
  const g = GROUP_BY_ID[id];
  select({ key: id, vi: g ? g.vi : 'Tiếng nền (khác)', icon: g?.icon || 'noise', builtin: true, teach: false });
}
$('#label-select').addEventListener('change', pickGroup);
$('#opt-teach').addEventListener('change', () => { if (current) current.teach = $('#opt-teach').checked; if (!current?.builtin) saveLabels(); });

// ------------------------------------------------------------------ Kho mẫu
let samples = [];
let filter = '';
const urls = new Map();
const countByLabel = () => samples.reduce((m, s) => ((m[s.label] = (m[s.label] || 0) + 1), m), {});
const labelInfo = (key) => myLabels.find((l) => l.key === key) || (GROUP_BY_ID[key] ? { key, vi: GROUP_BY_ID[key].vi, icon: GROUP_BY_ID[key].icon, builtin: true } : { key, vi: key === 'khac' ? 'Tiếng nền (khác)' : key, icon: 'star' });

async function refresh() {
  samples = await listSamples();
  render();
  renderMyLabels();
  const st = await storageInfo();
  const total = samples.reduce((n, s) => n + (s.blob?.size || 0), 0) / 1048576;
  $('#d-storage').textContent = `${samples.length} mẫu · ${total.toFixed(1)} MB` + (st ? ` · trình duyệt cho phép dùng tối đa ~${Math.round(st.quotaMB / 1024 * 10) / 10} GB` : '') + '. Mẫu nằm trên máy này; muốn chuyển máy khác hãy tải .zip.';
}

function shown() { return filter ? samples.filter((s) => s.label === filter) : samples; }

function render() {
  const counts = countByLabel();
  $('#d-count').textContent = samples.length;
  $('#d-zip').disabled = !shown().length;
  const keys = Object.keys(counts);
  $('#lib-labels').innerHTML = keys.length ? `<button type="button" class="lib-lbl${!filter ? ' on' : ''}" data-f="">Tất cả <b>${samples.length}</b></button>` + keys.map((k) => {
    const L = labelInfo(k), n = counts[k];
    const teach = samples.some((s) => s.label === k && s.teach);
    const goal = teach ? 5 : 30;
    return `<button type="button" class="lib-lbl${filter === k ? ' on' : ''}" data-f="${esc(k)}">${icon(L.icon || 'star', { size: 15 })}<span>${esc(L.vi)}</span><b>${n}</b>
      <span class="lib-prog" title="${teach ? `Dạy AI: nên có ${goal} mẫu` : `Đóng góp train: nên có ${goal} mẫu`}"><i style="width:${Math.min(100, (n / goal) * 100)}%"></i></span></button>`;
  }).join('') : '';
  const xs = shown();
  if (!xs.length) { $('#d-list').innerHTML = `<div class="empty">${icon('mic', { size: 30 })}Chưa có mẫu nào. Chọn âm thanh ở bước 1 rồi bấm nút micro.</div>`; return; }
  const opts = (sel) => [...myLabels.map((l) => [l.key, l.vi]), ...GROUPS.filter((g) => g.id !== 'noise' && g.id !== 'silence').map((g) => [g.id, g.vi]), ['khac', 'Tiếng nền (khác)']]
    .map(([k, v]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  $('#d-list').innerHTML = xs.map((s) => {
    const L = labelInfo(s.label);
    return `<div class="lib-item" data-id="${s.id}">
      <button class="icon-btn lib-play" data-act="play" type="button" aria-label="Nghe">${icon('play', { size: 18 })}</button>
      <div class="lib-main">
        <div class="lib-top"><b>${esc(L.vi)}</b><span class="mono muted">${(s.dur || 0).toFixed(1)}s · ${new Date(s.ts).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
        <div class="lib-tags">
          ${s.pred ? `<span class="badge ${s.match ? 'tone-green tone-bg' : ''}" title="Mô hình chung nghe ra">AI: ${esc(s.pred)}</span>` : ''}
          ${s.teach ? `<span class="badge tone-blue tone-bg">${icon('sparkles', { size: 12 })} Đang dạy AI</span>` : ''}
          ${s.uploaded ? `<span class="badge">${icon('check', { size: 12 })} Đã gửi kho chung</span>` : ''}
        </div>
        <div class="lib-audio" hidden></div>
      </div>
      <div class="lib-acts">
        <select class="select select-sm" data-act="relabel" aria-label="Đổi nhãn">${opts(s.label)}</select>
        <button class="icon-btn${s.teach ? ' on' : ''}" data-act="teach" type="button" title="${s.teach ? 'Đang dạy AI – bấm để thôi' : 'Dùng mẫu này để dạy AI'}" aria-label="Dạy AI">${icon('sparkles', { size: 17 })}</button>
        <button class="icon-btn" data-act="dl" type="button" title="Tải mẫu" aria-label="Tải mẫu">${icon('download', { size: 17 })}</button>
        <button class="icon-btn" data-act="del" type="button" title="Xóa mẫu" aria-label="Xóa mẫu">${icon('trash', { size: 17 })}</button>
      </div></div>`;
  }).join('');
}

$('#lib-labels').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });

$('#d-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'SELECT') return;
  const row = b.closest('[data-id]');
  const s = samples.find((x) => x.id === row.dataset.id);
  if (!s) return;
  const act = b.dataset.act;
  if (act === 'play') {
    const box = row.querySelector('.lib-audio');
    if (!box.hidden) { box.querySelector('audio')?.pause(); box.hidden = true; b.innerHTML = icon('play', { size: 18 }); return; }
    if (!urls.has(s.id)) urls.set(s.id, URL.createObjectURL(s.blob));
    box.innerHTML = `<audio controls autoplay src="${urls.get(s.id)}"></audio>`;
    box.hidden = false; b.innerHTML = icon('pause', { size: 18 });
    box.querySelector('audio').addEventListener('ended', () => { b.innerHTML = icon('play', { size: 18 }); });
  } else if (act === 'dl') {
    saveBlob(s.blob, fileName(s));
  } else if (act === 'del') {
    await deleteSamples(s.id);
    await reloadPersonal().catch(() => {});
    await refresh();
  } else if (act === 'teach') {
    s.teach = !s.teach;
    await putSample(s);
    await reloadPersonal().catch(() => {});
    render();
    toast(s.teach ? 'Mẫu này sẽ được dùng để dạy AI.' : 'Đã thôi dùng mẫu này để dạy AI.');
  }
});
$('#d-list').addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-act="relabel"]');
  if (!sel) return;
  const s = samples.find((x) => x.id === sel.closest('[data-id]').dataset.id);
  const L = labelInfo(sel.value);
  Object.assign(s, { label: L.key, labelVi: L.vi, icon: L.icon, uploaded: false });
  await putSample(s);
  await reloadPersonal().catch(() => {});
  await refresh();
  toast(`Đã đổi nhãn thành “${L.vi}”.`);
});

function fileName(s) {
  const d = new Date(s.ts);
  const st = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `${s.label}_${st}_${s.id.slice(0, 4)}.wav`;
}
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ------------------------------------------------------------------ Thêm mẫu (lưu ngay + AI nghe thử)
async function addClip(wave, source = 'mic') {
  if (!current) { toast('Hãy chọn hoặc tạo âm thanh ở bước 1 trước.', { tone: 'error' }); return false; }
  const level = dbfs(rms(wave));
  if (current.key !== 'khac' && level < -55) return false;
  const s = {
    id: uid(), ts: Date.now(), label: current.key, labelVi: current.vi, icon: current.icon, teach: $('#opt-teach').checked,
    blob: encodeWav(wave), dur: wave.length / TARGET_SR, level, source, pred: '…', uploaded: false,
  };
  await putSample(s);
  await refresh();
  try {
    const { result, meta } = await analyzeWave(wave, { useDenoise: false });
    s.emb = meta.embedding ? Array.from(meta.embedding) : null;
    s.pred = result.top ? `${result.top.vi} ${result.top.conf}%` : 'chưa nhận ra';
    s.match = !!result.top && (result.top.id === s.label || (meta.personal && meta.personal.id === keyOf(s.label)));
    await putSample(s);
    if (s.teach) { await reloadPersonal().catch(() => {}); recordTeach(); }
  } catch (e) { s.pred = ''; await putSample(s); console.warn(e); }
  await refresh();
  return true;
}

// ------------------------------------------------------------------ Ghi âm
let mic = null, timer = null, startAt = 0, lastCut = 0;
function stopRec() { clearInterval(timer); mic?.stop(); mic = null; $('#d-rec').classList.remove('recording'); $('#d-meter').style.width = '0%'; }
$('#d-rec').addEventListener('click', async () => {
  if (mic) return stopRec();
  if (!current) return toast('Hãy chọn hoặc tạo âm thanh ở bước 1 trước.', { tone: 'error' });
  const len = Number($('#d-len').value);
  mic = new LiveMic({ seconds: len + 1, onBlock: (db) => { $('#d-meter').style.width = `${Math.max(0, Math.min(100, db))}%`; } });
  try { await mic.start(); } catch (e) { mic = null; return toast(micErrorMessage(e), { tone: 'error' }); }
  $('#d-rec').classList.add('recording');
  startAt = performance.now(); lastCut = startAt;
  timer = setInterval(async () => {
    const now = performance.now();
    const sec = (now - startAt) / 1000;
    $('#d-time').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    if (now - lastCut >= len * 1000) {
      lastCut = now;
      const wave = mic.latest(len);
      if (!$('#d-continuous').checked) stopRec();
      const ok = await addClip(wave, 'mic');
      if (!ok) toast('Đoạn vừa rồi quá yên lặng nên đã bỏ qua.');
      else if (!$('#d-continuous').checked) toast('Đã lưu một mẫu – AI đang nghe thử.', { tone: 'success' });
    }
  }, 100);
});

$('#d-files').addEventListener('change', async (e) => {
  if (!current) { e.target.value = ''; return toast('Hãy chọn hoặc tạo âm thanh ở bước 1 trước.', { tone: 'error' }); }
  const len = Number($('#d-len').value) * TARGET_SR;
  let n = 0;
  for (const f of e.target.files) {
    try {
      const { wave } = await decodeToMono16k(f);
      for (let a = 0; a < wave.length && n < 200; a += len) {
        const seg = wave.slice(a, Math.min(wave.length, a + len));
        if (seg.length >= TARGET_SR && await addClip(seg, 'file')) n++;
      }
    } catch (err) { toast(`${f.name}: ${err.message}`, { tone: 'error' }); }
  }
  toast(`Đã thêm ${n} mẫu`, { tone: 'success' });
  e.target.value = '';
});

// ------------------------------------------------------------------ Thử nhận ngay
$('#d-test').addEventListener('click', async () => {
  const btn = $('#d-test');
  if (!samples.some((s) => s.teach && s.emb)) return toast('Hãy thu ít nhất một mẫu có bật “Dạy AI” trước.', { tone: 'error' });
  const m = new LiveMic({ seconds: 4 });
  try { await m.start(); } catch (e) { return toast(micErrorMessage(e), { tone: 'error' }); }
  btn.disabled = true;
  $('#test-card').hidden = false;
  for (let i = 3; i > 0; i--) { $('#test-out').innerHTML = `<div class="test-wait"><span class="rec-dot"></span>Đang nghe… phát âm thanh cần thử (${i})</div>`; await new Promise((r) => setTimeout(r, 1000)); }
  const wave = m.latest(3); m.stop();
  $('#test-out').innerHTML = '<div class="test-wait">Đang so sánh…</div>';
  try {
    await reloadPersonal();
    const { result, meta } = await analyzeWave(wave, { useDenoise: false });
    const p = meta.personal;
    $('#test-out').innerHTML = p
      ? `<div class="test-hit">${icon(p.icon || 'star', { size: 30 })}<div><small>Giống âm thanh của bạn</small><b>${esc(p.vi)}</b><span class="mono">${Math.round(p.prob * 100)}%</span></div></div>`
      : `<div class="test-miss">${icon('info', { size: 22 })}<div><b>Chưa khớp âm thanh riêng nào.</b><small>Mô hình chung nghe ra: ${esc(result.top ? `${result.top.vi} (${result.top.conf}%)` : 'không rõ')}. Thu thêm mẫu ở đúng nơi đó để AI nhận tốt hơn.</small></div></div>`;
  } catch (e) { $('#test-out').innerHTML = `<div class="test-miss">${esc(e.message)}</div>`; }
  btn.disabled = false;
});

// ------------------------------------------------------------------ Tải zip, xóa, gửi kho chung
$('#d-zip').addEventListener('click', async () => {
  const xs = shown();
  const files = [];
  for (const s of xs) files.push({ name: `${s.label}/${fileName(s)}`, data: new Uint8Array(await s.blob.arrayBuffer()) });
  const labels = [...new Set(xs.map((s) => s.label))].map((k) => `${k}\t${labelInfo(k).vi}`).join('\n');
  const readme = `Gói mẫu Urban Sound – ${new Date().toLocaleString('vi-VN')}\nGiải nén vào training/data/my_sounds/ (mỗi thư mục là một nhãn) rồi chạy các script trong training/.\nWAV mono 16 kHz, 16-bit.\n\nNhãn:\n${labels}\n`;
  files.push({ name: 'DOC_TOI.txt', data: new TextEncoder().encode(readme) });
  saveBlob(makeZip(files), `mau-am-thanh-${filter || 'tat-ca'}-${new Date().toISOString().slice(0, 10)}.zip`);
});

$('#d-clear').addEventListener('click', async () => {
  const xs = shown();
  if (!xs.length || !confirm(`Xóa ${xs.length} mẫu đang xem? Không khôi phục được.`)) return;
  await deleteSamples(xs.map((s) => s.id));
  await reloadPersonal().catch(() => {});
  await refresh();
});

$('#d-upload').addEventListener('click', async () => {
  const u = await currentUser().catch(() => null);
  if (!u || u.demo) return toast('Hãy đăng nhập để gửi mẫu lên kho chung của nhóm.', { tone: 'error' });
  const sb = await supabase();
  if (!sb) return toast('Web chưa cấu hình Supabase.', { tone: 'error' });
  const xs = shown().filter((s) => !s.uploaded);
  if (!xs.length) return toast('Các mẫu đang xem đều đã được gửi.');
  const btn = $('#d-upload');
  btn.disabled = true;
  let ok = 0;
  for (const s of xs) {
    btn.textContent = `Đang gửi ${ok + 1}/${xs.length}…`;
    const { error } = await sb.storage.from('samples').upload(`${u.id}/${s.label}/${fileName(s)}`, s.blob, { contentType: 'audio/wav', upsert: true });
    if (error) {
      toast(/bucket/i.test(error.message) ? 'Kho chung chưa được tạo. Nhóm cần chạy file supabase/samples.sql trong Supabase → SQL Editor.' : `Lỗi gửi: ${error.message}`, { tone: 'error', ms: 9000 });
      break;
    }
    s.uploaded = true; await putSample(s); ok++;
  }
  btn.disabled = false;
  btn.innerHTML = `${icon('upload', { size: 16 })}Gửi lên kho chung`;
  if (ok) toast(`Đã gửi ${ok} mẫu lên kho chung. Cảm ơn bạn!`, { tone: 'success' });
  render();
});

// ------------------------------------------------------------------ Khởi động
const pre = new URLSearchParams(location.search).get('label');
if (pre && (GROUP_BY_ID[pre] || pre === 'khac')) {
  $('#label-mode [data-mode="group"]').click();
  $('#label-select').value = pre; pickGroup();
} else select(myLabels[0] || null);
refresh();
hydrateIcons();
