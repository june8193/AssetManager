# 01 — Backend API log_type Parameter & Fixed Mapping Support

**What to build:**
백엔드 시스템 로그 API(`/api/v1/system/logs/content`)에서 호출자가 내부 파일명을 직접 지정하지 않아도 로그 종류(`log_type="error"` 또는 `"output"`)를 전달하여 대상 로그 내용을 조회할 수 있도록 개선합니다. `log_type`이 생략되거나 기본 호출될 경우 에러 로그(`pm2-err.log`)를 기본 반환하며, 기존 웹 대시보드(프론트엔드)에서 특정 파일명을 지정하여 조회하는 `filename` 파라미터도 하위 호환성으로 정상 지원합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] `/api/v1/system/logs/content` 엔드포인트가 `log_type` 파라미터(`"error"`, `"output"`)를 지원합니다.
- [x] `log_type="error"` 요청 시 `pm2-err.log`, `log_type="output"` 요청 시 `pm2-out.log` 파일의 로그 내용을 반환합니다.
- [x] 파라미터가 생략되었을 때 기본적으로 `pm2-err.log`(에러 로그)를 안전하게 조회하여 반환합니다.
- [x] 기존 웹 UI 호환을 위해 `filename` 파라미터가 명시적으로 전달된 경우 해당 파일명을 우선 조회합니다.
- [x] 잘못된 `log_type` 값 전달 시 400 Bad Request와 명확한 오류 메시지를 반환합니다.
- [x] 백엔드 단위 테스트(`tests/test_system_api.py`)에 신규 기능 및 하위 호환성 검증 케이스가 추가되고 모두 통과합니다.

