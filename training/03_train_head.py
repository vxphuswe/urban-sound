"""Bước 3 – Huấn luyện lớp phân loại nhỏ trên embedding YAMNet và xuất cho web.

Chạy:  python 03_train_head.py
Kết quả:
  ../models/custom/head.json     web tự nạp (commit file này lên GitHub là Vercel deploy luôn)
  data/report.json               độ chính xác, ma trận nhầm lẫn theo từng đoạn âm thanh
"""
import argparse
import json

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight

from common import DATA, HERE, ROOT, class_info, export_head, head_forward


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hidden", type=int, default=256)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--min-confidence", type=float, default=0.6)
    a = ap.parse_args()

    import tensorflow as tf
    tf.random.set_seed(0)

    d = np.load(DATA / "embeddings.npz", allow_pickle=False)
    X, y, split, clip, labels = d["X"], d["y"], d["split"], d["clip"], list(d["labels"])
    tr, te = split == "train", split == "test"
    n = len(labels)
    print(f"{n} nhãn · train {tr.sum()} khung · test {te.sum()} khung")

    cw = compute_class_weight("balanced", classes=np.arange(n), y=y[tr])
    model = tf.keras.Sequential([
        tf.keras.layers.Input((1024,)),
        tf.keras.layers.Dropout(0.1),
        tf.keras.layers.Dense(a.hidden, activation="relu"),
        tf.keras.layers.Dropout(0.35),
        tf.keras.layers.Dense(n, activation="softmax"),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(X[tr], y[tr], validation_data=(X[te], y[te]) if te.any() else None, epochs=a.epochs, batch_size=256,
              class_weight=dict(enumerate(cw)), verbose=2,
              callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss" if te.any() else "loss", patience=6, restore_best_weights=True)])

    dense = [l for l in model.layers if isinstance(l, tf.keras.layers.Dense)]
    layers = [(l.kernel.numpy(), l.bias.numpy(), "relu" if i < len(dense) - 1 else "softmax") for i, l in enumerate(dense)]

    report = {"labels": labels}
    if te.any():
        # đánh giá theo đoạn âm thanh (trung bình xác suất các khung) – giống cách web tổng hợp
        P = head_forward(layers, X[te])
        clips = np.unique(clip[te])
        yt, yp = [], []
        for c in clips:
            m = clip[te] == c
            yt.append(int(y[te][m][0])); yp.append(int(P[m].mean(0).argmax()))
        acc = float(np.mean(np.array(yt) == np.array(yp)))
        print(f"\nĐộ chính xác theo đoạn (tập test): {acc * 100:.1f}% trên {len(clips)} đoạn\n")
        print(classification_report(yt, yp, labels=list(range(n)), target_names=labels, zero_division=0))
        report.update(clip_accuracy=acc, n_test_clips=len(clips),
                      confusion_matrix=confusion_matrix(yt, yp, labels=list(range(n))).tolist())
    (DATA / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")

    # tên hiển thị: sounds_to_collect.json, ghi đè bởi labels_vi.json
    collect = json.loads((HERE / "sounds_to_collect.json").read_text(encoding="utf-8"))
    labels_vi = {k: {f: v[f] for f in ("vi", "icon", "kind", "group") if f in v} for k, v in collect.items() if not k.startswith("_")}
    for k, v in json.loads((HERE / "labels_vi.json").read_text(encoding="utf-8")).items():
        if isinstance(v, dict):
            labels_vi.setdefault(k, {}).update(v)
    classes = [class_info(l, labels_vi) for l in labels]
    out = ROOT / "models" / "custom" / "head.json"
    export_head(layers, classes, out, meta={"clip_accuracy": report.get("clip_accuracy")}, min_confidence=a.min_confidence)
    print(f"Đã xuất {out} ({out.stat().st_size / 1024:.0f} KB). Commit file này để web dùng mô hình mới.")


if __name__ == "__main__":
    main()
