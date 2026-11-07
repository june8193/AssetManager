# Spec: 입출금 제외 내 자산 수익 지수(Portfolio Index) 및 실시간(Live) 자산 추이 시각화

## Problem Statement (문제 정의)

1. **총자산 추이 차트에서 입출금 효과와 순수 투자 수익 구분 불가**:
   현재 메인 대시보드(`DashboardPage.jsx`)의 '자산 추이' 차트(`AssetChart.jsx`)는 시간에 따른 단순 자산 평가액(`total` 및 계좌별 평가액)만 보여줍니다. 이로 인해 대규모 입금이나 출금이 발생했을 때 그래프가 급등락하여, 내 자산이 늘어난 이유가 추가 입금 때문인지 순수 투자 수익 때문인지 한눈에 파악하거나 시장 지수(KOSPI, S&P 500 등)처럼 정규화된 등락률을 확인하기 어렵습니다.
2. **스냅샷 미생성 일자의 최신 실시간(Live) 자산 및 수익 지수 미반영**:
   사용자는 스냅샷을 매일 수동으로 저장하지 않습니다. 현재 대시보드 상단 요약 카드는 실시간 주가·환율과 미반영 입출금(`pending_deposits_krw`)을 반영한 실시간 총자산을 보여주지만, '자산 추이' 차트는 마지막으로 저장된 스냅샷 날짜까지만 표시되어 오늘 현재의 실시간 자산 규모와 실시간 수익 지수 등락을 차트에서 즉시 확인할 수 없습니다.
3. **모바일 대시보드의 시계열 추이 차트 부재**:
   모바일 대시보드(`MobileDashboardPage.jsx`)에는 총 자산 요약, 카테고리별 자산 비중, 기간별 성과 리스트 카드만 존재하고 시계열 추이 차트가 없어 모바일 환경에서 총자산 및 수익 지수의 흐름을 시각적으로 파악할 수 없습니다.

## Solution (해결 방안)

1. **시간가중수익률(TWR) 연쇄 방식 기반 '내 자산 지수(Portfolio Index, 1,000.00 pt 시작)' 산출**:
   - 최초 스냅샷 기준일을 `1,000.00 pt`로 설정하고, 저장된 모든 스냅샷 일자마다 입출금 변동을 제거한 일별(스냅샷 구간별) 수익률을 연쇄 곱셈(Chain-linking)하여 지수를 산출합니다.
   - 대시보드 하단 '일자별 현황' 테이블(`get_daily_stats`)의 수익률(`roi`)과 소수점까지 100% 일관성을 유지하도록 구간 수익률 분모 기준을 $\text{base}_t = V_{t-1} + D_t$로 통일합니다:
     $$r_t = \frac{(V_t - V_{t-1}) - D_t}{V_{t-1} + D_t}, \quad \text{Index}_t = \text{Index}_{t-1} \times (1 + r_t)$$
   - 각 시점 데이터마다 지수(`index`), 직전 스냅샷 대비 등락률(`index_change_pct`), 기준일(1,000pt) 대비 누적 등락률(`index_cum_return_pct`)을 함께 제공합니다.
2. **차트 맨 끝점에 '오늘의 실시간(Live) 자산 및 실시간 수익 지수' 자동 반영**:
   - 백엔드 대시보드 요약(`get_dashboard_summary`) 응답에 마지막 스냅샷 이후 발생한 미반영 순입출금액(`pending_deposits_krw`)을 포함하여 반환합니다.
   - 프론트엔드 시계열 데이터 구성 시, 마지막 스냅샷 이후 오늘 날짜의 실시간 총 평가자산(`total_valuation_krw`), 계좌별 실시간 평가액(`acc.total_valuation_krw`), 그리고 미반영 입출금을 반영한 **실시간 수익 지수(Live Index)**를 차트 맨 끝점에 자동으로 추가(또는 오늘 날짜 스냅샷이 이미 존재하는 경우 실시간 값으로 최신화)합니다.
3. **데스크톱 `AssetChart` 및 모바일 `MobileAssetTrendCard` 탭 전환 UI 제공**:
   - **데스크톱 (`AssetChart.jsx`)**: 우측 상단에 `[총자산 규모 (원)]`(기본 활성 탭) / `[수익 지수 (Index)]` 탭 전환 컨트롤을 배치합니다.
   - **모바일 (`MobileAssetTrendCard.jsx`)**: `MobileDashboardPage`의 **2번째 위치**(`MobileTotalAssetCard` 바로 아래, `MobileCategoryBreakdownCard` 위)에 다크 테마(`slate-900`) 기반 차트 카드를 신설하고 `[총자산 규모 (원) | 수익 지수 (Index)]` 세그먼트 탭을 제공합니다.
   - **프라이버시 마스킹 예외**: 금액 가리기(`***`) 활성화 시에도 금액 규모가 노출되지 않는 `수익 지수(pt)`와 `등락률(%)`은 마스킹하지 않고 상시 노출합니다.

