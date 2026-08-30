# 05 — 모바일 설정 탭 및 PWA 최종 최적화

**What to build:**
모바일 환경 설정 탭(`MobileSettingsPage`)을 구현하고 PWA 캐싱 전략 및 모바일 E2E 사용자 경험을 최종 완성합니다. 설정 탭에서는 자산 금액 마스킹 스위치, 백엔드 서버 헬스체크 핑 상태 카드, iOS/Android 홈 화면 추가(PWA 설치) 안내 가이드를 제공합니다. 또한 Service Worker의 `NetworkFirst` API 캐싱 정책과 정적 리소스 캐시를 최종 검증하고, 브라우저 모바일 뷰 E2E 검증을 마칩니다.

**Blocked by:** 02 — 모바일 대시보드 탭 (자산/비중/성과 카드), 03 — 모바일 자산 조회 및 거래내역 탭 (Read-Only), 04 — 모바일 비중 점검 탭 (목표비중 및 리밸런싱)

**Status:** resolved

- [x] `MobileSettingsPage` 컴포넌트가 구현되고 모바일 설정 탭(`/m/settings`)에 연결되어야 함
- [x] 설정 탭에서 마스킹 On/Off 토글, 서버 연결 상태 확인 카드, PWA 설치 안내가 정상 렌더링되어야 함
- [x] PWA Service Worker의 NetworkFirst API 캐시 및 정적 에셋 캐싱이 정상 동작해야 함
- [x] 모바일 웹 화면에서 4개 탭 간의 이동 및 인터랙션이 매끄럽게 동작함을 E2E(웹 미리보기)로 검증해야 함
- [x] 전체 프론트엔드 테스트 스위트가 오류 없이 모두 통과해야 함
