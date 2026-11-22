# 03 — MCP 내재 변동성 요약 지표 전환, 모바일 구버전 호출 정리 및 샤프·소티노 레거시 완전 삭제

**Spec:** [spec.md](../spec.md)

**What to build:**
자산·비중 조회 MCP 도구(`get_portfolio_status`, `get_asset_ratios`)에서 구버전 샤프·소티노·스냅샷 보간 MDD 병합 로직을 제거하고 신규 내재 변동성 API(`GET /api/v1/risk/volatility?period=1Y`) 기반의 요약 지표(`portfolio_volatility`, `daily_volatility_pct`, `sp500_volatility_ratio`)로 교체합니다. 또한 모바일 벤치마크 비교 컴포넌트에서 더 이상 사용하지 않는 구버전 포트폴리오 성과 API 호출을 제거한 뒤, 구버전 `/api/v1/performance/*` 라우터(무위험 수익률 설정, 샤프·소티노 계산, 불규칙 스냅샷 보간, 비보유 티커 일괄 조회), 해당 서비스 모듈, 관련 구버전 테스트 및 미사용 참조를 코드베이스에서 완전히 삭제합니다.

**Blocked by:** 01-volatility-diagnosis-vertical-slice, 02-volatility-charts-and-what-if-simulator

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] MCP 도구 `get_portfolio_status` 및 `get_asset_ratios`가 구버전 `sharpe_ratio`, `sortino_ratio`, `mdd`, `max_mdd` 병합을 제거하고 신규 `portfolio_volatility`, `daily_volatility_pct`, `sp500_volatility_ratio` 필드를 병합하며, 리스크 API 오류 시에도 기존 자산·비중 응답을 정상 반환한다.
- [ ] 모바일 벤치마크 비교 화면이 구버전 `/api/v1/performance/portfolio` 호출 없이 기존 벤치마크 차트 시계열 기반 MDD 표시를 정상 수행한다.
- [ ] 구버전 `/api/v1/performance/*` 라우터와 해당 서비스, 무위험 수익률 설정 엔드포인트, 샤프·소티노 관련 구버전 테스트가 코드베이스에서 완전히 제거된다(단, 데스크톱 리스크 관리 페이지 라우트 경로 `/performance`는 유지).
- [ ] 사전 합의된 MCP 도구 테스트 심(`pytest`)이 통과하며, 백엔드 전체 테스트(`uv run pytest` 순차 실행) 및 프론트엔드 전체 테스트(`Vitest`)가 100% 통과한다.
