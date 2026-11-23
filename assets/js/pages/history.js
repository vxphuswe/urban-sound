import { initLayout, $, $$, esc, toast, formatDate, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { listEntries, toggleFavorite, removeEntry, clearHistory } from '../store.js';
import { currentUser } from '../auth.js';
import { kindTone } from '../render.js';
import { bandOf } from '../levels.js';

initLayout();

const SRC = { file: 'File âm thanh', video: 'Video', mic: 'Ghi âm', live: 'Trực tiếp', link: 'Từ link' };
let tab = 'all';
let items = [];

currentUser().then((u) => { $('#login-hint').hidden = Boolean(u && !u.demo); });

async function load() {
  items = await listEntries();
  render();
}

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const src = $('#f-src').value;
  $('#c-all').textContent = items.length;
  $('#c-fav').textContent = items.filter((x) => x.fav).length;
  const xs = items.filter((x) => (tab === 'all' || x.fav) && (!src || x.source === src)
    && (!q || [x.label, x.fileName, x.transcript, ...(x.alts || [])].join(' ').toLowerCase().includes(q)));
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
      <button class="icon-btn fav-btn${x.fav ? ' on' : ''}" data-act="fav" type="button" aria-label="${x.fav ? 'Bỏ yêu thích' : 'Yêu thích'}" title="${x.fav ? 'Bỏ yêu thích' : 'Yêu thích'}">${icon('star', { size: 20 })}</button>
      <button class="icon-btn hist-actions-extra" data-act="del" type="button" aria-label="Xóa" title="Xóa">${icon('trash', { size: 18 })}</button>
    </article>`;
  }).join('');
}

$('#list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('[data-id]').dataset.id;
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

window.addEventListener('tp:history', () => { /* cập nhật khi tab khác thay đổi */ });
hydrateIcons();
load();
