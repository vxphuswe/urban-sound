import { initLayout, $, $$, esc, toast, hydrateIcons } from '../ui.js';
import { icon } from '../icons.js';
import { GROUPS, GROUP_BY_ID } from '../categories.js';
import { LiveMic, decodeToMono16k, encodeWav, micErrorMessage, TARGET_SR } from '../audio.js';
import { rms, dbfs } from '../dsp.js';
import { makeZip } from '../zip.js';
import { analyzeWave } from '../classifier.js';

initLayout();

// Nhãn gợi ý = id nhóm có sẵn (khớp với training/label_map.json)
$('#label-select').innerHTML = GROUPS.filter((g) => g.id !== 'noise' && g.id !== 'silence')
  .map((g) => `<option value="${g.id}">${esc(g.vi)} (${g.id})</option>`).join('') + '<option value="khac">Tiếng nền / không có gì đặc biệt (khac)</option>';
const pre = new URLSearchParams(location.search).get('label');
if (pre && (GROUP_BY_ID[pre] || pre === 'khac')) $('#label-select').value = pre;

const label = () => {
  const c = $('#label-custom').value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
  return c || $('#label-select').value;
};
const showLabel = () => ($('#label-now').textContent = label());
$('#label-select').addEventListener('change', showLabel);
$('#label-custom').addEventListener('input', showLabel);
showLabel();

const clips = []; // {label, wave, name, url}

function addClip(wave, lab, check = true) {
  const level = dbfs(rms(wave));
  if (lab !== 'khac' && level < -55) return false;
  const name = `${lab}_${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}_${String(clips.length + 1).padStart(3, '0')}.wav`;
  const blob = encodeWav(wave);
  const clip = { label: lab, wave, name, url: URL.createObjectURL(blob), blob, level, pred: check ? '…' : '' };
  clips.unshift(clip);
  render();
  // Cho AI nghe thử mẫu vừa thu để kiểm tra nhãn
  if (check) analyzeWave(wave, { useDenoise: false }).then(({ result }) => {
    clip.pred = result.top ? `${result.top.vi} ${result.top.conf}%` : 'chưa nhận ra';
    clip.match = result.top && (result.top.id === lab || (lab === 'khac' && ['background', 'quiet'].includes(result.status)));
    render();
  }).catch(() => { clip.pred = ''; render(); });
  return true;
}

function render() {
  $('#d-count').textContent = clips.length;
  $('#d-zip').disabled = !clips.length;
  if (!clips.length) { $('#d-list').innerHTML = '<div class="empty">Chưa có mẫu nào.</div>'; return; }
  const counts = {};
  clips.forEach((c) => (counts[c.label] = (counts[c.label] || 0) + 1));
  $('#d-list').innerHTML = `<div class="chips" style="margin-bottom:6px">${Object.entries(counts).map(([k, v]) => `<span class="badge badge-accent">${esc(k)}: ${v}</span>`).join('')}</div>` +
    clips.map((c, i) => `<div class="row" style="gap:10px;padding:8px 10px;border-radius:10px;background:var(--surface-2);flex-wrap:nowrap">
      <span class="badge">${esc(c.label)}</span><audio src="${c.url}" controls style="height:32px;flex:1;min-width:0"></audio>
      <span class="mono muted" style="font-size:.8rem">${(c.wave.length / TARGET_SR).toFixed(1)}s</span>
      ${c.pred ? `<span class="badge ${c.match ? 'tone-green tone-bg' : ''}" title="AI hiện tại nghe ra">AI: ${esc(c.pred)}</span>` : ''}
      <button class="icon-btn" data-del="${i}" aria-label="Xóa mẫu">${icon('trash', { size: 16 })}</button></div>`).join('');
}
$('#d-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del]');
  if (!b) return;
  const [c] = clips.splice(Number(b.dataset.del), 1);
  URL.revokeObjectURL(c.url);
  render();
});
$('#d-clear').addEventListener('click', () => { if (clips.length && confirm('Xóa tất cả mẫu đã thu?')) { clips.splice(0).forEach((c) => URL.revokeObjectURL(c.url)); render(); } });

// ---------------------------------------------------------------- Ghi liên tục, tự cắt mẫu
let mic = null, timer = null, startAt = 0, lastCut = 0;
$('#d-rec').addEventListener('click', async () => {
  const btn = $('#d-rec');
  if (mic) {
    clearInterval(timer); mic.stop(); mic = null;
    btn.classList.remove('recording');
    return;
  }
  const len = Number($('#d-len').value);
  mic = new LiveMic({ seconds: len + 1 });
  try { await mic.start(); } catch (e) { mic = null; return toast(micErrorMessage(e), { tone: 'error' }); }
  btn.classList.add('recording');
  startAt = performance.now(); lastCut = startAt;
  timer = setInterval(() => {
    const now = performance.now();
    const s = (now - startAt) / 1000;
    $('#d-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (now - lastCut >= len * 1000) {
      lastCut = now;
      const ok = addClip(mic.latest(len), label());
      if (!ok) toast('Đoạn vừa rồi quá yên lặng nên đã bỏ qua.');
      if (!$('#d-continuous').checked) {   // chế độ một mẫu: tự dừng
        clearInterval(timer); mic.stop(); mic = null;
        $('#d-rec').classList.remove('recording');
        if (ok) toast('Đã ghi xong một mẫu – AI đang nghe thử.', { tone: 'success' });
      }
    }
  }, 100);
});

// ---------------------------------------------------------------- Thêm file có sẵn
$('#d-files').addEventListener('change', async (e) => {
  const len = Number($('#d-len').value) * TARGET_SR;
  let n = 0;
  for (const f of e.target.files) {
    try {
      const { wave } = await decodeToMono16k(f);
      for (let a = 0; a < wave.length; a += len) {
        const seg = wave.slice(a, Math.min(wave.length, a + len));
        if (seg.length >= TARGET_SR && addClip(seg, label(), false)) n++;
      }
    } catch (err) {
      toast(`${f.name}: ${err.message}`, { tone: 'error' });
    }
  }
  toast(`Đã thêm ${n} mẫu`, { tone: 'success' });
  e.target.value = '';
});

// ---------------------------------------------------------------- Tải gói zip
$('#d-zip').addEventListener('click', async () => {
  const files = [];
  for (const c of clips) files.push({ name: `${c.label}/${c.name}`, data: new Uint8Array(await c.blob.arrayBuffer()) });
  const readme = `Gói mẫu Urban Sound – ${new Date().toLocaleString('vi-VN')}\nGiải nén vào training/data/my_sounds/ (mỗi thư mục là một nhãn) rồi chạy các script trong training/.\nWAV mono 16 kHz, 16-bit.\n`;
  files.push({ name: 'DOC_TOI.txt', data: new TextEncoder().encode(readme) });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(makeZip(files));
  a.download = `mau-am-thanh-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
});

hydrateIcons();
export { $$ };
