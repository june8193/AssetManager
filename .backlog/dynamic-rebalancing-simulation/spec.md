# Feature Spec: S&P 500 MDD & VIX 동적 리밸런싱 시뮬레이션 및 프리셋 관리

Status: ready-for-agent

## Problem Statement

현재 AssetManager의 '자산배분 시뮬레이션' 메뉴는 정적 비율(예: 주식 100%, 60/40 등)과 정기적인 리밸런싱 주기(매월, 매년, 없음)를 기준으로 과거 성과를 백테스트하는 기능(거치식 및 적립식)을 제공하고 있습니다.

그러나 실제 자산배분 투자자 및 시장 참여자들은 다음과 같은 현실적인 투자 고민에 직면합니다:

1. **시장 위기 시 현금 활용 기회 상실**:
   - 단순히 고정된 60/40 비율로 정기 리밸런싱만 수행할 경우, 2020년 코로나 폭락장이나 2022년 금리 인상기처럼 S&P 500이 20~30% 이상 폭락하고 변동성(VIX)이 치솟는 극단적 공포 국면에서 확보해 둔 현금을 전략적으로 투입(Buy the Dip)할 수 없습니다.
2. **객관적 저가 매수 기준의 부재 및 검증 불가**:
   - 투자자가 감정이나 뉴스에 휘둘리지 않고 "낙폭(Drawdown) -10% & VIX 25 이상이면 주식 75%, 낙폭 -20% & VIX 30 이상이면 주식 90%"와 같이 명확한 계량 규칙을 세우더라도, 이 규칙이 실제로 S&P 500 단순 보유나 일반 정기 리밸런싱 대비 장기 수익률(CAGR)을 높이고 최대 낙폭(MDD)을 방어해 주는지를 역사적 데이터(1989년~현재)로 검증할 수단이 없습니다.
3. **사용자 맞춤형 전략 수치 저장/관리의 부재**:
   - 투자자가 자신의 성향에 맞게 조정한 다단계 임계값(낙폭, VIX, 목표 주식 비중)과 기간/적립금 조건을 저장해 두고, 언제든지 다시 불러와 비교하거나 수정/삭제할 수 있는 개인화된 전략 관리 체계가 없습니다.

## Solution

S&P 500의 누적 최고가 대비 낙폭(Drawdown)과 CBOE 변동성 지수(VIX)를 결합한 **다단계 역발상 동적 자산배분 리밸런싱 시뮬레이션** 및 **전략 프리셋 영구 관리 체계**를 구현합니다.

1. **신규 전용 탭 `[동적 리밸런싱 (MDD/VIX)]` 신설**:
   - 자산배분 시뮬레이션 페이지 상단에 신규 탭을 추가하여, 복잡한 다단계 전략 파라미터와 결과를 독립적이고 직관적인 UI로 제공합니다.
   - 기존과 동일하게 **거치식(Lump-sum)** 및 **적립식(Recurring Deposit)** 모드를 모두 지원합니다.
2. **다단계 AND 조건부 저가 매수 알고리즘**:
   - 매 영업일(Daily)마다 S&P 500의 최고점 대비 낙폭과 당일 VIX 종가를 추적합니다.
   - `[낙폭 <= 기준치] AND [VIX >= 기준치]`를 동시에 충족하는 날, 즉시 현금을 주식으로 전환하여 목표 주식 비중으로 확대합니다 (상위 공포 단계 우선 적용).
3. **정기 점검일 정상 비중 복귀 메커니즘**:
   - 매월 말(또는 매년 말) 정기 점검 시점에 VIX와 낙폭 지표가 공포 구간을 벗어나 안정화되어 있으면, 평상시 기본 비중(예: 주식 60% / 현금 40%)으로 복귀 리밸런싱을 수행하여 잦은 매매(Whipsaw)를 방지하고 차익을 실현합니다.
4. **3개 벤치마크 자동 비교 및 리밸런싱 이벤트 로그 제공**:
   - ① 동적 리밸런싱 전략 vs ② 동일 기본 비중 일반 정기 리밸런싱 vs ③ S&P 500 100% 단순 보유를 한 차트 및 성과 카드에서 직접 비교합니다.
   - 과거 시뮬레이션 기간 중 실제로 비중 확대 및 복귀 리밸런싱이 발동된 날짜, 당시 S&P 500 가격, 낙폭, VIX, 변경 전후 비중을 확인할 수 있는 **이벤트 로그 테이블**을 제공합니다.
5. **백엔드 DB 기반 전략 프리셋 영구 관리 (CRUD)**:
   - 사용자가 조정한 전략(이름, 기본 비중, 기간, 운용 모드, 추가 적립금, 다단계 임계값 목록)을 백엔드 DB(`simulation_presets` 테이블)에 영구 저장하고, 언제든 조회, 수정, 삭제할 수 있도록 지원합니다.

