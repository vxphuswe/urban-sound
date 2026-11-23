import { CONFIG } from '../config.js';
import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { ACCEPT, decodeToMono16k, Recorder, levelStats, micErrorMessage } from '../audio.js';
import { loadClassifier, analyzeWave, classifierInfo } from '../classifier.js';
import { envelope } from '../dsp.js';
import { resultCard, healthBanner, levelSummary, referenceList, highlightReference, kindTone, borderTone } from '../render.js';
import { transcribe, formatTime, toSrt } from '../transcribe.js';
import { addEntry, updateEntry, toggleFavorite } from '../store.js';
import { GROUP_BY_ID } from '../categories.js';

initLayout();

const state = { wave: null, name: '', source: 'file', analysis: null, entry: null, chunks: [], url: null, media: null };
const SPEECHY = new Set(['speech', 'crowd', 'shout', 'laugh', 'children', 'tv', 'music', 'baby']);

$('#ref-list').innerHTML = referenceList();
$('#file-input').accept = ACCEPT;
$('#tr-model').innerHTML = CONFIG.ASR_MODELS.map((m) => `<option value="${m.id}" ${m.id === CONFIG.ASR_DEFAULT ? 'selected' : ''}>${m.label} (${m.size})</option>`).join('');
$('#opt-denoise').checked = CONFIG.DENOISE_DEFAULT;

// ---------------------------------------------------------------- Tab
function selectTab(which) {
  $('#tab-file').setAttribute('aria-selected', String(which === 'file'));
  $('#tab-rec').setAttribute('aria-selected', String(which === 'rec'));
  $('#panel-file').hidden = which !== 'file';
  $('#panel-rec').hidden = which !== 'rec';
}
$('#tab-file').onclick = () => selectTab('file');
$('#tab-rec').onclick = () => selectTab('rec');
if (location.hash === '#ghi-am') selectTab('rec');

// Tải sẵn mô hình trong nền để lần bấm đầu tiên nhanh hơn
setTimeout(() => loadClassifier().catch(() => {}), 1200);

// ---------------------------------------------------------------- Tải file
const dz = $('#dropzone');
$('#file-input').addEventListener('change', (e) => e.target.files[0] && handleFile(e.target.files[0]));
['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); });

async function handleFile(file) {
  if (file.size > 300 * 1024 * 1024) return toast('File lớn hơn 300 MB. Hãy cắt ngắn trước khi tải lên.', { tone: 'error' });
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name);
  setMedia(file, isVideo ? 'video' : 'audio');
  await run(file, { name: file.name, source: isVideo ? 'video' : 'file' });
}

function setMedia(blob, kind) {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(blob);
  const el = document.createElement(kind);
  el.src = state.url; el.controls = true; el.preload = 'metadata';
  el.style.cssText = kind === 'video' ? 'width:100%;max-height:360px;border-radius:12px;background:#000' : 'width:100%';
  $('#player-slot').replaceChildren(el);
  state.media = el;
  el.addEventListener('timeupdate', movePlayhead);
}

function movePlayhead() {
  if (!state.media || !state.wave) return;
  const d = state.wave.length / 16000;
  $('#playhead').style.left = `${Math.min(100, (state.media.currentTime / d) * 100)}%`;
}

