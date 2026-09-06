# Feature Spec: 벤치마크 비교 페이지 상단 레이아웃 개선 및 일원화

Status: ready-for-agent

## Problem Statement

현재 데스크탑 웹의 '시장분석 > 벤치마크 비교' 메뉴로 진입했을 때, 실제 페이지 상단 타이틀이 '시장분석 대시보드'로 표시되어 사이드바 메뉴명과의 불일치로 인한 탐색 및 인지적 혼선이 발생합니다.

또한, 페이지 상단에 위치한 요약 카드 영역('내 총자산' 카드 및 '4대 시장 지수 요약 카드')은 바로 하단에 위치한 '벤치마크 초과수익률 (Alpha) 분석' 표와 수익률 데이터가 중복되어 화면 공간을 비효율적으로 점유하고 있습니다.

상단 기간 선택 필터 역시 드롭다운(`<select>`) 형태로 제공되어 '수익률 비교 분석' 등 다른 시장분석 메뉴의 탭 인터페이스와 조작 일관성이 결여되어 있으며, 상단 카드를 제거할 경우 카드에만 안내되던 '최신 스냅샷 기준일'과 '수익률 비교 기준일' 정보가 유실되어 성과 산출 기준 시점을 파악하기 어려워지는 문제가 발생합니다.

## Solution

1. **타이틀 및 설명 문구 일원화**
   - 페이지 최상단 타이틀을 사이드바 메뉴명과 일치하도록 `벤치마크 비교`로 변경합니다.
   - 부제목 설명 문구를 `주요 시장 지수 대비 포트폴리오 성과 및 초과수익률(Alpha)을 비교 분석합니다.`로 명확화하여 페이지 목적을 직관적으로 전달합니다.

2. **상단 요약 카드 섹션 제거 및 초과수익률 표 최상단 이동**
   - 중복되던 '내 총자산' 및 '4대 시장 지수' 요약 카드 섹션을 완전히 제거합니다.
   - 핵심 성과 지표를 즉시 확인할 수 있도록 '벤치마크 초과수익률 (Alpha) 분석' 표를 페이지 최상단(헤더 직하단)으로 이동 배치합니다.

3. **기준일 안내 캡션 및 3단 설명 팝오버(Popover) 툴팁 제공**
   - 초과수익률 분석 표 상단에 `최신 스냅샷 기준일: YYYY-MM-DD`, `수익률 비교 기준일: YYYY-MM-DD` 캡션을 표시합니다.
   - 캡션 옆에 도움말 아이콘을 배치하고, 아이콘 클릭 시 토글되는 안내 팝오버 카드를 제공합니다 (외부 영역 클릭 시 또는 닫기 버튼으로 닫힘).
   - 팝오버는 사용자의 이해를 돕기 위해 3단 구조로 안내를 제공합니다:
     - 1단: **최신 스냅샷 기준일** 정의 (사용자가 기록한 포트폴리오 자산의 가장 최근 스냅샷 일자)
     - 2단: **수익률 비교 기준일** 정의 (시장 지수 데이터와 포트폴리오 스냅샷이 공통으로 존재하는 최근 유효 거래일)
     - 3단: **왜 필요한가요?** (시장 휴장일과 데이터 비대칭으로 인한 왜곡을 방지하고 정규화된 공정한 초과수익률을 비교하기 위한 안내)

4. **기간 선택 컨트롤 탭화**
   - 헤더 우측의 드롭다운을 '수익률 비교 분석' 페이지와 동일한 탭 버튼 그룹(`올해 누적 (YTD)`, `1개월`, `3개월`, `1년`)으로 개편하여 일관된 사용자 경험을 제공합니다.
   - 기존 새로고침 버튼은 탭 우측에 자연스럽게 유지합니다.

## User Stories

1. As an investor, I want the page title to display '벤치마크 비교' matching the sidebar menu name, so that I have a consistent navigation experience without confusion.
2. As an investor, I want to see a clear subtitle explaining portfolio benchmark comparison and alpha analysis, so that I instantly understand the purpose of this page.
3. As an investor, I want the '벤치마크 초과수익률 (Alpha) 분석' table to be positioned at the top of the page, so that I can immediately view my excess returns against major market indices without scrolling past redundant cards.
4. As an investor, I want redundant summary cards removed from the top of the page, so that the screen is clean, compact, and focused on essential comparison data.
5. As an investor, I want to see the latest snapshot date and return comparison baseline date displayed as a caption on the excess return table, so that I know exactly what historical dates are being used for performance calculations.
6. As an investor, I want to click a help icon next to the date caption to open an informative popover card, so that I can learn what the dates mean and why they are necessary.
7. As an investor reading the popover card, I want a 3-part structured explanation covering latest snapshot date, return comparison baseline date, and the rationale behind differences due to market holidays, so that I can trust the normalization process.
8. As an investor, I want the explanation popover to close cleanly when I click outside of it or click its close button, so that it doesn't obstruct my view of the data table.
9. As an investor, I want to switch performance periods using tab buttons (`올해 누적 (YTD)`, `1개월`, `3개월`, `1년`) in the header rather than a dropdown, so that switching periods is fast, visible, and consistent with the sector return comparison page.
10. As an investor, I want the refresh button to remain easily accessible next to the period tabs, so that I can force-refresh live benchmark data whenever needed.
11. As an investor, I want the excess return table and line chart to remain seamlessly responsive to the selected period tab, so that all visual components reflect the chosen timeframe consistently.

