import { initLayout, $, esc } from '../ui.js';
import { icon } from '../icons.js';
import { GROUPS, KIND_INFO } from '../categories.js';
import { BANDS } from '../levels.js';
import { dot } from '../render.js';
import { faqHtml } from '../faq.js';

const KIND_DESC = {
  danger: 'Súng, nổ, còi hú, chuông báo cháy, kính vỡ – thẻ đỏ, nhấp nháy, phát âm báo.',
  caution: 'Còi xe, la hét, công trường, pháo – thẻ cam, nên để ý.',
  people: 'Tiếng nói, trẻ em nô đùa, âm nhạc, chuông điện thoại – thẻ xanh dương, bình thường.',
  nature: 'Chó, mèo, chim, mưa, nước chảy – thẻ xanh lá, bình thường.',
  ambient: 'Máy lạnh, quạt, xe cộ, ồn nền – thẻ xám.',
};
$('#kind-legend').innerHTML = Object.entries(KIND_INFO).map(([k, v]) => `<div class="row" style="gap:12px;flex-wrap:nowrap"><span class="badge tone-${v.tone} tone-bg" style="min-width:150px">${v.label}</span><span class="muted" style="font-size:.92rem">${KIND_DESC[k]}</span></div>`).join('');
let lo = 0;
$('#band-legend').innerHTML = BANDS.map((b) => {
  const range = isFinite(b.max) ? `${lo}–${b.max} dB` : `≥ ${lo} dB`;
  lo = b.max;
  return `<div class="row" style="gap:12px;flex-wrap:nowrap"><span class="badge tone-${b.tone} tone-bg" style="min-width:150px">${icon(b.icon, { size: 14 })} ${b.label}</span><span class="mono muted" style="font-size:.9rem">${range}</span></div>`;
}).join('');

$('#group-table tbody').innerHTML = GROUPS.filter((g) => !['noise'].includes(g.id)).map((g) => `
  <tr><td><div class="row" style="gap:10px;flex-wrap:nowrap">${dot(g, 15)}<b>${esc(g.vi)}</b></div></td>
  <td><span class="badge tone-${KIND_INFO[g.kind].tone} tone-bg">${KIND_INFO[g.kind].label}</span></td>
  <td class="muted hide-sm" style="font-size:.82rem">${esc(g.names.slice(0, 6).join(', '))}${g.range ? ', mọi thể loại nhạc' : ''}${g.names.length > 6 ? '…' : ''}</td></tr>`).join('');

$('#faq').innerHTML = faqHtml();
initLayout();
