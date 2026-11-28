# 04 — 3중 백테스트 엔진 루프를 단일 파라미터화 코어로 통합

**Spec:** [spec.md](../spec.md)

**What to build:** 거치식·적립식·동적 리밸런싱 시뮬레이션에 3벌(내부 거치식 비교 포함 5벌)로 중복된 일별 리밸런싱 루프와 말일 리밸런싱 보정 규칙을 단일 파라미터화 백테스트 코어로 통합한다.

**Blocked by:** 03-unify-timeseries-metrics-and-benchmark-returns

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 거치식·적립식·동적 리밸런싱이 단일 백테스트 코어와 공통 시계열 통계 모듈을 통해 실행된다.
- [ ] 마지막 거래일 리밸런싱 보정 및 CAGR·MDD 산출 규칙이 모든 시뮬레이션 모드에서 일관되게 적용된다.
- [ ] `uv run pytest`로 기존 시뮬레이션·동적 리밸런싱·적립식 테스트가 모두 통과한다.
