import { initLayout, $, $$, esc, toast, formatDate, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { listEntries, toggleFavorite, removeEntry, clearHistory } from '../store.js';
import { currentUser } from '../auth.js';
import { kindTone } from '../render.js';
import { bandOf } from '../levels.js';
import { getAudio, extOf, safeName } from '../blobstore.js';
import { makeZip } from '../zip.js';

initLayout();

const SRC = { file: 'File âm thanh', video: 'Video', mic: 'Ghi âm', live: 'Trực tiếp', link: 'Từ link' };
let tab = 'all';
let items = [];

currentUser().then((u) => { $('#login-hint').hidden = Boolean(u && !u.demo); });

async function load() {
  items = await listEntries();
  render();
}

function currentList() {
  const q = $('#q').value.trim().toLowerCase();
  const src = $('#f-src').value;
  return items.filter((x) => (tab === 'all' || x.fav) && (!src || x.source === src)
    && (!q || [x.label, x.fileName, x.transcript, ...(x.alts || [])].join(' ').toLowerCase().includes(q)));
}

function render() {
  $('#c-all').textContent = items.length;
  $('#c-fav').textContent = items.filter((x) => x.fav).length;
  const xs = currentList();
  $('#zip-all').disabled = !xs.some((x) => x.hasAudio);
  if (!xs.length) {
    $('#list').innerHTML = `<div class="card empty">${icon(tab === 'fav' ? 'star' : 'history', { size: 40 })}<b>${tab === 'fav' ? 'Chưa có mục yêu thích' : 'Chưa có lịch sử'}</b><span>${tab === 'fav' ? 'Bấm ngôi sao ở kết quả nhận diện để lưu lại.' : 'Hãy thử nhận diện một âm thanh.'}</span><a class="btn btn-primary btn-sm" href="nhan-dien.html">Nhận diện ngay</a></div>`;
    return;
  }
  $('#list').innerHTML = xs.map((x) => {
    const tone = kindTone(x.kind);
    const b = x.peakDb != null ? bandOf(x.peakDb) : null;
    return `<article class="hist-item" data-id="${x.id}">
      <span class="dot tone-${tone} tone-bg">${icon(x.icon || 'wave', { size: 22 })}</span>
      <div style="min-width:0">
        <h4>${esc(x.label)}${x.conf ? ` <span class="mono muted" style="font-size:.85rem">${x.conf}%</span>` : ''}</h4>
        <small>${formatDate(x.ts)} · ${SRC[x.source] || x.source}${x.fileName && x.source !== 'live' ? ` · ${esc(x.fileName)}` : ''}</small>
        <div class="hist-meta">
          ${b ? `<span class="badge tone-${b.tone} tone-bg">${icon(b.icon, { size: 13 })} ${x.levelDb} dB · ${b.word}</span>` : ''}
          ${x.duration ? `<span class="badge">${icon('clock', { size: 13 })} ${x.duration}s</span>` : ''}
          ${x.alts?.length ? `<span class="badge">Cũng nghe: ${esc(x.alts.slice(0, 2).join(', '))}</span>` : ''}
        </div>
        ${x.transcript ? `<p class="muted" style="margin:8px 0 0;font-size:.88rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">“${esc(x.transcript)}”</p>` : ''}
      </div>
      <div class="hist-actions">
        ${x.hasAudio ? `<button class="icon-btn play-btn" data-act="play" type="button" aria-label="Nghe lại" title="Nghe lại">${icon('play', { size: 18 })}</button>
        <button class="icon-btn" data-act="dl" type="button" aria-label="Tải file" title="Tải file${x.audioSize ? ` (${(x.audioSize / 1048576).toFixed(1)} MB)` : ''}">${icon('download', { size: 18 })}</button>` : ''}
        <button class="icon-btn fav-btn${x.fav ? ' on' : ''}" data-act="fav" type="button" aria-label="${x.fav ? 'Bỏ yêu thích' : 'Yêu thích'}" title="${x.fav ? 'Bỏ yêu thích' : 'Yêu thích'}">${icon('star', { size: 20 })}</button>
        <button class="icon-btn" data-act="del" type="button" aria-label="Xóa" title="Xóa">${icon('trash', { size: 18 })}</button>
      </div>
      <div class="hist-player" hidden></div>
    </article>`;
  }).join('');
}

$('#list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const art = btn.closest('[data-id]');
  const id = art.dataset.id;
  if (btn.dataset.act === 'play') return togglePlay(art, id, btn);
  if (btn.dataset.act === 'dl') return downloadOne(id);
  if (btn.dataset.act === 'fav') {
    const on = await toggleFavorite(id);
    items = items.map((x) => (x.id === id ? { ...x, fav: on } : x));
    toast(on ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích', { tone: on ? 'success' : 'default' });
  } else {
    if (items.find((x) => x.id === id)?.fav && !confirm('Mục này đang là yêu thích. Vẫn xóa?')) return;
    await removeEntry(id);
    items = items.filter((x) => x.id !== id);
  }
  render();
});

$$('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  $$('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  render();
}));
$('#q').addEventListener('input', render);
$('#f-src').addEventListener('change', render);

