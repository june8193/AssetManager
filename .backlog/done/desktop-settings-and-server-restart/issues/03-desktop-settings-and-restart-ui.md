# 03 — 데스크톱 '환경 설정 및 서버 관리'(`/system/settings`) 페이지 및 재시작 헬스체크 폴링 UI 구현

**Spec:** [spec.md](../spec.md)

**What to build:**
데스크톱 좌측 사이드바 `서버 점검` 하위 메뉴에 `환경 설정 및 서버 관리`(`/system/settings`)를 추가하고, 구조화된 폼(Form) 탭(키움 URL, 계좌 카드 추가/삭제, DB 경로, 백업, 텔레그램, 네이버 설정 평문 편집)과 Raw TOML 에디터 탭 전환 UI, `설정 저장` / `저장 후 서버 재시작` / `서버 재시작` / `직전 설정 복원` 액션 버튼, 그리고 서버 재시작 시 헬스체크 폴링을 통해 재기동 완료까지 진행 상태를 실시간 표시하는 화면을 구현합니다.

**Blocked by:** 01-settings-crud-and-backup-api, 02-server-restart-api-and-dev-supervisor

**Status:** resolved

- [x] 데스크톱 사이드바(`Sidebar.jsx`)의 `서버 점검` 하위 메뉴에 `환경 설정 및 서버 관리`(`path: '/system/settings'`)가 추가되고 `App.jsx`의 데스크톱 라우트에 연결된다.
- [x] `systemService.js`에 `getSettings`, `updateSettings`, `restoreSettings`, `restartServer` API 호출 메서드가 추가된다.
- [x] `SystemSettingsPage.jsx`의 '구조화 폼 편집' 탭에서 `base_url`, `ws_url`, `[database]`, `[[accounts]]`(계좌 추가/삭제 포함), `[backup]`, `[telegram]`, `[naver]`의 모든 필드가 마스킹 없이 평문으로 표시되고 편집 가능하다.
- [x] `SystemSettingsPage.jsx`의 'Raw TOML 편집' 탭에서 `settings.toml` 원문 텍스트를 직접 확인하고 편집할 수 있다.
- [x] `설정 저장` 클릭 시 현재 활성 탭(Form 또는 Raw) 기준으로 설정을 저장하고 성공/오류(스키마·문법 검증 실패 사유) 피드백 배너를 표시한다.
- [x] 백업 파일(`has_backup: true`)이 존재할 때 `직전 설정 복원` 버튼이 활성화되며, 클릭 시 확인 후 `settings.toml.bak` 설정으로 복원하고 화면 입력값을 갱신한다.
- [x] `저장 후 서버 재시작` 및 단독 `서버 재시작` 버튼 클릭 시 재시작 API를 호출하고, 진행 상태 모달/배너를 띄워 `/api/v1/system/tasks/status` 헬스체크 폴링으로 서버 재기동 완료 시점까지 상태를 표시한 뒤 최신 설정을 다시 불러온다.
- [x] 프론트엔드 단위 테스트(`SystemSettingsPage.test.jsx`) 및 내장 브라우저 E2E 테스트가 모두 통과한다.
