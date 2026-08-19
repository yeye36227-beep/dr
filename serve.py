#!/usr/bin/env python3
"""
Dr.Judge — 로컬 개발용 서버 (CORS 우회)

실행:  python3 serve.py
열기:  http://localhost:3000/start.html

왜 필요한가
  Live Server(5500)로 열면 프론트와 백엔드가 다른 주소라서 브라우저가 CORS 로 막습니다.
  이 서버는 화면과 /api 를 '같은 주소'에서 내주기 때문에 브라우저가 CORS 검사를 하지 않습니다.

준비물 없음 — 맥에 기본으로 있는 python3 만 있으면 됩니다. (설치 패키지 0개)
  포트 바꾸기      PORT=4000 python3 serve.py
  백엔드 주소 바꾸기 API=http://127.0.0.1:9090 python3 serve.py
  끄기            Ctrl+C
"""

import os
import sys
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", 3000))
API = os.environ.get("API", "http://127.0.0.1:8080").rstrip("/")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "project")

TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
}

# 백엔드로 넘길 경로
BACKEND_PREFIXES = ("/api", "/v3/api-docs", "/v2/api-docs", "/swagger-ui")


def goes_to_backend(path):
    return any(path == p or path.startswith(p + "/") or path.startswith(p + "?")
               for p in BACKEND_PREFIXES)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass  # 요청 로그는 조용히

    # ---------- 요청 본문 읽기 ----------
    def read_body(self):
        # 길이를 알려주는 보통의 경우
        length = self.headers.get("Content-Length")
        if length:
            return self.rfile.read(int(length))

        # 길이 없이 잘라 보내는 경우(chunked) — 안 읽으면 다음 요청이 깨집니다
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            chunks = []
            while True:
                size_line = self.rfile.readline().strip()
                size = int(size_line.split(b";")[0] or b"0", 16)
                if size == 0:
                    self.rfile.readline()  # 마지막 빈 줄
                    break
                chunks.append(self.rfile.read(size))
                self.rfile.readline()  # 청크 뒤 CRLF
            return b"".join(chunks)

        return None

    # ---------- 백엔드로 넘기기 ----------
    def proxy(self):
        body = self.read_body()

        req = urllib.request.Request(API + self.path, data=body, method=self.command)
        for key, value in self.headers.items():
            if key.lower() in ("host", "content-length", "connection", "accept-encoding"):
                continue
            req.add_header(key, value)

        try:
            with urllib.request.urlopen(req, timeout=30) as up:
                data = up.read()
                self.send_response(up.status)
                ctype = up.headers.get("Content-Type")
                if ctype:
                    self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            print(f"  ✗ {self.command} {self.path} — 백엔드에 못 닿음 ({e})")
            data = (
                '{"success":false,"data":null,'
                '"error":{"code":"BACKEND_DOWN","message":"' + API + ' 에 연결하지 못했습니다."}}'
            ).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    # ---------- 화면 파일 ----------
    def serve_file(self):
        path = urllib.parse.unquote(self.path.split("?")[0])
        if path == "/":
            path = "/index.html"
        # 공유 링크(/share/{token}) 는 share.html 이 받습니다
        if path.startswith("/share/"):
            path = "/share.html"

        target = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not target.startswith(ROOT):  # 상위 폴더로 못 빠져나가게
            self.send_error(403)
            return

        try:
            with open(target, "rb") as f:
                data = f.read()
        except OSError:
            msg = ("없는 파일: " + path).encode()
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return

        ext = os.path.splitext(target)[1].lower()

        # 화면에 '여기서는 /api 를 그대로 쓰면 된다'고 알려 줍니다
        if ext == ".html":
            data = data.decode("utf-8").replace(
                "</head>",
                "  <script>window.__SAME_ORIGIN_API = true;</script>\n  </head>",
                1,
            ).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")  # 고친 게 바로 보이도록
        self.end_headers()
        self.wfile.write(data)

    def handle_one(self):
        if goes_to_backend(self.path):
            self.proxy()
        else:
            self.read_body()  # 남은 본문을 비워 다음 요청이 안 깨지게
            self.serve_file()

    do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = do_OPTIONS = handle_one


if __name__ == "__main__":
    if not os.path.isdir(ROOT):
        print(f"\n  project 폴더를 못 찾았습니다: {ROOT}")
        print("  이 파일을 project 폴더와 같은 위치에 두고 실행해 주세요.\n")
        sys.exit(1)

    print("")
    print("  Dr.Judge 로컬 서버가 떴습니다.")
    print("")
    print(f"    화면    http://localhost:{PORT}/start.html")
    print(f"    백엔드  {API}  →  /api 로 넘김")
    print("")
    print("  같은 주소에서 내주기 때문에 CORS 문제가 없습니다.")
    print("  끄려면 Ctrl+C")
    print("")

    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
