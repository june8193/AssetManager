# Feature Spec: 모바일 웹 지수분석 메뉴 추가

Status: ready-for-agent

## Problem Statement

현재 AssetManager의 모바일 웹은 대시보드, 자산 조회, 비중 점검, 설정의 4개 메뉴만 제공하고 있어, 사용자가 스마트폰으로 이동 중에 주요 시장 지수(S&P 500, 나스닥, 코스피, 코스닥)의 시계열 추이나 시장 공포지수(VIX), 최대 낙폭(MDD)을 확인할 수 없습니다.

또한, 내 자산 포트폴리오의 실시간 성과가 주요 시장 지수 대비 얼마나 우수한 성과를 내고 있는지(알파 초과수익), 시장 급락 국면에서 내 포트폴리오의 최대 낙폭(MDD)이 시장 지수 대비 얼마나 안정적으로 방어되고 있는지를 모바일에서 즉각 비교 분석할 수 없는 문제가 있습니다.

## Solution

모바일 웹 하단 네비게이션에 5번째 탭으로 **'지수분석'(`/m/market`)** 메뉴를 추가하고, 데스크탑 웹의 풍부한 시장 분석 기능과 벤치마크 기능을 모바일 터치 환경에 최적화된 **2단 서브 탭([시장 지수] | [포트폴리오 비교])** 구조로 제공합니다.

1. **[시장 지수] 탭**: 4대 대표 지수 칩 선택, 기간 필터, VIX 상태 요약, **데스크탑 스타일의 3단 밀착 동기화 차트(지수 가격 + 지수 MDD + VIX 기준선 포함 차트)**, 그리고 **기간 내 2대 극단값 분석 카드(최대 공포 피크 시점 & 최대 낙폭 바닥 시점)**를 스크롤 없이 한눈에 조망할 수 있도록 제공합니다.
2. **[포트폴리오 비교] 탭**: **내 포트폴리오 & 4대 지수 MDD 및 기간 수익률 요약 카드**, 지수별 정규화 누적 수익률 비교 선 차트(시리즈 토글 지원), **알파 초과수익률 컴팩트 카드 리스트** 및 상세 데이터 표 접기/펼치기를 제공합니다.

## User Stories

1. As a mobile investor, I want to access a dedicated '지수분석' tab from the bottom navigation bar, so that I can quickly inspect market conditions on my phone.
2. As a mobile investor, I want to switch between '[시장 지수]' and '[포트폴리오 비교]' sub-tabs at the top of the screen, so that I can focus on either macroeconomic indices or my own portfolio performance without information overload.
3. As a mobile investor, I want to tap chips for S&P 500, NASDAQ, KOSPI, and KOSDAQ, so that all underlying charts, MDD stats, and price points instantly update for the selected index.
4. As a mobile investor, I want to select different historical time horizons (1년, 3년, 5년, 10년, 전체), so that I can observe both short-term trends and long-term historical market cycles.
5. As a mobile investor, I want to see a compact 3-tier synchronized stack chart (Price, MDD underwater, VIX) with separated Y-axes, so that lines do not tangle while sharing an identical time axis without scrolling.
6. As a mobile investor, I want to see visual reference lines for VIX at '주의 20pt' and '경고 30pt' on the VIX chart, so that I can immediately tell whether current market volatility is entering a caution or warning phase.
7. As a mobile investor, I want to see a summary badge of current VIX status (안정 / 주의 / 경고 / 위기), so that I can understand the macro sentiment at a glance.
8. As a mobile investor, I want to see a '기간 내 최대 공포 (VIX 피크)' insight card showing the peak VIX date, peak VIX level, and corresponding index drawdown, so that I can evaluate how the asset performed during the worst market panic.
9. As a mobile investor, I want to see a '기간 내 최대 낙폭 (MDD 바닥)' insight card showing the bottom date, worst MDD percentage, and corresponding VIX level, so that I can verify the maximum pain point of the selected index.
10. As a mobile investor, I want to see a headline card in the '[포트폴리오 비교]' tab displaying my portfolio's return and portfolio MDD alongside all four major index MDDs, so that I can verify whether my portfolio defends against downturns better than the market.
11. As a mobile investor, I want to view a normalized percentage cumulative return comparison line chart, so that I can benchmark my portfolio trajectory against S&P 500, NASDAQ, KOSPI, and KOSDAQ from the baseline date.
12. As a mobile investor, I want to tap legend chips to toggle individual series on and off on the comparison chart, so that I can declutter the chart and focus only on specific indices.
13. As a mobile investor, I want to view a compact list of cards showing alpha excess returns (+X.XX%p) for each index, so that I can immediately celebrate my outperformance without squinting at large tables.
14. As a mobile investor, I want to tap '상세 표 보기' to expand a horizontally scrollable detailed data table, so that I can inspect exact raw figures (index return, portfolio return, alpha, index MDD) whenever needed.
15. As a mobile investor, I want the masking toggle (eye icon in header) to blur out my portfolio return percentages, so that I can safely view the market screen in public places.

