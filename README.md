# 방명록

로그인 없이 이름과 메시지를 남기는 방명록 웹페이지입니다. Node.js 내장 모듈만 사용하므로 별도 설치가 필요 없습니다.

## 실행

```bash
node server.js
```

브라우저에서 http://localhost:3000 접속 (포트 변경: `PORT=8080 node server.js`)

## 구조

```
server.js          # HTTP 서버 + REST API + JSON 파일 저장
public/index.html  # 화면
public/style.css   # 반응형 스타일 (다크 모드 지원)
public/app.js      # 입력 검증, 등록, 목록 렌더링
data/entries.json  # 저장된 글 (최초 등록 시 자동 생성)
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/entries` | 글 목록 (최신순) |
| POST | `/api/entries` | `{ name, message }` 등록. 빈 값·길이 초과 시 400 |

## 요구사항 대응

| ID | 구현 |
|---|---|
| FR-01/02 | `maxlength` + 글자 수 카운터, 서버에서 20자/500자 재검증 |
| FR-03 | 등록 버튼 → `POST /api/entries` |
| FR-04 | 공백만 입력해도 빈 값으로 처리, 안내 문구 표시 (클라이언트·서버 모두 검증) |
| FR-05 | 등록 성공 시 `form.reset()` |
| FR-06/07 | 폼 아래 목록에 이름·메시지·작성 일시 표시 |
| FR-08 | 서버에서 `createdAt` 내림차순 정렬, 새 글은 맨 위에 추가 |
| FR-09 | `data/entries.json` 파일 저장 → 새로고침·재접속·서버 재시작 후에도 유지 |
| FR-10 | 글이 없으면 "아직 작성된 글이 없습니다" 표시 |
| NFR-01 | 모바일 우선 레이아웃, 600px 이상에서 PC 레이아웃 |
| NFR-02 | `innerHTML` 미사용, `textContent`로만 출력 + CSP 헤더로 인라인 스크립트 차단 |
| NFR-03 | 등록 응답을 받는 즉시 목록에 추가 (재조회 없이 반영) |
