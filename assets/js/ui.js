// Khung chung của mọi trang: thanh điều hướng, chân trang, giao diện sáng/tối, thông báo nhỏ (toast).

import { CONFIG } from './config.js';
import { icon, LOGO_MARK } from './icons.js';
import { currentUser, onAuthChange, signOut, isDemoAuth } from './auth.js';
import { setUnlockHandler, recordVisit } from './journey.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NAV = [
  { href: 'huong-dan.html', label: 'Hướng dẫn', icon: 'book' },
  { href: 'nhan-dien.html', label: 'Nhận diện', icon: 'wave' },
  {
    label: 'Trực tiếp & đo ồn', icon: 'mic', match: ['truc-tiep.html', 'do-on.html'], items: [
      { href: 'truc-tiep.html', label: 'Giám sát trực tiếp', desc: 'Nghe liên tục, cảnh báo + đo dB', icon: 'mic' },
      { href: 'do-on.html', label: 'Máy đo độ ồn', desc: 'Đồng hồ decibel toàn màn hình', icon: 'gauge' },
      { href: 'do-on.html#so-sanh', label: 'So sánh mức ồn', desc: 'Tiếng của bạn to cỡ nào?', icon: 'bars' },
    ],
  },
  { href: 'suc-khoe.html', label: 'Sức khỏe', icon: 'shield' },
  {
    label: 'Thêm', icon: 'dots', items: [
      { href: 'lich-su.html', label: 'Lịch sử & yêu thích', desc: 'Xem lại các lần nhận diện', icon: 'history' },
      { href: 'du-lieu.html', label: 'Âm thanh của tôi', desc: 'Thu âm, lưu lại & dạy AI', icon: 'database' },
      { href: 'gioi-thieu.html', label: 'Về dự án & mô hình', desc: 'Công nghệ, độ chính xác', icon: 'cpu' },
    ],
  },
];

function page() {
  const p = location.pathname.split('/').pop() || 'index.html';
  return p.endsWith('.html') ? p : p + '.html';
}

function navHtml() {
  const cur = page();
  return NAV.map((n, i) => {
    if (!n.items) {
      const active = cur === n.href ? ' is-active' : '';
      return `<a class="nav-link${active}" href="${n.href}">${icon(n.icon, { size: 17 })}<span>${n.label}</span></a>`;
    }
    const active = (n.match || n.items.map((x) => x.href.split('#')[0])).includes(cur) ? ' is-active' : '';
    return `<div class="nav-drop" data-drop>
      <button class="nav-link${active}" type="button" aria-expanded="false" aria-haspopup="true" id="drop-${i}">${icon(n.icon, { size: 17 })}<span>${n.label}</span>${icon('chevron', { size: 14, cls: 'chev' })}</button>
      <div class="drop-menu" role="menu" aria-labelledby="drop-${i}">
        ${n.items.map((x) => `<a role="menuitem" href="${x.href}" class="drop-item"><span class="drop-ic">${icon(x.icon, { size: 18 })}</span><span><b>${x.label}</b><small>${x.desc}</small></span></a>`).join('')}
      </div></div>`;
  }).join('');
}

function headerHtml() {
  return `
  <div class="nav-wrap container">
    <a class="brand" href="index.html" aria-label="${CONFIG.APP_NAME} – trang chủ">
      <span class="brand-mark">${LOGO_MARK}</span>
      <span class="brand-name">${CONFIG.APP_NAME}</span>
    </a>
    <nav class="nav" aria-label="Chính">${navHtml()}</nav>
    <div class="nav-right">
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Đổi giao diện sáng/tối" title="Đổi giao diện sáng/tối">${icon('sun', { size: 18, cls: 'only-dark' })}${icon('moon', { size: 18, cls: 'only-light' })}</button>
      <div id="auth-slot" class="auth-slot"><a class="btn btn-ghost btn-sm" href="dang-nhap.html">Đăng nhập</a></div>
      <a class="btn btn-primary btn-sm hide-sm" id="cta-start" href="nhan-dien.html">Thử nhận diện</a>
      <button class="icon-btn show-sm" id="menu-toggle" type="button" aria-label="Mở menu" aria-expanded="false">${icon('menu', { size: 20 })}</button>
    </div>
  </div>
  <div class="drawer" id="drawer" hidden>
    ${[...new Map(NAV.flatMap((n) => n.items ? n.items : [n]).map((x) => [x.href, x])).values()].map((x) => `<a href="${x.href}" class="drawer-link">${icon(x.icon, { size: 18 })}${x.label}</a>`).join('')}
    <a class="btn btn-primary" href="nhan-dien.html">Bắt đầu nhận diện</a>
  </div>`;
}

