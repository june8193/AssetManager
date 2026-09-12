# 03 — 미국 주간 보고서(us-weekly-index-report) VIX 주간 변동성(High-Low) 모니터링 반영

**What to build:** 
미국 주간 보고서 생성 스킬의 주간 데이터 수집에 `^VIX`를 통합하고, 주간 마감 종가 및 등락률뿐만 아니라 주간 최고-최저 범위(High-Low Range)와 공포 심리 추이를 진단하는 전용 VIX 섹션을 주간 보고서 템플릿에 추가합니다.

**Blocked by:** 01 — MCP 도구 계층에서 get_market_indices 퇴역 및 get_market_history 다중 티커 검증

**Status:** ready-for-agent

- [ ] `.agents/skills/us-weekly-index-report/SKILL.md`의 주간 지수 조회 단계에서 `get_market_history` MCP 도구(또는 해당 쿼리)의 티커 목록에 `^VIX`(`tickers="^GSPC,^IXIC,^DJI,^VIX"`)가 포함되었는가?
- [ ] 주간 VIX 데이터 분석 시 주간 시작일 대비 종료일 등락률 외에 기간 내 최고치/최저치 범위(High-Low Range)를 산출하는 워크플로우가 명시되었는가?
- [ ] VIX 4단계 리스크 기준에 따른 주간 공포/안정 추세(예: 안정권 유지, 주중 일시 경고 진입 등) 진단이 포함된 보고서 템플릿 양식이 정의되었는가?
- [ ] 텔레그램 모바일 서식 가독성을 위해 표(Table) 서식이 배제되고 불릿 리스트로 구성되었는가?
