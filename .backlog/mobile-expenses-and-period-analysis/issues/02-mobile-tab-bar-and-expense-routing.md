# 02 — 모바일 6대 탭 바 확장 및 지출 라우트(/m/expenses) 기반 구축

**What to build:** 
모바일 환경에서 사용자가 언제든지 한 번의 터치로 지출 관리 화면에 접근할 수 있도록, 하단 네비게이션 탭 바를 6개 탭 체계로 확장하여 '지출' 탭을 신설하고 라우트 가드 및 앱 라우터에 `/m/expenses` 경로를 등록합니다.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `src/frontend/src/components/mobile/MobileTabBar.jsx` 컴포넌트에 '지출' 탭(`Receipt` 아이콘, 경로 `/m/expenses`)을 세 번째 위치에 추가
- [ ] 6개 탭이 한 화면 너비(390px 스마트폰 기준)에서 줄바꿈이나 짤림 없이 균형 있게 표시되도록 탭 바 레이아웃 스타일(패딩, 아이콘 및 폰트 크기) 최적화
- [ ] 현재 경로가 `/m/expenses`일 때 '지출' 탭이 활성화(Active) 스타일로 강조되도록 설정
- [ ] `MobileRouteGuard.jsx`의 허용 경로 목록에 `/m/expenses`가 정상 포함되어 메인으로 튕기지 않도록 보장
- [ ] `App.jsx`의 `MobileAppRoutes`에 `<Route path="/m/expenses" element={<MobileExpensesPage />} />` 라우트 등록 (초기 플레이스홀더 또는 스켈레톤 연결)
- [ ] `MobileTabBar.test.jsx` 및 `MobileRouteGuard.test.jsx`에서 신규 탭 렌더링 및 네비게이션 동작 테스트 작성 및 통과
