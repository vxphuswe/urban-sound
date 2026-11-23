"""Tài khoản nhiều người dùng + lịch sử sự kiện (SQLite). Không phụ thuộc torch nên kiểm thử độc lập được."""
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict
from pathlib import Path

from flask import Blueprint, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

bp = Blueprint("accounts", __name__)
BASE = Path(__file__).resolve().parent
DB = os.environ.get("APP_DB", str(BASE / "app.db"))
FAILS = defaultdict(list)     # {khóa: [thời điểm đăng nhập sai]} để chặn dò mật khẩu


def secret_key():
    f = BASE / ".secret_key"
    if os.environ.get("APP_SECRET"):
        return os.environ["APP_SECRET"]
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip()


def init_db():
    with sqlite3.connect(DB) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
            pw TEXT NOT NULL, is_admin INTEGER DEFAULT 0, created REAL);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, ts REAL,
            label TEXT, conf REAL, level REAL, duration REAL, source TEXT);
        CREATE INDEX IF NOT EXISTS ev_user ON events(user_id, ts);""")


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@bp.teardown_app_request
def close_db(_):
    d = g.pop("db", None)
    if d is not None:
        d.close()


def current_user():
    uid = session.get("uid")
    return db().execute("SELECT id, username, is_admin FROM users WHERE id=?", (uid,)).fetchone() if uid else None


def body():
    return request.get_json(silent=True) or {}


@bp.post("/api/register")
def register():
    d = body()
    u, p = str(d.get("username", "")).strip(), str(d.get("password", ""))
    if not re.fullmatch(r"[A-Za-z0-9_]{3,30}", u):
        return jsonify(error="Tên đăng nhập 3–30 ký tự: chữ, số hoặc dấu gạch dưới."), 400
    if len(p) < 6:
        return jsonify(error="Mật khẩu cần ít nhất 6 ký tự."), 400
    c = db()
    if c.execute("SELECT 1 FROM users WHERE username=?", (u,)).fetchone():
        return jsonify(error="Tên đăng nhập đã tồn tại."), 409
    first = c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0     # người đăng ký đầu tiên là quản trị
    cur = c.execute("INSERT INTO users(username, pw, is_admin, created) VALUES(?,?,?,?)",
                    (u, generate_password_hash(p), int(first), time.time()))
    c.commit()
    session["uid"] = cur.lastrowid
    return jsonify(user={"username": u, "admin": first})


@bp.post("/api/login")
def login():
    d = body()
    u, p = str(d.get("username", "")).strip(), str(d.get("password", ""))
    key = f"{request.remote_addr}|{u}"
    now = time.time()
    FAILS[key] = [t for t in FAILS[key] if now - t < 300]
    if len(FAILS[key]) >= 5:
        return jsonify(error="Sai quá nhiều lần. Thử lại sau 5 phút."), 429
    row = db().execute("SELECT * FROM users WHERE username=?", (u,)).fetchone()
    if not row or not check_password_hash(row["pw"], p):
        FAILS[key].append(now)
        return jsonify(error="Sai tên đăng nhập hoặc mật khẩu."), 401
    session["uid"] = row["id"]
    return jsonify(user={"username": u, "admin": bool(row["is_admin"])})


@bp.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@bp.get("/api/me")
def me():
    u = current_user()
    return jsonify(user={"username": u["username"], "admin": bool(u["is_admin"])} if u else None)


@bp.route("/api/events", methods=["GET", "POST", "DELETE"])
def events():
    u = current_user()
    if not u:
        return jsonify(error="Cần đăng nhập để lưu lịch sử."), 401
    c = db()
    if request.method == "POST":
        d = body()
        try:
            c.execute("INSERT INTO events(user_id, ts, label, conf, level, duration, source) VALUES(?,?,?,?,?,?,?)",
                      (u["id"], float(d.get("ts", time.time())), str(d.get("label", ""))[:40], float(d.get("conf", 0)),
                       float(d.get("level", -100)), float(d.get("duration", 0)), str(d.get("source", "live"))[:20]))
        except (TypeError, ValueError):
            return jsonify(error="Dữ liệu sự kiện không hợp lệ."), 400
        c.commit()
        return jsonify(ok=True)
    if request.method == "DELETE":
        c.execute("DELETE FROM events WHERE user_id=?", (u["id"],))
        c.commit()
        return jsonify(ok=True)
    rows = c.execute("SELECT ts, label, conf, level, duration, source FROM events WHERE user_id=? "
                     "ORDER BY ts DESC LIMIT 500", (u["id"],)).fetchall()
    return jsonify(events=[dict(r) for r in rows])


@bp.get("/api/admin/summary")
def admin_summary():
    u = current_user()
    if not u or not u["is_admin"]:
        return jsonify(error="Chỉ quản trị viên được xem."), 403
    rows = db().execute("""SELECT u.username, u.is_admin, COUNT(e.id) AS n, MAX(e.ts) AS last
                           FROM users u LEFT JOIN events e ON e.user_id=u.id GROUP BY u.id ORDER BY n DESC""").fetchall()
    return jsonify(users=[dict(r) for r in rows])
