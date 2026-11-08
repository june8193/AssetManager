# 01 — 실제 손익(자본/배당 분리) 및 중도매매·전량매도 반영 백엔드 Attribution 엔진 구현

**Spec:** [spec.md](../spec.md)

**What to build:** `BenchmarkService.get_attribution_summary` 및 `GET /api/benchmark/attribution` 엔드포인트에서 단순 기말 비중 곱셈 대신 원장(`LedgerEngine`) 및 시세(`HistoricalPrice`) 기반의 실제 발생 손익(Actual P&L) 수익기여도 산출 로직을 구현하고, 자본 손익(`capital_pnl`)과 배당/세금 손익(`dividend_pnl`)을 분리 리턴하며 총 기여도(`contributions`)에 합산합니다. 기간 내 전량 매도 종목(`CLOSED`) 포함, 미국 종목 USD 기본 표기 및 기준일 단일 환율 기반 KRW 보조 지표/기여도 산출을 완결하고 통합 테스트(`tests/test_benchmark_attribution.py`)로 검증합니다.

**Blocked by:** None — can start immediately

**Status:** completed

- [x] `BenchmarkService.get_attribution_summary`가 기준일(`as_of_date`) 보유 종목뿐만 아니라 4대 분석 기간(`1M`, `3M`, `1Y`, `YTD`) 중 기초에 보유했거나 기간 내 매매/배당(`BUY`, `SELL`, `INITIAL_BALANCE`, `INTEREST`, `TAX`) 이력이 있는 비현금 상장 종목(`주식`, `채권`)을 모두 포함하도록 구현 (`status`: `"HOLDING"` 또는 `"CLOSED"`, 전량 매도 종목은 기말 `weight: 0.0`, `quantity: 0.0`).
- [x] 종목별 기본 통화(`KRW` 또는 `USD`) 기준으로 기간별 자본 손익(`capital_pnl` = 기말평가액 - 기초평가액 - (BUY + INITIAL_BALANCE - SELL))과 세후 배당 손익(`dividend_pnl` = INTEREST - TAX, 타 통화 TAX는 기준일 환율로 환산 차감), 총 손익(`total_pnl` = capital_pnl + dividend_pnl)을 각각 산출하고, 기준일 단일 환율을 적용한 원화 보조 지표(`capital_pnl_krw`, `dividend_pnl_krw`, `total_pnl_krw`)를 함께 반환.
- [x] 종목별 기간 수익률(%) 3종(`capital_returns`: 내 포지션 자본 수익률, `returns`: 내 포지션 총수익률, `price_returns`: 시장 단순 주가 등락률)과 포트폴리오 기간 기준자본 대비 수익기여도(%p) 3종(`capital_contributions`, `dividend_contributions`, `contributions`)을 산출하여 반환.
- [x] `top_contributors_ytd`, `top_detractors_ytd`, `top_contributors_1m`, `top_detractors_1m` 랭킹 아이템에도 카테고리(`major_category`, `sub_category`), 통화(`currency`), 상태(`status`), 분리된 손익(`capital_pnl`, `dividend_pnl`, `total_pnl`, `total_pnl_krw`), 수익률(`capital_return`, `return`, `price_return`), 기여도(`capital_contribution`, `dividend_contribution`, `contribution`) 필드를 포함하도록 `_extract_attribution_ranking` 개선.
- [x] `tests/test_benchmark_attribution.py`에 ① 기간 중 신규 매수 시 미보유 기간 주가 등락 배제 검증, ② 분할 매수/일부 매도 반영 검증, ③ 전량 매도(`CLOSED`) 종목 랭킹/목록 포함 검증, ④ 자본 손익과 배당/세금 손익 분리 및 합산 검증, ⑤ 미국 종목(USD) 기본 통화 및 KRW 보조 지표 정합성 검증 테스트 케이스를 작성하고 `uv run pytest` 전체 통과 확인.
