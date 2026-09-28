# 01 — 백엔드 벤치마크 기여도 계산 서비스 및 REST API 엔드포인트 구현

**What to build:**
포트폴리오의 4개 기간(1개월, 3개월, 1년, 연초 대비) 입출금 보정 누적 수익률(ROI)과 3대 지수(S&P 500, NASDAQ, KOSPI) 수익률 및 S&P 500 대비 Alpha, 그리고 전체 보유 종목의 기간별 현지통화 주가 수익률과 자산 가중 손익 기여도(Attribution: $\text{비중(\%)} \times \text{종목수익률(\%)} / 100$)를 계산하고, YTD 및 1M 기준 Top 3 기여 종목(Top Contributors) 및 Bottom 3 부진 종목(Top Detractors)을 일괄 산출하여 반환하는 백엔드 서비스 메서드와 `GET /api/benchmark/attribution` REST API 엔드포인트를 구현합니다. (TDD 방식 적용)

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] `tests/test_benchmark_attribution.py` 단위 테스트가 작성되어 있으며, 4개 기간 벤치마크 수익률, Alpha, 종목별 가중 손익 기여도, Top/Bottom 3 랭킹 계산의 정합성을 검증한다.
- [ ] `BenchmarkService`에 `get_attribution_summary(as_of_date)` 메서드가 구현되어, 기존 캐시된 시세와 스냅샷을 활용해 0.5초 이내에 정확한 결과를 산출한다.
- [ ] `src/backend/routers/benchmark.py`에 `GET /api/benchmark/attribution` 엔드포인트가 등록되어 있으며, `as_of_date` 쿼리 파라미터를 지원한다.
- [ ] 모든 백엔드 단위 테스트가 통과한다 (`uv run pytest tests/test_benchmark_attribution.py`).
