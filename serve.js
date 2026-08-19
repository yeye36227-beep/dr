/* ============================================
   Dr.Judge — 로컬 개발용 서버 (CORS 우회)

   실행:  node serve.js
   열기:  http://localhost:3000/signup.html

   왜 필요한가
     Live Server(5500) 로 열면 프론트와 백엔드가 다른 주소라서
     브라우저가 CORS 로 막습니다. 백엔드를 고치려면 서버 담당이 필요하고요.
     이 서버는 화면과 /api 를 '같은 주소'에서 내주기 때문에
     브라우저가 아예 CORS 검사를 하지 않습니다.

   준비물 없음 — Node 만 있으면 됩니다. (설치 패키지 0개)
   ============================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const API = process.env.API || 'http://127.0.0.1:8080'; // 백엔드 주소
const ROOT = path.join(__dirname, 'project'); // 화면 파일이 있는 폴더

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  /* ---------- /api/ 는 백엔드로 그대로 넘깁니다 ----------
     주의: startsWith('/api') 로 하면 화면 파일인 api.js 까지 넘어갑니다.
     반드시 '/api/' 로 봐야 합니다. */
  const toBackend =
    req.url === '/api' ||
    req.url.startsWith('/api/') ||
    // Swagger 문서 — server-check.html 이 enum 값을 읽는 데 씁니다
    req.url.startsWith('/v3/api-docs') ||
    req.url.startsWith('/v2/api-docs') ||
    req.url.startsWith('/swagger-ui');

  if (toBackend) {
    const target = new URL(API);
    const proxy = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );

    proxy.on('error', (e) => {
      console.error(`  ✗ ${req.method} ${req.url} — 백엔드에 못 닿음 (${e.code})`);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'BACKEND_DOWN', message: `${API} 에 연결하지 못했습니다.` },
        }),
      );
    });

    req.pipe(proxy);
    return;
  }

  /* ---------- 나머지는 화면 파일 ---------- */
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  // 공유 링크(/share/{token}) 는 share.html 이 받습니다
  if (rel.startsWith('/share/')) rel = '/share.html';

  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('없는 파일: ' + rel);
      return;
    }

    let body = buf;

    /* 화면에 '여기서는 /api 를 그대로 쓰면 된다'고 알려 줍니다.
       이 표시가 있으면 api.js 가 백엔드 주소를 따로 붙이지 않습니다.
       (포트를 바꿔 띄워도 동작하도록 표시로 알려주는 방식을 씁니다) */
    if (path.extname(file).toLowerCase() === '.html') {
      body = Buffer.from(
        buf
          .toString('utf8')
          .replace('</head>', '  <script>window.__SAME_ORIGIN_API = true;</script>\n  </head>'),
        'utf8',
      );
    }

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', // 고친 게 바로 보이도록
    });
    res.end(body);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Dr.Judge 로컬 서버가 떴습니다.');
  console.log('');
  console.log(`    화면    http://localhost:${PORT}/start.html`);
  console.log(`    백엔드  ${API}  →  /api 로 넘김`);
  console.log('');
  console.log('  같은 주소에서 내주기 때문에 CORS 문제가 없습니다.');
  console.log('  끄려면 Ctrl+C');
  console.log('');
});
