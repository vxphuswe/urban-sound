// Câu hỏi thường gặp – dùng chung cho trang chủ và trang hướng dẫn.
export const FAQ = [
  ['Urban Sound nhận diện được những âm thanh nào?', 'Hơn 40 nhóm quen thuộc như chó sủa, mèo kêu, chim hót, trẻ em nô đùa, em bé khóc, tiếng nói, âm nhạc, xe máy, còi xe, còi hú, tiếng súng/nổ, pháo, chuông báo cháy, kính vỡ, công trường, máy lạnh, mưa… Bên dưới là mô hình YAMNet của Google biết 521 loại âm thanh chi tiết. Xem danh sách đầy đủ ở trang Hướng dẫn.'],
  ['Vì sao trước đây tiếng chó sủa lại bị nhận thành máy lạnh?', 'Mô hình cũ chỉ biết 10 loại âm thanh, nên mọi tiếng lạ hoặc tạp âm đều bị ép vào 1 trong 10 loại. Bản mới biết nhiều loại hơn, lọc tạp âm nền trước khi nhận diện, giảm ưu tiên cho tiếng nền (máy lạnh, quạt) và chỉ trả lời khi đủ chắc chắn.'],
  ['Tôi có cần đổi file sang .wav không?', 'Không. Bạn tải thẳng file .mp3, .m4a (ghi âm iPhone), .ogg, .aac, .flac, hoặc video .mp4, .mov, .webm. Trình duyệt tự đọc âm thanh trong file.'],
  ['Âm thanh của tôi có bị gửi lên máy chủ không?', 'Không. Việc nhận diện, đo độ ồn và phiên âm từ file đều chạy ngay trên trình duyệt của bạn. Chỉ có tính năng “Phụ đề trực tiếp” dùng dịch vụ nhận dạng giọng nói có sẵn của trình duyệt.'],
  ['Số dB có chính xác không?', 'Đó là ước tính. Micro điện thoại và laptop không được hiệu chuẩn như máy đo chuyên dụng nên có thể lệch vài dB. Phù hợp để so sánh các nơi và phát hiện chỗ quá ồn, không dùng cho công việc pháp lý.'],
  ['Khi nào web hiện cảnh báo màu đỏ?', 'Chỉ khi nghe thấy âm thanh nguy hiểm thực sự (súng, nổ, còi hú, chuông báo cháy, kính vỡ) hoặc khi mức ồn rất cao có thể hại tai. Trẻ em nô đùa, âm nhạc, tiếng nói hiện màu xanh.'],
  ['Kết quả sai thì làm sao?', 'Thử ghi lại gần nguồn âm hơn, dài hơn 3 giây, bật “Lọc tạp âm nền” hoặc giảm độ nhạy xuống “Thấp”. Bạn cũng có thể góp mẫu đúng ở trang “Đóng góp dữ liệu” để nhóm huấn luyện lại mô hình.'],
  ['Vì sao cần đăng nhập?', 'Không bắt buộc. Đăng nhập (Google, Apple hoặc mã qua email) chỉ để lưu lịch sử và danh sách yêu thích trên mọi thiết bị.'],
];

export function faqHtml(items = FAQ) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return items.map(([q, a], i) => `<details><summary><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(q)}</summary><div class="ans">${esc(a)}</div></details>`).join('');
}
