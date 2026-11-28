# 03 — 백그라운드 시세 갱신 이관 및 얕은 PriceService 제거

**Spec:** [spec.md](../spec.md)

**What to build:** 장마감/주기적 백그라운드 시세 갱신 작업을 `MarketDataProvider`로 이관하고, 내부에서 `SessionLocal`을 열어 테스트 격리를 깨뜨리던 얕은 패스스루 싱글톤 `PriceService`와 관련 잔존 참조를 완전히 제거한다.

**Blocked by:** 02-migrate-dashboard-and-portfolio-to-provider

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 백그라운드 시세 일괄 갱신이 미국/한국 기준일 중복 적재 없이 `MarketDataProvider`를 통해 실행된다.
- [ ] 프로덕션 코드 전체에서 `PriceService` 싱글톤 호출 및 임포트가 완전히 제거된다.
- [ ] 모든 백엔드 시세 관련 테스트가 전역 `SessionLocal` 우회 없이 격리된 테스트 DB 세션에서 통과한다(`uv run pytest`).
