"""Bước 4 (kiểm tra) – Chạy YAMNet + head.json trên một file, in kết quả từng khung.

Chạy:  python 04_predict.py duong/dan/file.m4a
"""
import sys

import numpy as np

from common import ROOT, load_audio, load_head, head_forward


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Cách dùng: python 04_predict.py <file âm thanh>")
    import tensorflow_hub as hub
    j, layers = load_head(ROOT / "models" / "custom" / "head.json")
    x = load_audio(sys.argv[1])
    _, emb, _ = hub.load("https://tfhub.dev/google/yamnet/1")(x)
    P = head_forward(layers, emb.numpy())
    names = [c.get("vi", c["id"]) for c in j["classes"]]
    for i, p in enumerate(P):
        k = int(p.argmax())
        print(f"{i * 0.48:6.2f}s  {names[k]:24s} {p[k] * 100:5.1f}%")
    m = P.mean(0)
    print("\nTổng hợp:", ", ".join(f"{names[k]} {m[k] * 100:.0f}%" for k in np.argsort(-m)[:3]))


if __name__ == "__main__":
    main()
