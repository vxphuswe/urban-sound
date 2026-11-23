"""Bước 1 – Gom dữ liệu từ nhiều nguồn thành một bảng manifest.csv.

Nguồn hỗ trợ:
  * data/my_sounds/<nhan>/*.wav|mp3|m4a...   mẫu nhóm tự thu (trang "Đóng góp dữ liệu" xuất đúng cấu trúc này)
  * data/extra/<nhan>/*                       dữ liệu tải thêm từ nơi khác (Freesound, FSD50K…), cùng cấu trúc
  * UrbanSound8K  (--us8k đường_dẫn)          10 lớp, ánh xạ theo label_map.json
  * ESC-50        (--esc50 đường_dẫn)         50 lớp, ánh xạ theo label_map.json

Ví dụ:
  python 01_prepare_data.py --us8k D:/data/UrbanSound8K --esc50 D:/data/ESC-50-master
  python 01_prepare_data.py --only-mine            # chỉ dùng mẫu tự thu

Kết quả: data/manifest.csv với các cột path, label, source, group, split
  group = mã nhóm để chia train/test KHÔNG rò rỉ (các đoạn cắt từ cùng một bản ghi luôn cùng phía).
"""
import argparse
import csv
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

from common import AUDIO_EXT, DATA, HERE


def folder_source(root, source):
    rows = []
    if not root.exists():
        return rows
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        for f in sorted(d.rglob("*")):
            if f.suffix.lower() in AUDIO_EXT:
                # tên file dạng nhan_YYYYMMDDhhmmss_001.wav -> nhóm theo thời điểm ghi (cùng buổi ghi = cùng nhóm)
                stem = f.stem.split("_")
                group = f"{source}:{d.name}:{stem[-2][:12] if len(stem) >= 3 else f.stem}"
                rows.append({"path": str(f.resolve()), "label": d.name, "source": source, "group": group, "split": ""})
    return rows


def us8k_source(root, mapping):
    rows = []
    meta = root / "metadata" / "UrbanSound8K.csv"
    if not meta.exists():
        print(f"! Không thấy {meta}")
        return rows
    for r in csv.DictReader(open(meta, encoding="utf-8")):
        lab = mapping.get(r["class"])
        if not lab:
            continue
        p = root / "audio" / f"fold{r['fold']}" / r["slice_file_name"]
        if p.exists():
            # fold 10 làm tập kiểm tra để so sánh được với mô hình CNN cũ
            rows.append({"path": str(p), "label": lab, "source": "us8k", "group": f"us8k:{r['fsID']}",
                         "split": "test" if r["fold"] == "10" else "train"})
    return rows


def esc50_source(root, mapping):
    rows = []
    meta = root / "meta" / "esc50.csv"
    if not meta.exists():
        print(f"! Không thấy {meta}")
        return rows
    for r in csv.DictReader(open(meta, encoding="utf-8")):
        lab = mapping.get(r["category"])
        if not lab:
            continue
        p = root / "audio" / r["filename"]
        if p.exists():
            rows.append({"path": str(p), "label": lab, "source": "esc50", "group": f"esc50:{r['src_file']}",
                         "split": "test" if r["fold"] == "5" else "train"})
    return rows


def assign_split(rows, test_ratio):
    for r in rows:
        if not r["split"]:
            h = int(hashlib.md5(r["group"].encode()).hexdigest(), 16) % 1000
            r["split"] = "test" if h < test_ratio * 1000 else "train"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--us8k", type=Path)
    ap.add_argument("--esc50", type=Path)
    ap.add_argument("--only-mine", action="store_true")
    ap.add_argument("--test-ratio", type=float, default=0.2)
    ap.add_argument("--max-per-label", type=int, default=600, help="giới hạn mỗi nhãn để dữ liệu cân bằng")
    a = ap.parse_args()

    mapping = json.loads((HERE / "label_map.json").read_text(encoding="utf-8"))
    rows = folder_source(DATA / "my_sounds", "mine") + folder_source(DATA / "extra", "extra")
    if not a.only_mine:
        if a.us8k:
            rows += us8k_source(a.us8k, mapping["urbansound8k"])
        if a.esc50:
            rows += esc50_source(a.esc50, mapping["esc50"])
    if not rows:
        raise SystemExit("Chưa có dữ liệu. Giải nén gói mẫu vào training/data/my_sounds/ hoặc truyền --us8k/--esc50.")
    assign_split(rows, a.test_ratio)

    # cân bằng: ưu tiên giữ mẫu tự thu
    random.seed(0)
    by_label = {}
    for r in rows:
        by_label.setdefault(r["label"], []).append(r)
    out = []
    for lab, rs in by_label.items():
        mine = [r for r in rs if r["source"] == "mine"]
        other = [r for r in rs if r["source"] != "mine"]
        random.shuffle(other)
        out += mine + other[: max(0, a.max_per_label - len(mine))]

    DATA.mkdir(parents=True, exist_ok=True)
    with open(DATA / "manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "label", "source", "group", "split"])
        w.writeheader()
        w.writerows(out)

    c = Counter((r["label"], r["split"]) for r in out)
    print(f"Đã ghi {len(out)} dòng vào {DATA / 'manifest.csv'}\n")
    print(f"{'nhãn':16s} {'train':>6s} {'test':>6s}")
    for lab in sorted({r['label'] for r in out}):
        warn = "  <- nên thu thêm (>= 30)" if c[(lab, 'train')] < 30 else ""
        print(f"{lab:16s} {c[(lab, 'train')]:6d} {c[(lab, 'test')]:6d}{warn}")
    if "khac" not in by_label:
        print("\nGợi ý: thêm nhãn 'khac' (tiếng nền bình thường) để mô hình biết khi nào KHÔNG nên báo.")


if __name__ == "__main__":
    main()
