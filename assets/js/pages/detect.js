import { CONFIG } from '../config.js';
import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { ACCEPT, decodeToMono16k, Recorder, levelStats, micErrorMessage, captureTabAudio, encodeWav } from '../audio.js';
import { loadClassifier, analyzeWave, classifierInfo } from '../classifier.js';
import { envelope } from '../dsp.js';
import { resultCard, healthBanner, levelSummary, referenceList, highlightReference, kindTone, borderTone } from '../render.js';
import { transcribe, formatTime, toSrt } from '../transcribe.js';
import { addEntry, updateEntry, toggleFavorite } from '../store.js';
import { GROUP_BY_ID } from '../categories.js';

initLayout();

const state = { wave: null, name: '', source: 'file', analysis: null, entry: null, chunks: [], url: null, media: null };
// Những loại có lời nói thật. Chó sủa, nhạc, em bé khóc… KHÔNG phiên âm (Whisper sẽ bịa ra chữ).
const VOICE = new Set(['speech', 'crowd', 'shout', 'tv', 'children']);

/** Các đoạn [bắt đầu, kết thúc] (giây) có tiếng người, nới 0,4 s hai đầu và gộp đoạn gần nhau. */
function speechSegments() {
  const tl = state.analysis?.result?.timeline || [];
  const segs = tl.filter((t) => VOICE.has(t.id)).map((t) => [Math.max(0, t.start - 0.4), t.end + 0.4]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const sg of segs) {
    const last = out[out.length - 1];
    if (last && sg[0] - last[1] < 1.2) last[1] = Math.max(last[1], sg[1]); else out.push([...sg]);
  }
  return out;
}

$('#ref-list').innerHTML = referenceList();
$('#file-input').accept = ACCEPT;
// Tiếng Việt: bản "small" chính xác hơn hẳn; máy tính đủ RAM dùng mặc định, điện thoại dùng "base" cho nhẹ
const ASR_PICK = (() => {
  try { const v = localStorage.getItem('tp.asrModel'); if (CONFIG.ASR_MODELS.some((m) => m.id === v)) return v; } catch { /* bỏ qua */ }
  return (navigator.deviceMemory ?? 8) >= 4 && !/Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Xenova/whisper-small' : CONFIG.ASR_DEFAULT;
})();
$('#tr-model').innerHTML = CONFIG.ASR_MODELS.map((m) => `<option value="${m.id}" ${m.id === ASR_PICK ? 'selected' : ''}>${m.label} (${m.size})</option>`).join('');
$('#tr-model').addEventListener('change', (e) => { try { localStorage.setItem('tp.asrModel', e.target.value); } catch { /* bỏ qua */ } });
$('#opt-denoise').checked = CONFIG.DENOISE_DEFAULT;

// ---------------------------------------------------------------- Tab
function selectTab(which) {
  for (const t of ['file', 'rec', 'link']) {
    $(`#tab-${t}`).setAttribute('aria-selected', String(which === t));
    $(`#panel-${t}`).hidden = which !== t;
  }
}
$('#tab-file').onclick = () => selectTab('file');
$('#tab-rec').onclick = () => selectTab('rec');
$('#tab-link').onclick = () => selectTab('link');
if (location.hash === '#ghi-am') selectTab('rec');
if (location.hash === '#tu-link') selectTab('link');

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
  // tô sáng câu đang phát (giống phụ đề karaoke)
  const t = state.media.currentTime;
  $$('#tr-out .tr-line').forEach((el, i) => {
    const c = state.chunks[i];
    el.classList.toggle('on', !!c && t >= c.start && t < (c.end ?? c.start + 3));
  });
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

// ---------------------------------------------------------------- Từ link (YouTube hoặc file trực tiếp)
function parseYouTube(raw) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      id = u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{6,})/) || [])[2];
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    const t = u.searchParams.get('t') || u.searchParams.get('start') || '0';
    const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/);
    const start = m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
    return { id, start };
  } catch { return null; }
}

