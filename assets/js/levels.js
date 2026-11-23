// Thang mức âm thanh, màu sắc và lời khuyên sức khỏe.
// Tham chiếu: NIOSH khuyến nghị giới hạn 85 dBA trung bình trong 8 giờ, cứ tăng 3 dB thì thời gian an toàn giảm một nửa.

export const REFERENCE_LEVELS = [
  { db: 140, text: 'Pháo hoa, tiếng súng', color: '#b91c1c' },
  { db: 130, text: 'Máy bay phản lực cất cánh', color: '#c2262b' },
  { db: 120, text: 'Còi xe cứu thương, sấm sét', color: '#dc3b3b' },
  { db: 110, text: 'Nhạc rock, máy cưa xích', color: '#e5483b' },
  { db: 100, text: 'Tàu điện ngầm, nhà máy', color: '#e8742f' },
  { db: 90,  text: 'Máy cắt cỏ, máy sấy tóc', color: '#e0a426' },
  { db: 80,  text: 'Giao thông đông đúc, đồng hồ báo thức', color: '#d6b02a' },
  { db: 70,  text: 'Máy hút bụi, nhà hàng', color: '#7fae3b' },
  { db: 60,  text: 'Trò chuyện, văn phòng', color: '#3f9b68' },
  { db: 50,  text: 'Văn phòng yên tĩnh, tủ lạnh', color: '#2f9173' },
  { db: 40,  text: 'Thư viện, mưa nhỏ', color: '#3b7dd8' },
  { db: 30,  text: 'Tiếng thì thầm, lá rụng', color: '#4b77d1' },
  { db: 20,  text: 'Tiếng thở nhẹ', color: '#6a7fd0' },
  { db: 10,  text: 'Gần như im lặng', color: '#8a90a3' },
  { db: 0,   text: 'Ngưỡng nghe thấy', color: '#9aa0ad' },
];

// Năm mức trạng thái dùng cho viền, icon và thông báo
export const BANDS = [
  { max: 45,  id: 'quiet',  label: 'Yên tĩnh',  word: 'Nhỏ',      tone: 'blue',  icon: 'vol0' },
  { max: 70,  id: 'normal', label: 'Bình thường', word: 'Vừa',    tone: 'green', icon: 'vol1' },
  { max: 85,  id: 'loud',   label: 'Ồn',        word: 'To',       tone: 'amber', icon: 'vol2' },
  { max: 100, id: 'vloud',  label: 'Rất ồn',    word: 'Rất to',   tone: 'orange', icon: 'vol3' },
  { max: Infinity, id: 'danger', label: 'Nguy hiểm', word: 'Cực to', tone: 'red', icon: 'vol3' },
];

export function bandOf(db) {
  return BANDS.find((b) => db < b.max) || BANDS[BANDS.length - 1];
}

/** Màu liên tục theo dB (nội suy theo bảng tham chiếu). */
export function colorOf(db) {
  const L = [...REFERENCE_LEVELS].reverse();
  if (db <= L[0].db) return L[0].color;
  for (let i = 1; i < L.length; i++) {
    if (db <= L[i].db) return L[i].color;
  }
  return L[L.length - 1].color;
}

/** Âm thanh tham chiếu gần nhất (để nói "to như ..."). */
export function nearestReference(db) {
  let best = REFERENCE_LEVELS[0];
  for (const r of REFERENCE_LEVELS) if (Math.abs(r.db - db) < Math.abs(best.db - db)) best = r;
  return best;
}

/** Thời gian tiếp xúc an toàn mỗi ngày theo NIOSH (giờ). */
export function safeHours(db, limit = 85) {
  if (db < limit) return Infinity;
  return 8 / Math.pow(2, (db - limit) / 3);
}

export function formatDuration(hours) {
  if (!isFinite(hours)) return 'không giới hạn';
  if (hours >= 1) return `${Math.round(hours * 10) / 10} giờ`;
  const m = hours * 60;
  if (m >= 1) return `${Math.round(m)} phút`;
  return `${Math.max(1, Math.round(m * 60))} giây`;
}

/** Lời khuyên sức khỏe cho một mức dB. */
export function healthAdvice(db, limit = 85) {
  const b = bandOf(db);
  if (db < 70) return { safe: true, tone: 'green', title: 'An toàn cho tai', text: 'Mức âm thanh này không gây hại cho thính giác, kể cả khi nghe cả ngày.' };
  if (db < limit) return { safe: true, tone: 'amber', title: 'Khá ồn nhưng vẫn an toàn', text: 'Có thể gây mệt mỏi, khó tập trung nếu kéo dài. Chưa gây hại cho tai.' };
  const t = formatDuration(safeHours(db, limit));
  return {
    safe: false,
    tone: b.tone,
    title: db >= 100 ? 'Nguy hiểm cho tai' : 'Có thể hại tai nếu kéo dài',
    text: `Ở khoảng ${Math.round(db)} dB, chỉ nên tiếp xúc tối đa khoảng ${t} mỗi ngày. Hãy tránh xa nguồn âm hoặc dùng nút bịt tai.`,
  };
}

/** Phần trăm cho thanh đo (0 dB -> 0%, 120 dB -> 100%). */
export function percentOf(db) {
  return Math.max(0, Math.min(100, (db / 120) * 100));
}

/** So sánh hai mức: âm thanh to hơn bao nhiêu lần (cảm nhận: x2 mỗi 10 dB; năng lượng: x10 mỗi 10 dB). */
export function compareLevels(a, b) {
  const d = a - b;
  return { diff: d, perceived: Math.pow(2, d / 10), energy: Math.pow(10, d / 10) };
}