## User Stories (사용자 스토리)

1. **As an** 자산 관리 사용자, **I want** 대시보드의 '자산 추이' 차트에서 `[총자산 규모 (원)]` 탭(기본값)과 `[수익 지수 (Index)]` 탭을 전환하여 볼 수 있기를 원한다, **so that** 외형적인 자산 규모 성장과 입출금을 제외한 순수 투자 실력(지수 흐름)을 한곳에서 비교·확인할 수 있다.
2. **As an** 자산 관리 사용자, **I want** '수익 지수 (Index)'가 최초 스냅샷일 `1,000.00 pt`에서 시작하여 일자별 스냅샷의 입출금을 제외한 수익률로 누적 산출되고 하단 '일자별 현황' 테이블의 일별 수익률과 정확히 일치하기를 원한다, **so that** 대규모 입출금이 발생해도 지수 왜곡 없이 S&P 500이나 KOSPI처럼 내 포트폴리오의 등락률을 직관적으로 파악할 수 있다.
3. **As an** 스냅샷을 매일 저장하지 않는 사용자, **I want** '자산 추이' 차트의 맨 끝점에 오늘의 실시간 평가자산(총자산 및 계좌별 자산)과 실시간 수익 지수(Live Index)가 자동으로 이어져 표시되기를 원한다, **so that** 수동 스냅샷을 찍지 않은 날에도 현재 시세 기준의 자산 추이와 지수 등락을 즉시 확인할 수 있다.
4. **As an** 자산 관리 사용자, **I want** '수익 지수 (Index)' 탭에서 차트 헤더의 최신 지수 배지(`1,284.50 pt (+28.45%)`), 차트 내 `1,000 pt` 기준 점선, 그리고 마우스 오버 툴팁의 3종 지표(`내 자산 지수 pt`, `직전 대비 등락률 %`, `기준일 1,000pt 대비 누적 등락률 %`)를 확인할 수 있기를 원한다, **so that** 특정 시점의 지수 수준과 단기·누적 성과를 한눈에 읽을 수 있다.
5. **As a** 프라이버시 마스킹(`***`) 기능을 사용하는 사용자, **I want** 금액 마스킹을 켰을 때 총자산 금액(원)은 `***`로 가려지더라도 수익 지수(`pt`)와 등락률(`%`)은 가려지지 않고 그대로 표시되기를 원한다, **so that** 주변에 자산 금액을 노출하지 않으면서도 수익 지수 차트와 등락률을 자유롭게 볼 수 있다.
6. **As a** 모바일 대시보드 사용자, **I want** 모바일 대시보드 상단 '총 자산 요약 카드' 바로 아래(2번째 순서)에서도 동일한 `[총자산 규모 (원) | 수익 지수 (Index)]` 탭 전환 차트 카드를 볼 수 있기를 원한다, **so that** 모바일에서도 언제 어디서나 내 자산 추이와 실시간 수익 지수를 한눈에 확인할 수 있다.

## Implementation Decisions (구현 결정사항)

### 1. 백엔드 스냅샷 지수 산출 및 요약 데이터 계약 (`src/backend/services/dashboard_service.py`)

- **`DashboardService.get_snapshots` 응답 확장**:
  - 날짜별로 그룹화된 스냅샷 집계 시 각 날짜의 총 평가액(`total`), 당기 입출금 합계(`period_deposit`), 계좌별 평가액(`acc_{id}`)을 합산합니다.
  - 오름차순 정렬된 스냅샷 날짜 시계열($i = 0, 1, \dots, n-1$)을 순회하며 TWR 수익 지수를 계산합니다:
    - $i = 0$ (최초 스냅샷 기준일):
      - `index = 1000.0`
      - `index_change_pct = 0.0`
      - `index_cum_return_pct = 0.0`
    - $i \ge 1$:
      - `prev_total` $= V_{i-1}$, `curr_total` $= V_i$, `curr_deposit` $= D_i$
      - `increase = curr_total - prev_total`
      - `profit = increase - curr_deposit`
      - `base = prev_total + curr_deposit`
      - `r_t = (profit / base) if base != 0 else 0.0`
      - `raw_index = prev_raw_index * (1.0 + r_t)`
      - `index = round(raw_index, 2)`
      - `index_change_pct = round(r_t * 100.0, 2)`
      - `index_cum_return_pct = round(((raw_index - 1000.0) / 1000.0) * 100.0, 2)`
  - 반환 스키마 구조:
    ```python
    {
        "history": [
            {
                "date": "2024-01-01",
                "total": 3000.0,
                "period_deposit": 3000.0,
                "index": 1000.0,
                "index_change_pct": 0.0,
                "index_cum_return_pct": 0.0,
                "acc_1": 1000.0,
                "acc_2": 2000.0,
            },
            ...
        ],
        "accounts": [{"id": 1, "name": "계좌1"}, ...]
    }
    ```