function footerHtml() {
  const y = new Date().getFullYear();
  return `
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="brand" href="index.html"><span class="brand-mark">${LOGO_MARK}</span><span class="brand-name">${CONFIG.APP_NAME}</span></a>
      <p>Nghe, hiểu và cảnh báo âm thanh quanh bạn. Mọi xử lý diễn ra ngay trên thiết bị – âm thanh không bị gửi đi đâu.</p>
    </div>
    <div><h4>Công cụ</h4><a href="nhan-dien.html">Nhận diện âm thanh</a><a href="truc-tiep.html">Giám sát trực tiếp</a><a href="do-on.html">Máy đo decibel</a><a href="nhan-dien.html#phien-am">Phiên âm giọng nói</a></div>
    <div><h4>Tìm hiểu</h4><a href="huong-dan.html">Hướng dẫn sử dụng</a><a href="do-on.html#so-sanh">So sánh mức ồn</a><a href="suc-khoe.html">Sức khỏe & an toàn tai</a><a href="huong-dan.html#hoi-dap">Câu hỏi thường gặp</a></div>
    <div><h4>Dự án</h4><a href="gioi-thieu.html">Về dự án & mô hình</a><a href="du-lieu.html">Âm thanh của tôi</a><a href="lich-su.html">Lịch sử & yêu thích</a><a href="dang-nhap.html">Tài khoản</a></div>
  </div>
  <div class="container footer-bottom">
    <span>© ${y} ${CONFIG.APP_NAME} · Đồ án nhận diện âm thanh đô thị</span>
    <span class="muted">Số đo dB là ước tính, không thay thế thiết bị đo chuẩn.</span>
  </div>`;
}

