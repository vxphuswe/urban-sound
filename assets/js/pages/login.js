import { initLayout, $, $$, toast, esc } from '../ui.js';
import { BRAND } from '../icons.js';
import { currentUser, signInWithProvider, sendEmailCode, verifyEmailCode, signOut, isDemoAuth, supabase, hasGoogleGis, renderGoogleButton } from '../auth.js';

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

$('#btn-google').addEventListener('click', () => signInWithProvider('google').catch((e) => toast(e.message, { tone: 'error', ms: 6000 })));
// Có Client ID: dùng nút Google chính thức (cửa sổ Google ghi tên web thay vì "...supabase.co")
if (hasGoogleGis()) {
  const holder = document.createElement('div');
  holder.className = 'gsi-holder';
  $('#btn-google').after(holder);
  renderGoogleButton(holder, {
    onDone: (u) => { toast(`Đăng nhập thành công. Chào ${u.name}!`, { tone: 'success' }); showDone(u); },
    onError: (e) => toast(e.message, { tone: 'error', ms: 8000 }),
  }).then(() => { $('#btn-google').hidden = true; }).catch(() => holder.remove()); // lỗi tải → giữ nút cũ
}
$('#btn-apple').addEventListener('click', () => signInWithProvider('apple').catch((e) => toast(e.message, { tone: 'error', ms: 6000 })));

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
