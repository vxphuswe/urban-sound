// Đăng nhập: Google, Apple hoặc mã 6 số qua email (Supabase Auth).
// Khi chưa cấu hình Supabase, web chạy "chế độ demo": tài khoản chỉ lưu trong trình duyệt này.

import { CONFIG, hasSupabase } from './config.js';

let client = null;
const listeners = new Set();
let cachedUser;

// Quay lại từ trang chọn tài khoản Google (luồng id_token): lấy kết quả trong "#..." NGAY khi tải trang,
// trước khi thư viện Supabase đọc địa chỉ, rồi xóa khỏi thanh địa chỉ.
const GOOGLE_RETURN = /(^|[#&])(id_token|error)=/.test(location.hash) && sessionStorage.getItem('tp.gnonce') ? location.hash.slice(1) : '';
if (GOOGLE_RETURN) history.replaceState(null, '', location.pathname + location.search);

export async function supabase() {
  if (!hasSupabase()) return null;
  if (client) return client;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  client.auth.onAuthStateChange((_e, session) => {
    cachedUser = session?.user ? mapUser(session.user) : null;
    listeners.forEach((fn) => fn(cachedUser));
  });
  return client;
}

function mapUser(u) {
  const m = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email,
    name: m.full_name || m.name || (u.email ? u.email.split('@')[0] : 'Bạn'),
    avatar: m.avatar_url || m.picture || '',
    provider: u.app_metadata?.provider || 'email',
    demo: false,
  };
}

export function isDemoAuth() { return !hasSupabase(); }

export async function currentUser() {
  if (cachedUser !== undefined) return cachedUser;
  const sb = await supabase().catch(() => null);
  if (sb) {
    const { data } = await sb.auth.getSession();
    cachedUser = data.session?.user ? mapUser(data.session.user) : null;
  } else {
    try { cachedUser = JSON.parse(localStorage.getItem('tp.demoUser') || 'null'); } catch { cachedUser = null; }
  }
  return cachedUser;
}

export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function setDemoUser(u) {
  cachedUser = u;
  if (u) localStorage.setItem('tp.demoUser', JSON.stringify(u)); else localStorage.removeItem('tp.demoUser');
  listeners.forEach((fn) => fn(u));
}

export async function signInWithProvider(provider) {
  const sb = await supabase();
  const NAME = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };
  if (!sb) throw new Error(`Đăng nhập ${NAME[provider]} cần cấu hình Supabase (xem README, mục "Đăng nhập"). Hiện bạn có thể dùng mã qua email ở chế độ demo.`);
  const next = new URLSearchParams(location.search).get('next') || 'lich-su.html';
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: new URL(next, location.href).href } });
  if (error) throw error;
}

export async function sendEmailCode(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email chưa đúng định dạng.');
  const sb = await supabase();
  if (!sb) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem('tp.demoCode', JSON.stringify({ email, code, t: Date.now() }));
    return { demoCode: code };
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/lich-su.html' } });
  if (error) throw new Error(error.message.includes('rate') ? 'Bạn gửi mã quá nhanh. Đợi một chút rồi thử lại.' : error.message);
  return {};
}

export async function verifyEmailCode(email, code) {
  const sb = await supabase();
  if (!sb) {
    const saved = JSON.parse(sessionStorage.getItem('tp.demoCode') || 'null');
    if (!saved || saved.email !== email || saved.code !== code) throw new Error('Mã không đúng. Kiểm tra lại 6 chữ số.');
    if (Date.now() - saved.t > 10 * 60 * 1000) throw new Error('Mã đã hết hạn. Hãy gửi mã mới.');
    sessionStorage.removeItem('tp.demoCode');
    setDemoUser({ id: 'demo-' + btoa(email).replace(/=/g, ''), email, name: email.split('@')[0], avatar: '', provider: 'email', demo: true });
    return cachedUser;
  }
  const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new Error('Mã không đúng hoặc đã hết hạn.');
  cachedUser = mapUser(data.user);
  return cachedUser;
}

export async function signOut() {
  const sb = await supabase();
  if (sb) await sb.auth.signOut();
  setDemoUser(null);
}

// ------------------------------------------------------------------ Google: trang chọn tài khoản ghi tên web của bạn
// Có CONFIG.GOOGLE_CLIENT_ID: chuyển thẳng tới Google với địa chỉ quay về là trang web này (không qua …supabase.co),
// Google trả về id_token, web đưa cho Supabase kiểm tra (signInWithIdToken). Chạy tốt cả trên điện thoại (không dùng cửa sổ bật lên).
export function hasGoogleDirect() { return Boolean(CONFIG.GOOGLE_CLIENT_ID) && hasSupabase(); }

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const googleRedirectUri = () => `${location.origin}/dang-nhap.html`;

export async function signInWithGoogleDirect(next = 'lich-su.html') {
  const raw = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem('tp.gnonce', raw);
  sessionStorage.setItem('tp.gnext', next);
  const q = new URLSearchParams({
    client_id: CONFIG.GOOGLE_CLIENT_ID, redirect_uri: googleRedirectUri(), response_type: 'id_token',
    scope: 'openid email profile', nonce: await sha256hex(raw), prompt: 'select_account',
  });
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** Gọi ở trang đăng nhập: hoàn tất nếu vừa quay về từ Google. Trả về user, null nếu không có gì, ném lỗi nếu thất bại. */
export async function finishGoogleDirect() {
  if (!GOOGLE_RETURN) return null;
  const h = new URLSearchParams(GOOGLE_RETURN);
  const raw = sessionStorage.getItem('tp.gnonce');
  sessionStorage.removeItem('tp.gnonce');
  if (h.get('error')) {
    if (h.get('error') === 'access_denied') return null; // người dùng bấm Hủy
    throw new Error(/redirect_uri/.test(h.get('error_description') || h.get('error')) ? 'Google chưa cho phép địa chỉ quay về. Thêm …/dang-nhap.html vào "Authorized redirect URIs" trong Google Cloud.' : `Google báo lỗi: ${h.get('error_description') || h.get('error')}`);
  }
  const sb = await supabase();
  const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: h.get('id_token'), nonce: raw });
  if (error) throw new Error(/audience|client/i.test(error.message) ? 'Supabase chưa chấp nhận Client ID này. Thêm Client ID vào Supabase → Authentication → Providers → Google.' : error.message);
  cachedUser = mapUser(data.user);
  listeners.forEach((fn) => fn(cachedUser));
  return cachedUser;
}
export const googleNext = () => sessionStorage.getItem('tp.gnext') || 'lich-su.html';