## Implementation Decisions

### 1. Navigation & Routing Structure
- **하단 5대 탭 바 체제**: 기존 4개 탭(`대시보드`, `자산 조회`, `비중 점검`, `설정`)에서 중앙에 `지수분석`(`TrendingUp` 아이콘, `/m/market`)을 추가하여 5대 탭 체제로 확장합니다.
- **모바일 라우트 가드**: 데스크톱 전용 URL 접근 차단 및 모바일 허용 경로 화이트리스트에 `/m/market`을 명시적으로 포함합니다.

### 2. Page Information Architecture (2 Sub-Tabs)
- **상단 고정 서브 탭 스위처**:
  - `[시장 지수]` (기본 활성 탭)
  - `[포트폴리오 비교]`
- 탭 전환 시 화면 전환 지연 없이 클라이언트 상태로 부드럽게 뷰를 교체합니다.

### 3. [시장 지수] 탭 컴포넌트 설계
- **4대 지수 가로 스크롤 칩**: S&P 500(`^GSPC`), NASDAQ(`^IXIC`), KOSPI(`^KS11`), KOSDAQ(`^KQ11`) 카드 칩. 현재가 및 전일 대비 등락률 표시.
- **기간 선택기**: 1년(`1Y`), 3년(`3Y`), 5년(`5Y`), 10년(`10Y`), 전체(`ALL`).
- **데스크탑형 3단 밀착 동기화 차트 컨테이너**:
  - 단일 카드 안에 Recharts `syncId` 기반으로 3개 차트를 수직 밀착 배치.
  - 1단: 지수 종가 (Price pt, Area/Line, 높이 약 96px).
  - 2단: 최대 낙폭 (MDD %, Area Underwater, 0% 기준선 하향, 높이 약 56px).
  - 3단: VIX 공포지수 (pt, Line, 높이 약 50px).
  - **VIX 기준선**: Recharts `<ReferenceLine>`으로 `y={20}`(주황색 파선, '주의 20') 및 `y={30}`(빨간색 파선, '경고 30') 렌더링.
  - 하단 공통 X축: 연/월 단위 타임스탬프를 1개만 밀착 표시.
- **2대 극단값 분석 카드 (스트레스 테스트)**:
  - 데스크탑의 `correlationStats` 계산 로직을 그대로 계승하여:
    - 🟣 `기간 내 최대 공포 (VIX 피크)`: 날짜, 최고 VIX, 당시 MDD, 당시 지수 종가.
    - 🔴 `기간 내 최대 낙폭 (MDD 바닥)`: 날짜, 최저 MDD, 당시 VIX, 당시 지수 종가.

### 4. [포트폴리오 비교] 탭 컴포넌트 설계
- **기간 선택기**: `YTD`, `1M`, `3M`, `1Y` (벤치마크 API 규격).
- **포트폴리오 & 지수 MDD 요약 카드**:
  - 헤드라인: 내 포트폴리오 기간 수익률(%) 및 포트폴리오 MDD(%).
  - 하위 4열 그리드: S&P 500, NASDAQ, KOSPI, KOSDAQ의 동일 기간 MDD(%).
- **누적 수익률 비교 선 차트**:
  - 기준일(0%) 정규화 수익률 시계열 선 차트.
  - 범례 칩 터치 시 특정 시리즈 숨김/표시 토글.
