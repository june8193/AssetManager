# 04 — 자산 월간 종합 보고서(asset-monthly-report) MCP 데이터 파이프라인 전환 및 VIX 리스크 연계

**What to build:** 
자산 월간 종합 보고서의 시장 지수, 포트폴리오 성과 및 보유 내역 수집 과정을 MCP 도구군으로 전환하고, 월간 벤치마크 조회에 `^VIX`를 포함하여 월간 변동성 스파이크 이력 분석과 자산 배분 총평 섹션의 현금 비중/포지션 관리 코멘트를 연계합니다.

**Blocked by:** 01 — MCP 도구 계층에서 get_market_indices 퇴역 및 get_market_history 다중 티커 검증

**Status:** ready-for-agent

- [ ] `.agents/skills/asset-monthly-report/SKILL.md`에서 지수 및 VIX 수집 시 `get_market_history` MCP 도구(`tickers="^GSPC,^IXIC,^KS11,^VIX"`)를 호출하도록 명시되었는가?
- [ ] 포트폴리오 월간 성과(`get_daily_stats`), 기말 상태(`get_portfolio_status`), 자산 비중(`get_asset_ratios`), 매매 내역(`get_transactions`) 등 핵심 데이터 조회가 MCP 도구 기반으로 명시되었는가?
- [ ] 월간 VIX 분석에서 월초 대비 월말 등락률뿐만 아니라 당월 중 발생한 최고/최저치 및 변동성 스파이크(주의/경고 진입 이력)를 파악하도록 워크플로우가 구성되었는가?
- [ ] "5. 자산 배분 현황 및 총평" 필수 섹션에 당월 VIX 리스크 환경 평가와 현금 비중 운용 관전 포인트가 반영되도록 템플릿이 갱신되었는가?
