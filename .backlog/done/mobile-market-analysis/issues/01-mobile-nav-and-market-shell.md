# 01 — 하단 네비게이션 탭 바 확장 및 모바일 지수분석 라우트/쉘 페이지 구성

**What to build:**
모바일 웹 화면 하단 탭 바에 5번째 메뉴로 '지수분석'(`TrendingUp` 아이콘, `/m/market`)을 추가하고, 사용자가 해당 탭을 터치했을 때 모바일 라우트 가드를 통과하여 모바일 지수분석 전용 페이지로 이동하도록 만듭니다. 지수분석 페이지 상단에는 '[시장 지수]'와 '[포트폴리오 비교]'를 전환할 수 있는 서브 탭 스위처를 제공합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] 모바일 하단 탭 바(`MobileTabBar`)에 5번째 탭 `지수분석`이 추가되고 올바른 순서(대시보드 | 자산 조회 | 지수분석 | 비중 점검 | 설정)로 렌더링된다.
- [x] `/m/market` 경로가 `MobileRouteGuard` 화이트리스트에 등록되어 데스크톱 리다이렉트 없이 정상 접근된다.
- [x] `MobileMarketPage` 컴포넌트가 마운트되고, 상단에 `[시장 지수]`(기본 활성)와 `[포트폴리오 비교]` 서브 탭 스위처가 정상 작동한다.
- [x] `MobileTabBar.test.jsx`, `MobileRouteGuard.test.jsx`, `MobileMarketPage.test.jsx` 단위 테스트가 모두 통과한다.
