# 03 — 대시보드 상단 통합 태스크 경고 배너 UI 및 E2E 검증

**What to build:** AssetManager 웹 대시보드 상단에 통합 태스크 경고 배너(`TaskAlertBanner`)를 구현하여 실패한 백그라운드 태스크(환율, 시세, DB 백업, 종목 동기화 등) 에러를 직관적으로 경고 노출하고, E2E 검증을 진행합니다.

**Blocked by:** 02 — TaskManager 내 환율 수집 태스크 상태 추적 및 API 노출

**Status:** completed

- [x] 대시보드 상단 경고 배너 컴포넌트(`TaskAlertBanner`) 구현 및 `status === "failed"` 인 백그라운드 태스크 경고 노출 단위/컴포넌트 테스트 검증
- [x] 태스크 에러가 없을 때(`status !== "failed"`) 배너가 숨겨지는지 검증
- [x] `uv run pytest` 및 Vitest 테스트를 통해 백엔드/프론트엔드 통합 검증 완료
