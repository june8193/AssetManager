# 02 — TaskManager 내 환율 수집 태스크 상태 추적 및 API 노출

**What to build:** `BackgroundTaskManager`에 `exchange_rate_update` 태스크를 신규 등록하고, 09:30 환율 자동 수집 실패 시 재시도 없이 수집을 중단하며 실패 정보(`status: "failed"`, `last_error`)를 `GET /api/system/tasks` 엔드포인트를 통해 외부로 노출합니다.

**Blocked by:** 01 — 환율 자동 수집 09:30 이후 변경 및 수동 새로고침 분리

**Status:** completed

- [x] `BackgroundTaskManager`에 `exchange_rate_update` 레지스트리 항목 추가
- [x] 환율 자동 수집 성공 시 `_update_task_success("exchange_rate_update")` 호출 기록 검증
- [x] 환율 자동 수집 실패 시 재시도 없이 중단되며 `_update_task_error("exchange_rate_update", error_msg)`가 호출되어 `status: "failed"`가 기록되는지 단위 테스트 검증
- [x] `GET /api/system/tasks` API 호출 결과에 `exchange_rate_update` 태스크 상태가 올바르게 응답되는지 검증
