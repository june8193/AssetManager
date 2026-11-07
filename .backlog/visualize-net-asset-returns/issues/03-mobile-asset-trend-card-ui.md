# 03 — 모바일 대시보드 '자산 추이 & 수익 지수' 카드(`MobileAssetTrendCard`) 신설 및 2번째 위치 배치

**Spec:** [spec.md](../spec.md)

**What to build:** 모바일 전용 다크 테마 차트 카드 컴포넌트인 `MobileAssetTrendCard.jsx`를 구현하여 `MobileDashboardPage.jsx`의 **2번째 위치**(`MobileTotalAssetCard` 바로 아래, `MobileCategoryBreakdownCard` 위)에 배치하고, 모바일 환경에서도 `[총자산 규모 (원) | 수익 지수 (Index)]` 세그먼트 탭 전환과 실시간(Live) 끝점이 반영된 시계열 추이 차트를 확인할 수 있게 합니다.

**Blocked by:** `01-portfolio-index-and-live-chart-data`

**Status:** ready-for-agent

- [ ] `MobileDashboardPage.jsx`에서 `MobileTotalAssetCard`(1번째) 바로 아래, `MobileCategoryBreakdownCard`(3번째) 위에 `MobileAssetTrendCard`(2번째)가 배치되어 렌더링된다.
- [ ] `MobileAssetTrendCard.jsx`는 모바일 다크 테마(`bg-slate-900 border-slate-800 rounded-3xl`) 및 세그먼트 탭 컨트롤(`총자산 규모 (원)` | `수익 지수 (Index)`)을 제공하며, 기본 활성 탭은 `총자산 규모 (원)`이다.
- [ ] `총자산 규모 (원)` 탭에서는 계좌 선택 드롭다운과 총자산(또는 선택 계좌) 시계열 차트가 표시되며, 프라이버시 마스킹 활성화 시 금액이 `***`로 마스킹된다.
- [ ] `수익 지수 (Index)` 탭으로 전환하면 계좌 선택 드롭다운이 숨겨지고, 카드 헤더 우측에 최신 수익 지수(`pt`) 및 누적 등락률(`%`)이 표시되며, `1,000 pt` 기준 점선과 지수 시계열 차트 및 3종 지표 툴팁이 렌더링된다.
- [ ] 프라이버시 마스킹 활성화 시에도 모바일 `수익 지수 (Index)` 탭의 지수(`pt`)와 등락률(`%`)은 마스킹되지 않고 그대로 표시된다.
- [ ] 모바일 컴포넌트 단위 테스트(`MobileAssetTrendCard.test.jsx` 및 `MobileDashboardPage.test.jsx`)에서 2번째 카드 배치 순서, 세그먼트 탭 전환, 마스킹 예외 처리가 검증된다.
