# Urban Sound – Nhận diện âm thanh đô thị

Web nhận diện âm thanh, đo độ ồn và phiên âm lời nói **chạy hoàn toàn trên trình duyệt**. Không cần máy chủ Python nên deploy miễn phí lên **Vercel** chỉ với vài cú bấm.

| Trang | Chức năng |
| --- | --- |
| `index.html` | Trang chủ: giới thiệu, danh sách âm thanh nhận diện được (đặt lên đầu), hỏi đáp |
| `nhan-dien.html` | Tải file **mọi định dạng** (MP3, M4A, WAV, OGG, MP4, MOV…) hoặc ghi âm → kết quả lớn "Đây là tiếng chó sủa (96%)", dòng thời gian, mức dB, cảnh báo sức khỏe, **phiên âm thành văn bản** (.txt/.srt) |
| `truc-tiep.html` | Giám sát liên tục (chỉ micro): nhận diện mỗi 0,5 s, trạng thái rõ ràng (Đang tắt / Đang tải / Đang nghe / Đang xử lý / Đã phát hiện), xác suất 5 lớp cao nhất, dòng thời gian 60 s, đo độ ồn ước tính, báo động toàn màn hình kèm âm báo kiểu chuông báo cháy khi có âm nguy hiểm hoặc tiếng ồn vượt ngưỡng, phụ đề trong khung, nhật ký + CSV |
| `do-on.html` | Máy đo decibel: đồng hồ đổi màu, min/TB/max, biểu đồ 60 giây, bảng mức tham chiếu, **so sánh mức ồn** |
| `suc-khoe.html` | Thời gian nghe an toàn (NIOSH 85 dB/8 giờ, +3 dB = ½ thời gian), dấu hiệu, cách bảo vệ tai |
| `huong-dan.html` | Hướng dẫn từng bước, ý nghĩa màu sắc, danh sách nhóm âm thanh, hỏi đáp, xử lý lỗi micro |
| `lich-su.html` | Lịch sử + **Yêu thích** (không bị xóa khi dọn lịch sử), tìm kiếm, lọc, xuất CSV |
| `dang-nhap.html` | Đăng nhập Google / Apple / mã 6 số qua email (Supabase) |
| `du-lieu.html` | Thu mẫu âm thanh có nhãn, tải gói .zip để **train thêm** |
| `gioi-thieu.html` | Kỹ thuật, so sánh với mô hình CNN cũ, quyền riêng tư, ghi nguồn |

## Đã sửa gì so với bản cũ

| Góp ý / lỗi | Cách xử lý |
| --- | --- |
| Sủa "gâu gâu" ra máy lạnh, tạp âm bị nhận sai | Đổi sang **YAMNet (521 lớp)** thay vì CNN 10 lớp; **lọc tạp âm nền** (spectral gating) và chạy mô hình trên cả âm gốc lẫn âm đã lọc; **cổng năng lượng** bỏ khung lặng; tiếng nền (máy lạnh, quạt, ồn) bị **giảm trọng số**; làm mượt theo thời gian; dưới ngưỡng thì báo "chưa chắc chắn" thay vì đoán bừa. Có test tự động cho đúng tình huống này (`tests/analysis.test.mjs`) |
| Chỉ nhận vài loại, người dùng không biết | 40+ nhóm tiếng Việt; khung **Lưu ý** đặt đầu trang chủ và trang nhận diện |
| Chỉ nhận .wav | Mọi định dạng trình duyệt đọc được, kể cả video .mp4/.mov |
| Toàn thuật ngữ (dBFS, Log-Mel, Grad-CAM, P(CLASS)…) | Giao diện chỉ còn: tên âm thanh, %, mức ồn "Nhỏ/Vừa/To/Rất ồn" + icon loa. Chi tiết kỹ thuật gom vào ô "Chi tiết kỹ thuật" và trang Giới thiệu |
| Trẻ em chơi đùa cũng hiện cảnh báo vàng sọc đen | Màu theo loại: **đỏ chỉ cho nguy hiểm thật** (súng, nổ, còi hú, báo cháy, kính vỡ), trẻ em/nhạc màu xanh. Viền đổi màu khi âm thanh to |
| Phải kéo 3 thanh trượt dBFS | Nút chọn nhanh Thấp/Trung bình/Cao; số liệu nâng cao giấu trong "Cài đặt nâng cao" |
| Bắt buộc bật camera, không biết mic có bật không | Chỉ cần micro; camera là **tùy chọn** (đổi trước/sau trên điện thoại, quay video kèm kết quả) và chỉ để quan sát, AI không phân tích hình; chip trạng thái + vòng sáng khi có tiếng |
| Mỗi mục nên là trang riêng | 10 trang riêng, menu có icon và menu thả xuống |
| Không có đăng nhập / chỗ có chỗ không | Nút đăng nhập ở mọi trang; trang đăng nhập chia đôi giống mẫu SozAI |
| Cần yêu thích | Nút ngôi sao + tab Yêu thích, dọn lịch sử vẫn giữ mục yêu thích |
| Hiện hình con chó khi nghe tiếng chó | Minh họa động (vẫy đuôi, "Gâu!") cho chó; mèo, chim, trẻ em cũng có hình riêng |

