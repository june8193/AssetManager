# Feature Spec: 월간 수익률 조회 및 성과 비교 탭 UI 통합

Status: done

## Problem Statement

최근 스냅샷 저장 시 매일의 연속 스냅샷을 저장하도록 시스템이 개선됨에 따라 데이터베이스에 일별 시계열 데이터가 풍부하게 축적되고 있습니다. 그러나 현재 자산 관리 화면에서는 연간 단위(Yearly)와 일자별 단위(Daily)로만 성과 및 시장 지수 비교를 제공하고 있어, 투자자가 월별(Monthly) 자산 추이, 월간 순입금액(Contribution), 월간 투자손익 및 월간 수익률(ROI)을 한눈에 파악하기 어렵습니다.

또한, 대시보드와 벤치마크 페이지 하단에 연도별 테이블과 일별 테이블이 세로로 나열되어 있어, 여기에 월간 테이블까지 단순 추가할 경우 화면이 과도하게 길어지고 정보 탐색의 편의성이 저하되는 문제가 있습니다.

## Solution

1. **월간 성과 분석 엔진 및 API 구축**
   - 스냅샷 데이터를 연월(YYYY-MM) 단위로 그룹핑하여, 전월 말 기말자산을 기초자산으로 삼고 당월 발생한 순입금액(Contribution)과 당월 말 평가액을 반영한 정확한 월간 투자손익 및 월간 수익률(ROI)을 산출합니다.
   - 벤치마크 지수 비교 서비스에서도 4대 시장 지수(KOSPI, KOSDAQ, S&P 500, NASDAQ)의 월별 수익률을 산출하여 포트폴리오 월간 ROI와 나란히 비교할 수 있는 데이터를 제공합니다.
   - AI 에이전트 인터페이스(MCP)에도 월간 통계 도구를 추가하여 자연어 기반의 월별 성과 조회를 지원합니다.

2. **통합 탭(세그먼트 컨트롤) UI/UX 제공**
   - 대시보드 및 벤치마크 페이지의 테이블 영역을 **[연도별 | 월별 | 일별] 탭**으로 통합하여, 사용자가 원하는 기간 단위를 직관적으로 전환하며 조회할 수 있도록 개선합니다.
   - 월별 현황 테이블에도 일별 현황과 마찬가지로 10/20/50개 단위의 페이지네이션을 지원하여 수십 개월 이상의 데이터도 쾌적하게 탐색할 수 있도록 합니다.

## User Stories

1. As an asset manager, I want to view my monthly asset valuations and returns, so that I can evaluate my investment performance on a month-by-month basis.
2. As an asset manager, I want the monthly statistics to use the previous month-end valuation as the base asset, so that the monthly ROI accurately reflects the continuous monthly compounding performance.
3. As an asset manager, I want the monthly statistics to aggregate all deposit and withdrawal transactions (contributions) occurring within the month, so that cash inflows/outflows do not distort my investment profit calculation.
4. As an asset manager, I want the system to handle the very first recorded month gracefully by using the initial snapshot's valuation minus deposit as the base asset, so that historic return calculations remain mathematically sound.
5. As an asset manager viewing monthly performance, I want to see [Month, Ending Assets, MoM Increase, Net Contribution, Investment Profit, ROI] columns, so that I have a comprehensive view of my capital and performance changes.
6. As a benchmark analyst, I want to compare my portfolio's monthly return against major market indices (KOSPI, KOSDAQ, S&P 500, NASDAQ) for the same month, so that I can evaluate whether I outperformed the market each month.
7. As a dashboard user, I want a unified tab/segment control to switch between Yearly, Monthly, and Daily tables, so that the page remains compact and uncluttered.
8. As a user viewing monthly and daily tables, I want pagination controls (10, 20, 50 items per page), so that I can browse through extensive historical records without performance degradation.
9. As an AI assistant user, I want an MCP tool to fetch monthly statistics, so that I can ask conversational questions about monthly performance and receive accurate data.
10. As a user navigating between tabs, I want the active tab selection and page size to be preserved or smoothly transitioned, so that my analytical context is maintained.

## Implementation Decisions