function directUrl(raw) {
  const u = new URL(raw);
  const drive = u.hostname === 'drive.google.com' && (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1];
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive}`;
  if (u.hostname.endsWith('dropbox.com')) { u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); }
  return u.href;
}

async function fetchAudio(url) {
  const okType = (t) => /^(audio|video)\/|application\/(ogg|octet-stream)/i.test(t || '');
  // 1) thử tải trực tiếp (được nếu máy chủ nguồn cho phép CORS, ví dụ Freesound, Wikimedia)
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (r.ok && okType(r.headers.get('content-type'))) return await r.blob();
    if (r.ok && /text\/html/i.test(r.headers.get('content-type') || '')) throw Object.assign(new Error('html'), { html: true });
  } catch (e) {
    if (e.html) throw new Error('Link này là một trang web, không phải file âm thanh. Bấm chuột phải vào trình phát → "Sao chép địa chỉ âm thanh", hoặc dùng link YouTube.');
  }
  // 2) nhờ máy chủ Vercel tải hộ
  const r = await fetch(`api/fetch-audio?url=${encodeURIComponent(url)}`);
  if (r.status === 404 && !(r.headers.get('content-type') || '').includes('json')) {
    throw new Error('Trang này chặn tải trực tiếp. Tính năng tải hộ chỉ chạy trên bản đã deploy lên Vercel. Bạn có thể tải file về máy rồi dùng thẻ "Tải file".');
  }
  if (!r.ok) {
    let msg = 'Không tải được link.';
    try { msg = (await r.json()).error || msg; } catch { /* bỏ qua */ }
    throw new Error(msg);
  }
  return await r.blob();
}

let ytInfo = null;
$('#link-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = $('#link-input').value.trim();
  if (!raw) return;
  let url;
  try { url = new URL(raw); } catch { return toast('Link chưa đúng. Link phải bắt đầu bằng http:// hoặc https://', { tone: 'error' }); }
  const yt = parseYouTube(url.href);
  if (yt) {
    ytInfo = yt;
    $('#yt-frame').src = `https://www.youtube-nocookie.com/embed/${yt.id}?enablejsapi=1&rel=0&start=${yt.start}&origin=${encodeURIComponent(location.origin)}`;
    $('#yt-box').hidden = false;
    $('#yt-status').hidden = true;
    if (!navigator.mediaDevices?.getDisplayMedia) toast('Điện thoại không hỗ trợ nghe âm thanh từ video. Hãy mở trang trên Chrome/Edge máy tính.', { tone: 'error', ms: 7000 });
    return;
  }
  $('#yt-box').hidden = true;
  const btn = $('#link-btn');
  btn.disabled = true;
  const name = decodeURIComponent(url.pathname.split('/').pop() || url.hostname) || 'Âm thanh từ link';
  try {
    status('Đang tải âm thanh từ link…', 3, 'Link trực tiếp tối đa 4 MB.');
    const blob = await fetchAudio(directUrl(url.href));
    const isVideo = (blob.type || '').startsWith('video/');
    setMedia(blob, isVideo ? 'video' : 'audio');
    await run(blob, { name, source: 'link' });
  } catch (err) {
    $('#status').hidden = true;
    toast(err.message, { tone: 'error', ms: 8000 });
  } finally {
    btn.disabled = false;
  }
});