// ---------------------------------------------------------------- Ghi âm
const eq = $('#rec-eq');
eq.innerHTML = Array.from({ length: 24 }, () => '<i></i>').join('');
let rec = null, recTimer = null;
$('#rec-btn').addEventListener('click', async () => {
  const btn = $('#rec-btn');
  if (!rec) {
    rec = new Recorder({
      onLevel: (db, buf) => {
        const bars = eq.children;
        for (let i = 0; i < bars.length; i++) {
          const v = Math.abs(buf[Math.floor((i / bars.length) * buf.length)] || 0);
          bars[i].style.height = `${Math.min(34, 4 + v * 160 + (db - 30) / 3)}px`;
        }
      },
    });
    try {
      await rec.start();
    } catch (e) {
      rec = null;
      return toast(micErrorMessage(e), { tone: 'error', ms: 6000 });
    }
    btn.classList.add('recording'); btn.setAttribute('aria-label', 'Dừng ghi âm');
    $('#rec-hint').textContent = 'Đang ghi… bấm nút để dừng.';
    recTimer = setInterval(() => {
      const s = rec.seconds;
      $('#rec-time').textContent = formatTime(s);
      if (s >= 60) btn.click();
    }, 200);
    loadClassifier().catch(() => {});
  } else {
    clearInterval(recTimer);
    const r = rec; rec = null;
    btn.classList.remove('recording'); btn.setAttribute('aria-label', 'Bắt đầu ghi âm');
    $('#rec-hint').textContent = 'Bấm nút để ghi âm (tối đa 60 giây). Bấm lần nữa để dừng và nhận diện.';
    [...eq.children].forEach((b) => (b.style.height = '6px'));
    const blob = await r.stop();
    if (!blob || r.seconds < 0.5) return toast('Bản ghi quá ngắn, hãy thử lại.', { tone: 'error' });
    const name = `Ghi âm ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    setMedia(blob, 'audio');
    await run(blob, { name, source: 'mic' });
  }
});

// ---------------------------------------------------------------- Phân tích
function status(text, pct, hint) {
  $('#status').hidden = false;
  $('#status-text').textContent = text;
  $('#status-bar').style.width = `${pct ?? 0}%`;
  if (hint !== undefined) $('#status-hint').textContent = hint;
}

async function run(blob, { name, source }) {
  state.name = name; state.source = source; state.chunks = [];
  $('#result').innerHTML = '';
  $('#tech').hidden = true;
  resetTranscript();
  status('Đang đọc file…', 5);
  try {
    const { wave } = await decodeToMono16k(blob);
    state.wave = wave;
    if (wave.length < 16000 * 0.3) throw new Error('Âm thanh quá ngắn (cần ít nhất nửa giây).');
    await loadClassifier((t, p) => status(t, p * 0.4));
    const { result, meta } = await analyzeWave(wave, {
      useDenoise: $('#opt-denoise').checked,
      sensitivity: $('#opt-sens').value,
      onProgress: (t, p) => status(t, 40 + p * 0.6, ''),
    });
    state.analysis = { result, meta };
    $('#status').hidden = true;
    const lv = levelStats(wave);
    render(result, meta, lv);
    state.entry = await addEntry({
      source, fileName: name, groupId: result.top?.id || null, label: result.top ? result.top.vi : 'Chưa nhận ra',
      conf: result.top?.conf ?? 0, kind: result.top?.kind, icon: result.top?.icon, status: result.status,
      levelDb: Math.round(lv.avg), peakDb: Math.round(lv.max), duration: Math.round(meta.duration * 10) / 10,
      alts: result.alternatives.map((a) => a.vi),
    });
    bindResultActions();
    $('#tr-run').disabled = false;
    const speechy = [result.top, ...result.alternatives].some((a) => a && SPEECHY.has(a.id) && a.conf >= 35);
    if ($('#opt-asr').checked && speechy) runTranscribe();
    else if (!speechy) $('#tr-out').innerHTML = `<div class="empty">${icon('info', { size: 30 })}Không phát hiện rõ giọng nói trong đoạn này. Bạn vẫn có thể bấm “Phiên âm” để thử.</div>`;
  } catch (e) {
    console.error(e);
    $('#status').hidden = true;
    $('#result').innerHTML = `<div class="banner warn" data-tone="red"><span class="b-ic">${icon('alert', { size: 22 })}</span><div><b>Không phân tích được</b><p>${esc(e.message)}</p></div></div>`;
  }
}

function render(r, meta, lv) {
  $('#result').innerHTML = resultCard(r, lv);
  if (meta.demo) $('#result').insertAdjacentHTML('afterbegin', `<div class="notice notice-warn" style="margin-bottom:12px">${icon('info')}<div><b>Chế độ demo giao diện</b> – kết quả là giả lập. Bỏ <code>?demo</code> trên địa chỉ để dùng mô hình thật.</div></div>`);
  if (meta.truncated) toast(`File dài, chỉ phân tích ${CONFIG.MAX_ANALYZE_SEC / 60} phút đầu.`);

  // Mức âm & sức khỏe
  $('#level-body').innerHTML = levelSummary(lv);
  $('#health').innerHTML = healthBanner(lv.max);
  highlightReference($('#ref-list'), lv.avg);
  $('#level-card').style.borderColor = `color-mix(in srgb, var(--${borderTone('ambient', lv.max)}) 55%, transparent)`;

  // Dạng sóng & dòng thời gian
  $('#media-card').hidden = false;
  $('#media-name').textContent = state.name;
  $('#media-dur').textContent = formatTime(meta.duration);
  drawWave(r.timeline);
  const dur = state.wave.length / 16000;
  $('#timeline').innerHTML = r.timeline.map((t) => `<div class="tl-seg tone-${kindTone(t.kind)}" style="left:${(t.start / dur) * 100}%;width:${(Math.min(dur, t.end) - t.start) / dur * 100}%" title="${esc(t.vi)} ${formatTime(t.start)}" data-t="${t.start}">${esc(t.vi)}</div>`).join('');
  $('#tl-list').innerHTML = r.timeline.length
    ? r.timeline.slice(0, 30).map((t) => `<div class="tl-item tone-${kindTone(t.kind)}" data-t="${t.start}" role="button" tabindex="0"><span class="mono">${formatTime(t.start)} – ${formatTime(Math.min(dur, t.end))}</span><span class="dot tone-bg">${icon(t.icon || 'wave', { size: 16 })}</span><span>${esc(t.vi)}</span><span class="mono muted">${t.conf}%</span></div>`).join('')
    : '<p class="muted" style="margin:8px 0 0;font-size:.9rem">Không có đoạn âm thanh nổi bật nào để đánh dấu.</p>';
  $$('[data-t]').forEach((el) => {
    const seek = () => { if (state.media) { state.media.currentTime = Number(el.dataset.t); state.media.play().catch(() => {}); } };
    el.addEventListener('click', seek);
    el.addEventListener('keydown', (e) => e.key === 'Enter' && seek());
  });

  // Chi tiết kỹ thuật
  const info = classifierInfo();
  $('#tech').hidden = false;
  $('#tech-body').innerHTML = `
    <p>Mô hình: <b>YAMNet</b> (Google, ${info.classes} lớp AudioSet)${info.head.length ? ` + mô hình nhóm tự train (${info.head.length} lớp)` : ''}. Nguồn: <span class="mono">${esc(meta.source)}</span>.</p>
    <p>Thời gian xử lý: <b>${(meta.ms / 1000).toFixed(1)} s</b> cho ${meta.analyzedSec.toFixed(1)} s âm thanh · Khung có âm thanh: ${r.frames.active}/${r.frames.total} · Mức nền ≈ ${Math.round(r.frames.floorDb)} dBFS${meta.denoiseDb ? ` · Lọc tạp âm giảm ${meta.denoiseDb.toFixed(1)} dB` : ''}.</p>
    <table class="simple"><thead><tr><th>Lớp gốc (tiếng Anh)</th><th style="text-align:right">Điểm TB</th></tr></thead>
    <tbody>${r.topClasses.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.score.toFixed(3)}</td></tr>`).join('')}</tbody></table>
    <p class="muted" style="margin-top:10px">“dB” trên trang là ước tính từ mức tín hiệu số (dBFS) cộng hệ số hiệu chỉnh, không thay thế máy đo âm thanh chuẩn.</p>`;
}

function drawWave(timeline) {
  const c = $('#wave');
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth || 600, h = c.clientHeight || 96;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const env = envelope(state.wave, Math.floor(w / 3));
  const max = Math.max(0.01, ...env);
  const dur = state.wave.length / 16000;
  const css = getComputedStyle(document.documentElement);
  const base = css.getPropertyValue('--muted').trim() || '#888';
  const toneColor = (k) => css.getPropertyValue(`--${kindTone(k)}`).trim();
  for (let i = 0; i < env.length; i++) {
    const t = (i / env.length) * dur;
    const seg = timeline.find((s) => t >= s.start && t <= s.end);
    g.fillStyle = seg ? toneColor(seg.kind) : base;
    g.globalAlpha = seg ? 0.95 : 0.45;
    const bh = Math.max(2, (env[i] / max) * (h - 12));
    g.fillRect(i * 3, (h - bh) / 2, 2, bh);
  }
}
window.addEventListener('resize', () => state.analysis && drawWave(state.analysis.result.timeline));

function bindResultActions() {
  const box = $('#result-actions');
  if (!box || !state.entry) return;
  box.innerHTML = `
    <button class="btn btn-sm fav-btn" id="fav" type="button">${icon('star', { size: 16 })}<span>Yêu thích</span></button>
    <a class="btn btn-sm btn-ghost" href="lich-su.html">${icon('history', { size: 16 })}Xem lịch sử</a>
    <a class="btn btn-sm btn-ghost" href="du-lieu.html?label=${encodeURIComponent(state.analysis.result.top?.id || '')}">${icon('database', { size: 16 })}Kết quả sai? Góp mẫu đúng</a>`;
  $('#fav').addEventListener('click', async () => {
    const on = await toggleFavorite(state.entry.id);
    $('#fav').classList.toggle('on', on);
    $('#fav span').textContent = on ? 'Đã yêu thích' : 'Yêu thích';
    toast(on ? 'Đã thêm vào yêu thích – sẽ không bị xóa khi dọn lịch sử.' : 'Đã bỏ yêu thích', { tone: on ? 'success' : 'default' });
  });
}

// ---------------------------------------------------------------- Phiên âm
function resetTranscript() {
  state.chunks = [];
  $('#tr-out').innerHTML = `<div class="empty">${icon('text', { size: 34 })}Văn bản lời nói sẽ hiện ở đây.</div>`;
  ['#tr-copy', '#tr-txt', '#tr-srt'].forEach((s) => ($(s).disabled = true));
  $('#tr-run').disabled = true;
}

async function runTranscribe() {
  if (!state.wave) return;
  $('#tr-run').disabled = true;
  $('#tr-status').hidden = false;
  $('#tr-status-text').textContent = 'Đang chuẩn bị mô hình phiên âm…';
  $('#tr-bar').style.width = '0%';
  $('#tr-bar').parentElement.classList.add('indet');
  try {
    const out = await transcribe(state.wave, {
      model: $('#tr-model').value,
      language: $('#tr-lang').value,
      onStatus: (t) => ($('#tr-status-text').textContent = t),
      onLoad: (d) => {
        $('#tr-bar').parentElement.classList.remove('indet');
        $('#tr-bar').style.width = `${Math.round(d.progress * 100)}%`;
        $('#tr-status-mb').textContent = `${d.loadedMB.toFixed(0)} / ${d.totalMB.toFixed(0)} MB`;
        if (d.progress >= 1) $('#tr-bar').parentElement.classList.add('indet');
      },
    });
    state.chunks = out.chunks;
    renderTranscript();
    if (state.entry && out.text) updateEntry(state.entry.id, { transcript: out.text.slice(0, 5000) });
  } catch (e) {
    console.error(e);
    $('#tr-out').innerHTML = `<div class="empty">${icon('alert', { size: 30 })}Không phiên âm được: ${esc(e.message)}<br><small>Kiểm tra kết nối mạng (lần đầu cần tải mô hình) hoặc thử chế độ “Nhanh”.</small></div>`;
  } finally {
    $('#tr-status').hidden = true;
    $('#tr-status-mb').textContent = '';
    $('#tr-run').disabled = false;
  }
}

function renderTranscript() {
  if (!state.chunks.length) {
    $('#tr-out').innerHTML = `<div class="empty">${icon('info', { size: 30 })}Không nghe thấy lời nói rõ ràng trong đoạn này.</div>`;
    return;
  }
  $('#tr-out').innerHTML = state.chunks.map((c) => `<div class="tr-line" data-t="${c.start}"><span class="mono">${formatTime(c.start)}</span><span>${esc(c.text)}</span></div>`).join('');
  $$('#tr-out .tr-line').forEach((el) => el.addEventListener('click', () => { if (state.media) { state.media.currentTime = Number(el.dataset.t); state.media.play().catch(() => {}); } }));
  ['#tr-copy', '#tr-txt', '#tr-srt'].forEach((s) => ($(s).disabled = false));
}

const plain = () => state.chunks.map((c) => c.text).join('\n');
function download(text, ext) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  a.download = `${(state.name || 'phien-am').replace(/\.[^.]+$/, '')}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#tr-run').addEventListener('click', runTranscribe);
$('#tr-copy').addEventListener('click', async () => { await navigator.clipboard.writeText(plain()); toast('Đã sao chép văn bản', { tone: 'success' }); });
$('#tr-txt').addEventListener('click', () => download(plain(), 'txt'));
$('#tr-srt').addEventListener('click', () => download(toSrt(state.chunks), 'srt'));

hydrateIcons();
export { GROUP_BY_ID };
