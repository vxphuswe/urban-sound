// Lịch sử nhận diện và danh sách yêu thích.
// Luôn lưu trong trình duyệt; nếu đăng nhập bằng Supabase thì đồng bộ thêm lên bảng `detections`.

import { supabase, currentUser } from './auth.js';
import { putAudio, deleteAudio } from './blobstore.js';
import { recordDetection } from './journey.js';

const KEY = 'tp.history';
const MAX = 300;

function readLocal() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function writeLocal(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* đầy bộ nhớ */ }
  window.dispatchEvent(new CustomEvent('tp:history'));
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function remote() {
  const u = await currentUser();
  if (!u || u.demo) return null;
  const sb = await supabase();
  return sb ? { sb, u } : null;
}

const toRow = (it, uid) => ({
  id: it.id, user_id: uid, created_at: new Date(it.ts).toISOString(), source: it.source, file_name: it.fileName || null,
  group_id: it.groupId, label: it.label, confidence: it.conf, level_db: it.levelDb, peak_db: it.peakDb,
  duration: it.duration, transcript: it.transcript || null, favorite: Boolean(it.fav), extra: { kind: it.kind, icon: it.icon, alts: it.alts || [], status: it.status },
});
const fromRow = (r) => ({
  id: r.id, ts: Date.parse(r.created_at), source: r.source, fileName: r.file_name, groupId: r.group_id, label: r.label,
  conf: r.confidence, levelDb: r.level_db, peakDb: r.peak_db, duration: r.duration, transcript: r.transcript, fav: r.favorite,
  kind: r.extra?.kind, icon: r.extra?.icon, alts: r.extra?.alts || [], status: r.extra?.status, synced: true,
});

/** Thêm một lần nhận diện. item: {source, fileName, groupId, label, conf, kind, icon, levelDb, peakDb, duration, transcript, alts, status} */
export async function addEntry(item, { audio, audioName } = {}) {
  const it = { id: uuid(), ts: Date.now(), fav: false, ...item };
  if (audio) {
    const ok = await putAudio(it.id, audio, audioName || item.fileName, (k) => readLocal().some((x) => x.id === k && x.fav));
    if (ok) { it.hasAudio = true; it.audioName = audioName || item.fileName || ''; it.audioSize = audio.size; }
  }
  writeLocal([it, ...readLocal()]);
  if (it.groupId && it.status !== 'quiet') recordDetection(String(it.groupId).startsWith('my_') ? null : it.groupId, it.kind);
  const r = await remote().catch(() => null);
  if (r) {
    const { error } = await r.sb.from('detections').insert(toRow(it, r.u.id));
    if (!error) patchLocal(it.id, { synced: true });
  }
  return it;
}

function patchLocal(id, patch) {
  writeLocal(readLocal().map((x) => (x.id === id ? { ...x, ...patch } : x)));
}

export async function updateEntry(id, patch) {
  patchLocal(id, patch);
  const r = await remote().catch(() => null);
  if (r) {
    const row = {};
    if ('fav' in patch) row.favorite = patch.fav;
    if ('transcript' in patch) row.transcript = patch.transcript;
    if (Object.keys(row).length) await r.sb.from('detections').update(row).eq('id', id);
  }
}

export async function toggleFavorite(id) {
  const it = readLocal().find((x) => x.id === id);
  const fav = !(it?.fav);
  await updateEntry(id, { fav });
  return fav;
}

export async function removeEntry(id) {
  writeLocal(readLocal().filter((x) => x.id !== id));
  deleteAudio(id);
  const r = await remote().catch(() => null);
  if (r) await r.sb.from('detections').delete().eq('id', id);
}

/** Xóa lịch sử nhưng GIỮ các mục yêu thích. */
export async function clearHistory() {
  deleteAudio(readLocal().filter((x) => !x.fav).map((x) => x.id));
  writeLocal(readLocal().filter((x) => x.fav));
  const r = await remote().catch(() => null);
  if (r) await r.sb.from('detections').delete().eq('favorite', false);
}

export async function listEntries() {
  const local = readLocal();
  const r = await remote().catch(() => null);
  if (!r) return local;
  const { data, error } = await r.sb.from('detections').select('*').order('created_at', { ascending: false }).limit(MAX);
  if (error) return local;
  // đẩy các mục tạo lúc chưa đăng nhập lên tài khoản
  const ids = new Set(data.map((d) => d.id));
  const pending = local.filter((x) => !ids.has(x.id) && !x.synced);
  if (pending.length) await r.sb.from('detections').insert(pending.map((x) => toRow(x, r.u.id)));
  const localById = new Map(local.map((x) => [x.id, x]));
  const withLocal = (x) => { const l = localById.get(x.id); return l?.hasAudio ? { ...x, hasAudio: true, audioName: l.audioName, audioSize: l.audioSize } : x; };
  const merged = [...pending.map((x) => ({ ...x, synced: true })), ...data.map(fromRow).map(withLocal)].sort((a, b) => b.ts - a.ts);
  writeLocal(merged);
  return merged;
}

export function localCount() { return readLocal().length; }
