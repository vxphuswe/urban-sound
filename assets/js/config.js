// Cấu hình chung của web. Nhóm chỉ cần sửa file này khi deploy.
// Khóa "anon / publishable" của Supabase là khóa công khai (được bảo vệ bằng RLS), để ở đây là bình thường.

export const CONFIG = {
  APP_NAME: 'Urban Sound',
  APP_TAGLINE: 'Nhận diện âm thanh đô thị',

  // ---- Đăng nhập (Supabase). Để trống => chạy chế độ demo, tài khoản lưu trong trình duyệt.
  SUPABASE_URL: 'https://jkhxovqwycgzrzgnreyg.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_cik7QoBVaULXndxS5EB9Lw_1qiv2Bk4',
  // Nút đăng nhập hiển thị. Apple cần tài khoản Apple Developer (trả phí) – để false nếu chưa có.
  AUTH_PROVIDERS: { google: true, apple: false },
  // Client ID loại "Web application" trong Google Cloud (dạng 1234-abc.apps.googleusercontent.com) – là thông tin công khai.
  // Điền vào thì nút Google mở cửa sổ đăng nhập ghi tên web của bạn thay vì "...supabase.co". Để trống = cách cũ.
  GOOGLE_CLIENT_ID: '',

  // ---- Mô hình nhận diện (YAMNet, 521 loại âm thanh của Google AudioSet)
  // Thử lần lượt: bản tự host trong /models/yamnet (chạy tools/download_yamnet.mjs) rồi tới TF Hub.
  YAMNET_SOURCES: [
    { url: 'models/yamnet/model.json', fromTFHub: false, local: true },
    { url: 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1', fromTFHub: true },
    { url: 'https://www.kaggle.com/models/google/yamnet/TfJs/tfjs/1', fromTFHub: true },
  ],
  CLASS_MAP_SOURCES: [
    'models/yamnet/yamnet_class_map.csv',
    'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv',
  ],
  TFJS_URL: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',

  // Lớp do nhóm tự train thêm (training/03_train_head.py xuất ra). Không có file thì bỏ qua.
  CUSTOM_HEAD_URL: 'models/custom/head.json',

  // ---- Phiên âm (Whisper chạy trong trình duyệt bằng Transformers.js)
  TRANSFORMERS_URL: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3',
  ASR_MODELS: [
    { id: 'Xenova/whisper-tiny', label: 'Nhanh', size: '~40 MB' },
    { id: 'Xenova/whisper-base', label: 'Cân bằng', size: '~80 MB' },
    { id: 'Xenova/whisper-small', label: 'Chính xác nhất cho tiếng Việt', size: '~250 MB' },
  ],
  ASR_DEFAULT: 'Xenova/whisper-base',

  // ---- Phân tích
  MAX_ANALYZE_SEC: 300,          // chỉ xét 5 phút đầu của file
  DENOISE_DEFAULT: true,         // lọc tạp âm nền trước khi nhận diện
  // Độ nhạy: ngưỡng điểm (sau trọng số) để coi là "nghe thấy" và số lần liên tiếp ở chế độ trực tiếp
  SENSITIVITY: {
    low:    { label: 'Thấp',       threshold: 0.42, streak: 3 },
    medium: { label: 'Trung bình', threshold: 0.28, streak: 2 },
    high:   { label: 'Cao',        threshold: 0.18, streak: 1 },
  },

  // ---- Đo độ ồn
  // dB ước tính = dBFS + CALIBRATION_DB. Micro điện thoại/laptop khác nhau nên cho phép chỉnh trong "Cài đặt nâng cao".
  CALIBRATION_DB: 96,
  HEALTH_LIMIT_DB: 85,           // NIOSH: 85 dBA trung bình 8 giờ
};

export function hasSupabase() {
  return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
}