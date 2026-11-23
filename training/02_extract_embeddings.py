"""Bước 2 – Trích embedding YAMNet (1024 chiều) cho từng khung 0,96 s, có tăng cường dữ liệu.

Tăng cường dữ liệu giúp mô hình KHÔNG nhầm khi có tạp âm (lỗi "sủa ra máy lạnh"):
  * trộn tiếng nền thật (máy lạnh, đường phố, nhãn 'khac'…) với độ ồn ngẫu nhiên SNR 0–20 dB
  * đổi âm lượng ±8 dB, dịch thời gian, đổi tốc độ nhẹ ±8 %
  * thêm tiếng vang phòng đơn giản

Chạy:  python 02_extract_embeddings.py --augment 3
Kết quả: data/embeddings.npz (X, y, groups, split, labels)
"""
import argparse
import csv
import random

import numpy as np
from tqdm import tqdm

from common import DATA, SR, load_audio

BACKGROUND_LABELS = {"khac", "ac", "traffic", "noise", "wind", "rain", "engine", "appliance"}


def yamnet():
    import tensorflow_hub as hub
    return hub.load("https://tfhub.dev/google/yamnet/1")


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def mix_noise(x, noise, snr_db):
    if len(noise) < len(x):
        noise = np.tile(noise, int(np.ceil(len(x) / len(noise))))
    s = random.randint(0, len(noise) - len(x))
    n = noise[s:s + len(x)]
    gain = 10 ** ((rms_db(x) - rms_db(n) - snr_db) / 20)
    return x + gain * n


def reverb(x):
    ir_len = int(SR * random.uniform(0.08, 0.35))
    ir = np.random.randn(ir_len).astype(np.float32) * np.exp(-np.linspace(0, 6, ir_len))
    ir[0] = 1.0
    y = np.convolve(x, ir)[: len(x)]
    return y / (np.max(np.abs(y)) + 1e-9) * np.max(np.abs(x))


def augment(x, bg_pool):
    y = x.copy()
    if random.random() < 0.3:
        import librosa
        y = librosa.effects.time_stretch(y, rate=random.uniform(0.92, 1.08))
    if random.random() < 0.5:
        y = np.roll(y, random.randint(0, len(y) // 4))
    if bg_pool and random.random() < 0.8:
        y = mix_noise(y, random.choice(bg_pool), random.uniform(0, 20))
    if random.random() < 0.25:
        y = reverb(y)
    y = y * 10 ** (random.uniform(-8, 8) / 20)
    return np.clip(y, -1, 1).astype(np.float32)


def frame_embeddings(model, x, label):
    """Embedding của các khung có âm thanh (bỏ khung lặng hơn đỉnh 25 dB, trừ nhãn tiếng nền)."""
    if len(x) < 15600:
        x = np.pad(x, (0, 15600 - len(x)))
    _, emb, _ = model(x)
    emb = emb.numpy()
    hop, win = int(0.48 * SR), int(0.96 * SR)
    lv = np.array([rms_db(x[i * hop: i * hop + win]) if i * hop < len(x) else -120 for i in range(len(emb))])
    if label in BACKGROUND_LABELS:
        keep = lv > -70
    else:
        keep = (lv > lv.max() - 25) & (lv > -60)
    if not keep.any():
        keep[np.argmax(lv)] = True
    return emb[keep]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--augment", type=int, default=3, help="số bản tăng cường cho mỗi file train")
    ap.add_argument("--max-sec", type=float, default=30)
    a = ap.parse_args()
    random.seed(0); np.random.seed(0)

    rows = list(csv.DictReader(open(DATA / "manifest.csv", encoding="utf-8")))
    labels = sorted({r["label"] for r in rows})
    lid = {l: i for i, l in enumerate(labels)}
    model = yamnet()

    # kho tiếng nền để trộn (chỉ lấy từ tập train)
    bg_pool = []
    for r in rows:
        if r["label"] in BACKGROUND_LABELS and r["split"] == "train" and len(bg_pool) < 200:
            try:
                bg_pool.append(load_audio(r["path"])[: int(SR * 10)])
            except Exception:
                pass
    print(f"Kho tiếng nền: {len(bg_pool)} đoạn")

    X, y, groups, split, clip = [], [], [], [], []
    for ci, r in enumerate(tqdm(rows, desc="Trích embedding")):
        try:
            x = load_audio(r["path"])[: int(SR * a.max_sec)]
        except Exception as e:
            print("! Bỏ qua", r["path"], e)
            continue
        if len(x) < SR * 0.3:
            continue
        versions = [x] + ([augment(x, bg_pool) for _ in range(a.augment)] if r["split"] == "train" else [])
        for v in versions:
            e = frame_embeddings(model, v, r["label"])
            X.append(e)
            y += [lid[r["label"]]] * len(e)
            groups += [r["group"]] * len(e)
            split += [r["split"]] * len(e)
            clip += [ci] * len(e)

    np.savez_compressed(DATA / "embeddings.npz", X=np.concatenate(X).astype(np.float32), y=np.array(y),
                        groups=np.array(groups), split=np.array(split), clip=np.array(clip), labels=np.array(labels))
    print(f"Đã lưu {sum(len(e) for e in X)} khung, {len(labels)} nhãn -> {DATA / 'embeddings.npz'}")


if __name__ == "__main__":
    main()
