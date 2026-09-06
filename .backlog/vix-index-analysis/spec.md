# 시장분석 지수분석 VIX(변동성 지수) 추가 스펙

Status: ready-for-agent

## Problem Statement

자산 관리 시스템에서 주식 시장의 흐름과 위험도를 분석할 때 지수 종가 추이와 최대 낙폭(MDD)만으로는 시장 참여자들의 심리적 공포 수준이나 내재 변동성 확대를 선제적으로 파악하기 어렵습니다. 
투자자는 S&P 500, 나스닥 등 미국 지수뿐만 아니라 코스피, 코스닥 등 국내 지수를 분석할 때도 글로벌 금융 시장의 대표적 공포 지표인 S&P 500 기반 VIX(변동성 지수)를 함께 확인하여, 현재 지수의 하락이 단순 조정인지 아니면 본격적인 패닉 국면이자 역발상 분할 매수 기회인지 판단할 수 있는 시각적 근거를 필요로 합니다.
또한 VIX 지수의 수치(20, 30, 40 등)가 구체적으로 어떤 시장 상황과 리스크 수준을 의미하는지 바로 파악할 수 있는 직관적인 기준선과 도움말이 제공되지 않아 지표 해석에 어려움이 있습니다.

## Solution

데스크탑 웹의 시장분석 > 지수분석 메뉴에 S&P 500 기반 VIX 변동성 지수 차트를 최대 낙폭(MDD) 차트 바로 아래에 새롭게 추가합니다.
4대 지수(S&P 500, 나스닥, 코스피, 코스닥) 중 어떤 지수를 선택하더라도 동일하게 S&P 500 기준 VIX 차트가 연동되어 표시되며, 상단 지수 종가 및 MDD 차트와 날짜 축 및 마우스 커서 인터랙션이 동기화되어 특정 시점의 지수 하락과 공포 지수의 급등을 한눈에 비교할 수 있습니다.
또한 4단계 기준선(안정 20 미만, 주의 20, 경고 30, 위기 40)을 차트 상에 시각적으로 표시하고, 최근 VIX 수치에 대응하는 상태 배지 및 VIX의 개념과 기준선 의미를 설명하는 안내 툴팁(Info 아이콘)을 제공하여 초보 투자자도 시장 심리를 직관적으로 이해할 수 있도록 돕습니다.

## User Stories

1. As an investor, I want to view the VIX volatility chart under the MDD chart on the index analysis page, so that I can evaluate market fear alongside drawdown depth.
2. As an investor, I want the VIX chart to be available regardless of whether I select S&P 500, NASDAQ, KOSPI, or KOSDAQ, so that I can use the global benchmark volatility index across all market perspectives.
3. As an investor, I want the date range filter (1Y, 3Y, 5Y, 10Y, 20Y, 30Y, ALL) to apply simultaneously to the VIX chart, so that I can analyze historical volatility across consistent time horizons.
4. As an investor, I want the cursor hover interaction to be synchronized across the index price chart, MDD chart, and VIX chart, so that I can pinpoint exact historical market events and their corresponding volatility spikes.
5. As an investor, I want to see clear reference lines at 20, 30, and 40 on the VIX chart, so that I can instantly recognize when the market enters caution, panic, or crisis zones.
6. As an investor, I want reference lines to have clear labels (e.g. 주의 20, 경고 30, 위기 40), so that I don't have to memorize specific threshold numbers.
7. As an investor, I want to see the latest VIX value and a colored status badge in the header of the VIX chart card, so that I can quickly assess today's market fear level at a glance.
8. As an investor, I want the status badge to dynamically change its text and color based on the current VIX level (Normal in green, Caution in amber, Warning in red, Crisis in deep crimson), so that danger levels are visually unmistakable.
9. As an investor, I want an info tooltip button next to the VIX chart title, so that I can open an explanation popover describing what the VIX index measures and what the 4 risk zones represent.
10. As a Korean equity investor analyzing KOSPI or KOSDAQ, I want the VIX data to align smoothly with Korean market trading dates without gaps or broken charts on US holidays, so that the synchronized chart experience remains seamless.
11. As a long-term investor analyzing data over 3 years, I want long-term VIX data to follow the same weekly aggregation as the index price chart, so that chart rendering remains high-performing and free of lag.
12. As an investor, I want network requests to be consolidated so that index price, MDD, and VIX data load together in a single API call, preventing mismatched loading spinners or partial chart updates.

