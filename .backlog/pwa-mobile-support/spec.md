# Feature Spec: 모바일(iOS/Android) PWA 지원 및 읽기 전용 모바일 웹 개편

Status: resolved

## Problem Statement

현재 AssetManager 웹 서비스는 PC 데스크톱 와이드 화면(좌측 사이드바 + 복잡한 데이터 테이블 및 차트)에 최적화되어 있어, 아이폰 및 안드로이드 등 모바일 브라우저나 홈 화면 PWA로 접속 시 다음과 같은 문제가 발생합니다:
1. 사이드바와 테이블 UI가 모바일 좁은 화면에 어긋나 시인성과 조작성이 크게 저하됩니다.
2. 모바일 환경에서 데이터베이스 수정/삭제/추가, 스냅샷 생성/재계산, SQL 실행, API 키 설정 등 데스크톱 수준의 CUD 및 시스템 관리 기능에 노출되어 오작동 및 실수로 인한 데이터 손실 위험이 있습니다.
3. 현재 별도의 React Native 모바일 앱(`AssetManager-app`)이 개발되어 있으나, 앱을 별도로 빌드/배포하지 않고도 모바일 웹/PWA 환경에서 모바일 앱과 동일한 핵심 읽기 전용 기능(대시보드, 자산/거래내역 조회, 비중 점검, 마스킹)을 즉시 이용하고자 하는 사용자의 니즈가 있습니다.

## Solution

1. **PWA(Progressive Web App) 인프라 구축**:
   - `vite-plugin-pwa`를 도입하여 iOS(Safari) 및 Android(Chrome)에서 '홈 화면에 추가' 시 네이티브 앱과 동일한 전체화면(Standalone) 실행 환경 제공.
   - iOS 노치/다이내믹 아일랜드 안전 영역(Safe Area) 및 테마 컬러(`#1e293b`) 지원.
   - 정적 에셋 캐싱 및 최신 자산 데이터 조회를 위한 Service Worker 캐싱 정책(`NetworkFirst` for API) 수립.

2. **적응형 모바일 레이아웃(Adaptive Mobile Layout) 제공**:
   - 디바이스 뷰포트 너비(`< 768px`) 또는 PWA Standalone 모드 접속 시 네이티브 모바일 앱과 동일한 형태의 **상단 간소화 헤더 + 중앙 터치 최적화 뷰 + 하단 4대 탭 바** 레이아웃으로 자동 전환.
   - 하단 4대 탭:
     - 📊 **대시보드**: 총 자산 요약, 카테고리별 자산 비중, 연간/누적 성과 요약
     - 💼 **자산 조회**: 계좌별 자산 잔고 카드(아코디언) + 전체 거래내역(입출금/매수매도/배당) 리스트 및 검색/필터링
     - ⚖️ **비중 점검**: 목표 비중 대비 현재 비중 비교 및 리밸런싱 필요 금액 확인
     - ⚙️ **환경 설정**: 금액 마스킹 토글, 백엔드 서버 연결 상태(Ping) 확인, PWA 설치 및 버전 안내

3. **안전한 읽기 전용(Read-Only) 정책 및 라우팅 가드(Route Guard)**:
   - 모바일 화면에서는 모든 CUD(계좌/자산/환율/거래내역 추가·수정·삭제) 버튼 및 입력 폼 원천 제거.
   - 모바일 환경에서 `/db`, `/connection`, `/system/db-explorer` 등 데스크톱 관리자 URL로 직접 접근 시, 사용자 안내 토스트/모달과 함께 안전하게 모바일 대시보드로 자동 리다이렉트 처리.

## User Stories

1. As a mobile user, I want to add the AssetManager web app to my iPhone or Android home screen, so that I can launch it like a native standalone mobile app without browser address bars.
2. As a mobile user, I want the app to adapt to device safe areas (notch, home indicator), so that UI components are not covered or cut off by the phone's physical screen edges.
3. As a mobile user, I want to see a simplified top header with server connection status and a privacy masking toggle button, so that I can quickly verify backend health and hide sensitive asset amounts in public spaces.
4. As a mobile user, I want to navigate between Dashboard, Asset Inquiry, Ratio Check, and Settings using a bottom tab bar, so that I can easily reach core views with one thumb.
5. As a mobile user, I want to view my total asset value, category breakdown, and annual/cumulative profit summaries in touch-friendly cards on the dashboard tab, so that I can check my financial health on the go.
6. As a mobile user, I want to view account-by-account asset balances and holdings with expandable cards on the asset inquiry tab, so that I can inspect details of individual portfolios.
7. As a mobile user, I want to search and filter transaction history (deposits, withdrawals, trades, dividends) by account and transaction type on the asset inquiry tab, so that I can review recent financial activities without opening a desktop computer.
8. As a mobile user, I want to view target vs actual allocation ratios and required rebalancing amounts on the ratio check tab, so that I can assess portfolio imbalances immediately.
9. As a mobile user, I want all modification, deletion, and addition controls (CUD) to be hidden or disabled on mobile, so that I do not accidentally modify or corrupt ledger data while on mobile.
10. As a mobile user, I want to be redirected back to the mobile dashboard if I enter a desktop-only URL (such as DB management or SQL explorer), so that I am prevented from accessing complex desktop management tools on a small screen.
11. As a mobile user, I want my data to load reliably with network-first caching, so that asset valuations stay up-to-date while providing seamless fallback during intermittent network glitches.
12. As a desktop user, I want the existing desktop interface (full sidebar, DB management, wizards, simulation, connection settings) to remain completely unaffected when viewing the application on a desktop browser.

