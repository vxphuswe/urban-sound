"""Hàm dùng chung cho các script huấn luyện."""
import base64
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = HERE / "data"
SR = 16000
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".opus", ".webm", ".mp4"}

# Nhóm có sẵn trên web (trùng id trong assets/js/categories.js)
BUILTIN_GROUPS = {
    "dog", "cat", "poultry", "livestock", "bird", "insect", "animal", "children", "baby", "speech", "crowd", "laugh",
    "shout", "body", "footsteps", "music", "motorbike", "horn", "traffic", "siren", "train", "aircraft", "boat", "engine",
    "gunshot", "fireworks", "alarm", "glass", "fire", "construction", "ac", "appliance", "bell", "door", "office", "tv",
    "rain", "water", "wind", "silence", "noise",
}


def load_audio(path, sr=SR):
    """Đọc file bất kỳ -> mono float32 ở 16 kHz, biên độ [-1, 1]."""
    import librosa
    y, _ = librosa.load(str(path), sr=sr, mono=True)
    return np.nan_to_num(y.astype(np.float32))


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype="<f4").tobytes()).decode()


def export_head(layers, classes, path, meta=None, min_confidence=0.6):
    """
    Ghi mô hình Dense nhỏ thành JSON để web đọc trực tiếp (assets/js/classifier.js -> loadHead).
    layers: [(W [in, out], b [out], activation)], activation thuộc {'relu', 'softmax', 'linear'}
    classes: [{'id':..., 'vi':..., 'group':..., 'icon':..., 'kind':...}]
    """
    out = {
        "version": 1,
        "input": "yamnet_embedding_1024",
        "min_confidence": min_confidence,
        "classes": classes,
        "layers": [
            {"shape": [int(W.shape[0]), int(W.shape[1])], "w": b64(W), "b": b64(b), "activation": act}
            for W, b, act in layers
        ],
        "meta": meta or {},
    }
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


def load_head(path):
    j = json.loads(Path(path).read_text(encoding="utf-8"))
    layers = []
    for L in j["layers"]:
        W = np.frombuffer(base64.b64decode(L["w"]), dtype="<f4").reshape(L["shape"])
        b = np.frombuffer(base64.b64decode(L["b"]), dtype="<f4")
        layers.append((W, b, L["activation"]))
    return j, layers


def head_forward(layers, x):
    h = np.asarray(x, dtype=np.float32)
    for W, b, act in layers:
        h = h @ W + b
        if act == "relu":
            h = np.maximum(h, 0)
        elif act == "softmax":
            h = np.exp(h - h.max(axis=-1, keepdims=True))
            h = h / h.sum(axis=-1, keepdims=True)
    return h


def class_info(label, labels_vi):
    """Thông tin hiển thị cho một nhãn: nhãn có sẵn dùng luôn nhóm của web, nhãn mới lấy từ labels_vi.json."""
    info = {"id": label}
    extra = labels_vi.get(label, {})
    if label in BUILTIN_GROUPS:
        info["group"] = label
    elif extra.get("group"):
        info["group"] = extra["group"]
    for k in ("vi", "icon", "kind"):
        if k in extra:
            info[k] = extra[k]
    info.setdefault("vi", label)
    return info