function ytCommand(func) {
  $('#yt-frame').contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

$('#yt-capture').addEventListener('click', async () => {
  if (!ytInfo) return;
  const sec = Number($('#yt-sec').value);
  const btn = $('#yt-capture');
  const st = $('#yt-status');
  btn.disabled = true;
  try {
    const blob = await captureTabAudio(sec, {
      onStart: () => { ytCommand('playVideo'); st.hidden = false; },
      onTick: (left) => { st.innerHTML = `<span class="rec-dot"></span>Đang nghe âm thanh video… còn ${Math.ceil(left)} giây`; },
    });
    ytCommand('pauseVideo');
    st.innerHTML = `${icon('check', { size: 18 })} Đã nghe xong ${sec} giây – đang nhận diện…`;
    setMedia(blob, 'audio');
    await run(blob, { name: `YouTube ${ytInfo.id}`, source: 'link' });
    st.hidden = true;
  } catch (err) {
    st.hidden = true;
    toast(err.message, { tone: 'error', ms: 8000 });
  } finally {
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------- Phân tích
function status(text, pct, hint) {
  $('#status').hidden = false;
  $('#status-cancel').hidden = false;
  $('#status-text').textContent = text;
  $('#status-bar').style.width = `${pct ?? 0}%`;
  if (hint !== undefined) $('#status-hint').textContent = hint;
}

let runSeq = 0;
$('#status-cancel').addEventListener('click', () => {
  runSeq++;
  state.abort?.abort();
  $('#status').hidden = true;
  toast('Đã huỷ. Mô hình vẫn tiếp tục tải ngầm để lần sau nhanh hơn.');
});

async function run(blob, { name, source }) {
  const my = ++runSeq;
  state.abort = new AbortController();
  const alive = () => my === runSeq;
  state.name = name; state.source = source; state.chunks = [];
  $('#result').innerHTML = '';
  $('#tech').hidden = true;
  resetTranscript();
  status('Đang đọc file…', 5);
  try {
    const { wave } = await decodeToMono16k(blob);
    state.wave = wave;
    if (wave.length < 16000 * 0.3) throw new Error('Âm thanh quá ngắn (cần ít nhất nửa giây).');
    await loadClassifier((t, p) => alive() && status(t, p * 0.4));
    if (!alive()) return;
    const { result, meta } = await analyzeWave(wave, {
      signal: state.abort.signal,
      useDenoise: $('#opt-denoise').checked,
      sensitivity: $('#opt-sens').value,
      onProgress: (t, p) => alive() && status(t, 40 + p * 0.6, ''),
    });
    if (!alive()) return;
    state.analysis = { result, meta };
    $('#status').hidden = true;
    const lv = levelStats(wave);
    render(result, meta, lv);
    state.entry = await addEntry({
      source, fileName: name, groupId: result.top?.id || null, label: result.top ? result.top.vi : 'Chưa nhận ra',
      conf: result.top?.conf ?? 0, kind: result.top?.kind, icon: result.top?.icon, status: result.status,
      levelDb: Math.round(lv.avg), peakDb: Math.round(lv.max), duration: Math.round(meta.duration * 10) / 10,
      alts: result.alternatives.map((a) => a.vi),
    }, { audio: blob.size > 25 * 1048576 ? new Blob([encodeWav(wave)], { type: 'audio/wav' }) : blob, audioName: blob.size > 25 * 1048576 ? name.replace(/\.[^.]+$/, '') + '.wav' : name });
    bindResultActions();
    $('#tr-run').disabled = false;
    const speechy = speechSegments().reduce((n, [a, b]) => n + b - a, 0) >= 1.2;
    $('#phien-am').hidden = false;
    if ($('#opt-asr').checked && speechy) runTranscribe();
    else if (!speechy) $('#tr-out').innerHTML = `<div class="empty">${icon('info', { size: 30 })}Đoạn này không có người nói rõ ràng nên không cần chuyển thành chữ. Nếu vẫn muốn thử, bấm “Phiên âm”.</div>`;
  } catch (e) {
    if (!alive() || e.name === 'AbortError') return;
    console.error(e);
    $('#status').hidden = true;
    $('#result').innerHTML = `<div class="banner warn" data-tone="red"><span class="b-ic">${icon('alert', { size: 22 })}</span><div><b>Không phân tích được</b><p>${esc(e.message)}</p></div></div>`;
  }
}

function render(r, meta, lv) {
  $('#result').innerHTML = resultCard(r, lv);
  if (meta.personal) {
    const p = meta.personal;
    $('#result').insertAdjacentHTML('afterbegin', `<div class="personal-hit">${icon(p.icon || 'star', { size: 26 })}<div><small>Giống âm thanh bạn đã dạy</small><b>${esc(p.vi)}</b></div><span class="mono">${Math.round(p.prob * 100)}%</span><a class="link" href="du-lieu.html">Quản lý</a></div>`);
  }
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

async function runTranscribe(e) {
  if (!state.wave) return;
  const manual = !!e?.type; // bấm nút "Phiên âm" = người dùng muốn thử cả khi không thấy tiếng người
  const dur = state.wave.length / 16000;
  let segs = speechSegments().map(([a, b]) => [a, Math.min(dur, b)]);
  if (!segs.length) {
    if (!manual) return;
    segs = [[0, dur]];
  }
  $('#tr-run').disabled = true;
  $('#tr-status').hidden = false;
  $('#tr-status-text').textContent = 'Đang chuẩn bị mô hình phiên âm…';
  $('#tr-bar').style.width = '0%';
  $('#tr-bar').parentElement.classList.add('indet');
  try {
    const all = [];
    for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i];
    const piece = state.wave.subarray(Math.floor(a * 16000), Math.ceil(b * 16000));
    const out = await transcribe(piece, {
      model: $('#tr-model').value,
      language: $('#tr-lang').value,
      onStatus: (t) => ($('#tr-status-text').textContent = segs.length > 1 ? `${t} (đoạn ${i + 1}/${segs.length})` : t),
      onLoad: (d) => {
        $('#tr-bar').parentElement.classList.remove('indet');
        $('#tr-bar').style.width = `${Math.round(d.progress * 100)}%`;
        $('#tr-status-mb').textContent = `${d.loadedMB.toFixed(0)} / ${d.totalMB.toFixed(0)} MB`;
        if (d.progress >= 1) $('#tr-bar').parentElement.classList.add('indet');
      },
    });
    for (const c of out.chunks) all.push({ ...c, start: c.start + a, end: c.end != null ? c.end + a : null });
    }
    state.chunks = all;
    renderTranscript();
    const text = all.map((c) => c.text).join(' ').trim();
    if (state.entry && text) updateEntry(state.entry.id, { transcript: text.slice(0, 5000) });
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
  $('#tr-out').innerHTML = `<div class="tr-sheet">${state.chunks.map((c) => `<button type="button" class="tr-line" data-t="${c.start}" title="Bấm để nghe lại đoạn này"><span class="tr-time mono">${icon('play', { size: 11 })}${formatTime(c.start)}</span><span class="tr-text">${esc(c.text)}</span></button>`).join('')}</div>
    <p class="muted" style="font-size:.78rem;margin:10px 2px 0">Chỉ phiên âm những đoạn AI nghe thấy tiếng người. Bấm một dòng để nghe lại đúng đoạn đó.</p>`;
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