- **`DashboardService.get_dashboard_summary` 응답 확장**:
  - 이미 내부에서 계산 중인 `pending_deposits_krw = self.get_pending_deposits_krw(usd_rate=usd_rate)` 값을 반환 딕셔너리의 `"pending_deposits_krw": pending_deposits_krw` 필드로 추가 노출합니다.

### 2. 실시간(Live) 차트 끝점 병합 순수 유틸리티 (`src/frontend/src/utils/chartSeriesBuilder.js` 또는 `useDashboard.js`)

- 스냅샷 시계열(`snapshots.history`)과 실시간 대시보드 요약 데이터(`total_valuation_krw`, `accounts`, `pending_deposits_krw`)를 결합하여 차트용 시계열을 생성하는 순수 함수 `buildLiveAssetSnapshots(snapshots, summary, todayStr)`를 정의합니다:
  - `snapshots?.history`가 비어 있으면 빈 배열을 유지합니다.
  - 마지막 스냅샷 항목을 `lastSnap`이라 할 때:
    - **Case 1 (`lastSnap.date < todayStr`)**: 마지막 스냅샷 이후 오늘 날짜의 실시간 포인트(`is_live: true`)를 배열 맨 끝에 추가합니다.
      - `total`: `summary.total_valuation_krw`
      - 각 활성 계좌 `acc_{acc.id}`: `acc.total_valuation_krw`
      - `period_deposit`: `summary.pending_deposits_krw || 0`
      - 실시간 구간 수익률 $r_{\text{live}}$:
        $$r_{\text{live}} = \frac{(V_{\text{live}} - V_{\text{last}}) - D_{\text{pending}}}{V_{\text{last}} + D_{\text{pending}}}$$
      - `index = round(lastSnap.index * (1 + r_live), 2)`
      - `index_change_pct = round(r_live * 100, 2)`
      - `index_cum_return_pct = round(((live_raw_index - 1000) / 1000) * 100, 2)`
    - **Case 2 (`lastSnap.date === todayStr`)**: 오늘 이미 스냅샷을 생성한 경우, 날짜 중복 포인트를 만들지 않고 마지막 오늘 스냅샷 항목의 실시간 평가액 및 지수를 최신 실시간 값(`pending_deposits_krw` 반영 포함)으로 갱신(`is_live: true`)합니다.

### 3. 데스크톱 `AssetChart.jsx` UI/UX 계약

- **모드 상태**: `chartMode`: `'asset'` (기본값: `총자산 규모 (원)`) | `'index'` (`수익 지수 (Index)`)
- **우측 상단 컨트롤**:
  - `[총자산 규모 (원)]` / `[수익 지수 (Index)]` 탭 버튼 그룹을 항상 렌더링합니다.
  - `chartMode === 'asset'`일 때만 계좌 선택 드롭다운(`총 자산 합계` 및 개별 계좌 목록)을 표시하고, `chartMode === 'index'`일 때는 계좌 선택 드롭다운을 숨깁니다.
- **헤더 배지 및 서브타이틀**:
  - `chartMode === 'index'`일 때 제목 옆에 최신 지수 및 누적 등락률 배지(예: `1,284.50 pt (+28.45%)`)를 표시하고, 부제목을 `기준일(1,000.00 pt) 대비 입출금을 제외한 순수 투자 성과 지수 추이`로 표시합니다.
- **차트 및 툴팁 렌더링**:
  - `chartMode === 'index'`일 때 Y축 포맷터는 마스킹(`maskValue`)을 적용하지 않고 `{val.toLocaleString()} pt` (또는 숫자 포맷)로 표시하며, `ReferenceLine y={1000}` 기준 점선을 렌더링합니다.
  - 툴팁에 다음 3가지 정보를 표시합니다 (마스킹 미적용):
    1. `내 자산 지수`: `{index.toFixed(2)} pt`
    2. `직전 대비 등락률`: `{+index_change_pct.toFixed(2)}%`
    3. `기준일(1,000pt) 대비`: `{+index_cum_return_pct.toFixed(2)}%`

