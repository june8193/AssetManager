# 02 — 일괄 원화 포지션 평가 모듈 추출 및 6개 모듈 중복 루프 대체

**Spec:** [spec.md](../spec.md)

**What to build:** 계좌마다 `LedgerEngine.get_positions`를 반복 호출하던 3N 쿼리와 6개 도메인 모듈에 흩어진 시세×환율 원화 평가 루프를 단일 일괄 평가 모듈로 통합하고, 비중 점검(`RatioService`)이 무거운 대시보드 요약 전체를 호출하던 결합을 끊는다.

**Blocked by:** 01-remove-ghost-snapshot-service-and-unify-net-deposits

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 계좌별·티커별·카테고리별 보유 포지션과 원화/외화 평가액을 일괄 산출하는 평가 모듈이 구현된다.
- [ ] 대시보드, 포트폴리오, 비중, 스냅샷, 리스크, 벤치마크 모듈이 자체 평가 루프 대신 단일 평가 모듈을 사용한다.
- [ ] `RatioService`가 대시보드 요약 전체에 의존하지 않고 평가 모듈을 직접 소비한다.
- [ ] `uv run pytest`로 관련 백엔드 테스트가 모두 통과한다.
