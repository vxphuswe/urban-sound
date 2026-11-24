// Kho file âm thanh trong trình duyệt (IndexedDB): lưu bền giữa các lần mở web, không gửi đi đâu.
//  - "audio":   file gắn với từng mục lịch sử (nghe lại, tải về)
//  - "samples": kho mẫu âm thanh người dùng tự thu để train thêm (trang Thu dữ liệu)

const DB_NAME = 'urban-sound-files';
const VERSION = 1;
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
        if (!d.objectStoreNames.contains('samples')) {
          const s = d.createObjectStore('samples', { keyPath: 'id' });
          s.createIndex('label', 'label');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((r) => { out = r; });
    t.oncomplete = () => resolve(out?.result !== undefined && out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// ------------------------------------------------------------------ File của lịch sử
/** Lưu file cho một mục lịch sử. Giới hạn tổng ~400 MB: tự xóa file cũ nhất (trừ mục được giữ). */
export async function putAudio(id, blob, name, keep = () => false) {
  if (!blob) return false;
  try {
    const rec = { blob, name: name || 'am-thanh', type: blob.type || 'audio/wav', size: blob.size, ts: Date.now() };
    await tx('audio', 'readwrite', (s) => s.put(rec, id));
    await trimAudio(400 * 1048576, keep);
    return true;
  } catch (e) {
    console.warn('Không lưu được file âm thanh:', e);
    return false;
  }
}

export async function getAudio(id) {
  try {
    const d = await db();
    return await req2p(d.transaction('audio').objectStore('audio').get(id));
  } catch { return null; }
}

export async function deleteAudio(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return;
  try { await tx('audio', 'readwrite', (s) => list.forEach((id) => s.delete(id))); } catch { /* bỏ qua */ }
}

export async function audioKeys() {
  try {
    const d = await db();
    return await req2p(d.transaction('audio').objectStore('audio').getAllKeys());
  } catch { return []; }
}

async function trimAudio(budget, keep) {
  const d = await db();
  const store = d.transaction('audio').objectStore('audio');
  const keys = await req2p(store.getAllKeys());
  const vals = await req2p(d.transaction('audio').objectStore('audio').getAll());
  let total = vals.reduce((n, v) => n + (v.size || 0), 0);
  if (total <= budget) return;
  const order = keys.map((k, i) => ({ k, ...vals[i] })).filter((x) => !keep(x.k)).sort((a, b) => a.ts - b.ts);
  const drop = [];
  for (const x of order) { if (total <= budget) break; total -= x.size || 0; drop.push(x.k); }
  await deleteAudio(drop);
}

// ------------------------------------------------------------------ Kho mẫu (trang Thu dữ liệu)
export async function putSample(sample) {
  await tx('samples', 'readwrite', (s) => s.put(sample));
  return sample;
}
export async function listSamples() {
  try {
    const d = await db();
    const all = await req2p(d.transaction('samples').objectStore('samples').getAll());
    return all.sort((a, b) => b.ts - a.ts);
  } catch { return []; }
}
export async function deleteSamples(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  await tx('samples', 'readwrite', (s) => list.forEach((id) => s.delete(id)));
}

/** Dung lượng trình duyệt cho phép và đang dùng (MB). */
export async function storageInfo() {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usedMB: (e.usage || 0) / 1048576, quotaMB: (e.quota || 0) / 1048576 };
  } catch { return null; }
}

/** Xin trình duyệt giữ dữ liệu lâu dài (không tự xóa khi máy thiếu dung lượng). */
export async function persist() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

export function extOf(type, name = '') {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (m) return m[1].toLowerCase();
  if (/wav/.test(type)) return 'wav';
  if (/mpeg|mp3/.test(type)) return 'mp3';
  if (/ogg/.test(type)) return 'ogg';
  if (/webm/.test(type)) return 'webm';
  if (/mp4|m4a|aac/.test(type)) return type.startsWith('video') ? 'mp4' : 'm4a';
  return 'bin';
}

/** Tên file an toàn (bỏ dấu, ký tự lạ). */
export function safeName(s) {
  return String(s || 'am-thanh').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'am-thanh';
}
