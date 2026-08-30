# 01 — PWA 인프라 및 적응형 모바일 레이아웃 쉘

**What to build:**
모바일 기기(아이폰/안드로이드) 브라우저 및 홈 화면(PWA Standalone)에서 최적의 풀스크린 모바일 앱 경험을 제공하기 위한 PWA 인프라(`vite-plugin-pwa`, `manifest.webmanifest`, iOS Safe Area 메타태그)를 구성하고, 뷰포트 너비(`< 768px`) 또는 Standalone 모드를 감지하는 `useIsMobile` 훅과 상단 헤더(`MobileHeader`: 서버 상태, 마스킹 토글), 중앙 컨텐츠 뷰, 하단 4대 탭 바(`MobileTabBar`)로 이루어진 `MobileLayout`을 구축합니다. 또한 모바일 환경에서 데스크톱 전용 관리 URL(`/db`, `/connection`, `/system/*` 등)로 접근 시 모바일 대시보드로 자동 리다이렉트하는 `MobileRouteGuard`를 적용합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `vite-plugin-pwa` 및 Web App Manifest(`name`, `theme_color: #1e293b`, `display: standalone`, 아이콘)가 올바르게 구성되어야 함
- [x] `index.html`에 iOS 전용 메타 태그(`apple-mobile-web-app-capable`, `viewport-fit=cover` 등)가 적용되어야 함
- [x] 화면 너비 및 PWA standalone 모드를 감지하는 `useIsMobile` 훅이 구현되고 리사이즈/모드 변화에 반응해야 함
- [x] 모바일 환경에서 상단 헤더, 본문 스크롤 영역, 하단 4개 탭 바(대시보드, 자산 조회, 비중 점검, 설정)를 렌더링하는 `MobileLayout`이 제공되어야 함
- [x] 모바일 모드에서 `/db` 등 비모바일 경로 접근 시 사용자 안내와 함께 `/`로 리다이렉트하는 `MobileRouteGuard`가 동작해야 함
- [x] 모바일 레이아웃 및 훅에 대한 Vitest 단위 테스트가 작성되고 통과해야 함
