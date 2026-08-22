# 03 — 서비스 및 계산 유틸리티 테스트의 Node 런타임 격리 (Environment Tiering)

**What to build:** DOM 조작이 없는 순수 비즈니스 계산 및 API 서비스 단위 테스트들을 가상 DOM 없이 네이티브 Node 런타임 환경에서 초고속으로 실행되도록 분리합니다.

**Blocked by:** 01 — 경량 DOM 런타임(happy-dom) 전환 및 Vitest 러너 환경 최적화

**Status:** ready-for-agent

- [ ] 순수 계산 유틸리티 테스트 파일들에 `@vitest-environment node` 지시어를 적용한다.
- [ ] API 서비스 및 클라이언트 단위 테스트 파일들에 `@vitest-environment node` 지시어를 적용한다.
- [ ] Node 환경에서 해당 유틸리티/서비스 테스트 스위트가 에러 없이 수 밀리초 내에 즉시 통과하는지 검증한다.
