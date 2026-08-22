# 01 — 경량 DOM 런타임(happy-dom) 전환 및 Vitest 러너 환경 최적화

**What to build:** 무거운 jsdom 대신 초경량 happy-dom을 테스트 환경에 도입하고, 테스트 시 불필요한 CSS 파싱 비활성화 및 러너 풀 설정을 튜닝하여 테스트 초기화 오버헤드를 대폭 단축합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `happy-dom` 패키지를 설치하고 테스트 환경 설정을 업데이트한다.
- [x] 테스트 러너 설정에서 불필요한 CSS 파싱 및 번들링 오버헤드를 비활성화한다.
- [x] 기본 컴포넌트 및 페이지 테스트가 깨짐 없이 원활하게 구동되는지 확인한다.