## User Stories

1. As an asset allocation investor, I want to navigate to the new '동적 리밸런싱 (MDD/VIX)' tab in the simulation menu, so that I can analyze rule-based opportunistic rebalancing strategies without cluttering the existing fixed-ratio simulation screens.
2. As an investor, I want to choose between 거치식 (Lump-sum) and 적립식 (Recurring deposit with annual additions), so that I can simulate both initial-wealth deployment and periodic salary investments.
3. As an investor, I want to specify a baseline stock/cash allocation (e.g. 60% stock / 40% cash), so that the system knows my default target portfolio during normal market conditions.
4. As an investor, I want to define multi-tier panic conditions combining S&P 500 drawdown and VIX (e.g., Tier 1: Drawdown <= -10% AND VIX >= 25 -> 75% stock; Tier 2: Drawdown <= -20% AND VIX >= 30 -> 90% stock), so that cash is deployed progressively into stocks as market fear intensifies.
5. As an investor, I want the simulation to trigger stock weight increases immediately on the day the combined [Drawdown AND VIX] condition is met, so that intra-month market dip opportunities are not missed.
6. As an investor, I want the strategy to restore back to my baseline allocation only on scheduled review days (e.g. month-end) if panic conditions have subsided, so that excessive turnover and whipsaw trades are avoided.
7. As an investor, I want to see a performance chart comparing my Dynamic Rebalancing strategy against both static regular rebalancing (same 60/40) and 100% S&P 500 Buy & Hold, so that I can objectively evaluate whether opportunistic rebalancing improved risk-adjusted returns (CAGR and MDD).
8. As an investor, I want to inspect a detailed Rebalancing Event Log table showing historical trigger dates, S&P 500 price, drawdown percentage, VIX level, and pre/post equity ratios, so that I can audit and trust how the algorithm performed during crises like 2008, 2020, and 2022.
9. As an investor, I want to save my tuned multi-tier parameters as a named preset (e.g., '공포지수 3단계 분할매수 전략') to the server database, so that my customized settings persist across sessions, devices, and browser cache clears.
10. As an investor, I want to edit or delete my saved presets, so that I can continuously refine and maintain my strategy library over time.
11. As an investor, I want default recommended preset parameters preloaded on my first visit, so that I can immediately run and understand the simulation with sensible numbers.
12. As a system administrator, I want preset data stored in the application database, so that it is included in standard database backups (`assets_YYYYMMDD_HHMMSS.db`).

## Implementation Decisions

### 1. Architectural Seams & Testing Approach
- **Primary Backend Seam**: FastAPI REST Endpoints via `TestClient`. All calculation logic, tier evaluations, daily panic detection, scheduled recovery, and preset persistence are tested at the HTTP API layer (`/api/simulation/run-dynamic`, `/api/simulation/presets`).
- **Primary Frontend Seam**: React component integration tests via Vitest & React Testing Library. User interactions (tab switching, tier manipulation, saving/loading presets, table rendering) are verified against mocked API responses.

### 2. Data Sources & Daily Market Tracking
- Leverages existing daily close records in the `HistoricalPrice` table for `^GSPC` (S&P 500) and `^VIX` spanning 1989 to current date.
- Drawdown is computed against the cumulative all-time high (ATH peak) of S&P 500 close prices up to day $t$:
  $$\text{Peak}_t = \max_{0 \le i \le t}(\text{Close}_i), \quad \text{Drawdown}_t = \frac{\text{Close}_t - \text{Peak}_t}{\text{Peak}_t} \times 100$$

### 3. Core Simulation Algorithm Mechanics
- **State Initialization**: Starting portfolio value of 100.0 (or annual deposit schedule for recurring mode), allocated according to baseline stock/cash weights.
- **Daily Loop**:
  1. Update equity and cash values based on day $t$ S&P 500 price movement.
  2. Evaluate configured tiers in descending order of fear intensity (highest tier first). If both $\text{Drawdown}_t \le \text{Threshold}_{\text{DD}}$ **AND** $\text{VIX}_t \ge \text{Threshold}_{\text{VIX}}$ are satisfied, and the target equity ratio exceeds the current target tier, trigger immediate dynamic rebalancing on day $t$ and log the event.
  3. If day $t$ is a scheduled rebalancing day (month-end or year-end):
     - Check if current market conditions still satisfy any panic tier.
     - If no panic tier is active (fear subsided), restore equity ratio back to the baseline weight (e.g. 60%) and log the recovery event.
     - If a panic tier is still active or market is normal, perform standard rebalancing to maintain the currently active target weight.
