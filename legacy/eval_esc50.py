"""Đánh giá chéo bộ dữ liệu trên ESC-50 (KHÔNG huấn luyện lại).

Đặt file này cạnh model.py, preprocess.py, best_model.pth rồi chạy:
  python eval_esc50.py --esc50 C:\\duong\\dan\\ESC-50-master
  python eval_esc50.py --esc50 ... --features features.npz     # thêm so sánh với Fold 10 của UrbanSound8K

Ba kết quả: (1) độ chính xác trên các lớp ESC-50 tương ứng với 10 lớp của mô hình,
(2) tỉ lệ từ chối âm thanh lạ và tiếng người theo từng ngưỡng tin cậy, (3) ngưỡng gợi ý cho trang web.
ESC-50: Piczak (2015), giấy phép CC BY-NC 3.0. Chỉ dùng cho học tập và phải ghi nguồn.
"""
import argparse
import csv
import json
import os

import librosa
import numpy as np
import torch

from model import CLASSES, UrbanSoundCNN
from preprocess import SR, TARGET_LEN, log_mel_from_wave

# Nhãn ESC-50 -> nhãn UrbanSound8K. "engine" của ESC-50 là động cơ nói chung, chỉ gần đúng với engine_idling.
MAP = {"dog": "dog_bark", "siren": "siren", "car_horn": "car_horn", "engine": "engine_idling"}
LA = ["rain", "wind", "crickets", "chirping_birds", "water_drops", "pouring_water", "keyboard_typing",
      "mouse_click", "clock_tick", "door_wood_knock", "can_opening", "footsteps", "toilet_flush", "brushing_teeth"]
VOICE = ["laughing", "coughing", "sneezing", "crying_baby", "breathing", "snoring"]
THRESHOLDS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]


def load_model(path="best_model.pth"):
    state = torch.load(path, map_location="cpu")
    for k in ("model_state_dict", "state_dict"):
        if isinstance(state, dict) and k in state:
            state = state[k]
    net = UrbanSoundCNN(num_classes=len(CLASSES))
    net.load_state_dict(state)
    return net.eval()


@torch.no_grad()
def probs_of(net, mels):
    return torch.softmax(net(torch.from_numpy(np.asarray(mels, dtype=np.float32)).unsqueeze(1)), 1).numpy()


def clip_probs(net, path):
    """Clip 5 giây của ESC-50 -> hai cửa sổ 4 giây (bắt đầu giây 0 và giây 1), lấy trung bình xác suất."""
    y, _ = librosa.load(path, sr=SR, mono=True, duration=5.0)
    segs = [y[s:s + TARGET_LEN] for s in (0, SR) if len(y) >= s + SR]
    return probs_of(net, [log_mel_from_wave(s) for s in segs]).mean(0)