## Implementation Decisions

1. **PWA 설정 및 메타데이터**:
   - `vite-plugin-pwa` 도입 및 `manifest.webmanifest` 구성:
     - `name`: "AssetManager", `short_name`: "AssetManager"
     - `display`: "standalone", `orientation`: "portrait"
     - `theme_color`: "#1e293b", `background_color`: "#0f172a"
     - 192x192, 512x512 및 maskable PWA 아이콘 구성
   - `index.html` 내 iOS 전용 메타 태그(`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `viewport-fit=cover`) 적용.
   - Service Worker 캐싱: Workbox를 통해 정적 에셋(JS, CSS, 폰트)은 `StaleWhileRevalidate`/`CacheFirst`, `/api/*` 요청은 `NetworkFirst` 전략 적용.

2. **반응형 뷰 분기 및 네비게이션 아키텍처**:
   - `useIsMobile` 커스텀 훅을 통해 뷰포트 너비(`window.innerWidth < 768`) 및 Standalone 모드(`display-mode: standalone`) 감지.
   - 최상위 레이아웃에서 조건부 렌더링:
     - **Desktop**: 기존 `Sidebar` + 데스크톱 라우트
     - **Mobile**: `MobileLayout` (`MobileHeader` + 컨텐츠 뷰 + `MobileTabBar`)
   - 모바일 4대 탭 라우팅:
     - `/` 또는 `/m/dashboard`: `MobileDashboardPage`
     - `/m/assets`: `MobileAssetsPage` (계좌별 자산 + 거래내역 탭)
     - `/m/ratios`: `MobileRatiosPage` (비중 점검)
     - `/m/settings`: `MobileSettingsPage` (마스킹, 서버 상태, PWA 안내)

3. **읽기 전용 가드 및 라우트 보호**:
   - `MobileRouteGuard` 컴포넌트 구현: 모바일 환경에서 데스크톱 전용 경로(`/db`, `/connection`, `/benchmark`, `/simulation/*`, `/system/*` 등) 접근 시 안내 토스트와 함께 `/`로 자동 리다이렉트.

4. **컴포넌트 및 로직 재사용**:
   - 기존 웹 프론트엔드의 `useDashboard`, `useRatios`, `useFormatters`, `MaskingContext` 비즈니스 로직 100% 재사용.
   - 모바일 전용 UI 컴포넌트(`MobileHeader`, `MobileTabBar`, `MobileTotalAssetCard`, `MobileAccountCard`, `MobileTransactionList`, `MobileRatioCard`)를 작성하여 모바일 터치 환경에 최적화된 패딩, 폰트 크기, 터치 타겟 제공.

## Testing Decisions

- **테스트 원칙**: 내부 구현 세부사항이 아닌 사용자 관점의 외부 인터랙션(모바일/데스크톱 레이아웃 분기, 탭 전환, 데이터 조회 렌더링, 읽기 전용 가드 리다이렉트)을 검증.
- **테스트 프레임워크**: `Vitest` + `React Testing Library` (`happy-dom`)
- **테스트 대상 모듈 및 시나리오**:
  1. `useIsMobile.test.js`: 화면 너비 리사이즈 및 Standalone 미디어 쿼리 상태 변화에 따른 모바일 모드 감지 검증.
  2. `MobileLayout.test.jsx`: 모바일 환경에서 상단 헤더, 하단 4개 탭 바 렌더링 및 탭 클릭 시 라우팅 전환 검증.
  3. `MobileRouteGuard.test.jsx`: 모바일 모드에서 `/db` 등 관리자 경로 접근 시 모바일 대시보드로 리다이렉트되는 동작 검증.
  4. `MobileDashboardPage.test.jsx`: 총 자산 카드, 카테고리 비중, 성과 요약 데이터가 올바르게 표시되고 마스킹 토글이 정상 작동하는지 검증.
  5. `MobileAssetsPage.test.jsx`: 계좌별 잔고 아코디언 및 거래내역 검색/필터링이 읽기 전용(CUD 버튼 부재)으로 정상 동작하는지 검증.
  6. `MobileRatiosPage.test.jsx`: 목표 비중 대비 현재 비중 및 리밸런싱 금액이 올바르게 계산되어 출력되는지 검증.

## Out of Scope

- 모바일 PWA 환경에서의 계좌/자산/환율/거래내역 생성/수정/삭제(CUD) 기능
- 모바일 PWA 내 스냅샷 마법사(`/db/snapshots/new`), SQL 직접 실행(`DbExplorer`), 키움 API 연결 관리
- 앱스토어 / 구글 플레이스토어 배포를 위한 네이티브 바이너리 패키징 (TWA / Capacitor)
- 푸시 알림 서버(Web Push) 구축

## Further Notes

- 모든 프론트엔드 코드는 기존 Tailwind CSS 및 Lucide 아이콘을 활용하여 React Native 앱(`AssetManager-app`)의 다크 슬레이트 테마(`#1e293b`, `#0f172a`, `#38bdf8`)와 디자인 일관성을 유지합니다.
- 프로젝트 개발 규칙(`GEMINI.md`)에 따라 테스트 주도 개발(TDD)을 준수하며, Vitest 단위 테스트 및 E2E 브라우저 검증을 수행합니다.
