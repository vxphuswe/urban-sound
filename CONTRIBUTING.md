# Quy ước làm việc nhóm

## Nhánh

- `main` luôn chạy được – Vercel deploy từ nhánh này. Không push thẳng vào `main`.
- Mỗi việc một nhánh: `ten/viec-ngan-gon`, ví dụ `binh/loc-tap-am`, `chi/trang-lich-su`.
- Cập nhật nhánh thường xuyên: `git pull origin main` (hoặc `git rebase origin/main`).

## Commit

Viết tiếng Việt, ngắn, nói rõ thay đổi gì:

```
Thêm nút yêu thích ở trang lịch sử
Sửa lỗi micro không tắt khi rời trang trực tiếp
Train lại head với 120 mẫu tiếng rao
```

## Pull Request

1. Push nhánh, mở PR vào `main`, điền mẫu PR (ảnh chụp nếu sửa giao diện).
2. Vercel tự tạo link xem thử – gửi link cho bạn review.
3. Ít nhất 1 người duyệt rồi mới **Squash and merge**.

## Viết code

- Không cần build: HTML + CSS + JavaScript module thuần. Mở bằng `npm run dev`.
- Văn bản hiển thị cho người dùng: **tiếng Việt, không thuật ngữ** (không dBFS, logits, softmax…). Thông tin kỹ thuật để trong "Chi tiết kỹ thuật".
- Màu đỏ chỉ dành cho nguy hiểm thật. Thêm nhóm âm thanh mới ở `assets/js/categories.js`.
- Icon: thêm vào `assets/js/icons.js` (nét 24×24, `stroke="currentColor"`).
- Chạy `npm test` trước khi mở PR nếu sửa `analysis.js`, `dsp.js`, `classifier.js`.

## Không commit

File âm thanh dữ liệu (`training/data/`), `.env`, khóa `service_role` của Supabase, `*.pth`, `*.npz`. Đã có sẵn trong `.gitignore`.
