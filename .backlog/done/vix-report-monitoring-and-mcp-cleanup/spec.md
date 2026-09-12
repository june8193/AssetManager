# 미국 일간·주간 및 월간 보고서 VIX 모니터링 추가 및 MCP 시장지수 도구 통합 스펙

Status: closed

## Problem Statement

현재 정기적으로 자동 생성되는 미국 일간 보고서, 미국 주간 보고서, 그리고 자산 월간 종합 보고서는 S&P 500, 나스닥, 다우존스 등 가격 지수 위주로만 시장 상황을 다루고 있어, 시장 참여자들의 심리적 공포 수준이나 내재 변동성(VIX) 확대를 조기에 파악하기 어렵습니다. 시장이 하락할 때 이것이 통상적인 건전한 조정인지, 아니면 패닉 셀링이 동반된 위기 국면인지를 판단할 수 있는 변동성 지표가 보고서에 부재합니다.

또한 보고서 생성 스킬들이 내부적으로 백엔드 REST API를 감싼 파이썬 CLI 스크립트 실행에 의존하고 있어 에이전트와 도구 간의 인터페이스가 비효율적이며, 기존 MCP 도구 중 `get_market_indices`는 백엔드 응답(배열)과 MCP 프로토콜(오브젝트 필수) 간의 직렬화 불일치로 오류가 발생하는 동시에 기간별 시계열을 다루지 못하는 한계가 있었습니다. 반면 `get_market_history`는 단일 호출로 복수 지수와 VIX의 일자별 종가를 온전히 반환할 수 있으므로, 지표 수집 파이프라인의 통합과 간소화가 필요합니다.

## Solution

미국 일간 보고서, 미국 주간 보고서, 자산 월간 종합 보고서에 CBOE 변동성 지수(VIX) 모니터링을 독립 섹션으로 신설합니다. VIX 지표는 시스템의 기존 대시보드 리스크 기준과 100% 일치하는 4단계(안정 <20, 주의 20~25, 경고 25~30, 위기 ≥30) 상태 분류 및 직관적인 상태 이모지를 함께 제공하여 텔레그램 메시지에서도 한눈에 시장 리스크를 진단할 수 있도록 합니다.

데이터 수집 파이프라인은 신뢰성이 검증된 `get_market_history` MCP 도구로 일원화합니다. 일간 보고서에서는 단 한 번의 MCP 호출로 3대 주가지수와 VIX의 최근 2거래일 종가를 확보하여 당일 등락률과 리스크 단계를 산출하고, 주간 및 월간 보고서에서는 주간/월간 변동폭(High-Low Range) 및 변동성 스파이크 이력을 분석하여 포트폴리오 리스크 코멘트와 유기적으로 연계합니다. 중복되고 규격 오류가 있는 `get_market_indices` MCP 도구는 서버에서 안전하게 퇴역(제거)시킵니다.

## User Stories

1. As an investor receiving daily US market reports, I want to see the latest VIX index value and daily change rate alongside a 4-tier risk status (Stable, Caution, Warning, Crisis) in a dedicated section, so that I can immediately judge whether the day's market movement was accompanied by volatility fear.
2. As an investor receiving daily US market reports, I want the VIX section to use clear emoji-based indicators (🟢, 🟡, 🟠, 🔴) rather than complex markdown tables, so that the telegram message renders cleanly without line-wrap formatting issues on mobile screens.
3. As an investor reading weekly US market reports, I want to see the weekly closing VIX, weekly net change, and weekly high-low fluctuation range, so that I can understand how intraday fear levels shifted across the entire trading week.
4. As an investor reading weekly US market reports, I want a concise risk commentary stating whether the market stayed within a stable volatility regime or experienced sudden surges, so that I can adapt my upcoming week's trading mindset accordingly.
5. As a portfolio manager reviewing the asset monthly report, I want to see monthly VIX trends and any volatility spikes recorded during the month, so that I can correlate historical portfolio drawdowns with broader market stress events.
6. As a portfolio manager reviewing the asset monthly report, I want the asset allocation and monthly recap section to explicitly connect current VIX conditions to cash allocation and rebalancing advice, so that risk management recommendations are grounded in quantitative volatility data.
7. As an automated reporting agent executing the daily report workflow, I want to retrieve both the 3 major US indices and VIX using a single `get_market_history` MCP call, so that tool invocation round-trips and latency are minimized.
8. As an automated reporting agent executing the daily report workflow, I want to compute daily price changes using the two most recent consecutive trading days from the historical price series, so that public holidays and weekend gaps are gracefully handled without calculation anomalies.
9. As an automated reporting agent executing the weekly and monthly workflows, I want to query the same `get_market_history` MCP tool with consistent ticker lists, so that data schemas and parsing logic remain unified across all reporting cadences.
10. As a system maintainer, I want the broken and redundant `get_market_indices` MCP tool removed from the MCP server, so that the MCP tool catalog is streamlined and avoids protocol serialization errors.
11. As a desktop and mobile dashboard user, I want the underlying backend REST endpoint `/api/market/indices` preserved intact, so that web UI market ticker sections continue operating without disruption.

