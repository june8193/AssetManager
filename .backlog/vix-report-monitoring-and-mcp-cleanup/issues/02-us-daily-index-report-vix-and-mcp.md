# 02 — 미국 일간 보고서(us-daily-index-report) MCP 전환 및 VIX 4단계 모니터링 반영

**What to build:** 
미국 일간 보고서 생성 스킬의 시장 데이터 수집 워크플로우를 레거시 CLI 방식에서 `get_market_history` MCP 도구 단일 호출로 전환합니다. 3대 지수(S&P 500, 나스닥, 다우)와 VIX(`^VIX`)의 최근 2거래일 종가를 비교하여 당일 등락률을 산출하고, 4단계 리스크 분류(🟢 안정 <20 / 🟡 주의 20~25 / 🟠 경고 25~30 / 🔴 위기 ≥30) 및 시장 심리 진단을 독립된 VIX 모니터링 섹션으로 일간 보고서에 제공합니다.

**Blocked by:** 01 — MCP 도구 계층에서 get_market_indices 퇴역 및 get_market_history 다중 티커 검증

**Status:** closed

- [x] `.agents/skills/us-daily-index-report/SKILL.md`에서 휴장일 확인이 `check_market_holiday` MCP 도구 호출로 명시되었는가?
- [x] `.agents/skills/us-daily-index-report/SKILL.md`에서 지수 및 VIX 데이터 수집이 `get_market_history` MCP 도구(`tickers="^GSPC,^IXIC,^DJI,^VIX"`) 단일 호출로 갱신되었는가?
- [x] 최근 2거래일 종가 비교를 통해 각 지수 및 VIX의 당일 마감 수치, 전일 대비 변동폭 및 등락률(상승 시 `+`)을 계산하는 로직이 명시되었는가?
- [x] VIX 4단계 리스크 등급(🟢/🟡/🟠/🔴)과 상태 설명이 표(Table) 서식 없이 불릿 리스트로 구성된 독립 보고서 템플릿 양식이 정의되었는가?
