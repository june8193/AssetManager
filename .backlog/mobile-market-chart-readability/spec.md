# Feature Spec: 모바일 웹 지수분석 메뉴 차트 가독성 개선

Status: done

## Problem Statement

현재 모바일 웹의 지수분석 메뉴(`MobileMarketIndexSection`)는 작은 스마트폰 화면(폭 360~420px) 안에서 세 가지 차트(지수 종가, 낙폭 MDD, VIX 변동성)를 3단으로 무리하게 밀착 배치하여 다음과 같은 심각한 가독성 및 사용성 문제가 발생하고 있습니다:

1. **차트 영역이 너무 작아 곡선 식별 불가**: 3개 차트가 각각 96px, 56px, 68px로 쪼개져 있어 곡선 추세와 변동 폭을 파악하기 매우 어렵습니다.
2. **VIX 기준선 때문에 차트가 가려지고 보이지 않음**: 68px에 불과한 VIX 차트 영역 내에 '주의 20', '경고 30' 텍스트 라벨과 기준선이 빼곡하게 겹치면서 보라색 VIX 추세선 자체를 완전히 덮어버리고 있습니다.
3. **거대한 팝업 툴팁이 차트를 가리고 사라지지 않음**: 마우스 호버나 모바일 화면 터치 시 나타나는 팝업(통합 툴팁)이 폭 170px의 불투명한 카드 형태로 차트 중앙을 뒤덮어 버립니다. 또한, 화면에서 손을 떼고 있어도 팝업이 닫히지 않고 계속 떠 있어 화면 조작을 방해합니다.

## Solution

모바일 환경에서는 한 화면에 3개 차트를 모두 띄우는 욕심을 버리고, **"1화면 1차트 제대로 보기"** 원칙으로 전환합니다.

1. **상단 서브탭 스위처 [📈 지수 종가 | 📉 낙폭 (MDD) | ⚡ VIX 변동성] 도입**: 
   - 탭 선택 시 해당 지표 1개만을 **260px 높이의 쾌적한 단독 대형 차트**로 제공하여 모바일에서도 시원하게 곡선과 추세를 볼 수 있도록 합니다.
2. **VIX 기준선(주의 20, 경고 30) 분리 및 가독성 극대화**:
   - 차트 높이가 260px로 확장되어 Y축 공간이 넉넉해지며,
   - 차트 곡선을 침범하던 큰 텍스트 라벨을 차트 내부에서 제거하고, 깔끔한 가로 파선과 우측 Y축 미니 뱃지(20, 30) 및 상단 범례 태그로 분리 배치하여 VIX 곡선이 100% 선명하게 드러나도록 개선합니다.
3. **지수·MDD·VIX 통합 초슬림 툴팁 & TouchEnd 즉시 소멸 인터랙션**:
   - 사용자가 차트를 터치/스크러빙할 때, 숨겨진 다른 지표들까지 놓치지 않도록 **상단 슬림 바에 [날짜 | 지수 종가 | MDD | VIX] 3대 수치를 한눈에 동시 노출**합니다.
   - 툴팁은 차트 상단에 고정된 슬림 바 형태로 표시되어 손가락이 닿는 차트 선을 일체 가리지 않습니다.
   - 모바일에서 손을 떼는 순간(`touchEnd`) 또는 마우스가 차트 밖으로 벗어나는 즉시 툴팁과 세로선(Crosshair)이 **화면에서 즉시 사라집니다**.

## User Stories

