# Huấn luyện thêm dữ liệu cho Urban Sound

Web dùng **YAMNet** (521 loại âm thanh) làm "tai nghe" chính. Thư mục này giúp nhóm train thêm một **lớp phân loại nhỏ** (head) trên embedding của YAMNet để:

- nhận ra âm thanh đặc thù Việt Nam mà YAMNet chưa biết: tiếng rao, còi xe máy, trống trường, karaoke…
- nhận đúng hơn các lớp quan trọng (chó sủa, còi hú…) **khi có tạp âm** (máy lạnh, đường phố) nhờ tăng cường dữ liệu;
- biết khi nào **không** nên báo (nhãn `khac` = tiếng nền bình thường).

Head chỉ nặng vài trăm KB, train trên CPU trong vài phút. Web tự nạp file `models/custom/head.json` – không cần sửa code.

## Train âm thanh bạn CHƯA có dữ liệu

Không cần tự đi ghi âm hết – có 3 nguồn tải tự động:

| Nguồn | Script | Hợp với |
| --- | --- | --- |
| **Freesound.org** (hàng trăm nghìn âm thanh, có giấy phép CC) | `00_download_freesound.py` | âm thanh đặc thù: tiếng rao, còi xe máy, mõ, chuông chùa, karaoke… |
| **Google AudioSet** (527 lớp, 2 triệu đoạn YouTube) | `00_download_audioset.py` | âm thanh phổ biến cần nhận chắc hơn: chó, mèo, còi hú, kính vỡ… |
| UrbanSound8K, ESC-50 | `01_prepare_data.py --us8k --esc50` | bộ chuẩn, đã ánh xạ sẵn |

Danh sách cần tải nằm trong **`sounds_to_collect.json`** (đã có 23 nhãn gợi ý). Muốn thêm âm thanh mới chỉ cần thêm một mục:

```json
"tieng_ech": { "vi": "Ếch kêu", "icon": "bug", "kind": "nature", "n": 150,
               "freesound": ["frog croaking", "frogs night"], "audioset": ["Croak", "Frog"] }
```

Tra tên lớp AudioSet đúng chính tả: `python 00_download_audioset.py --list frog`.

Quy trình đầy đủ:

```bash
pip install -r requirements.txt yt-dlp          # + cài ffmpeg
export FREESOUND_API_KEY=...                   # Windows PowerShell: $env:FREESOUND_API_KEY="..."
python 00_download_freesound.py                # -> data/extra/<nhan>/fs_*.mp3
python 00_download_audioset.py                 # -> data/extra/<nhan>/as_*.wav
# NGHE THỬ và xóa file sai nhãn trong data/extra/
python 01_prepare_data.py --esc50 duong/dan/ESC-50-master
python 02_extract_embeddings.py --augment 3
python 03_train_head.py
```

Máy yếu hoặc ngại cài TensorFlow? Mở **`train_colab.ipynb`** trên Google Colab (File → Upload notebook) – chạy từng ô là xong, cuối cùng tải `head.json` về.

## Các file

| File | Việc |
| --- | --- |
| `00_download_freesound.py` | Tải mẫu từ Freesound theo `sounds_to_collect.json`, ghi nguồn vào `credits_freesound.csv` |
| `00_download_audioset.py` | Tải đoạn 10 s từ AudioSet/YouTube (cần yt-dlp + ffmpeg) |
| `sounds_to_collect.json` | Danh sách âm thanh cần tải: tên tiếng Việt, từ khóa Freesound, lớp AudioSet |
| `train_colab.ipynb` | Chạy toàn bộ trên Google Colab |
| `01_prepare_data.py` | Gom dữ liệu (mẫu tự thu + UrbanSound8K + ESC-50 + thư mục `extra/`) thành `data/manifest.csv`, chia train/test không rò rỉ |
| `02_extract_embeddings.py` | Chạy YAMNet lấy embedding 1024 chiều từng khung, **trộn tạp âm thật**, đổi âm lượng, tốc độ, tiếng vang |
| `03_train_head.py` | Train Dense(256) → softmax, in độ chính xác theo đoạn, xuất `../models/custom/head.json` |
| `04_predict.py` | Thử mô hình trên một file bất kỳ |
| `label_map.json` | Ánh xạ lớp của UrbanSound8K / ESC-50 sang nhãn của web |
| `labels_vi.json` | Tên tiếng Việt, icon, màu cho **nhãn mới** |
| `common.py` | Hàm dùng chung (đọc audio, xuất/đọc head.json) |

