"""Bước 0b – Tải đoạn 10 giây từ Google AudioSet (video YouTube đã gắn nhãn) theo sounds_to_collect.json.

AudioSet có 527 lớp với hơn 2 triệu đoạn – nguồn lớn nhất để "nhận hầu hết âm thanh".
Cần cài thêm:  pip install yt-dlp   và   ffmpeg (Windows: winget install ffmpeg | macOS: brew install ffmpeg)

  python 00_download_audioset.py                              # theo sounds_to_collect.json
  python 00_download_audioset.py --label meo --classes "Meow" "Purr" --n 100
  python 00_download_audioset.py --unbalanced                 # dùng bộ 2 triệu đoạn (tải CSV ~200 MB) để có nhiều mẫu hơn
  python 00_download_audioset.py --list "bell"                # tìm tên lớp có chữ "bell"

Kết quả: data/extra/<nhan>/as_<YTID>_<giây>.wav (mono 16 kHz) + data/extra/credits_audioset.csv
Lưu ý: nhiều video đã bị xóa/riêng tư nên tỉ lệ tải thành công thường 60–80 %. Nhãn AudioSet là "yếu"
(cả đoạn 10 s có thể chỉ chứa âm thanh đó vài giây) – script 02 đã tự bỏ khung lặng.
"""
import argparse
import csv
import io
import json
import random
import shutil
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from common import DATA, HERE, ROOT

OUT = DATA / "extra"
CACHE = DATA / "audioset_meta"
SEGMENTS = {
    "balanced": "http://storage.googleapis.com/us_ytid/balanced_train_segments.csv",
    "eval": "http://storage.googleapis.com/us_ytid/eval_segments.csv",
    "unbalanced": "http://storage.googleapis.com/us_ytid/unbalanced_train_segments.csv",
}
CLASS_MAP = [ROOT / "models" / "yamnet" / "yamnet_class_map.csv",
             "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv"]


def fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        print("Đang tải", url)
        urllib.request.urlretrieve(url, dest)
    return dest


def class_map():
    for src in CLASS_MAP:
        try:
            text = Path(src).read_text(encoding="utf-8") if isinstance(src, Path) else urllib.request.urlopen(src, timeout=30).read().decode()
            return {r["display_name"]: r["mid"] for r in csv.DictReader(io.StringIO(text))}
        except Exception:
            continue
    raise SystemExit("Không đọc được bảng lớp AudioSet.")


def segments(names):
    rows = []
    for n in names:
        p = fetch(SEGMENTS[n], CACHE / f"{n}.csv")
        with open(p, encoding="utf-8") as f:
            for line in f:
                if line.startswith("#"):
                    continue
                parts = line.strip().split(", ", 3)
                if len(parts) == 4:
                    rows.append((parts[0], float(parts[1]), float(parts[2]), set(parts[3].strip('"').split(","))))
    return rows


def grab(ytid, start, end, path):
    cmd = ["yt-dlp", "-q", "--no-warnings", "-f", "bestaudio/best", "--download-sections", f"*{start}-{end}",
           "-x", "--audio-format", "wav", "--postprocessor-args", "ffmpeg:-ac 1 -ar 16000",
           "-o", str(path.with_suffix(".%(ext)s")), f"https://www.youtube.com/watch?v={ytid}"]
    try:
        subprocess.run(cmd, check=True, timeout=120, capture_output=True)
        return path.exists()
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", nargs="*")
    ap.add_argument("--label")
    ap.add_argument("--classes", nargs="*", help="tên lớp AudioSet cho --label")
    ap.add_argument("--n", type=int)
    ap.add_argument("--unbalanced", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--list", help="tìm tên lớp AudioSet theo từ khóa rồi thoát")
    a = ap.parse_args()

    cmap = class_map()
    if a.list:
        for name in cmap:
            if a.list.lower() in name.lower():
                print(name)
        return
    if not shutil.which("yt-dlp") or not shutil.which("ffmpeg"):
        raise SystemExit("Cần cài yt-dlp (pip install yt-dlp) và ffmpeg.")

    plan = json.loads((HERE / "sounds_to_collect.json").read_text(encoding="utf-8"))
    plan = {k: v for k, v in plan.items() if not k.startswith("_")}
    if a.label:
        plan = {a.label: {"audioset": a.classes or [], "n": a.n or 150}}
    elif a.labels:
        plan = {k: plan[k] for k in a.labels if k in plan}
    plan = {k: v for k, v in plan.items() if v.get("audioset")}
    if not plan:
        raise SystemExit("Không có nhãn nào khai báo 'audioset'.")

    rows = segments(["balanced", "eval"] + (["unbalanced"] if a.unbalanced else []))
    print(f"Đã đọc {len(rows):,} đoạn AudioSet")
    random.seed(0)
    OUT.mkdir(parents=True, exist_ok=True)
    credits_path = OUT / "credits_audioset.csv"
    new = not credits_path.exists()
    with open(credits_path, "a", newline="", encoding="utf-8") as cf:
        cw = csv.writer(cf)
        if new:
            cw.writerow(["label", "file", "youtube_url", "start", "end"])
        for label, cfg in plan.items():
            mids = {cmap[c] for c in cfg["audioset"] if c in cmap}
            missing = [c for c in cfg["audioset"] if c not in cmap]
            if missing:
                print(f"! {label}: không thấy lớp {missing} (dùng --list để tra tên đúng)")
            cand = [r for r in rows if r[3] & mids]
            random.shuffle(cand)
            want = a.n or cfg.get("n", 150)
            folder = OUT / label
            folder.mkdir(parents=True, exist_ok=True)
            have = len(list(folder.glob("as_*.wav")))
            print(f"\n== {label}: {len(cand)} đoạn phù hợp, đã có {have}, cần {want}")
            i = 0
            with ThreadPoolExecutor(a.workers) as ex:
                while have < want and i < len(cand):
                    batch = cand[i:i + a.workers * 2]
                    i += len(batch)
                    jobs = []
                    for ytid, s, e, _ in batch:
                        path = folder / f"as_{ytid}_{int(s)}.wav"
                        if path.exists():
                            continue
                        jobs.append((ytid, s, e, path, ex.submit(grab, ytid, s, e, path)))
                    for ytid, s, e, path, fut in jobs:
                        if fut.result() and have < want:
                            have += 1
                            cw.writerow([label, path.name, f"https://youtu.be/{ytid}?t={int(s)}", s, e])
                    print(f"  {have}/{want} (đã thử {i})", end="\r")
            print()
    print("\nXong. Nghe thử và xóa đoạn sai trước khi train.")


if __name__ == "__main__":
    main()