def accept_table(conf, correct=None):
    """Với mỗi ngưỡng: tỉ lệ được nhận (conf >= ngưỡng) và, nếu có nhãn đúng, độ chính xác trong số được nhận."""
    rows = {}
    for t in THRESHOLDS:
        m = conf >= t
        r = {"accepted": float(m.mean())}
        if correct is not None:
            r["selective_acc"] = float(correct[m].mean()) if m.any() else None
        rows[str(t)] = r
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--esc50", required=True)
    ap.add_argument("--features", default=None, help="features.npz của UrbanSound8K (để lấy Fold 10)")
    ap.add_argument("--model", default="best_model.pth")
    a = ap.parse_args()
    net = load_model(a.model)
    meta = list(csv.DictReader(open(os.path.join(a.esc50, "meta", "esc50.csv"), encoding="utf-8")))

    def run(cats):
        out = []
        for r in meta:
            if r["category"] in cats:
                p = os.path.join(a.esc50, "audio", r["filename"])
                if os.path.exists(p):
                    out.append((r["category"], clip_probs(net, p)))
        return out

    res = {"model": a.model}
    # (1) các lớp tương ứng
    ins = run(set(MAP))
    cat = np.array([c for c, _ in ins]); P = np.array([p for _, p in ins])
    pred = P.argmax(1); truth = np.array([CLASSES.index(MAP[c]) for c in cat]); ok = pred == truth
    print("\n(1) ESC-50, các lớp tương ứng (số clip, độ chính xác, nhãn bị đoán nhiều nhất)")
    per = {}
    for c in MAP:
        m = cat == c
        if m.any():
            top = CLASSES[np.bincount(pred[m], minlength=10).argmax()]
            per[c] = {"n": int(m.sum()), "acc": float(ok[m].mean()), "most_predicted": top}
            print(f"  {c:9s} → {MAP[c]:14s} n={m.sum():3d}  acc={ok[m].mean()*100:5.1f}%  hay bị đoán: {top}")
    print(f"  Tổng: {ok.mean()*100:.1f}% trên {len(ok)} clip")
    res["esc50_mapped"] = {"per_class": per, "overall_acc": float(ok.mean()), "n": int(len(ok)),
                           "thresholds": accept_table(P.max(1), ok)}
    # (2) âm thanh lạ và tiếng người
    for name, cats in (("unknown_sounds", LA), ("voice", VOICE)):
        g = np.array([p.max() for _, p in run(set(cats))])
        res[name] = {"n": int(len(g)), "mean_conf": float(g.mean()), "thresholds": accept_table(g)}
    # (3) Fold 10 của UrbanSound8K (nếu có)
    if a.features:
        d = np.load(a.features); te = d["folds"] == 10
        Pu = np.concatenate([probs_of(net, d["X"][te][i:i + 128]) for i in range(0, te.sum(), 128)])
        okU = Pu.argmax(1) == d["y"][te]
        res["us8k_fold10"] = {"acc": float(okU.mean()), "thresholds": accept_table(Pu.max(1), okU)}
    # Bảng tổng hợp
    print("\n(2) Theo ngưỡng tin cậy τ:  [được nhận / độ chính xác khi được nhận]  và  [tỉ lệ bị từ chối] với âm thanh lạ")
    print(f"{'τ':>5} | {'ESC-50 tương ứng':>18} | {'US8K Fold 10':>14} | {'lạ: từ chối':>11} | {'tiếng người: từ chối':>20}")
    for t in map(str, THRESHOLDS):
        e = res["esc50_mapped"]["thresholds"][t]
        u = res.get("us8k_fold10", {}).get("thresholds", {}).get(t)
        us = f"{u['accepted']*100:.0f}% / {u['selective_acc']*100:.0f}%" if u and u["selective_acc"] is not None else "–"
        es = f"{e['accepted']*100:.0f}% / {e['selective_acc']*100:.0f}%" if e["selective_acc"] is not None else "–"
        print(f"{float(t):5.1f} | {es:>18} | {us:>14} | {(1-res['unknown_sounds']['thresholds'][t]['accepted'])*100:10.0f}% | {(1-res['voice']['thresholds'][t]['accepted'])*100:19.0f}%")
    os.makedirs("results", exist_ok=True)
    json.dump(res, open("results/esc50_eval.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nĐã lưu results/esc50_eval.json")
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        x = THRESHOLDS
        fig, ax = plt.subplots(figsize=(6.5, 3.8))
        ax.plot(x, [(1 - res["unknown_sounds"]["thresholds"][str(t)]["accepted"]) * 100 for t in x], "o-", label="Âm thanh lạ bị từ chối")
        ax.plot(x, [(1 - res["voice"]["thresholds"][str(t)]["accepted"]) * 100 for t in x], "s-", label="Tiếng người bị từ chối")
        ax.plot(x, [res["esc50_mapped"]["thresholds"][str(t)]["accepted"] * 100 for t in x], "^-", label="Clip đúng lớp được nhận")
        ax.set_xlabel("Ngưỡng tin cậy τ"); ax.set_ylabel("%"); ax.grid(alpha=.3); ax.legend(fontsize=8)
        fig.tight_layout(); fig.savefig("results/esc50_threshold.png", dpi=160)
        print("Đã lưu results/esc50_threshold.png")
    except ImportError:
        pass


if __name__ == "__main__":
    main()