## Implementation Decisions

1. **Market Data Provider VIX Integration**:
   - The market data provider facade will recognize `^VIX` and `VIX` as US market index symbols and route them to the Yahoo Finance adapter.
   - Historical daily closing data and real-time fast info for `^VIX` will be retrieved via yfinance and cached in the local historical price database.

2. **Unified Historical Analysis API Response**:
   - The historical market analysis service will fetch `^VIX` daily closing prices concurrently with the selected index prices.
   - The returned payload from the historical API will include an aligned `vix` array matching the exact dates of the selected index.
   - For dates where the selected market was open but the US market was closed (such as Korean holidays differing from US holidays), forward-fill interpolation will be applied using the most recent valid VIX close.
   - When the requested duration exceeds 3 years (1,095 days) and triggers weekly resampling (W-FRI), the VIX series will be resampled identically to match the weekly date points.

3. **Frontend VIX Chart Component & Synchronization**:
   - The VIX chart will be rendered directly below the MDD chart card within the individual index analysis tab.
   - The chart will utilize the shared synchronization identifier (`syncId="marketAnalysisCharts"`), enabling simultaneous tooltip cursors across index price, MDD, and VIX charts.
   - The chart will feature horizontal reference lines at threshold values 20, 30, and 40 with associated labels and muted dashed borders.
   - A dedicated status badge component will compute the active sentiment state:
     - Level < 20: `안정` (Stable, Green #10B981)
     - Level 20 ~ 30: `주의` (Caution, Amber #F59E0B)
     - Level 30 ~ 40: `경고` (Warning, Red #EF4444)
     - Level >= 40: `위기` (Crisis, Deep Crimson #991B1B)

4. **Educational Tooltip & Popover**:
   - An info trigger button will be placed adjacent to the VIX chart title.
   - Clicking or hovering over the info button will present a floating guide card explaining the CBOE S&P 500 Implied Volatility Index concept and detailing the 4 historical quantile threshold tiers.

5. **Scope Separation for Detailed Tables**:
   - The monthly and yearly performance breakdown tables at the bottom of the page will retain their current focus on index returns and MDD, leaving the VIX metrics dedicated to the visual chart panel.

## Testing Decisions

1. **Test Philosophy**:
   - Tests must evaluate external system behavior rather than private implementation details.
   - Verify that requests for market history with any valid index return a complete dataset containing aligned VIX data.
   - Verify that frontend components render the chart, status indicators, and interactive tooltips as expected by users.

2. **Backend Seam**:
   - Primary seam: The historical market analysis service and `/api/market/analysis/historical` API route.
   - Behaviors under test:
     - Response dictionary includes `vix` alongside `labels`, `prices`, and `mdd`.
     - Length of `vix` array strictly equals the length of `labels` and `prices`.
     - When querying Korean indices (`^KS11`, `^KQ11`), US holiday gaps in VIX are seamlessly forward-filled without null values.
     - When querying time spans > 3 years, VIX values properly resample to weekly intervals.
   - Prior art: Existing tests in the backend router and benchmark service test suites.

3. **Frontend Seam**:
   - Primary seam: The `MarketAnalysisPage` component test suite using Vitest and React Testing Library.
   - Behaviors under test:
     - Renders VIX chart container and title `VIX 변동성 지수 (S&P 500)`.
     - Renders recent VIX numeric value and calculated status badge.
     - Renders reference lines for 20, 30, and 40.
     - Interacting with the Info icon reveals the explanation popover.
   - Prior art: Existing component tests in `MarketAnalysisPage.test.jsx`.

## Out of Scope

- Custom VIX variants for non-US indices (e.g., VKOSPI for KOSPI or VXN for NASDAQ) are out of scope; all indices will reference the S&P 500 VIX benchmark.
- Modifying the annual 4-index comparison tab to compare VIX across years.
- Adding VIX columns to the monthly/yearly statistical tables.
- Push notifications or email alerts triggered when VIX breaches the 30 or 40 thresholds.

## Further Notes

- Empirical market data indicates that VIX remains below 20 for approximately 65-80% of trading days, while levels above 30 represent panic sell-offs historically associated with high-probability contrarian buying opportunities.
- Yfinance ticker `^VIX` has been verified in the local environment and provides reliable real-time and multi-decade historical quotes without requiring paid API keys.
