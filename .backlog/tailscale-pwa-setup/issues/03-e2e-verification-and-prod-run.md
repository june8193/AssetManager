# 03 — 운영 환경 빌드 및 Tailscale HTTPS E2E 검증

**What to build:**
운영 구동 스크립트(`scripts/run_prod.py`)를 통해 프론트엔드를 신규 빌드 및 배포하고, Tailscale HTTPS 실제 주소로의 E2E 통신, PWA 설치 요건 충족 상태, 기존 테스트 스위트의 무결성을 최종 검증합니다.

**Blocked by:** 02 — Vite 호스트 허용 설정 및 Tailscale Serve 포트 정렬

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `run_prod.py` 환경에서 프론트엔드가 에러 없이 빌드(`vite build`)되고 프리뷰(`vite preview`)로 구동되어야 함.
- [ ] 기존 프론트엔드 테스트 스위트(`pnpm test` / Vitest)가 모두 통과(Green)해야 함.
- [ ] Tailscale HTTPS 도메인(`https://seongeuns-macbook-air.tail9df66b.ts.net`)을 통해 HTML 문서, PWA 매니페스트, 서비스 워커 스크립트, PNG 아이콘 및 API 요청이 브라우저 보안 경고나 Mixed Content 없이 200 OK로 서빙되어야 함.
- [ ] 안드로이드(Chrome 앱 설치 버튼) 및 iOS(Safari 홈 화면에 추가 후 Standalone 실행)에서 PWA로 정상 구동 가능한지 확인 가이드가 마련되어야 함.
