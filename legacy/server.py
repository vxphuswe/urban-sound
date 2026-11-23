"""Backend Flask cho Urban Sound Classifier.

Chạy:  python server.py   ->  mở http://127.0.0.1:5000
"""
import base64
import io
import os
import threading
from pathlib import Path

import librosa
import numpy as np
import torch
from flask import Flask, jsonify, request, send_from_directory

from accounts import bp as accounts_bp, init_db, secret_key
from model import CLASSES, UrbanSoundCNN
from preprocess import HOP_LENGTH, N_FFT, N_MELS, SR, TARGET_LEN, log_mel_from_wave

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"
MODEL_PATH = BASE / "best_model.pth"

WIN_SEC = TARGET_LEN // SR            # 4 giây, đúng độ dài mô hình được huấn luyện
HOP_SEC = 2                           # bước trượt giữa hai cửa sổ
MAX_WINDOWS = 30                      # giới hạn để một lần phân tích không quá lâu
MAX_SEC = WIN_SEC + (MAX_WINDOWS - 1) * HOP_SEC   # 62 giây
MIN_SEC = 0.2
MAX_UPLOAD_MB = 25
WAVE_BINS = 600

app = Flask(__name__, static_folder=str(STATIC))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
app.config.update(SECRET_KEY=secret_key(), SESSION_COOKIE_SAMESITE="Lax")
app.register_blueprint(accounts_bp)
init_db()


# ---------------------------------------------------------------- mô hình
def load_model():
    if not MODEL_PATH.exists():
        raise SystemExit(f"Không tìm thấy {MODEL_PATH.name}. Hãy đặt file trọng số cạnh server.py.")
    state = torch.load(MODEL_PATH, map_location="cpu")
    # Chấp nhận cả checkpoint lưu dạng {"model_state_dict": ...}
    for key in ("model_state_dict", "state_dict"):
        if isinstance(state, dict) and key in state:
            state = state[key]
    net = UrbanSoundCNN(num_classes=len(CLASSES))
    net.load_state_dict(state)
    net.eval()
    return net


model = load_model()
N_PARAMS = sum(p.numel() for p in model.parameters())
_cam_lock = threading.Lock()   # Grad-CAM dùng gradient của model, không chạy song song


def infer(mels):
    """mels (n, 128, 173) -> xác suất softmax (n, 10)."""
    with torch.no_grad():
        logits = model(torch.from_numpy(mels).unsqueeze(1))
        return torch.softmax(logits, dim=1).numpy()


def gradcam(mel, cls_idx):
    """Bản đồ Grad-CAM (128, 173) trong [0, 1] cho lớp cls_idx, lấy ở tầng conv cuối."""
    x = torch.tensor(mel).unsqueeze(0).unsqueeze(0)
    with _cam_lock, torch.enable_grad():
        a = model.features[:15](x)          # đầu ra ReLU của Block 4, trước AvgPool
        a.retain_grad()
        out = model.classifier(model.features[15:](a))
        model.zero_grad(set_to_none=True)
        out[0, cls_idx].backward()
        w = a.grad.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((w * a).sum(1, keepdim=True))
        cam = torch.nn.functional.interpolate(cam, size=mel.shape, mode="bilinear", align_corners=False)
        cam = cam[0, 0].detach().numpy()
    return cam / (cam.max() + 1e-8)


# ---------------------------------------------------------------- âm thanh
def load_audio(data):
    """Bytes của file âm thanh -> sóng mono 22,050 Hz (đọc dư 0,5 giây để biết file có dài hơn giới hạn)."""
    y, _ = librosa.load(io.BytesIO(data), sr=SR, mono=True, duration=MAX_SEC + 0.5)
    return np.nan_to_num(y.astype(np.float32))


def window_starts(n, sliding):
    """Vị trí bắt đầu (tính theo mẫu) của từng cửa sổ 4 giây."""
    if not sliding or n <= TARGET_LEN:
        return [0]
    starts = list(range(0, n - TARGET_LEN + 1, HOP_SEC * SR))
    if starts[-1] + TARGET_LEN < n:      # thêm một cửa sổ sát cuối để không bỏ sót phần đuôi
        starts.append(n - TARGET_LEN)
    return starts


def dbfs(x):
    """Mức RMS so với toàn thang kỹ thuật số (dBFS). Là mức tương đối, không phải dB SPL."""
    if len(x) == 0:
        return -100.0
    rms = float(np.sqrt(np.mean(np.square(x, dtype=np.float64))))
    return round(max(-100.0, 20 * np.log10(rms + 1e-10)), 1)


def envelope(x, bins=WAVE_BINS):
    """Đường bao |biên độ| gồm `bins` điểm, để vẽ waveform gọn nhẹ."""
    if len(x) < bins:
        x = np.pad(x, (0, bins - len(x)))
    edges = np.linspace(0, len(x), bins + 1).astype(int)[:-1]
    return np.maximum.reduceat(np.abs(x), edges)