$('#clear').addEventListener('click', async () => {
  const n = items.filter((x) => !x.fav).length;
  if (!n) return toast('Không có gì để xóa (các mục yêu thích luôn được giữ lại).');
  if (!confirm(`Xóa ${n} mục lịch sử? Các mục yêu thích sẽ được giữ lại.`)) return;
  await clearHistory();
  items = items.filter((x) => x.fav);
  render();
  toast('Đã xóa lịch sử, giữ lại mục yêu thích.', { tone: 'success' });
});

$('#export').addEventListener('click', () => {
  if (!items.length) return toast('Chưa có dữ liệu để xuất.');
  const rows = [['thoi_gian', 'am_thanh', 'do_tin_cay_%', 'nguon', 'ten_file', 'muc_on_dB', 'cao_nhat_dB', 'thoi_luong_s', 'yeu_thich', 'phien_am'],
    ...items.map((x) => [new Date(x.ts).toISOString(), x.label, x.conf ?? '', SRC[x.source] || x.source, x.fileName || '', x.levelDb ?? '', x.peakDb ?? '', x.duration ?? '', x.fav ? 'có' : '', x.transcript || ''])];
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'lich-su-urban-sound.csv';
  a.click();
});

// ------------------------------------------------------------------ Nghe lại & tải file
let playing = null;
async function togglePlay(art, id, btn) {
  const box = art.querySelector('.hist-player');
  if (!box.hidden) { box.querySelector('audio,video')?.pause(); box.hidden = true; box.innerHTML = ''; btn.innerHTML = icon('play', { size: 18 }); return; }
  const rec = await getAudio(id);
  if (!rec) return toast('File này không còn trên trình duyệt (có thể đã bị dọn khi đầy bộ nhớ, hoặc được tạo trên máy khác).', { tone: 'error', ms: 6000 });
  if (playing && playing !== box) { playing.querySelector('audio,video')?.pause(); playing.hidden = true; playing.innerHTML = ''; playing.closest('[data-id]').querySelector('.play-btn').innerHTML = icon('play', { size: 18 }); }
  const url = URL.createObjectURL(rec.blob);
  const isVideo = (rec.type || '').startsWith('video');
  box.innerHTML = `<${isVideo ? 'video playsinline' : 'audio'} controls autoplay src="${url}"></${isVideo ? 'video' : 'audio'}>`;
  box.hidden = false;
  btn.innerHTML = icon('pause', { size: 18 });
  const el = box.firstElementChild;
  el.addEventListener('ended', () => { btn.innerHTML = icon('play', { size: 18 }); });
  playing = box;
}

function fileNameFor(x, rec) {
  const d = new Date(x.ts);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `${stamp}_${safeName(x.label)}.${extOf(rec.type, rec.name)}`;
}

async function downloadOne(id) {
  const x = items.find((i) => i.id === id);
  const rec = await getAudio(id);
  if (!x || !rec) return toast('File này không còn trên trình duyệt.', { tone: 'error' });
  saveBlob(rec.blob, fileNameFor(x, rec));
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

$('#zip-all').addEventListener('click', async () => {
  const list = currentList().filter((x) => x.hasAudio);
  if (!list.length) return toast('Chưa có file âm thanh nào trong danh sách đang xem.');
  const btn = $('#zip-all');
  btn.disabled = true;
  try {
    const files = [];
    for (const x of list) {
      const rec = await getAudio(x.id);
      if (rec) files.push({ name: fileNameFor(x, rec), data: new Uint8Array(await rec.blob.arrayBuffer()) });
    }
    if (!files.length) return toast('Không còn file nào trên trình duyệt.', { tone: 'error' });
    saveBlob(makeZip(files), `urban-sound-lich-su-${new Date().toISOString().slice(0, 10)}.zip`);
    toast(`Đã gói ${files.length} file.`, { tone: 'success' });
  } finally { btn.disabled = false; }
});

window.addEventListener('tp:history', () => { /* cập nhật khi tab khác thay đổi */ });
hydrateIcons();
load();
