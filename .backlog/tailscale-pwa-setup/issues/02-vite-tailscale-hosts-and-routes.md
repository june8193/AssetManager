# 02 — Vite 호스트 허용 설정 및 Tailscale Serve 포트 정렬

**What to build:**
Tailscale HTTPS 도메인(`*.ts.net`)으로 접속 시 발생하는 Vite v8의 Host 차단(403 Forbidden)을 해제하고, Tailscale Serve의 프록시 대상을 프론트엔드 포트(5173)로 변경하여 단일 HTTPS 주소(`https://seongeuns-macbook-air.tail9df66b.ts.net`)로 프론트엔드 UI와 백엔드 API(`/api`)가 모두 원활히 통신되도록 만듭니다.

**Blocked by:** 01 — PWA PNG 에셋 생성 및 웹 매니페스트/HTML 메타 등록

**Status:** closed

## Acceptance criteria

- [x] `src/frontend/vite.config.js`의 `server` 및 `preview` 설정에 `allowedHosts: ['.ts.net']`가 적용되어야 함.
- [x] Tailscale Serve 설정(`tailscale serve status`)이 `https://seongeuns-macbook-air.tail9df66b.ts.net -> http://127.0.0.1:5173`으로 정상 매핑되어야 함.
- [x] `curl -i -H "Host: seongeuns-macbook-air.tail9df66b.ts.net" http://127.0.0.1:5173/` 요청 시 403 차단 없이 200 OK가 반환되어야 함.
- [x] `curl -i http://127.0.0.1:5173/api/db/users` 요청 시 백엔드로 정상 프록시되어 200 OK와 응답 본문이 반환되어야 함.
