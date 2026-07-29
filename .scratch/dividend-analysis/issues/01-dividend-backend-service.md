# 01 — 배당 수령 집계 및 연환산 산식 백엔드 서비스 & REST API 구현

**What to build:** DB에 기록된 이자/배당 수령 거래내역(`transactions` 중 `INTEREST`)을 바탕으로 총 누적 수령액, YTD 수령액, 월별/연도별 시계열 데이터 및 종목별 연환산 추정 배당금과 고유 통화 기준 시가 배당률을 산출하는 백엔드 서비스 및 REST API 엔드포인트를 제공합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `DividendService` 단위 테스트 작성 및 통과 (`test_dividend_service.py`)
- [x] `(올해 수령액 / 현재월) * 12` 연환산 산식을 적용하여 추정 연간 배당금 산출
- [x] 수령 실적 0원인 종목은 0원 및 `-` 표기 반환
- [x] 한국 주식(KRW), 미국 주식(USD) 고유 통화 기준 시가 배당률(%) 산출
- [x] `GET /api/dividend/summary` 및 `GET /api/dividend/stocks` REST API 구현
