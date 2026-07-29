# 02 — 지수 및 개별 종목 위험조정 지수(Sharpe, Sortino) API 및 UI 노출

**What to build:**
지수(KOSPI, S&P500 등) 및 개별 투자 종목의 일별 historical prices 시계열을 바탕으로 252 영업일 연율화 샤프 지수(Sharpe Ratio) 및 소티노 지수(Sortino Ratio)를 연산하는 백엔드 서비스 logic, REST API (`GET /api/v1/performance/asset/{ticker}`) 및 UI 종목/지수 상세 성과 카드를 구현합니다.

**Blocked by:** 01 — 무위험 수익률 DB 저장 및 API/UI 설정 기능

**Status:** ready-for-agent

- [ ] 지수/종목 일별 시세 기반 연율화 수익률($\mu_{annual}$), 연율화 변동성($\sigma_{annual}$), 소티노 하방 변동성($\sigma_{down, annual}$) 연산 로직 구현
- [ ] 일별 무위험 수익률 단리 적용 ($R_{f, daily} = R_{f, annual} / 252$)
- [ ] `GET /api/v1/performance/asset/{ticker}?period=1Y` REST API 엔드포인트 구현
- [ ] 프론트엔드 지수/종목 상세 화면 또는 대시보드 지수 탭에 Sharpe/Sortino KPI 카드 표출
- [ ] pytest 단위 테스트 통과