## Chạy trên máy

Chỉ cần một web server tĩnh (micro chỉ chạy trên `localhost` hoặc HTTPS):

```bash
npm run dev          # = npx serve -l 3000 .   → mở http://localhost:3000
# hoặc
python -m http.server 3000
```

- Thêm `?demo` vào địa chỉ (ví dụ `nhan-dien.html?demo`) để thử **giao diện** khi không có mạng: kết quả là giả lập.
- `npm test` chạy kiểm thử phần xử lý (Node 18+).
- Lần đầu mở trang nhận diện, trình duyệt tải YAMNet (~15 MB) từ TF Hub rồi lưu lại. Muốn tự host: `npm run download-model` rồi commit thư mục `models/yamnet/`.

## Làm việc nhóm với GitHub

```bash
# Trưởng nhóm (một lần)
git init && git add . && git commit -m "Urban Sound v2"
git branch -M main
git remote add origin https://github.com/<ten-nhom>/urban-sound.git
git push -u origin main
```

Trên GitHub: **Settings → Collaborators → Add people** để mời thành viên. Sau đó mỗi người:

```bash
git clone https://github.com/<ten-nhom>/urban-sound.git && cd urban-sound
git checkout -b ten-ban/ten-tinh-nang       # ví dụ: an/trang-lich-su
# ...sửa code...
git add . && git commit -m "Thêm bộ lọc lịch sử theo ngày"
git push -u origin an/trang-lich-su
```

Rồi mở **Pull Request** vào `main`, nhờ một bạn khác review. Quy ước chi tiết trong [CONTRIBUTING.md](CONTRIBUTING.md). Gợi ý chia việc:

| Người | Phụ trách |
| --- | --- |
| A | Giao diện chung (`assets/css/app.css`, `assets/js/ui.js`) |
| B | Nhận diện + phiên âm (`nhan-dien.html`, `assets/js/pages/detect.js`) |
| C | Giám sát trực tiếp + đo dB (`truc-tiep`, `do-on`) |
| D | Thu dữ liệu + train (`du-lieu.html`, `training/`) |
| E | Đăng nhập, lịch sử, Supabase, deploy |

## Deploy lên Vercel