## Implementation Decisions

1. **페이지 헤더 및 타이틀 컴포넌트 개편**:
   - 페이지 제목 텍스트를 '시장분석 대시보드'에서 '벤치마크 비교'로 변경.
   - 부제목을 '주요 시장 지수 대비 포트폴리오 성과 및 초과수익률(Alpha)을 비교 분석합니다.'로 업데이트.
   - 기간 선택 UI를 네이티브 `<select>`에서 활성 상태 스타일(bg-blue-600 또는 둥근 흰색 pill)이 적용된 탭 버튼 그룹으로 교체.

2. **레이아웃 순서 재배치 및 요약 카드 모듈 제거**:
   - 기존 1번 영역의 4개 카드(`내 총자산` 및 3~4개 지수 카드) 렌더링 블록을 완전 삭제.
   - 기존 3번 영역에 있던 '초과수익률 분석' 테이블을 헤더 바로 아래 최상단으로 이동.
   - 최상단 배치 후 전체 페이지 레이아웃 구조:
     `[헤더: 타이틀 & 기간 탭]` ➔ `[최상단: 초과수익률 분석 표 + 기준일 캡션/팝오버]` ➔ `[중앙: 누적 수익률 비교 추이 선 차트 & 시리즈 토글]` ➔ `[하단: 연도/월/일별 성과 비교 탭 & 테이블]`.

3. **기준일 캡션 및 설명 팝오버(Popover) 컴포넌트 구성**:
   - 표 헤더 영역 내부에 기준일 정보를 작고 정돈된 캡션 텍스트로 배치 (`최신 스냅샷 기준일`, `수익률 비교 기준일`).
   - 캡션 우측에 클릭 가능한 `HelpCircle` 아이콘 버튼 배치.
   - 팝오버 상태(`showHelpPopover: boolean`) 및 외부 클릭 감지를 위한 `useRef` + `useEffect` 훅 이벤트 바인딩.
   - 팝오버 내부 콘텐츠는 3단 구조(최신 스냅샷 정의, 비교 기준일 정의, 정규화 필요성 및 시장 휴장일 안내)로 디자인하여 시각적 계층감 부여.

4. **API 및 서비스 인터페이스 불변**:
   - 기존 `useBenchmark` 훅과 백엔드 `GET /api/benchmark` API 계약은 그대로 유지 (필요한 데이터가 이미 모두 제공되므로 백엔드 변경 불필요).

## Testing Decisions

- **좋은 테스트 원칙**:
  - 컴포넌트 내부 상태나 렌더링 세부 구현이 아닌, 사용자가 화면에서 관찰하고 상호작용하는 외부 동작(User-facing behavior)을 검증합니다.
- **테스트 접점 (Highest Seam)**:
  - **컴포넌트 렌더링 및 인터랙션 테스트 (`src/pages/BenchmarkPage.test.jsx`)**:
    - 변경된 페이지 타이틀('벤치마크 비교') 및 부제목 정상 렌더링 확인.
    - 기존 요약 카드(내 총자산 평가액 등)가 렌더링되지 않음을 확인.
    - 초과수익률 분석 표 및 기준일 캡션이 최상단에 올바르게 노출되는지 확인.
    - 기간 탭 버튼 그룹 렌더링 및 탭 클릭 시 `setPeriod` 호출 동작 검증.
    - 기준일 도움말 아이콘 클릭 시 3단 설명 팝오버가 열리고 내용이 표시되는지, 닫기 상호작용이 동작하는지 검증.
  - **E2E 브라우저 검증**:
    - 브라우저를 통해 `http://localhost:5173/benchmark` 화면의 전체 시각적 배치, 탭 클릭 및 팝오버 동작 교차 검증.

## Out of Scope

- 백엔드 벤치마크 수익률/Alpha 계산 로직 및 DB 스키마 수정.
- 하단 누적 수익률 차트의 Recharts 렌더링 로직이나 하단 연도별/월별/일별 성과 테이블의 컬럼 구성 변경.
- 모바일 전용 별도 분기 화면 재설계 (기존 Tailwind 반응형 그리드 체계 유지).

## Further Notes

- 모든 코드 작성 및 테스트는 `GEMINI.md`의 개발 규칙(한국어 주석/문서, `uv` 및 격리 환경 실행, TDD 원칙)을 준수합니다.
