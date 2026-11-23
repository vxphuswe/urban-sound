# Urban Sound Classifier – web demo

Web app minh họa cho đồ án phân loại âm thanh đô thị (UrbanSound8K, 2D CNN trên Log-Mel Spectrogram).
Backend Flask chạy mô hình PyTorch; giao diện là một trang HTML duy nhất, không cần internet.

## Chạy

```bash
pip install -r requirements_web.txt
python server.py
```

Mở http://127.0.0.1:5000. Đổi cổng bằng biến môi trường `PORT` (ví dụ `PORT=8000 python server.py`).

Thu âm bằng micro chỉ hoạt động khi mở trang qua `127.0.0.1` hoặc `localhost` (trình duyệt yêu cầu).

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `server.py` | Flask: `/` (giao diện), `/api/info`, `/api/predict` |
| `model.py` | Kiến trúc `UrbanSoundCNN` (405.898 tham số) và danh sách 10 lớp |
| `preprocess.py` | Trích Log-Mel. `log_mel_from_wave` dùng chung cho huấn luyện và web app |
| `best_model.pth` | Trọng số đã huấn luyện (state dict) |
| `static/index.html` | Giao diện: Phân tích, Giám sát, Mô hình |
| `static/metrics.json` | Ma trận nhầm lẫn và validation accuracy hiển thị ở mục Mô hình |

## Tính năng

- **Phân tích:** chọn file .wav hoặc thu âm. Mặc định xét cả file bằng cửa sổ 4 giây, bước 2 giây
  (tối đa 62 giây, 30 cửa sổ); bỏ chọn để chỉ xét 4 giây đầu. Kết quả gồm lớp dự đoán, xác suất 10 lớp,
  mức âm tương đối (RMS, dBFS), dạng sóng, ảnh phổ Log-Mel và Grad-CAM của từng cửa sổ.
- **Giám sát:** quy tắc cảnh báo thử nghiệm (lớp theo dõi, độ tin cậy tối thiểu, số cửa sổ liên tiếp,
  ngưỡng mức âm), nhật ký các lần phân tích, thống kê số cửa sổ theo lớp, xuất CSV.
  Cài đặt và nhật ký lưu trong trình duyệt (localStorage).
- **Mô hình:** accuracy, Macro F1, ma trận nhầm lẫn, precision/recall/F1 theo lớp, các cặp nhầm nhiều nhất.

## Cập nhật sau khi huấn luyện lại

1. Thay `best_model.pth`.
2. Sửa `static/metrics.json`: `confusion_matrix` (hàng = nhãn thật, cột = dự đoán, theo thứ tự `classes`)
   và `val_accuracy`. Accuracy, precision, recall, F1 được trang tự tính từ ma trận.

## API

`POST /api/predict` (multipart form): `audio` (file), `sliding` (`1` = cả file, `0` = 4 giây đầu),
`focus` (tùy chọn, chỉ số cửa sổ cần vẽ ảnh phổ). Trả về JSON gồm `probs`, `windows`, `starts`,
`levels`, `level`, `peak`, `wave`, `mel`, `cam`... Lỗi trả về `{"error": "..."}` kèm mã 4xx/5xx.

## Giới hạn

- Mô hình chỉ biết 10 lớp của UrbanSound8K; âm thanh khác vẫn bị xếp vào một trong 10 lớp.
- dBFS là mức so với biên độ tối đa của file, không phải dB SPL đo bằng thiết bị đã hiệu chuẩn.
- Cảnh báo chỉ nói về loại âm thanh nhận diện được, không khẳng định có sự cố thật.
- `app.run` của Flask chỉ dùng để demo trên máy cá nhân, không dùng để triển khai công khai.

Dữ liệu: UrbanSound8K (Salamon, Jacoby & Bello, 2014).

## Giám sát trực tiếp và nhiều người dùng (bản mở rộng)
- Trang `/live`: nghe micro liên tục, cửa sổ 4 giây cập nhật mỗi giây, hiển thị phổ tần số và sóng âm thời gian thực,
  trạng thái BÌNH THƯỜNG / ĐANG THEO DÕI / CẢNH BÁO, xác suất lớp theo dõi, số lần liên tiếp, mức âm, nhật ký sự kiện, xuất CSV.
- Tài khoản: đăng ký/đăng nhập (mật khẩu băm, chặn dò mật khẩu), lịch sử sự kiện riêng của từng người trong SQLite (`app.db`).
  Người đăng ký đầu tiên là quản trị viên, xem được số sự kiện của mọi người dùng. Khách không đăng nhập vẫn dùng được nhưng không lưu lịch sử.
- Nhiều người cùng dùng: `pip install -r requirements_web.txt` (có waitress, 8 luồng). Cho máy khác trong mạng LAN truy cập:
  `set HOST=0.0.0.0` rồi `python server.py` (Windows). Micro của trình duyệt chỉ chạy qua localhost hoặc HTTPS, nên máy khác cần HTTPS (ví dụ reverse proxy).
- Đặt khóa phiên riêng bằng biến môi trường `APP_SECRET` khi triển khai. Không đưa `app.db` và `.secret_key` lên GitHub.
- Độ chính xác do mô hình quyết định (baseline Fold 10: 79,45%). Trang chỉ thêm ngưỡng “Không xác định” (dưới 50%) và điều kiện liên tiếp để giảm báo sai.