1. **월간 통계 산출 공식 (Domain Service)**:
   - **기초자산 ($A_{base}$)**: 직전 월의 마지막 스냅샷 평가액 ($A_{prev\_end}$). 단, 전체 데이터의 최초 월인 경우 해당 월 첫 스냅샷의 $(평가액 - 입금액)$.
   - **기말자산 ($A_{end}$)**: 해당 월의 마지막 스냅샷 평가액.
   - **순입금액 ($C$)**: 해당 월에 속한 모든 스냅샷의 `period_deposit` 합계.
   - **전월비 증감 ($\Delta A$)**: $A_{end} - A_{base}$
   - **투자손익 ($P$)**: $\Delta A - C$
   - **월간 수익률 ($ROI$)**: 
     $$\text{ROI} = \begin{cases} \frac{P}{A_{base} + C} \times 100 & \text{if } (A_{base} + C) \neq 0 \\ 0.0 & \text{otherwise} \end{cases}$$
   - **정렬**: 최신 연월이 가장 앞에 오도록 내림차순 정렬 (`month`: `"YYYY-MM"`).

2. **벤치마크 지수 월별 비교 로직**:
   - 각 월의 시작 거래일 종가와 마지막 거래일 종가를 기반으로 지수별 월간 수익률 계산.
   - 응답 구조: 기존 `yearly`, `daily` 배열 외에 `monthly` 배열을 추가하여 단일 비교 API 엔드포인트에서 반환.

3. **프론트엔드 컴포넌트 아키텍처 (`PerformanceTable` & Page Layout)**:
   - `PerformanceTable`에 `period="monthly"` prop 지원 추가 (컬럼 라벨: "연월", "기말자산", "전월비 증감", "순입금", "투자손익", "수익률").
   - `DashboardPage`와 `BenchmarkPage`에 `[연도별 | 월별 | 일별]` 탭 상태(`selectedPeriod`)를 두고, 선택된 기간에 해당하는 `PerformanceTable` 1개만 조건부 렌더링.
   - 월별 모드에 페이지네이션(10/20/50개) 활성화.

4. **MCP 도구 확장**:
   - 통계 도구 모듈에 `get_monthly_stats`를 추가하고 서버 초기화 시 등록.

## Testing Decisions

- **좋은 테스트 원칙**: 내부 루프나 임시 변수 등 구현 세부사항이 아닌, 외부로 노출되는 서비스 인터페이스 및 HTTP/UI 엔드포인트의 입력-출력 동작과 정합성을 검증합니다.
- **백엔드 테스트 접점 (Highest Seam)**:
  - `DashboardService.get_monthly_stats()`: 단일 월, 다중 월, 입출금 포함 월, 비활성 계좌 포함 여부 등 다양한 데이터 셋에 대한 손익/ROI 수학적 검증.
  - `BenchmarkService.get_comparison_tables()`: `monthly` 비교 결과에 4대 지수 수익률과 포트폴리오 ROI가 올바르게 매핑되는지 검증.
  - 라우터 엔드포인트: `GET /api/dashboard/stats/monthly` 정상 응답 검증.
- **프론트엔드 테스트 접점**:
  - `PerformanceTable.test.jsx`: `period="monthly"` 렌더링, 컬럼 표시, 마스킹 적용, 페이지네이션 동작 검증.
  - `DashboardPage.test.jsx` & `BenchmarkPage.test.jsx`: 탭 버튼 클릭 시 '연도별', '월별', '일별' 표가 올바르게 전환되어 렌더링되는지 검증.
- **기존 테스트 선례 (Prior Art)**:
  - `tests/test_dashboard_stats.py` (`test_get_yearly_stats_*`, `test_get_daily_stats_*`)
  - `src/frontend/src/components/PerformanceTable.test.jsx`

## Out of Scope

- 자산 추이 차트(`AssetChart`)의 월별 다운샘플링 뷰 모드 전환 (차트는 기존 일별 스냅샷 시계열 유지).
- 월별 목표 수익률 설정 및 달성률 게이지 시각화 기능 (추후 별도 고도화).
- 특정 계좌만 선택하여 조회하는 계좌별 월간 수익률 필터 (자산 통계는 전체 포트폴리오 통합 기준).

## Further Notes

- 모든 신규 코드는 프로젝트 코딩 규칙(`GEMINI.md`)에 따라 Python 실행은 `uv`, 언어는 한국어 주석/문서, TDD(Red-Green-Refactor)를 준수합니다.
- DB 데이터 조회 시 기존 `db_query.py` 또는 MCP 도구를 활용하며, 테스트는 격리된 인메모리/테스트 DB에서 수행합니다.