1. As a mobile investor, I want to see a clear tab switcher (`[지수 종가] | [낙폭 (MDD)] | [VIX 변동성]`) above the chart card, so that I can choose which chart to focus on without visual clutter.
2. As a mobile investor, I want each chart to be rendered with a generous height of ~260px, so that I can clearly examine daily swings, peaks, and troughs without squinting at tiny compressed charts.
3. As a mobile investor, I want the '지수 종가' tab to show a spacious, beautiful price area/line chart with clear Y-axis price units and historical date milestones.
4. As a mobile investor, I want the '낙폭 (MDD)' tab to show an underwater area chart from 0% downwards to historical drawdown bottoms with ample vertical breathing room.
5. As a mobile investor, I want the 'VIX 변동성' tab to show a clear VIX curve where the 20 and 30 levels are distinct and comfortable to read across the 260px vertical canvas.
6. As a mobile investor, I want VIX reference lines at 20 (주의) and 30 (경고) to be styled as clean dashed lines with their badges placed on the right Y-axis or header legend, so that text labels never overlap or obscure the purple VIX curve.
7. As a mobile investor, I want to touch and scrub horizontally across any active chart to see the exact values for that specific date displayed in a slim top inspector bar, so that my finger and tooltip never block the chart lines underneath.
8. As a mobile investor, I want the touch tooltip to display all three key metrics (지수 종가, MDD, VIX) together alongside the date, so that even while viewing a single chart I can immediately cross-reference drawdown and panic levels for that day.
9. As a mobile investor, I want the currently active tab's metric to be highlighted within the unified tooltip, so that I can easily connect the active chart curve with its numerical value.
10. As a mobile investor, I want the inspection tooltip and vertical crosshair guide to disappear immediately when I lift my finger (`touchEnd`) or move my pointer away, so that no lingering popups stay stuck on the screen.
11. As a mobile investor, I want the 4-index selector chips (S&P 500, NASDAQ, KOSPI, KOSDAQ) and period filters (1Y, 3Y, 5Y, 10Y, ALL) to remain seamlessly connected to whichever chart tab is active.
12. As a mobile investor, I want the 2 extreme statistics cards ('최대 공포 VIX 피크' & '최대 낙폭 MDD 바닥') below the chart to remain intact and synchronized, providing instant historical crisis takeaways.

## Implementation Decisions

### 1. 차트 뷰 모드 전환 아키텍처 (3단 밀착 동시 렌더링 -> 1화면 1차트 서브탭 스위처)
- `MobileMarketIndexSection.jsx`의 내부 상태로 `activeChartTab` (`'price'` | `'mdd'` | `'vix'`)을 추가 (기본값: `'price'`).
- 차트 카드 상단에 3버튼 세그먼트 컨트롤러를 배치:
  - `📈 지수 종가`: 기본 지수 시계열 차트 (높이 `h-[260px]`).
  - `📉 낙폭 (MDD)`: 최대 낙폭 언더워터 차트 (높이 `h-[260px]`).
  - `⚡ VIX 변동성`: VIX 공포지수 시계열 차트 (높이 `h-[260px]`).
- 탭 전환 시 Recharts 컴포넌트가 부드럽게 1개만 렌더링되어 DOM 부하를 줄이고 시각적 집중도를 극대화합니다.

### 2. VIX 기준선 분리 및 가독성 개선
- VIX 차트 높이를 기존 68px에서 **260px**로 3.8배 이상 대폭 확장.
- 차트 내부 SVG에 직접 렌더링되어 곡선과 엉키던 `label={{ value: '주의 20', ... }}` 텍스트 제거.
- 대신:
  - `ReferenceLine`은 얇고 깔끔한 대시선(`stroke="#f59e0b"`, `stroke="#ef4444"`, `strokeDasharray="4 3"`, `strokeWidth={1.2}`)으로만 렌더링.
  - 우측 YAxis 도메인(`domain={[0, (max) => Math.max(45, Math.ceil(max + 2))]}`) 및 차트 헤더 우측 범례 뱃지(`주의 20`, `경고 30`)를 통해 기준선 수치를 명확히 안내.

### 3. 지수·MDD·VIX 통합 초슬림 툴팁 & 즉시 소멸 인터랙션
- 기존 Recharts의 170px 불투명 플로팅 `<Tooltip>` 박스를 제거하거나, 차트 컨테이너 상단 고정 슬림 바(Slim Inspector Bar) 형태의 커스텀 툴팁으로 교체.
- 터치/호버 시 데이터 포인트 획득:
  ```js
  // 프로토타입에서 검증된 통합 데이터 구조
  {
    date: '2026-06-15',
    price: 5864.6,
    mdd: -2.50,
    vix: 15.24
  }
  ```
