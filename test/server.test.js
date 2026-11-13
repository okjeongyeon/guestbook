// 방명록 서버 자동 테스트 — 실행: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.join(__dirname, '..', 'server.js');
let nextPort = 4100;

// 임시 폴더를 저장소로 쓰는 서버를 띄운다 (실제 data/ 폴더는 건드리지 않음)
async function startServer(t, { seed } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guestbook-test-'));
  const dataFile = path.join(dir, 'entries.json');
  if (seed !== undefined) fs.writeFileSync(dataFile, seed);
  const port = nextPort++;
  const proc = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => {
    proc.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => d.toString().includes('실행 중') && resolve());
    proc.on('exit', (code) => reject(new Error('서버가 종료됨: ' + code)));
  });
  const base = `http://localhost:${port}`;
  return {
    dir,
    dataFile,
    list: () => fetch(base + '/api/entries').then((r) => r.json()),
    post: (body) =>
      fetch(base + '/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };
}

test('DATA_FILE로 지정한 파일에 글이 저장된다', async (t) => {
  const s = await startServer(t);
  await s.post({ name: '홍길동', message: '안녕하세요' });
  const saved = JSON.parse(fs.readFileSync(s.dataFile, 'utf8'));
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].name, '홍길동');
});

test('저장 파일이 깨져 있어도 원래 내용을 백업해 두고 지우지 않는다', async (t) => {
  const broken = '[{"name":"기존 글", "message": 깨진 데이터';
  const s = await startServer(t, { seed: broken });
  await s.post({ name: '새 방문자', message: '새 글' });
  const backups = fs.readdirSync(s.dir).filter((f) => f.startsWith('entries.json.corrupt'));
  assert.strictEqual(backups.length, 1, '깨진 파일의 백업이 1개 있어야 한다');
  assert.strictEqual(fs.readFileSync(path.join(s.dir, backups[0]), 'utf8'), broken);
});

// ---- 기존 요구사항 회귀 테스트 ----
test('FR-04: 이름이나 메시지가 비어 있으면(공백만 있어도) 400으로 거부한다', async (t) => {
  const s = await startServer(t);
  assert.strictEqual((await s.post({ name: '', message: '내용' })).status, 400);
  assert.strictEqual((await s.post({ name: '이름', message: '   ' })).status, 400);
  assert.deepStrictEqual(await s.list(), []);
});

test('FR-01/02: 이름 20자, 메시지 500자를 넘으면 거부한다', async (t) => {
  const s = await startServer(t);
  assert.strictEqual((await s.post({ name: 'a'.repeat(21), message: 'x' })).status, 400);
  assert.strictEqual((await s.post({ name: 'a', message: 'x'.repeat(501) })).status, 400);
  assert.strictEqual((await s.post({ name: 'a'.repeat(20), message: 'x'.repeat(500) })).status, 201);
});

test('FR-08: 목록은 최신 글이 맨 위에 온다', async (t) => {
  const s = await startServer(t);
  await s.post({ name: '첫번째', message: '1' });
  await new Promise((r) => setTimeout(r, 5));
  await s.post({ name: '두번째', message: '2' });
  const list = await s.list();
  assert.deepStrictEqual(list.map((e) => e.name), ['두번째', '첫번째']);
});

test('FR-09: 서버를 다시 켜도 글이 유지된다', async (t) => {
  const s1 = await startServer(t);
  await s1.post({ name: '유지', message: '남아있어야 함' });
  const s2 = await startServer(t, { seed: fs.readFileSync(s1.dataFile, 'utf8') });
  assert.strictEqual((await s2.list())[0].name, '유지');
});