## Implementation Decisions

1. **VIX 4-Tier Risk Classification Standardization**:
   - The volatility classification will strictly align with the 4 risk zones defined across the application:
     - Stable (안정): VIX < 20 (Market sentiment calm and stable)
     - Caution (주의): 20 ≤ VIX < 25 (Short-term volatility expansion caution)
     - Warning (경고): 25 ≤ VIX < 30 (Market agitation and warning phase)
     - Crisis (위기): VIX ≥ 30 (Extreme panic and systemic crisis phase)
   - Visual styling in telegram reports will employ color-coordinated circle indicators (🟢, 🟡, 🟠, 🔴) paired with bulleted typography, avoiding markdown table syntax.

2. **Unification on `get_market_history` MCP Tool**:
   - The MCP market query interface will rely exclusively on `get_market_history` for price and index series data.
   - For daily reports, callers will specify a 5-day inquiry window covering `^GSPC, ^IXIC, ^DJI, ^VIX` to extract the two most recent trading dates and calculate end-of-day changes.
   - For weekly and monthly reports, callers will query the exact boundary date range for benchmark tickers and `^VIX`, deriving net return, high-low span, and phase transitions.

3. **Retirement of `get_market_indices` MCP Tool**:
   - The `get_market_indices` function and registration decorator will be deleted from the MCP tools module and MCP server entry point.
   - The associated MCP tool schema definition file will be cleaned up.
   - The backend service layer, provider adapters, and FastAPI REST endpoint (`/api/market/indices`) will remain unchanged to preserve backwards compatibility with frontend web and mobile dashboards.

4. **Skill Specification Updates**:
   - The US daily index report skill workflow will transition from legacy CLI execution to MCP tool invocations (`check_market_holiday`, `get_market_history`) and include the VIX section template.
   - The US weekly index report skill workflow will incorporate `^VIX` into its history retrieval step and specify high-low range analysis in its report template.
   - The asset monthly report skill workflow will incorporate `^VIX` into benchmark data collection and mandate risk regime evaluation in the allocation wrap-up section.

## Testing Decisions

1. **Testing Seams**:
   - **MCP Tool Integration Seam**: Automated unit and integration tests covering the MCP server to verify that `get_market_history` correctly returns multi-ticker payloads including `^VIX` and that no dangling references to `get_market_indices` exist.
   - **Backend Route Seam**: Regression tests verifying that existing REST endpoints (`/api/market/indices` and `/api/market/history`) continue responding correctly to frontend clients.

2. **Test Characteristics**:
   - Tests will evaluate external inputs and outputs (payload structures and responses) without asserting internal adapter implementation details.
   - Existing mock patterns in test suites will be respected.

## Out of Scope

- Modifying the web or mobile frontend index chart UI components (which already feature synchronized VIX charts).
- Adding VIX monitoring to domestic (Korea) daily or weekly reports.
- Creating new backend calculation engines for VIX (as Yahoo Finance historical data already provides accurate historical values).
- Replacing external network tools for web news search or telegram message dispatch.

## Further Notes

- The VIX index ticker symbol in Yahoo Finance is `^VIX`.
- The MCP tool `check_market_holiday` should continue to be utilized for pre-flight market closure checks before running market data retrieval.
