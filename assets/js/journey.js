// "Hành trình nghe": bộ sưu tập âm thanh đã gặp, chuỗi ngày dùng liên tiếp và huy hiệu.
// Lưu trong trình duyệt (localStorage). Chỉ đếm những gì AI thật sự nhận ra – không có điểm ảo.

const KEY = 'tp.journey';

export const BADGES = [
  { id: 'first', icon: 'ear', name: 'Lần đầu lắng nghe', hint: 'Nhận diện âm thanh đầu tiên', test: (j) => j.detections >= 1 },
  { id: 'kinds5', icon: 'sparkles', name: 'Tai thính', hint: 'Gặp 5 loại âm thanh khác nhau', test: (j) => nKinds(j) >= 5 },
  { id: 'kinds15', icon: 'star', name: 'Nhà sưu tầm âm thanh', hint: 'Gặp 15 loại âm thanh khác nhau', test: (j) => nKinds(j) >= 15 },
  { id: 'kinds25', icon: 'logo', name: 'Đôi tai thành phố', hint: 'Gặp 25 loại âm thanh khác nhau', test: (j) => nKinds(j) >= 25 },
  { id: 'streak3', icon: 'fire', name: 'Ba ngày liền', hint: 'Dùng web 3 ngày liên tiếp', test: (j) => streak(j) >= 3 },
  { id: 'streak7', icon: 'fire', name: 'Một tuần không nghỉ', hint: 'Dùng web 7 ngày liên tiếp', test: (j) => streak(j) >= 7 },
  { id: 'guard10', icon: 'shield', name: 'Người gác phố', hint: 'Giám sát trực tiếp tổng 10 phút', test: (j) => j.liveSec >= 600 },
  { id: 'guard60', icon: 'shield', name: 'Canh đêm', hint: 'Giám sát trực tiếp tổng 1 giờ', test: (j) => j.liveSec >= 3600 },
  { id: 'teacher', icon: 'database', name: 'Người dạy AI', hint: 'Thu 3 mẫu để dạy AI một âm thanh riêng', test: (j) => j.taught >= 3 },
  { id: 'danger', icon: 'alert', name: 'Phát hiện kịp thời', hint: 'AI phát hiện một âm thanh nguy hiểm', test: (j) => j.danger >= 1 },
  { id: 'fifty', icon: 'bars', name: 'Năm mươi lần nghe', hint: 'Nhận diện tổng cộng 50 lần', test: (j) => j.detections >= 50 },
];

const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function load() {
  let j = {};
  try { j = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { j = {}; }
  return { days: [], kinds: {}, firstSeen: {}, detections: 0, liveSec: 0, taught: 0, danger: 0, badges: {}, ...j };
}
function save(j) { try { localStorage.setItem(KEY, JSON.stringify(j)); } catch { /* đầy bộ nhớ */ } }

export function nKinds(j) { return Object.keys(j.kinds).length; }
export function streak(j) {
  const set = new Set(j.days);
  let n = 0;
  const d = new Date();
  if (!set.has(today(d))) d.setDate(d.getDate() - 1); // hôm nay chưa dùng thì tính tới hôm qua
  while (set.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

let onUnlock = null;
/** ui.js đăng ký hàm hiện thông báo khi mở khóa huy hiệu. */
export function setUnlockHandler(fn) { onUnlock = fn; }

function update(mut) {
  const j = load();
  mut(j);
  const t = today();
  if (!j.days.includes(t)) { j.days.push(t); j.days = j.days.slice(-60); }
  const fresh = [];
  for (const b of BADGES) if (!j.badges[b.id] && b.test(j)) { j.badges[b.id] = Date.now(); fresh.push(b); }
  save(j);
  fresh.forEach((b) => onUnlock?.(b));
  window.dispatchEvent(new CustomEvent('tp:journey'));
  return j;
}

export const recordVisit = () => update(() => {});
export const recordDetection = (groupId, kind) => update((j) => {
  j.detections++;
  if (groupId) {
    j.kinds[groupId] = (j.kinds[groupId] || 0) + 1;
    j.firstSeen[groupId] = j.firstSeen[groupId] || Date.now();
  }
  if (kind === 'danger') j.danger++;
});
export const recordLive = (sec) => update((j) => { j.liveSec += sec; });
export const recordTeach = () => update((j) => { j.taught++; });