### 4. 모바일 `MobileAssetTrendCard.jsx` 및 `MobileDashboardPage.jsx` UI/UX 계약

- **배치 위치 (`MobileDashboardPage.jsx`)**:
  - 1순위: `<MobileTotalAssetCard data={data} />`
  - **2순위 (신규)**: `<MobileAssetTrendCard data={data.snapshots} />`
  - 3순위: `<MobileCategoryBreakdownCard ... />`
  - 4순위: `<MobilePerformanceSummaryCard data={data} />`
- **카드 구성 (`MobileAssetTrendCard.jsx`)**:
  - 모바일 다크 테마(`bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg`)와 세그먼트 탭(`bg-slate-800/80 p-1 rounded-xl`) 스타일을 준수합니다.
  - `[총자산 규모 (원) | 수익 지수 (Index)]` 탭 전환을 지원하며, 기본 활성 탭은 `'asset'`(`총자산 규모 (원)`)입니다.
  - `'asset'` 탭에서는 계좌 선택 `select`와 마스킹(`maskValue`) 연동 총자산 차트를 보여주고, `'index'` 탭에서는 계좌 선택을 숨기고 최신 지수 요약 헤더(`{index.toFixed(2)} pt ({+cum_return}%)`), `1,000pt` 기준선, 3종 지표 툴팁(마스킹 예외)을 제공합니다.

## Testing Decisions (테스트 결정사항)

- **백엔드 단위/통합 테스트 심 (`tests/test_dashboard_snapshots.py`, `tests/test_dashboard_stats.py`)**:
  - `DashboardService.get_snapshots(all_data=True)` 호출 시:
    - 첫 스냅샷 날짜의 `index == 1000.0`, `index_change_pct == 0.0`, `index_cum_return_pct == 0.0`인지 검증합니다.
    - 중간 날짜에 대규모 입금(`period_deposit > 0`) 또는 출금(`period_deposit < 0`)이 발생했을 때, 입출금이 지수를 왜곡하지 않고 `get_daily_stats()`의 일별 `roi`와 `index_change_pct`가 정확히 일치하며 `index`가 복리 연쇄되는지 검증합니다.
  - `DashboardService.get_dashboard_summary()` 호출 시 `pending_deposits_krw`가 응답에 포함되는지 검증합니다.
- **프론트엔드 단위/컴포넌트 테스트 심**:
  - `src/frontend/src/components/Dashboard/AssetChart.test.jsx`:
    - 기본 렌더링 시 `총자산 규모 (원)` 탭이 활성화되고 계좌 선택 드롭다운이 표시되는지 검증합니다.
    - `수익 지수 (Index)` 탭 클릭 시 계좌 선택 드롭다운이 숨겨지고, 최신 지수(`pt`) 및 누적 등락률(`%`) 배지가 표시되는지 검증합니다.
    - 프라이버시 마스킹(`MaskingContext`) 활성화 시 총자산 금액은 `***`로 마스킹되지만, `수익 지수 (Index)` 탭의 지수(`pt`)와 등락률(`%`)은 마스킹되지 않고 그대로 노출되는지 검증합니다.
  - `src/frontend/src/components/mobile/MobileAssetTrendCard.test.jsx` 및 `src/frontend/src/pages/mobile/MobileDashboardPage.test.jsx`:
    - 모바일 대시보드에서 `총 자산 요약` 카드 바로 아래(2번째 위치)에 `자산 추이` 카드가 렌더링되는지 검증합니다.
    - 모바일 카드 내 `[총자산 규모 (원) | 수익 지수 (Index)]` 탭 전환 및 마스킹 예외 동작을 검증합니다.

## Out of Scope (범위 제외 사항)

- 개별 계좌별 수익 지수(Index) 산출 (사용자 결정에 따라 수익 지수는 '총자산 합계' 기준으로만 제공).
- DB 스키마 변경 및 Alembic 마이그레이션 (기존 `AccountSnapshot` 테이블의 `total_valuation`, `period_deposit` 및 실시간 요약 데이터를 활용하여 런타임 산출).
- 벤치마크 비교 페이지(`BenchmarkPage.jsx`)나 위험조정 성과분석 페이지(`PerformanceAnalysisPage.jsx`)의 기존 차트 변경.
