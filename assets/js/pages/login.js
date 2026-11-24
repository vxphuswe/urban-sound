import { initLayout, $, $$, toast, esc } from '../ui.js';
import { BRAND } from '../icons.js';
import { CONFIG } from '../config.js';
import { currentUser, signInWithProvider, sendEmailCode, verifyEmailCode, signOut, isDemoAuth, supabase, hasGoogleDirect, signInWithGoogleDirect, finishGoogleDirect, googleNext } from '../auth.js';

initLayout();
$('#g-logo').outerHTML = BRAND.google;
$('#a-logo').outerHTML = BRAND.apple;
if (isDemoAuth()) document.body.classList.add('auth-demo');
$('#auth-eq').innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="background:#fff;opacity:.85;height:${6 + Math.abs(Math.sin(i * 1.3)) * 26}px"></i>`).join('');

const next = new URLSearchParams(location.search).get('next') || 'lich-su.html';
$('#go-next').href = next;
let email = '';

function show(step) {
  for (const s of ['start', 'code', 'done']) $(`#step-${s}`).hidden = s !== step;
}

async function showDone(u) {
  $('#hello-name').textContent = u.name;
  show('done');
}

// Đã đăng nhập (kể cả vừa quay lại từ Google/Apple)
(async () => {
  await supabase().catch(() => null);
  const u = await currentUser();
  if (u) showDone(u);
})();

// ------------------------------------------------------------------ Google / Apple / Facebook
const PROVIDER_NAME = { google: 'Google', apple: 'Apple' };
const notReady = (p) => {
  const on = Object.keys(PROVIDER_NAME).filter((k) => CONFIG.AUTH_PROVIDERS?.[k]).map((k) => PROVIDER_NAME[k]);
  const why = p === 'apple' ? ' (cần tài khoản Apple Developer trả phí)' : '';
  toast(`Đăng nhập ${PROVIDER_NAME[p]} chưa được bật${why}. Bạn dùng ${[...on, 'mã qua email'].join(', ')} nhé.`, { ms: 6000 });
};

$('.oauth').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-provider]');
  if (!b) return;
  const p = b.dataset.provider;
  if (!isDemoAuth() && !CONFIG.AUTH_PROVIDERS?.[p]) return notReady(p);
  b.disabled = true;
  b.classList.add('loading');
  try {
    if (p === 'google' && hasGoogleDirect()) await signInWithGoogleDirect(next); // trang chọn tài khoản ghi tên web
    else await signInWithProvider(p);
  } catch (err) {
    toast(err.message, { tone: 'error', ms: 7000 });
    b.disabled = false; b.classList.remove('loading');
  }
});

// Vừa quay về từ Google
finishGoogleDirect().then((u) => {
  if (!u) return;
  toast(`Đăng nhập thành công. Chào ${u.name}!`, { tone: 'success' });
  $('#go-next').href = googleNext();
  showDone(u);
}).catch((err) => toast(err.message, { tone: 'error', ms: 9000 }));

$('#email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  email = $('#email').value.trim().toLowerCase();
  const btn = $('#send-btn');
  btn.disabled = true; btn.textContent = 'Đang gửi…';
  try {
    const r = await sendEmailCode(email);
    $('#sent-to').textContent = email;
    show('code');
    $$('#otp input')[0].focus();
    if (r.demoCode) toast(`Chế độ demo – mã của bạn: ${r.demoCode}`, { ms: 15000 });
  } catch (err) {
    toast(err.message, { tone: 'error' });
  } finally {
    btn.disabled = false; btn.textContent = 'Nhận mã đăng nhập';
  }
});

// Ô nhập mã: tự nhảy ô, dán cả 6 số
const boxes = $$('#otp input');
boxes.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(-1);
    if (inp.value && i < 5) boxes[i + 1].focus();
    if (boxes.every((b) => b.value)) $('#code-form').requestSubmit();
  });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && i > 0) boxes[i - 1].focus(); });
  inp.addEventListener('paste', (e) => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (t.length) { e.preventDefault(); t.split('').forEach((c, k) => (boxes[k].value = c)); boxes[Math.min(5, t.length - 1)].focus(); if (t.length === 6) $('#code-form').requestSubmit(); }
  });
});

$('#code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = boxes.map((b) => b.value).join('');
  if (code.length !== 6) return toast('Hãy nhập đủ 6 chữ số.', { tone: 'error' });
  const btn = $('#verify-btn');
  btn.disabled = true;
  try {
    const u = await verifyEmailCode(email, code);
    toast(`Đăng nhập thành công. Chào ${u.name}!`, { tone: 'success' });
    showDone(u);
  } catch (err) {
    toast(err.message, { tone: 'error' });
    boxes.forEach((b) => (b.value = '')); boxes[0].focus();
  } finally {
    btn.disabled = false;
  }
});

$('#resend').addEventListener('click', async () => {
  try { const r = await sendEmailCode(email); toast(r.demoCode ? `Mã mới (demo): ${r.demoCode}` : 'Đã gửi lại mã.', { ms: 10000 }); } catch (err) { toast(err.message, { tone: 'error' }); }
});
$('#back').addEventListener('click', () => show('start'));
$('#logout').addEventListener('click', async () => { await signOut(); show('start'); toast('Đã đăng xuất'); });
