# Mô hình

- `yamnet/` – (tùy chọn) bản YAMNet tự host. Chạy `node tools/download_yamnet.mjs` để tải. Nếu thư mục trống, web tự tải từ TF Hub.
- `custom/head.json` – (tùy chọn) mô hình nhóm tự train, tạo bởi `training/03_train_head.py`. Không có file này web vẫn chạy bình thường.
