import { initLayout, $, esc } from '../ui.js';

const VI = {
  air_conditioner: 'Máy lạnh', car_horn: 'Còi xe', children_playing: 'Trẻ em chơi đùa', dog_bark: 'Chó sủa', drilling: 'Máy khoan',
  engine_idling: 'Động cơ', gun_shot: 'Tiếng súng', jackhammer: 'Búa khoan', siren: 'Còi hú', street_music: 'Nhạc đường phố',
};
const pct = (x) => `${(x * 100).toFixed(1).replace('.', ',')}%`;

async function load() {
  try {
    const [m, e] = await Promise.all([fetch('assets/data/cnn_metrics.json').then((r) => r.json()), fetch('assets/data/cnn_esc50_eval.json').then((r) => r.json())]);
    $('#acc').textContent = pct(e.us8k_fold10.acc);
    $('#unk').textContent = pct(e.unknown_sounds.thresholds['0.5'].accepted);
    $('#voice').textContent = pct(e.voice.thresholds['0.5'].accepted);

    // Biểu đồ thanh ngang: % âm lạ/tiếng người vẫn bị nhận theo ngưỡng
    const ths = Object.keys(e.unknown_sounds.thresholds);
    $('#thr-chart').innerHTML = `<div style="display:grid;gap:10px">${ths.map((t) => {
      const u = e.unknown_sounds.thresholds[t].accepted, v = e.voice.thresholds[t].accepted;
      return `<div style="display:grid;grid-template-columns:70px 1fr;gap:10px;align-items:center;font-size:.85rem">
        <span class="mono muted">τ = ${t.replace('.', ',')}</span>
        <div style="display:grid;gap:4px">
          <div style="height:12px;border-radius:6px;background:var(--orange);width:${u * 100}%" title="Âm lạ bị nhận ${pct(u)}"></div>
          <div style="height:12px;border-radius:6px;background:var(--blue);width:${v * 100}%" title="Tiếng người bị nhận ${pct(v)}"></div>
        </div></div>`;
    }).join('')}</div>
    <div class="row" style="gap:16px;margin-top:14px;font-size:.85rem"><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:3px;background:var(--orange)"></i>Âm thanh lạ bị nhận nhầm</span><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:3px;background:var(--blue)"></i>Tiếng người bị nhận nhầm</span></div>`;

    // Ma trận nhầm lẫn
    const cm = m.confusion_matrix;
    const max = Math.max(...cm.flat());
    $('#cm').innerHTML = `<thead><tr><th>Thật \\ Đoán</th>${m.classes.map((c) => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:120px;font-size:.72rem">${esc(VI[c] || c)}</th>`).join('')}<th>Recall</th></tr></thead>
      <tbody>${cm.map((row, i) => {
        const sum = row.reduce((a, b) => a + b, 0);
        return `<tr><th style="font-size:.8rem;white-space:nowrap">${esc(VI[m.classes[i]] || m.classes[i])}</th>${row.map((v, j) => `<td class="num" style="text-align:center;background:color-mix(in srgb, ${i === j ? 'var(--accent)' : 'var(--red)'} ${Math.round((v / max) * 85)}%, transparent);font-size:.8rem">${v || ''}</td>`).join('')}<td class="num">${pct(row[i] / sum)}</td></tr>`;
      }).join('')}</tbody>`;
  } catch (err) {
    console.warn(err);
  }
}
load();
initLayout();
