import { initLayout, $, esc } from '../ui.js';
import { ILLUSTRATIONS } from '../icons.js';
import { publicGroups, KIND_INFO } from '../categories.js';
import { dot, referenceList } from '../render.js';
import { faqHtml, FAQ } from '../faq.js';

$('#hero-illo').innerHTML = ILLUSTRATIONS.dog;

const order = ['danger', 'caution', 'people', 'nature', 'ambient'];
const byKind = {};
for (const g of publicGroups()) (byKind[g.kind] ||= []).push(g);
$('#kinds').innerHTML = order.filter((k) => byKind[k]).map((k) => `
  <div class="card card-pad">
    <div class="row" style="gap:8px;margin-bottom:12px"><span class="badge tone-${KIND_INFO[k].tone} tone-bg">${KIND_INFO[k].label}</span></div>
    <div style="display:grid;gap:8px">${byKind[k].map((g) => `<div class="row" style="gap:10px;font-size:.92rem;flex-wrap:nowrap;line-height:1.3">${dot(g, 15)}<span>${esc(g.vi)}</span></div>`).join('')}</div>
  </div>`).join('');
$('#kinds').style.gridTemplateColumns = 'repeat(auto-fit, minmax(210px, 1fr))';

$('#home-levels').innerHTML = referenceList(60);
$('#home-faq').innerHTML = faqHtml(FAQ.slice(0, 6));

initLayout();
