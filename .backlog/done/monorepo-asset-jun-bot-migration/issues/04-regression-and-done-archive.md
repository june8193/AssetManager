# 04 — 최종 통합 회귀 검증 및 모노레포 이전 완료 정리 슬라이스

**What to build:**
모든 이관 파일과 기능에 대한 전체 백엔드 단위/회귀 테스트 통과를 확인하고, `Asset-jun-bot` 보존 및 모노레포 단일화 상태를 최종 점검하며 백로그를 완료 처리합니다.

**Blocked by:** 03 — 텔레그램 /restart 커맨드 및 재시작 완료 알림 복원 슬라이스

**Status:** resolved

- [x] 전체 백엔드 단위 테스트(`uv run pytest`)가 100% 통과하여 기존 및 신규 기능에 회귀 버그가 없음을 검증한다.
- [x] `AssetManager` 내 에이전트 스킬 목록(7종)과 `docs/references/` 지식 문서의 정합성을 확인한다.
- [x] 백로그 디렉토리를 `.backlog/done/monorepo-asset-jun-bot-migration/`으로 이동하고 완료 상태를 확정한다.
