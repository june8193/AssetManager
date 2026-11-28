# 02 — 대시보드·포트폴리오·종목·섹터 모듈을 MarketDataProvider로 전환

**Spec:** [spec.md](../spec.md)

**What to build:** 대시보드, 포트폴리오, 종목 검색/시세, 섹터 모듈들이 각자 보유하던 독자 장중 판정(공휴일 누락), 수동 시세 캐시 Upsert, 7중 환율 폴백, 동기 키움/야후 직접 호출을 모두 제거하고 주입된 `MarketDataProvider` 인터페이스만 사용하도록 전환한다.

**Blocked by:** 01-expand-market-provider-and-async-kiwoom

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 대시보드와 포트폴리오 모듈이 공휴일 포함 시장 캘린더를 공유하며 평일 휴장일에 외부 시세 API를 불필요하게 호출하지 않는다.
- [ ] 비동기 요청 경로 내 동기 `requests.post` 호출이 완전히 제거된다.
- [ ] 대시보드·포트폴리오·종목·섹터 라우터가 FastAPI DI(`Depends`)로 `MarketDataProvider`를 주입받아 동작한다.
- [ ] `uv run pytest`로 대시보드·포트폴리오·종목·섹터 테스트가 모두 통과한다.
