"""Tải mô hình YAMNet (bản TensorFlow.js) về models/yamnet/ để web tự phục vụ mô hình từ Vercel.

Lý do: tải từ TF Hub/Kaggle ở Việt Nam đôi khi rất chậm ("đang tải mà lâu quá").
Sau khi chạy script này và commit thư mục models/yamnet, web sẽ tải mô hình từ chính tên miền của bạn.

Chạy (Python 3.8+, không cần cài thêm thư viện):
    python tools/download_yamnet.py
"""
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "models" / "yamnet"
BASES = [
    "https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1",
    "https://www.kaggle.com/models/google/yamnet/TfJs/tfjs/1",
]
CLASS_MAP = "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv"
UA = {"User-Agent": "UrbanSound/1.0"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=60)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for base in BASES:
        try:
            print("Đang tải model.json từ", base)
            r = get(f"{base}/model.json?tfjs-format=file")
            model = json.loads(r.read().decode())
            (OUT / "model.json").write_text(json.dumps(model), encoding="utf-8")
            for group in model["weightsManifest"]:
                for p in group["paths"]:
                    print("  ", p, end=" … ", flush=True)
                    data = get(f"{base}/{p}?tfjs-format=file").read()
                    (OUT / p).write_bytes(data)
                    print(f"{len(data) / 1e6:.1f} MB")
            break
        except Exception as e:  # thử nguồn tiếp theo
            print("   thất bại:", e)
    else:
        sys.exit("Không tải được mô hình. Web vẫn chạy bằng cách tải trực tiếp từ TF Hub.")
    (OUT / "yamnet_class_map.csv").write_bytes(get(CLASS_MAP).read())
    total = sum(f.stat().st_size for f in OUT.iterdir()) / 1e6
    print(f"Xong! {total:.1f} MB trong {OUT}. Hãy commit thư mục models/yamnet rồi push lên GitHub.")


if __name__ == "__main__":
    main()