1. Đăng nhập [vercel.com](https://vercel.com) bằng tài khoản GitHub.
2. **Add New → Project** → chọn repo `urban-sound` → **Import**.
3. Framework Preset: **Other**. Build Command: *để trống*. Output Directory: *để trống* (thư mục gốc).
4. Bấm **Deploy**. Vài giây sau có địa chỉ `https://urban-sound.vercel.app` (HTTPS sẵn → micro chạy được trên điện thoại).
5. Từ giờ mỗi lần push lên `main` Vercel tự deploy; mỗi Pull Request có một link xem thử riêng.

`vercel.json` đã cấu hình quyền micro và camera (chỉ cho chính trang web), cache cho mô hình và vài đường dẫn ngắn (`/nhan-dien`, `/truc-tiep`…). `.vercelignore` loại `training/`, `legacy/` khỏi bản deploy.

## Đăng nhập thật (Supabase – miễn phí)

Chưa cấu hình thì web chạy **chế độ demo**: mã 6 số hiện ngay trên màn hình, tài khoản chỉ lưu trong trình duyệt.

1. Tạo project ở [supabase.com](https://supabase.com).
2. **SQL Editor** → dán và chạy `supabase/schema.sql` (tạo bảng `detections` có Row Level Security).
3. **Project Settings → API**: chép *Project URL* và *anon / publishable key* vào `assets/js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'sb_publishable_...',
   ```
   (Khóa này là khóa công khai, được bảo vệ bằng RLS – để trong code là bình thường. **Không bao giờ** dán `service_role` key.)
4. **Authentication → URL Configuration**: *Site URL* = địa chỉ Vercel; thêm `http://localhost:3000/**` và `https://<ten>.vercel.app/**` vào *Redirect URLs*.
5. **Mã 6 số qua email:** Authentication → Emails → *Magic Link* template, thêm `{{ .Token }}` vào nội dung (ví dụ: `Mã đăng nhập Urban Sound của bạn: {{ .Token }}`). Email mặc định của Supabase bị giới hạn số thư/giờ; khi dùng nhiều nên cấu hình SMTP riêng.
6. **Google:** tạo OAuth Client (Web) ở Google Cloud Console, Authorized redirect URI = `https://xxxx.supabase.co/auth/v1/callback`; dán Client ID/Secret vào Authentication → Providers → Google.
7. **Apple:** cần tài khoản Apple Developer (trả phí). Làm theo hướng dẫn "Login with Apple" của Supabase; nếu chưa có, nút Apple sẽ báo lỗi rõ ràng, các cách khác vẫn dùng được.

## Train thêm dữ liệu

Xem [training/README.md](training/README.md). Tóm tắt: thu mẫu ở trang **Đóng góp dữ liệu** → giải nén vào `training/data/my_sounds/` → chạy `01_prepare_data.py`, `02_extract_embeddings.py`, `03_train_head.py` → commit `models/custom/head.json`. Có thể kết hợp UrbanSound8K và ESC-50 (ánh xạ sẵn trong `training/label_map.json`).

## Cấu trúc thư mục

```
├── *.html                    10 trang + 404
├── assets/
│   ├── css/app.css           toàn bộ giao diện (sáng/tối)
│   ├── js/
│   │   ├── config.js         ⚙️ cấu hình: Supabase, mô hình, độ nhạy, hiệu chỉnh dB
│   │   ├── categories.js     nhóm âm thanh tiếng Việt, màu, trọng số
│   │   ├── analysis.js       hậu xử lý chống nhận nhầm (có test)
│   │   ├── dsp.js            FFT, lọc tạp âm, RMS, đổi tần số
│   │   ├── classifier.js     nạp & chạy YAMNet (TF.js) + head tự train
│   │   ├── audio.js          đọc file/video, ghi âm, micro liên tục
│   │   ├── transcribe*.js    phiên âm Whisper (Web Worker) + phụ đề trực tiếp
│   │   ├── levels.js         thang dB, lời khuyên sức khỏe
│   │   ├── auth.js, store.js đăng nhập, lịch sử/yêu thích
│   │   ├── icons.js          icon + minh họa (chó, mèo, chim, trẻ em) tự vẽ
│   │   ├── ui.js, render.js  khung trang, thẻ kết quả
│   │   └── pages/*.js        mã riêng từng trang
│   └── data/                 số liệu mô hình CNN cũ (trang Giới thiệu)
├── models/                   yamnet/ (tùy chọn tự host), custom/head.json (tự train)
├── training/                 script Python để train thêm
├── supabase/schema.sql       bảng lịch sử + RLS
├── tools/download_yamnet.mjs tải mô hình về tự host
├── tests/                    kiểm thử Node
└── legacy/                   mã Flask + CNN UrbanSound8K bản cũ (giữ cho báo cáo)
```

## Giới hạn cần biết

- Số dB là **ước tính** từ micro (dBFS + hệ số hiệu chỉnh, mặc định +96); có thể chỉnh trong trang Trực tiếp → Cài đặt nâng cao.
- YAMNet rất mạnh nhưng không hoàn hảo: người **giả** tiếng sủa vẫn là giọng người nên có thể ra "tiếng người nói". Thu thêm dữ liệu và train head để cải thiện các trường hợp nhóm quan tâm.
- Phiên âm tiếng Việt bằng Whisper bản nhỏ đôi khi sai chính tả với giọng địa phương; chọn chế độ "Chính xác hơn" (~250 MB) nếu máy đủ mạnh.
- Phụ đề trực tiếp dùng Web Speech API: tốt nhất trên Chrome/Edge, chưa hỗ trợ Firefox.

Nguồn mô hình & dữ liệu: YAMNet (Google, Apache 2.0), Whisper (OpenAI, MIT), Transformers.js, TensorFlow.js, UrbanSound8K & ESC-50 (CC BY-NC 3.0).


## Cập nhật tháng 11/2026

### Đăng nhập Google hiện tên web thay vì "…supabase.co"
1. Google Cloud → APIs & Services → Credentials → mở OAuth client loại **Web application** đang dùng cho Supabase.
2. Ở **Authorized JavaScript origins** thêm `https://urban-sound-ai.vercel.app` (và `http://localhost:5678` nếu chạy máy).
3. Chép **Client ID** (dạng `…apps.googleusercontent.com`) vào `GOOGLE_CLIENT_ID` trong `assets/js/config.js`.
4. Supabase → Authentication → Providers → Google: Client ID này phải nằm trong ô **Client IDs** (đã có nếu đây đúng là client bạn dùng cho Supabase).
5. Google Auth Platform → **Branding**: đặt tên ứng dụng "Urban Sound" và logo để cửa sổ Google hiển thị đẹp.

Để trống `GOOGLE_CLIENT_ID` thì web dùng lại cách đăng nhập cũ.

### Kho mẫu chung của nhóm
Trang **Âm thanh của tôi** (`du-lieu.html`) có nút "Gửi lên kho chung". Chạy một lần file `supabase/samples.sql` trong Supabase → SQL Editor để tạo kho `samples`. Mẫu của mọi người nằm ở Supabase → Storage → samples.

### Tính năng mới
- **Âm thanh của tôi**: thu và lưu mẫu (IndexedDB, mở lại web vẫn còn), dạy AI nhận âm thanh riêng bằng so khớp embedding YAMNet (few-shot, cosine), nghe lại/đổi nhãn/tải .zip.
- **Lịch sử**: lưu kèm file âm thanh (trực tiếp lưu 3 giây quanh lúc phát hiện) – nghe lại, tải từng file hoặc tải tất cả.
- **Trực tiếp**: "Bắt đầu nghe" tự bật camera (một lần hỏi quyền), quay video 1080p/720p, phụ đề đẹp hơn + bản ghi lời nói (.txt/.srt).
- **Phiên âm**: chỉ phiên âm đoạn có tiếng người, lọc chú thích kiểu *cười*, [nhạc]; mặc định Whisper small trên máy tính.
- **Đám đông**: quy tắc kết hợp Speech + Crowd/Hubbub của YAMNet.
- **Hành trình nghe**: bộ sưu tập âm thanh, chuỗi ngày, huy hiệu (trang chủ).
- **Minh họa động** cho từng loại âm thanh (`assets/js/scenes.js`); có thể thay bằng ảnh/video thật – xem `assets/media/sounds/README.md`.

### Đăng nhập Google (trang chọn tài khoản ghi tên web)
Khi có `GOOGLE_CLIENT_ID`, nút Google chuyển thẳng tới Google và quay về `…/dang-nhap.html` (không qua `…supabase.co`).
Trong Google Cloud → Credentials → OAuth client (Web) cần có:
- **Authorized JavaScript origins:** `https://urban-sound-ai.vercel.app`
- **Authorized redirect URIs:** `https://urban-sound-ai.vercel.app/dang-nhap.html` (giữ nguyên link `…supabase.co/auth/v1/callback` đã có)

