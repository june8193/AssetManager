# 01 — 포트폴리오 내재 변동성 산출 API 및 데스크톱 리스크 진단 기본 슬라이스 구현

**Spec:** [spec.md](../spec.md)

**What to build:**
원장 기준 현재 보유 종목·현금 비중과 유효 종가(`close_price > 0`) 시세를 바탕으로 공분산 행렬(PSD 보정), 포트폴리오 연율화 내재 변동성, 평소 하루 평균 출렁임(`±%` 및 원화 체감 폭), 3대 벤치마크(`S&P 500`, `NASDAQ`, `KOSPI`) 비교, 종목별 오일러 위험 기여도, 낙폭 비교 시계열을 산출하는 `GET /api/v1/risk/volatility` 엔드포인트를 구현합니다(`1M`/`3M`/`1Y` 기간 및 `extra_tickers` 파라미터 지원 포함). 이와 연결하여 데스크톱 리스크 관리 화면(`/performance`)을 전면 재구축하고, 상단 기간 전환(`1개월`·`3개월`·`1년`), 금액 마스킹 연동, 벤치마크 위치 스펙트럼 게이지, 3열 KPI 카드, `액셀 Top 3`/`완충 자산` 빠른 가이드 배너, 종목별 변동성·기여도 기본 테이블까지 관통하는 첫 엔드투엔드 진단 슬라이스를 완성합니다(구버전 샤프·소티노 UI 및 공식 안내 모달 제거 포함).

**Blocked by:** None — can start immediately

**Status:** resolved

## Acceptance Criteria

- [x] `GET /api/v1/risk/volatility` 엔드포인트가 `period`(`1M`, `3M`, `1Y`, 기본값 `1Y`) 및 선택적 `extra_tickers` 쿼리 파라미터를 지원하며, 스펙에 정의된 JSON 계약(`portfolio`, `benchmarks`, `assets`, `covariance_matrix`, `drawdown_comparison`)을 반환한다.
- [x] 시세 캐시의 휴장일 센티널(`close_price <= 0`)이 완전히 제외되고, 현지 통화 기준 일별 수익률만 사용되며, 원화·달러 예수금 합산 버킷(`CASH`)은 수익률·변동성·공분산 모두 `0.0`으로 처리된다.
- [x] 비보유 시세 캐시 티커는 제외되고 원장 보유 수량(`quantity > 0`) 종목과 `extra_tickers` 요청 종목만 포함되며, PSD 보정된 공분산 행렬을 통해 임의 가중치에서 $\sigma_p \ge 0$ 및 $\sum \text{volatility\_share}_i = 100\%$ 불변식이 성립한다.
- [x] 단일 지수 추종 자산(예: `VOO` 100%)만 보유한 경우 포트폴리오 내재 변동성이 벤치마크 `S&P 500` 지수 변동성과 동일한 수준의 일별 잣대로 정합하게 계산된다.
- [x] 데스크톱 리스크 관리 화면(`/performance`)이 기존 샤프·소티노·무위험수익률 UI 및 공식 안내 모달 없이 신규 `포트폴리오 내재 변동성` 진단 UI로 교체된다(대시보드의 `수익 지수 Index`와 용어 분리).
- [x] 상단 기간 전환(`1개월`, `3개월`, `1년 (표준)`), 금액 마스킹(`***`) 연동, 벤치마크(`S&P 500`, `NASDAQ`, `KOSPI`) 수평 스펙트럼 게이지, 3열 KPI(연율화 변동성, 평소 하루 평균 출렁임, S&P 500 대비 배수 및 상태 배지), `액셀 Top 3`·`완충 자산` 가이드 배너, 종목별 변동성·기여도 테이블이 정상 렌더링된다.
- [x] 사전 합의된 테스트 심(백엔드 HTTP API 심 `uv run pytest`, 프론트엔드 페이지 통합 심 `Vitest`) 테스트가 작성되어 모두 통과한다.

## Comments
- 구현 및 커밋 완료: `65b23207e96fac1f590c2d564058ce8150c66088` (`uv run pytest` 821 passed, 1 skipped / `vitest` 80 files, 620 passed / Standards & Spec 2차 재리뷰 PASS)