- **알파 수익률 컴팩트 카드 & 상세 표 토글**:
  - 기본 뷰: 지수별 초과수익 뱃지(+X.XX%p, 녹색/적색)가 포함된 컴팩트 카드 4종.
  - 토글 뷰: '상세 표 보기' 클릭 시 지수명, 지수 수익률, 내 수익률, 알파, 지수 MDD가 포함된 가로 스크롤 테이블 확장.

### 5. API 재사용
- 백엔드 수정 없이 기존 검증된 프로덕션 API를 100% 재사용:
  - `/api/market/analysis/historical?ticker={ticker}&start_date={s}&end_date={e}`
  - `/api/market/analysis/stats?ticker={ticker}&start_date={s}&end_date={e}`
  - `/api/market/benchmark?period={period}`
  - `/api/v1/performance/portfolio?period={period}`

## Testing Decisions

### 1. 테스트 원칙
- 내부 구현 세부사항(state 이름, 비공개 메서드)이 아닌 **사용자 관점의 외부 동작(버튼 클릭 시 화면 갱신, 칩 선택 시 차트 반영, 라우팅 리다이렉트 등)**을 검증합니다.
- 실제 운영 DB가 아닌 테스트용 환경/Mock 데이터를 기반으로 독립 격리 검증을 수행합니다.

### 2. 단위 및 컴포넌트 테스트 (Vitest + React Testing Library)
- **`MobileTabBar.test.jsx`**: 5개 탭이 올바른 순서와 아이콘으로 렌더링되며, `/m/market` 경로에서 활성 스타일(sky-400)이 적용되는지 검증.
- **`MobileRouteGuard.test.jsx`**: 모바일 모드에서 `/m/market` 경로가 차단되지 않고 정상 렌더링되는지 검증.
- **`MobileMarketPage.test.jsx`**:
  - 기본 서브 탭이 `[시장 지수]`로 렌더링되는지 검증.
  - 상단 서브 탭 클릭 시 `[포트폴리오 비교]` 뷰로 정상 전환되는지 검증.
  - 4대 지수 칩 클릭 시 활성 지수가 변경되고 가격/MDD/극단값 수치가 연동 갱신되는지 검증.
  - VIX 차트에 20pt/30pt 기준선 요소가 정상 렌더링되는지 검증.
  - 포트폴리오 비교 탭에서 '상세 표 보기' 클릭 시 접이식 데이터 테이블이 노출되는지 검증.

### 3. E2E 테스트 (Playwright / Dev Server)
- 개발 서버(`uv run scripts/dev.py`)를 구동하고 모바일 뷰포트(390x844)로 접속하여 시나리오 검증:
  1. 하단 탭 바에서 '지수분석' 탭 클릭 -> URL이 `/m/market`으로 전환.
  2. 4대 지수 칩(S&P500, 나스닥, 코스피, 코스닥) 전환 테스트.
  3. 기간 필터 버튼(1Y, 3Y, 5Y 등) 전환 테스트.
  4. `[포트폴리오 비교]` 탭 전환 후 요약 카드, 비교 차트, 상세 표 토글 인터랙션 검증.
  5. 최종 화면 캡처 저장(`screenshots/YYYYMMDD_HHMMSS_mobile_market_analysis/`).

## Out of Scope

- **개별 종목 기술적 지표(RSI, MACD, 볼린저 밴드 등)**: 이번 기능은 4대 매크로 지수 분석 및 포트폴리오 벤치마크에 집중하며, 개별 종목 분석 차트는 포함하지 않습니다.
- **실시간 틱 단위 캔들스틱 차트**: 일별/주별 종가 기반 분석 차트이며, 초/분 단위 분봉 및 캔들스틱 차트는 대상에서 제외합니다.
- **관심 종목(Watchlist) 커스텀 추가 비교**: 모바일 사용성과 가독성을 위해 4대 대표 지수 중심의 비교에 집중하며, 데스크톱의 관심종목 체크박스 추가 기능은 모바일 버전에서 제외합니다.

## Further Notes

- 인터랙티브 프로토타입 UI 아티팩트(`mobile_market_prototype.html`)를 통해 모든 인터랙션과 시각적 조화가 사전 검증되었습니다.
- 본 스펙은 사용자와의 `/grill-me` 인터뷰 및 UI 검토 피드백(Y축 분리, VIX 기준선, 2대 극단값 카드)을 100% 충실하게 반영하여 작성되었습니다.
