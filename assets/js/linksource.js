// Lấy âm thanh từ link: YouTube (nghe qua thẻ trình duyệt), Google Drive, Dropbox hoặc link file trực tiếp.
// Dùng chung cho trang Nhận diện và trang Âm thanh của tôi.

export function parseYouTube(raw) {
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

export function directUrl(raw) {
  const u = new URL(raw);
  const drive = u.hostname === 'drive.google.com' && (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1];
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive}`;
  if (u.hostname.endsWith('dropbox.com')) { u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); }
  return u.href;
}

export async function fetchAudio(url) {
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

/** Lệnh điều khiển video YouTube nhúng (cần enablejsapi=1). */
export function ytCommand(frame, func) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}
export const ytEmbed = (yt) => `https://www.youtube-nocookie.com/embed/${yt.id}?enablejsapi=1&rel=0&start=${yt.start}&origin=${encodeURIComponent(location.origin)}`;