async function renderAuth() {
  const slot = $('#auth-slot');
  if (!slot) return;
  const u = await currentUser().catch(() => null);
  // Đã đăng nhập thì không cần nút kêu gọi dùng thử nữa
  const cta = $('#cta-start');
  if (cta) cta.hidden = !!u;
  if (!u) {
    slot.innerHTML = `<a class="btn btn-ghost btn-sm" href="dang-nhap.html?next=${encodeURIComponent(page())}">Đăng nhập</a>`;
    return;
  }
  const initial = esc((u.name || u.email || '?').trim()[0].toUpperCase());
  slot.innerHTML = `<div class="nav-drop" data-drop>
    <button class="avatar-btn" type="button" aria-expanded="false" title="${esc(u.email || u.name)}">
      ${u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${initial}</span>`}
    </button>
    <div class="drop-menu drop-right" role="menu">
      <div class="drop-head"><b>${esc(u.name)}</b><small>${esc(u.email || '')}${u.demo ? ' · demo' : ''}</small></div>
      <a class="drop-item" href="lich-su.html"><span class="drop-ic">${icon('history', { size: 18 })}</span><span><b>Lịch sử & yêu thích</b></span></a>
      <button class="drop-item" type="button" id="logout-btn"><span class="drop-ic">${icon('logout', { size: 18 })}</span><span><b>Đăng xuất</b></span></button>
    </div></div>`;
  bindDrops(slot);
  $('#logout-btn')?.addEventListener('click', async () => { await signOut(); toast('Đã đăng xuất'); renderAuth(); });
}

function bindDrops(root = document) {
  $$('[data-drop]', root).forEach((d) => {
    const btn = d.querySelector('button');
    const close = () => { d.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !d.classList.contains('open');
      $$('[data-drop].open').forEach((o) => o.classList.remove('open'));
      d.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); btn.focus(); } });
  });
}

// ------------------------------------------------------------------ Thanh chuyển nhanh giữa 3 công cụ + hướng dẫn nhanh
const TOOLS = [
  { href: 'nhan-dien.html', label: 'Nhận diện file / ghi âm', short: 'Nhận diện', icon: 'wave' },
  { href: 'truc-tiep.html', label: 'Giám sát trực tiếp', short: 'Trực tiếp', icon: 'mic' },
  { href: 'do-on.html', label: 'Đo độ ồn', short: 'Đo độ ồn', icon: 'gauge' },
];

function renderToolTabs() {
  const el = $('#tool-tabs');
  if (!el) return;
  const cur = page();
  el.innerHTML = `<nav class="tool-tabs" aria-label="Công cụ">${TOOLS.map((t) => `<a href="${t.href}" class="${cur === t.href ? 'on' : ''}" ${cur === t.href ? 'aria-current="page"' : ''}>${icon(t.icon, { size: 17 })}<span class="lg">${t.label}</span><span class="sm">${t.short}</span></a>`).join('')}</nav>`;
}

/** Khối "Cách dùng nhanh" ở đầu trang công cụ, có thể thu gọn (nhớ lựa chọn). */
function renderQuickGuide() {
  const el = $('#quick-guide');
  if (!el) return;
  const steps = JSON.parse(el.dataset.steps || '[]');
  const key = `tp.qg.${page()}`;
  let closed = false;
  try { closed = localStorage.getItem(key) === '0'; } catch { /* bỏ qua */ }
  el.innerHTML = `<details class="qg" ${closed ? '' : 'open'}>
    <summary>${icon('book', { size: 18 })}<b>Cách dùng nhanh</b><span class="muted">${steps.length} bước</span><a class="link" href="huong-dan.html${el.dataset.anchor || ''}">Hướng dẫn chi tiết</a></summary>
    <ol class="qg-steps">${steps.map((s, i) => `<li><span class="qg-n">${i + 1}</span><div><b>${s[0]}</b><small>${s[1]}</small></div></li>`).join('')}</ol>
  </details>`;
  el.querySelector('details').addEventListener('toggle', (e) => { try { localStorage.setItem(key, e.target.open ? '1' : '0'); } catch { /* bỏ qua */ } });
}

export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('tp.theme', t); } catch { /* chế độ riêng tư */ }
}

/** Thông báo nhỏ ở góc màn hình */
export function toast(msg, { tone = 'default', ms = 3200 } = {}) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `${icon(tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'info', { size: 18 })}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Mở khóa huy hiệu: thẻ chúc mừng + pháo giấy nhỏ (tôn trọng "giảm chuyển động"). */
export function celebrate(b) {
  const el = document.createElement('div');
  el.className = 'badge-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="bt-medal">${icon(b.icon, { size: 26 })}</span><div><small>Mở khóa huy hiệu</small><b>${esc(b.name)}</b><span>${esc(b.hint)}</span></div><a class="link" href="index.html#hanh-trinh">Xem</a>`;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const conf = document.createElement('div');
    conf.className = 'bt-confetti';
    conf.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(Math.random() * 2 - 1) * 160}px;--y:${-60 - Math.random() * 120}px;--r:${Math.random() * 720}deg;--c:${['#2ee6c5', '#ffb547', '#ff5fa2', '#7c8cff', '#fff'][i % 5]};animation-delay:${Math.random() * 0.15}s"></i>`).join('');
    el.appendChild(conf);
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 5200);
}

/** Hiện dần các khối khi cuộn tới */
function reveal() {
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((e) => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

export function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const t = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return same ? `Hôm nay, ${t}` : `${d.toLocaleDateString('vi-VN')} ${t}`;
}

/** Thay các thẻ <span data-icon="tên"> trong HTML bằng SVG */
export function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, { size: Number(el.dataset.size) || 18 });
  });
}

export function initLayout() {
  hydrateIcons();
  const h = $('#site-header');
  if (h) h.innerHTML = headerHtml();
  const f = $('#site-footer');
  if (f) f.innerHTML = footerHtml();
  bindDrops(h || document);
  renderToolTabs();
  renderQuickGuide();
  document.addEventListener('click', () => $$('[data-drop].open').forEach((o) => o.classList.remove('open')));

  $('#theme-toggle')?.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  const mt = $('#menu-toggle');
  mt?.addEventListener('click', () => {
    const d = $('#drawer');
    const open = d.hasAttribute('hidden');
    d.toggleAttribute('hidden', !open);
    mt.setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('scroll', () => h?.classList.toggle('scrolled', scrollY > 8), { passive: true });

  renderAuth();
  onAuthChange(() => renderAuth());
  reveal();
  setUnlockHandler(celebrate);
  recordVisit();
  if (isDemoAuth() && page() === 'dang-nhap.html') document.body.classList.add('auth-demo');
}

// Áp dụng giao diện sớm nhất có thể (mặc định: tối)
try { applyTheme(localStorage.getItem('tp.theme') || 'dark'); } catch { applyTheme('dark'); }
