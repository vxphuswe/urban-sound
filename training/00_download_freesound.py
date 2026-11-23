"""Bước 0a – Tải mẫu âm thanh từ Freesound.org theo danh sách sounds_to_collect.json.

Cần API key miễn phí: đăng ký tài khoản freesound.org → https://freesound.org/apiv2/apply → tạo key.

  # Windows (PowerShell):  $env:FREESOUND_API_KEY="abc123"
  # macOS/Linux:           export FREESOUND_API_KEY=abc123
  python 00_download_freesound.py                    # tải mọi nhãn trong sounds_to_collect.json
  python 00_download_freesound.py --labels tieng_rao coi_xe_may --n 100
  python 00_download_freesound.py --label tieng_mo --query "wood block" --n 80     # thêm nhãn nhanh
  python 00_download_freesound.py --no-nc            # bỏ âm thanh giấy phép "NonCommercial"

Kết quả: data/extra/<nhan>/fs_<id>.mp3 và data/extra/credits_freesound.csv (ghi nguồn + giấy phép – bắt buộc khi dùng CC BY).
Tải bản preview MP3 chất lượng cao (~128 kbps) – đủ tốt để train, không cần đăng nhập OAuth.
"""
import argparse
import csv
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from common import DATA, HERE

API = "https://freesound.org/apiv2"
OUT = DATA / "extra"


def api_get(path, params, key):
    params = {**params, "token": key}
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "UrbanSound-training/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def search(query, key, page, no_nc, max_dur):
    flt = f"duration:[0.5 TO {max_dur}]"
    if no_nc:
        flt += ' -license:"Attribution NonCommercial"'
    params = {"query": query, "filter": flt, "fields": "id,name,username,license,duration,previews,tags",
              "page_size": 150, "page": page, "sort": "score"}
    for path in ("/search/text/", "/search/"):          # API cũ và mới
        try:
            return api_get(path, params, key)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            if e.code == 401:
                raise SystemExit("API key không hợp lệ. Kiểm tra FREESOUND_API_KEY.")
            if e.code == 429:
                print("  Freesound yêu cầu chậm lại, đợi 60 giây…")
                time.sleep(60)
                return api_get(path, params, key)
            raise
    return {"results": []}


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "UrbanSound-training/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        f.write(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("FREESOUND_API_KEY"))
    ap.add_argument("--labels", nargs="*", help="chỉ tải các nhãn này")
    ap.add_argument("--label", help="nhãn mới (dùng kèm --query)")
    ap.add_argument("--query", nargs="*", help="từ khóa cho --label")
    ap.add_argument("--n", type=int, help="số mẫu tối đa mỗi nhãn (ghi đè n trong file)")
    ap.add_argument("--no-nc", action="store_true", help="bỏ giấy phép NonCommercial")
    ap.add_argument("--max-dur", type=float, default=30)
    a = ap.parse_args()
    if not a.key:
        raise SystemExit("Thiếu API key. Lấy miễn phí tại https://freesound.org/apiv2/apply rồi đặt biến FREESOUND_API_KEY.")

    plan = json.loads((HERE / "sounds_to_collect.json").read_text(encoding="utf-8"))
    plan = {k: v for k, v in plan.items() if not k.startswith("_")}
    if a.label:
        plan = {a.label: {"freesound": a.query or [a.label.replace("_", " ")], "n": a.n or 150}}
    elif a.labels:
        plan = {k: plan[k] for k in a.labels if k in plan}

    OUT.mkdir(parents=True, exist_ok=True)
    credits_path = OUT / "credits_freesound.csv"
    new_file = not credits_path.exists()
    credits = open(credits_path, "a", newline="", encoding="utf-8")
    cw = csv.writer(credits)
    if new_file:
        cw.writerow(["label", "file", "freesound_id", "name", "author", "license", "url"])

    seen = set()
    for label, cfg in plan.items():
        want = a.n or cfg.get("n", 150)
        folder = OUT / label
        folder.mkdir(parents=True, exist_ok=True)
        have = len(list(folder.glob("fs_*.mp3")))
        print(f"\n== {label}: đã có {have}, cần {want}")
        for q in cfg.get("freesound", []):
            page = 1
            while have < want and page <= 5:
                res = search(q, a.key, page, a.no_nc, a.max_dur).get("results", [])
                if not res:
                    break
                for s in res:
                    if have >= want:
                        break
                    if s["id"] in seen:
                        continue
                    seen.add(s["id"])
                    path = folder / f"fs_{s['id']}.mp3"
                    if path.exists():
                        continue
                    url = (s.get("previews") or {}).get("preview-hq-mp3")
                    if not url:
                        continue
                    try:
                        download(url, path)
                    except Exception as e:
                        print("  ! lỗi tải", s["id"], e)
                        continue
                    cw.writerow([label, path.name, s["id"], s["name"], s["username"], s["license"], f"https://freesound.org/s/{s['id']}/"])
                    have += 1
                    time.sleep(0.15)
                print(f"  '{q}' trang {page}: {have}/{want}")
                page += 1
    credits.close()
    print(f"\nXong. Nghe thử vài file trong {OUT} và XÓA file sai nhãn trước khi train (rất quan trọng).")


if __name__ == "__main__":
    main()