## Làm từng bước

```bash
cd training
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**1. Thu dữ liệu.** Mở trang **Đóng góp dữ liệu** trên web → chọn nhãn → ghi nhiều mẫu → *Tải gói .zip*. Giải nén vào `training/data/my_sounds/` để có cấu trúc:

```
training/data/my_sounds/
├── dog/          dog_20261123101010_001.wav ...
├── tieng_rao/    ...
├── coi_xe_may/   ...
└── khac/         (phòng yên tĩnh, máy lạnh, đường phố không có gì đặc biệt)
```

Muốn thêm dữ liệu từ nơi khác (Freesound, FSD50K, YouTube có giấy phép…) thì bỏ vào `training/data/extra/<nhan>/` cùng cấu trúc.

**2. Gom dữ liệu**

```bash
python 01_prepare_data.py --us8k D:/data/UrbanSound8K --esc50 D:/data/ESC-50-master
# hoặc chỉ dùng mẫu tự thu:
python 01_prepare_data.py --only-mine
```

**3. Trích embedding** (lần đầu tải YAMNet từ TF Hub)

```bash
python 02_extract_embeddings.py --augment 3
```

**4. Train và xuất**

```bash
python 03_train_head.py
python 04_predict.py duong/dan/thu.m4a     # thử nhanh
```

**5. Đưa lên web:** commit `models/custom/head.json` → push lên GitHub → Vercel tự deploy. Mở trang Nhận diện, phần *Chi tiết kỹ thuật* sẽ ghi "+ mô hình nhóm tự train".

## Nhãn mới

1. Đặt tên thư mục không dấu, gạch dưới: `tieng_rao`.
2. Thêm vào `labels_vi.json`: `"tieng_rao": { "vi": "Tiếng rao bán hàng", "icon": "speech", "kind": "people" }`
   - `kind`: `danger` (đỏ), `caution` (cam), `people` (xanh dương), `nature` (xanh lá), `ambient` (xám)
   - `icon`: tên icon trong `assets/js/icons.js` (dog, cat, horn, siren, music, speech, bell…)
3. Nhãn trùng id nhóm có sẵn (`dog`, `siren`, `horn`…) sẽ **bổ sung** cho nhóm đó, không cần khai báo.

## Mẹo để mô hình tốt

- Mỗi nhãn ≥ 30–50 đoạn, nhiều người thu, nhiều điện thoại, nhiều nơi.
- Luôn có nhãn `khac` với nhiều tiếng nền – đây là cách hiệu quả nhất để **giảm báo nhầm**.
- Ghi cả mẫu "khó": chó sủa khi máy lạnh đang chạy, còi xe giữa đường đông.
- Nếu nhãn nào hay bị nhầm, xem ma trận nhầm lẫn trong `data/report.json` và thu thêm cho nhãn đó.
- Người giả tiếng sủa vẫn là **giọng người** – muốn web nhận thành chó thì cần thu thêm loại mẫu đó vào `dog` (không khuyến khích).

## Bản quyền dữ liệu

UrbanSound8K và ESC-50 dùng giấy phép **CC BY-NC 3.0**: chỉ dùng học tập/phi thương mại và phải ghi nguồn. Không đưa file âm thanh gốc lên GitHub (đã có trong `.gitignore`).
