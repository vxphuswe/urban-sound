import { initLayout, $, esc } from '../ui.js';
import { safeHours, formatDuration, nearestReference, colorOf } from '../levels.js';
import { healthBanner } from '../render.js';

const EX = { 85: 'Giao thông giờ cao điểm', 88: 'Máy xay sinh tố', 91: 'Máy cắt cỏ', 94: 'Máy sấy tóc sát tai', 97: 'Xe máy rú ga', 100: 'Tàu điện ngầm, nhà máy', 103: 'Quán bar', 106: 'Buổi hòa nhạc', 110: 'Nhạc rock, máy cưa xích', 115: 'Còi xe cứu thương gần', 120: 'Sấm sét gần' };
$('#h-table').innerHTML = Object.entries(EX).map(([db, t]) => `<tr><td><span class="row" style="gap:8px;flex-wrap:nowrap"><span class="ldot" style="width:10px;height:10px;border-radius:50%;background:${colorOf(+db)}"></span><b class="mono">${db} dB</b></span></td><td class="muted">${esc(t)}</td><td class="num">${formatDuration(safeHours(+db))}</td></tr>`).join('');

function update() {
  const db = Number($('#h-db').value);
  $('#h-num').textContent = db;
  $('#h-num').style.color = colorOf(db);
  $('#h-like').textContent = `To như: ${nearestReference(db).text.toLowerCase()}`;
  $('#h-banner').innerHTML = healthBanner(db);
}
$('#h-db').addEventListener('input', update);
update();
initLayout();
