# 01 — MarketDataProvider 인터페이스 확장 및 비동기 키움 어댑터 단일화

**Spec:** [spec.md](../spec.md)

**What to build:** `MarketDataProvider`가 기준일 시세 조회(현금 티커 포함), 기준일 이하 최근 환율 폴백, 종목 검색, 발행주식수 조회를 단일 비동기 인터페이스로 제공하도록 확장하고, 여러 곳에 흩어진 키움 REST 통신을 토큰 관리·백오프 재시도를 내장한 단일 비동기 키움 클라이언트로 통합한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] `MarketDataProvider` 인터페이스에 기준일 벌크 시세, 기준 환율 폴백, 종목 검색, 발행주식수 조회 동작이 추가되고 `FakeMarketAdapter`가 이를 지원한다.
- [ ] 동기 `requests` 기반 키움 호출 및 개별 모듈의 중복 `httpx` 호출이 단일 비동기 키움 클라이언트로 통합된다.
- [ ] 순수 달력 모듈에서 외부 네트워크 호출 의존성이 제거되고 공휴일 판정이 일관되게 동작한다.
- [ ] `uv run pytest`로 시장 데이터·키움 관련 테스트가 `FakeMarketAdapter` 기반으로 모두 통과한다.
