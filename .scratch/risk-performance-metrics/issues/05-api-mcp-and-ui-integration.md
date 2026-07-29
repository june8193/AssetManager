Title: 위험조정지표(Sharpe, Sortino, MDD) 백엔드 API, MCP 도구 및 프론트엔드 UI 연동 설계
Type: grilling
Status: resolved
Blocked by: 02, 04

## Question

계산된 샤프 지수, 소티노 지수, MDD 정보를 백엔드 API 서비스, MCP(AssetManager MCP 서버) 및 프론트엔드 UI(대시보드 / 포트폴리오 분석 화면)에 어떻게 배치하고 노출할 것인가?

## Answer

### 1. 백엔드 구조 및 REST API
- `src/backend/services/performance_service.py` 서비스 생성:
  - `system_settings` DB 테이블을 활용해 무위험 수익률($R_f$) 관리.
  - 종목/지수의 `historical_prices` 데이터를 받아 샤프/소티노 지수 및 MDD 계산.
  - `account_snapshots` 데이터를 기반으로 TWR 시계열 및 포트폴리오 Sharpe/Sortino/MDD 연산.
- API 라우터 (`src/backend/routers/performance.py`):
  - `GET /api/v1/performance/settings/risk-free-rate` & `PUT /api/v1/performance/settings/risk-free-rate`
  - `GET /api/v1/performance/metrics/asset` (지수/종목 성과 지표)
  - `GET /api/v1/performance/metrics/portfolio` (총 자산 TWR, 샤프/소티노, MDD 시계열)

### 2. MCP 도구 연동 (`src/mcp/`)
- `get_portfolio_status` 및 `get_asset_ratios` 도구의 반환 JSON 스키마에 `sharpe_ratio`, `sortino_ratio`, `mdd` 필드 통합.
- 텔레그램 보트 및 AI 에이전트가 포트폴리오 성과 및 지수 성출 시 위험조정 지수를 즉각 응답할 수 있도록 조치.

### 3. 프론트엔드 UI 설계
- **무위험 수익률 설정**: 설정 화면 또는 성과 분석 대시보드 상단에 사용자 설정 Input 제공 (변경 시 DB 반영).
- **총 자산 성과 지표 카드**: 샤프 지수, 소티노 지수, 최근 MDD, 최고 MDD 핵심 KPI 카드 배치.
- **MDD 추이 차트**: 기존 지수 분석 메뉴의 차트 UI 스타일과 동일하게 시간 경과에 따른 Drawdown(%) 시계열 그래프 표기.
