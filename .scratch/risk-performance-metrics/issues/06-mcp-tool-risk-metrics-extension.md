# 06 — MCP 서버 도구 연동 (`get_portfolio_status`, `get_asset_ratios`)

**What to build:**
`src/mcp/`의 `get_portfolio_status` 및 `get_asset_ratios` 도구 응답 JSON 스키마에 `sharpe_ratio`, `sortino_ratio`, `mdd` 필드를 추가 확장하여, AI 에이전트 및 텔레그램 봇이 포트폴리오 및 지수 조회 시 위험조정 지수를 수집·응답할 수 있도록 조치합니다.

**Blocked by:** 02, 03 — 지수/종목 및 포트폴리오 연산 서비스 완료 후 연동

**Status:** ready-for-agent

- [ ] `src/mcp/` 내 도구 스키마 및 구현 함수 업데이트
- [ ] `get_portfolio_status` 호출 시 총 자산 TWR 기반 `sharpe_ratio`, `sortino_ratio`, `mdd` 반환 검증
- [ ] `get_asset_ratios` 호출 시 개별 지수/종목 위험 지표 반환 검증
- [ ] MCP 단위 테스트 실행 및 통과
