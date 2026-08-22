# 04 — 비동기 네트워크 Mock 누락 보완 및 act() 경고 안정화

**What to build:** 페이지 및 훅 단위 테스트에서 실제 백엔드 소켓/포트 연결을 시도하여 발생하는 타임아웃 및 네트워크 오류(ECONNREFUSED)를 방지하고, 비동기 상태 갱신(act) 경고를 해소하여 테스트의 결정성과 실행 속도를 확보합니다.

**Blocked by:** 02 — 전역 Recharts 차트 및 브라우저 API Mocking 체계 구축, 03 — 서비스 및 계산 유틸리티 테스트의 Node 런타임 격리 (Environment Tiering)

**Status:** resolved

- [x] `DashboardPage` 등에서 백그라운드 태스크/SSE/시스템 상태 polling 네트워크 fetch를 적절히 mock 처리하여 `ECONNREFUSED` 로그 및 대기 지연을 제거한다.
- [x] 상태 갱신이 비동기로 발생하는 주요 페이지 테스트에서 비동기 전이 처리를 보완하여 `act(...)` 경고를 제거한다.
- [x] 관련 페이지 테스트들이 격리된 환경에서 완벽히 통과하는지 검증한다.