def b64u8(a):
    """Mảng float -> uint8 (0..255) -> base64, để trình duyệt tự tô màu."""
    a = (a - a.min()) / (a.max() - a.min() + 1e-8)
    return base64.b64encode((a * 255).astype(np.uint8).tobytes()).decode()


def r4(values):
    return [round(float(v), 4) for v in values]


# ---------------------------------------------------------------- routes
@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html", max_age=0)


@app.get("/api/info")
def info():
    return jsonify(
        classes=CLASSES, params=N_PARAMS, sr=SR, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS,
        win_sec=WIN_SEC, hop_sec=HOP_SEC, max_sec=MAX_SEC, max_upload_mb=MAX_UPLOAD_MB,
    )


@app.errorhandler(413)
def too_large(_):
    return jsonify(error=f"File lớn hơn {MAX_UPLOAD_MB} MB. Hãy cắt ngắn đoạn âm thanh."), 413


@app.post("/api/predict")
def predict():
    f = request.files.get("audio")
    if f is None:
        return jsonify(error="Thiếu file âm thanh."), 400
    try:
        y = load_audio(f.read())
    except Exception:
        return jsonify(error="Không đọc được file. Hãy dùng định dạng .wav."), 400
    if len(y) < int(SR * MIN_SEC):
        return jsonify(error="Âm thanh quá ngắn (cần ít nhất 0,2 giây)."), 400

    sliding = request.form.get("sliding") == "1"
    truncated = False
    if sliding:
        truncated = len(y) > MAX_SEC * SR
        y = y[: MAX_SEC * SR]
    else:
        truncated = len(y) > TARGET_LEN
        y = y[:TARGET_LEN]

    try:
        starts = window_starts(len(y), sliding)
        segs = [y[s:s + TARGET_LEN] for s in starts]
        mels = np.stack([log_mel_from_wave(s) for s in segs])
        P = infer(mels)
        probs = P.mean(0)
        top = int(probs.argmax())

        # Cửa sổ được vẽ ảnh phổ: theo yêu cầu, hoặc cửa sổ mô hình tự tin nhất về lớp dự đoán
        try:
            focus = int(request.form.get("focus", ""))
        except ValueError:
            focus = int(P[:, top].argmax())
        focus = min(max(focus, 0), len(segs) - 1)
        cam_class = int(P[focus].argmax())
        cam = gradcam(mels[focus], cam_class)
    except Exception as e:  # lỗi mô hình: báo về giao diện thay vì trả trang lỗi HTML
        app.logger.exception("Lỗi khi phân tích")
        return jsonify(error=f"Lỗi khi chạy mô hình: {type(e).__name__}."), 500

    # Trục thời gian của waveform: tối thiểu 4 giây để khớp với ảnh phổ của clip ngắn
    axis = np.pad(y, (0, max(0, TARGET_LEN - len(y))))
    peak = float(np.max(np.abs(y)))
    return jsonify(
        classes=CLASSES, top=top, probs=r4(probs),
        windows=[r4(row) for row in P], n_windows=len(segs),
        starts=[round(s / SR, 2) for s in starts], win_sec=WIN_SEC, hop_sec=HOP_SEC,
        duration=round(len(y) / SR, 2), axis_sec=round(len(axis) / SR, 2), truncated=truncated,
        level=dbfs(y), peak=round(max(-100.0, 20 * np.log10(peak + 1e-10)), 1),
        levels=[dbfs(s) for s in segs],
        wave=[round(float(v), 3) for v in envelope(axis)],
        focus=focus, cam_class=cam_class, mel=b64u8(mels[focus]), cam=b64u8(cam),
    )


@app.get("/live")
def live_page():
    return send_from_directory(STATIC, "live.html", max_age=0)


@app.post("/api/live")
def live():
    """Giám sát trực tiếp: nhận <= vài giây âm thanh, dùng 4 giây cuối, trả xác suất 10 lớp (nhẹ, không Grad-CAM)."""
    f = request.files.get("audio")
    if f is None:
        return jsonify(error="Thiếu âm thanh."), 400
    try:
        y = load_audio(f.read())
    except Exception:
        return jsonify(error="Không đọc được âm thanh."), 400
    if len(y) < int(SR * MIN_SEC):
        return jsonify(error="Âm thanh quá ngắn."), 400
    y = y[-TARGET_LEN:]
    P = infer(log_mel_from_wave(y)[None])[0]
    return jsonify(probs=r4(P), top=int(P.argmax()), level=dbfs(y))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "127.0.0.1")     # HOST=0.0.0.0 để người khác trong mạng LAN truy cập
    print(f"Urban Sound Classifier: http://{host}:{port}  (mô hình {N_PARAMS:,} tham số)")
    try:
        from waitress import serve                  # máy chủ nhiều luồng, phục vụ nhiều người cùng lúc
        serve(app, host=host, port=port, threads=8)
    except ImportError:
        app.run(host=host, port=port, debug=False, threaded=True)
