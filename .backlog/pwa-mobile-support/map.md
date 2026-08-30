## Destination

AssetManager 웹에 iOS 및 Android PWA(Progressive Web App)를 구축하고, 네이티브 모바일 앱(AssetManager-app)과 동등한 수준의 핵심 읽기 전용 기능(대시보드, 자산/거래내역 조회, 비중 점검)을 모바일 친화적 UI로 제공할 수 있는 설계 및 구현 스펙 완성.

## Notes

- **참조 프로젝트**: `c:\localrepo\AssetManager-app` (현재 React Native/Expo 기반 모바일 앱의 화면 및 기능 구성)
- **핵심 제약사항**:
  - 모바일 PWA 환경에서는 DB 조회만 허용하고 CUD(생성/수정/삭제) 기능은 비활성화/제한.
  - 모바일 기기(아이폰/안드로이드)의 홈 화면 추가(PWA standalone) 및 반응형 웹 모두에서 일관된 모바일 UX 제공.
  - 기존 웹의 데이터 훅(`useDashboard`, `useRatios` 등)과 API 클라이언트를 최대한 재사용.
- **관련 스킬**: `wayfinder`, `tdd`, `prototype`

## Decisions so far

- [01-pwa-foundation-and-adaptive-layout](issues/01-pwa-foundation-and-adaptive-layout.md): PWA 인프라(`vite-plugin-pwa`, Safe Area 메타) 및 `useIsMobile` 반응형 레이아웃 쉘, 모바일 가드 구축
- [02-mobile-dashboard-tab](issues/02-mobile-dashboard-tab.md): 모바일 대시보드 탭 및 3대 요약 카드(총자산, 카테고리비중, 성과요약) 구현
- [03-mobile-assets-and-transactions-tab](issues/03-mobile-assets-and-transactions-tab.md): 모바일 자산 조회(계좌별 아코디언) 및 거래내역(검색/필터) Read-Only 탭 구현
- [04-mobile-ratios-tab](issues/04-mobile-ratios-tab.md): 모바일 비중 점검 탭 및 원터치 추가금 리밸런싱 시뮬레이터 카드 구현
- [05-mobile-settings-and-pwa-polish](issues/05-mobile-settings-and-pwa-polish.md): 모바일 설정 탭(마스킹 스위치, 백엔드 Ping 헬스체크, PWA 설치 가이드) 및 캐싱 최적화 완료

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- 모바일 PWA 푸시 알림 또는 백그라운드 동기화 필요 여부 및 도입 가능성
- 모바일 오프라인 모드 데이터 캐싱(IndexedDB/Localforage) 수준 및 동기화 정책
- 모바일 터치 제스처(스와이프 당겨서 새로고침, 탭 전환 등) 인터랙션 라이브러리 적용 여부

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- 모바일 PWA 상에서의 계좌/자산/환율/거래내역 CUD(추가, 수정, 삭제) 기능 지원
- 모바일 PWA 내 DB Explorer(SQL 실행) 및 키움 API 연동 설정/관리 기능 지원
- 앱스토어/구글플레이 스토어 패키징(TWA, Capacitor 등 네이티브 래핑)
