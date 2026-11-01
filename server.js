// 방명록 서버 — 외부 의존성 없이 Node.js 내장 모듈만 사용
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'entries.json');
const MAX_NAME = 20;
const MAX_MESSAGE = 500;

// ---- 저장소 (FR-09: 파일에 저장해 재시작/재접속 후에도 유지) ----
function loadEntries() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

let entries = loadEntries();

function saveEntries() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, DATA_FILE); // 원자적 교체로 파일 손상 방지
}

// ---- 유틸 ----
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// 글자 수는 코드포인트 기준(이모지 등도 1자로 계산)
const charLen = (s) => [...s].length;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      // NFR-02 보강: 인라인 스크립트 실행 차단
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'",
    });
    res.end(content);
  });
}

// ---- 라우팅 ----
const server = http.createServer(async (req, res) => {
  if (req.url === '/api/entries' && req.method === 'GET') {
    // FR-08: 최신 글이 맨 위
    const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, sorted);
  }

  if (req.url === '/api/entries' && req.method === 'POST') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: '잘못된 요청입니다.' });
    }

    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';

    // FR-04: 빈 값 거부 / FR-01·02: 길이 제한 (서버에서도 재검증)
    if (!name || !message) {
      return sendJson(res, 400, { error: '이름과 메시지를 모두 입력해 주세요.' });
    }
    if (charLen(name) > MAX_NAME) {
      return sendJson(res, 400, { error: `이름은 최대 ${MAX_NAME}자까지 입력할 수 있습니다.` });
    }
    if (charLen(message) > MAX_MESSAGE) {
      return sendJson(res, 400, { error: `메시지는 최대 ${MAX_MESSAGE}자까지 입력할 수 있습니다.` });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      message,
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    try {
      saveEntries();
    } catch (e) {
      entries.pop();
      console.error(e);
      return sendJson(res, 500, { error: '저장 중 오류가 발생했습니다.' });
    }
    return sendJson(res, 201, entry);
  }

  if (req.url.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Not Found' });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405).end();
});

server.listen(PORT, () => {
  console.log(`방명록 서버 실행 중: http://localhost:${PORT}`);
});
