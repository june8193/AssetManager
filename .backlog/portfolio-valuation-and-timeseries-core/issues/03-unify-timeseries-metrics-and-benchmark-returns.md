# 03 — 순수 시계열 수식 모듈 추출 및 기간 수익률·MDD 통합

**Spec:** [spec.md](../spec.md)

**What to build:** 연/월/일 스냅샷 수익률 버킷 집계, 기간 문자열 변환, MDD 시계열 산출, 직전 기말 종가 기준 기간 수익률 계산을 순수 `in-process` 시계열 수식 모듈로 통합하여 시장분석과 벤치마크 간 동일 지수 수익률 불일치를 해소한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 시장분석과 벤치마크 비교 표가 동일한 직전 기말 종가 기준가 공식으로 연간·월간 지수 수익률을 산출한다.
- [ ] 대시보드 연/월/일 통계 3벌의 중복 집계 코드와 10+곳에 흩어진 MDD 계산 루프가 단일 시계열 모듈로 통합된다.
- [ ] 순수 `in-process` 입력만으로 수익률·MDD·다운샘플링을 검증하는 단위 테스트가 추가되고 `uv run pytest`가 통과한다.
