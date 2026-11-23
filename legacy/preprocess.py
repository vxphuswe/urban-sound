"""Tiền xử lý âm thanh: .wav -> Log-Mel Spectrogram (128 x 173).

Dùng chung cho huấn luyện (chạy trực tiếp file này để tạo features.npz)
và cho web app (server.py gọi log_mel_from_wave), để hai bên luôn cho ra
đúng một loại đặc trưng.
"""
import os

import librosa
import numpy as np

SR = 22050
DURATION = 4.0
TARGET_LEN = int(SR * DURATION)  # 88,200 samples
N_FFT = 2048
HOP_LENGTH = 512
N_MELS = 128


def log_mel_from_wave(y):
    """Sóng âm mono ở 22,050 Hz -> Log-Mel đã chuẩn hóa, shape (128, 173)."""
    # 1. Cố định 4 giây (đệm 0 nếu ngắn, cắt nếu dài)
    if len(y) < TARGET_LEN:
        y = np.pad(y, (0, TARGET_LEN - len(y)), mode="constant")
    else:
        y = y[:TARGET_LEN]

    # 2. Mel spectrogram -> thang decibel
    mel_spec = librosa.feature.melspectrogram(
        y=y, sr=SR, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS
    )
    log_mel = librosa.power_to_db(mel_spec, ref=np.max)

    # 3. Chuẩn hóa Z-score theo từng mẫu
    log_mel = (log_mel - np.mean(log_mel)) / (np.std(log_mel) + 1e-6)

    return log_mel.astype(np.float32)  # (128, 173)


def extract_log_mel(file_path):
    """Đọc file audio (mono, resample về 22,050 Hz) rồi trích Log-Mel."""
    y, _ = librosa.load(file_path, sr=SR, mono=True)
    return log_mel_from_wave(y)


if __name__ == "__main__":
    # pandas và tqdm chỉ cần khi tạo đặc trưng cho cả bộ dữ liệu,
    # nên import ở đây để web app không phải cài hai thư viện này.
    import pandas as pd
    from tqdm import tqdm

    df = pd.read_csv("data/metadata/UrbanSound8K.csv")
    X, y, folds = [], [], []
    for _, r in tqdm(df.iterrows(), total=len(df)):
        path = os.path.join("data", "audio", f"fold{r['fold']}", r["slice_file_name"])
        X.append(extract_log_mel(path))
        y.append(r["classID"])
        folds.append(r["fold"])
    np.savez_compressed(
        "features.npz", X=np.array(X), y=np.array(y), folds=np.array(folds)
    )
    print("Đã lưu features.npz")
