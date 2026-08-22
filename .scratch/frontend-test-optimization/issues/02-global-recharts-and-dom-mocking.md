# 02 — 전역 Recharts 차트 및 브라우저 API Mocking 체계 구축

**What to build:** 전역 테스트 setup 계층에 ResizeObserver 및 Recharts 레이아웃 컨테이너(ResponsiveContainer 등) mock을 구성하여, 수백 줄의 차트 크기 계산 stderr 경고와 불필요한 레이아웃 연산 부하를 전면 차단합니다.

**Blocked by:** 01 — 경량 DOM 런타임(happy-dom) 전환 및 Vitest 러너 환경 최적화

**Status:** resolved

- [x] 전역 테스트 setup에 `ResizeObserver` 및 윈도우 레이아웃 mock을 표준화한다.
- [x] Recharts의 `ResponsiveContainer` 및 관련 차트 컨테이너를 가볍게 렌더링되도록 mock 처리한다.
- [x] 차트가 포함된 대시보드/페이지 테스트 실행 시 차트 크기 경고(The width(-1) and height(-1) of chart should be greater than 0)가 완전히 사라지고 기존 assertion이 100% 통과하는지 검증한다.
