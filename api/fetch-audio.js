// Vercel Serverless Function: tải hộ một file âm thanh/video từ link trực tiếp (vượt giới hạn CORS của trình duyệt).
// GET /api/fetch-audio?url=https://.../tieng-cho.mp3
// An toàn: chỉ http/https, chặn địa chỉ nội bộ (SSRF), chỉ nhận file âm thanh/video, tối đa ~4 MB (giới hạn phản hồi của Vercel).

import { lookup } from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const OK_TYPES = /^(audio\/|video\/|application\/ogg|application\/octet-stream|binary\/octet-stream)/i;

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}

async function assertPublic(u) {
  if (!['http:', 'https:'].includes(u.protocol)) throw Object.assign(new Error('Chỉ hỗ trợ link http/https.'), { status: 400 });
  const addrs = await lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw Object.assign(new Error('Địa chỉ không được phép.'), { status: 400 });
}

export default async function handler(req, res) {
  try {
    let target = new URL(String(req.query?.url || ''));
    let r;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublic(target);
      r = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'UrbanSound/1.0 (+https://urban-sound-ai.vercel.app)' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { target = new URL(r.headers.get('location'), target); continue; }
      break;
    }
    if (!r || !r.ok) return res.status(502).json({ error: `Máy chủ nguồn trả lỗi ${r?.status ?? ''}.` });
    const type = r.headers.get('content-type') || '';
    if (!OK_TYPES.test(type)) return res.status(415).json({ error: 'Link này là trang web, không phải file âm thanh/video.' });
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return res.status(413).json({ error: 'File lớn hơn 4 MB. Hãy tải file về máy rồi dùng thẻ "Tải file".' });

    const chunks = [];
    let total = 0;
    for await (const c of r.body) {
      total += c.length;
      if (total > MAX_BYTES) return res.status(413).json({ error: 'File lớn hơn 4 MB. Hãy tải file về máy rồi dùng thẻ "Tải file".' });
      chunks.push(c);
    }
    res.setHeader('Content-Type', type.split(';')[0]);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  } catch (e) {
    const msg = e?.name === 'TimeoutError' ? 'Quá thời gian tải (15 giây).' : (e?.message || 'Không tải được link.');
    return res.status(e?.status || 400).json({ error: msg });
  }
}