- 툴팁 레이아웃:
  - 상단 고정 위치: 차트 상단 8px 위치에 가로 1열 바 형태로 표시 (`날짜 | 지수 XXXX pt | MDD -X.X% | VIX XX.X pt`).
  - 활성 탭에 해당하는 지표에 은은한 칩 하이라이트 적용.
- 즉시 소멸 로직:
  - 차트 컨테이너의 `onTouchEnd`, `onTouchCancel`, `onMouseLeave` 이벤트 리스너에서 툴팁 표시 상태(`activePoint`)를 즉시 `null`로 리셋하여 손을 떼는 순간 1밀리초의 잔상도 남지 않고 즉각 숨김 처리.

## Testing Decisions

### 1. 테스트 원칙 및 Seam (검증 경계)
- 최고 수준의 컴포넌트 Seam: `src/frontend/src/components/mobile/MobileMarketIndexSection.jsx`
- 테스트 러너: `vitest` + `@testing-library/react` (`src/frontend/src/components/mobile/MobileMarketIndexSection.test.jsx`)
- 내부 상태 변수명이 아닌 **사용자 관점의 외부 동작(탭 클릭, 차트 전환, 툴팁 표시 및 터치 해제 시 소멸, 기준선 노출 등)**을 검증합니다.

### 2. 구체적 테스트 케이스
1. **서브탭 스위처 렌더링 및 기본 상태 검증**:
   - `[지수 종가]`, `[낙폭 (MDD)]`, `[VIX 변동성]` 탭 버튼이 렌더링되며 기본 선택은 `지수 종가`인지 확인.
   - 기본 상태에서 지수 종가 차트(`chart-tier-price`)가 260px 영역으로 렌더링되는지 확인.
2. **탭 전환 동작 검증**:
   - `낙폭 (MDD)` 탭 클릭 시 MDD 차트(`chart-tier-mdd`)가 노출되고 지수 종가 차트는 언마운트/숨김 처리되는지 확인.
   - `VIX 변동성` 탭 클릭 시 VIX 차트(`chart-tier-vix`) 및 기준선 범례 배지가 노출되는지 확인.
3. **VIX 기준선 및 가독성 검증**:
   - VIX 차트에 20, 30 기준선 요소가 렌더링되며 곡선을 가리는 불필요한 내부 텍스트 라벨이 없는지 확인.
4. **통합 툴팁 및 터치 종료 검증**:
   - 차트 인터랙션 시 날짜와 함께 `지수`, `MDD`, `VIX` 3개 수치가 툴팁에 모두 표기되는지 확인.
   - 인터랙션 종료(`mouseLeave` / `touchEnd`) 이벤트 발생 시 툴팁이 즉시 숨겨지는지 확인.
5. **하단 2대 극단값 카드 연동 유지 검증**:
   - 탭 전환과 무관하게 하단 극단값 분석 카드(`extreme-stats-cards-container`)가 정상 유지 및 갱신되는지 확인.

## Out of Scope

- 데스크톱 전용 지수분석 페이지(`MarketAnalysisPage.jsx`)의 레이아웃 변경 (데스크톱은 넓은 화면으로 3단 동기화 차트가 유지됨).
- 백엔드 시계열 분석 API 스키마 변경 (기존 `/api/market/analysis/historical` API를 100% 그대로 활용).
- 새로운 시장 지수 티커 추가 또는 기간 필터 추가.

## Further Notes

- 사전 검증된 프로토타입 UI 아티팩트: `C:\Users\june8\.gemini\antigravity\brain\a26c30e7-2c79-476f-a784-87601872bb53\mobile_market_chart_ui_mockup.html`
- 사용자의 피드백("한 화면에 3개는 욕심, 1개씩 제대로 보기", "터치 툴팁에 MDD, VIX 함께 표시")이 완벽하게 반영되어 있습니다.