- **Output Aggregation**:
  - Downsampled chart series for browser performance (matching existing 5Y/10Y/ALL sampling rules).
  - Summaries containing CAGR, MDD, final return, and volatility.
  - Yearly and monthly performance and drawdown breakdown tables.
  - Granular `rebalancing_events` array containing `{date, event_type, sp500_price, drawdown, vix, old_stock_ratio, new_stock_ratio}`.

### 4. Database Schema for Preset Management
- A new table `simulation_presets` is introduced to store user-defined strategies:
  - `id`: Integer Primary Key Autoincrement
  - `name`: Varchar(100), Unique/Not Null
  - `description`: Text, Optional
  - `base_stock_ratio`: Float, Not Null (default 60.0)
  - `rebalancing_period`: Varchar(20), Not Null (default 'monthly')
  - `investment_mode`: Varchar(20), Not Null (default 'recurring')
  - `annual_deposit`: Float, Not Null (default 20000000.0)
  - `period`: Varchar(10), Not Null (default '5Y')
  - `tiers_json`: Text, Not Null (JSON string representing ordered list of `{tier, dd_threshold, vix_threshold, target_stock_ratio}`)
  - `created_at`: DateTime
  - `updated_at`: DateTime

### 5. API Contracts
- `POST /api/simulation/run-dynamic`:
  - Request body:
    ```json
    {
      "base_stock_ratio": 60.0,
      "period": "5Y",
      "rebalancing": "monthly",
      "mode": "recurring",
      "annual_deposit": 20000000.0,
      "tiers": [
        {"tier": 1, "dd_threshold": -10.0, "vix_threshold": 25.0, "target_stock_ratio": 75.0},
        {"tier": 2, "dd_threshold": -20.0, "vix_threshold": 30.0, "target_stock_ratio": 90.0},
        {"tier": 3, "dd_threshold": -30.0, "vix_threshold": 40.0, "target_stock_ratio": 100.0}
      ]
    }
    ```
  - Response body contains `chart` (3 datasets), `summaries` (3 benchmarks), `yearly_stats`, `monthly_stats`, and `rebalancing_events`.
- `GET /api/simulation/presets`: List all presets (including default preset indicator).
- `POST /api/simulation/presets`: Create new preset.
- `PUT /api/simulation/presets/{id}`: Update existing preset.
- `DELETE /api/simulation/presets/{id}`: Delete preset.

### 6. Frontend User Interface
- Added 3rd tab `동적 리밸런싱 (MDD/VIX)` in `AssetAllocationSimulationPage.jsx`.
- Preset selector dropdown with [저장], [수정], [삭제] modal dialogs.
- Interactive multi-tier editor allowing addition, removal, and modification of drawdown thresholds, VIX levels, and target ratios.
- Comparative Recharts visualization with color distinction for dynamic strategy vs baseline vs buy & hold.
- Tabbed results container: [이벤트 로그] / [연도별 현황] / [월별 현황].

## Testing Decisions

1. **What Makes a Good Test**:
   - Tests assert only on observable HTTP outputs, response structures, calculation outcomes, and UI interaction states.
   - Internal helper methods and loop variables are not mocked or inspected.
   - All tests use isolated in-memory or temporary SQLite test databases to prevent altering production data.
2. **Modules to be Tested**:
   - **Backend API & Service**:
     - Dynamic rebalancing simulation calculation accuracy (daily panic trigger execution, month-end baseline recovery, CAGR/MDD metrics).
     - Preset CRUD API operations, validation, and error cases (e.g. invalid ratios, duplicate names).
     - Prior art: `tests/test_simulation.py` and `tests/test_simulation_recurring.py`.
   - **Frontend Components**:
     - Rendering of the dynamic rebalancing tab, preset selection, tier row additions/deletions, and event log display.
     - Prior art: `src/frontend/src/pages/AssetAllocationSimulationPage.test.jsx`.

## Out of Scope

1. Intraday real-time trade execution or broker order routing (this is purely a historical backtest simulation).
2. Additional assets other than S&P 500 and Cash (e.g. individual stocks, crypto, commodities, or long-term treasuries).
3. Fractional-day tick data simulation (daily closing prices are used for both S&P 500 and VIX).
4. Machine learning / algorithmic optimization of threshold parameters (users define their own rule tiers).

## Further Notes

- S&P 500 (`^GSPC`) and VIX (`^VIX`) daily data are already fully synced in the database from 1989-01-26 to current date (over 13,700 records each), enabling full 30Y and ALL period backtests without external API rate limits.
- When creating the new `simulation_presets` table, follow the project rule of executing migrations safely and updating the SQLite schema cleanly.
