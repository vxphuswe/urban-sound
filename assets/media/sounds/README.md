# Ảnh / video thật cho từng loại âm thanh (tuỳ chọn)

Mặc định web dùng cảnh minh họa động vẽ bằng SVG (`assets/js/scenes.js`). Muốn thay bằng **ảnh hoặc video thật**:

1. Chép file vào thư mục này, ví dụ `dog.mp4` (video ngắn 3–6 giây, không tiếng, ≤ 2 MB) hoặc `dog.webp`.
2. Khai báo trong `manifest.json` theo **id nhóm** (xem `assets/js/categories.js`):

```json
{
  "dog":   { "file": "dog.mp4",   "credit": "Ảnh: Tên tác giả / Pexels" },
  "siren": { "file": "siren.webp", "credit": "Ảnh: Tên tác giả / Unsplash" }
}
```

Chỉ dùng ảnh/video bạn **có quyền dùng** (tự quay, hoặc nguồn miễn phí như Pexels, Unsplash, Pixabay) và ghi nguồn ở `credit`.
Nhóm nào không khai báo vẫn dùng cảnh minh họa động.
