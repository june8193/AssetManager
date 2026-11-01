# 01 — 설정 파일(`settings.toml`) 조회·검증·주석 보존 저장 및 백업 복원 API 구현

**Spec:** [spec.md](../spec.md)

**What to build:**
`tomlkit`을 도입하여 `settings.toml`의 한글 주석과 서식을 보존한 채 구조화된 JSON(Form 모드) 또는 Raw TOML 텍스트(Raw 모드)로 설정을 조회(`GET /api/v1/system/settings`) 및 수정(`PUT /api/v1/system/settings`)하고, 덮어쓰기 직전 `settings.toml.bak` 자동 백업 생성 및 복원(`POST /api/v1/system/settings/restore`), 그리고 메모리 내 설정 캐시(`get_settings(reload=True)`, `KiwoomAuthManager`) 즉시 갱신을 수행하는 백엔드 슬라이스를 구현합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `pyproject.toml`에 `tomlkit` 의존성이 추가되고 정상 설치된다.
- [x] `GET /api/v1/system/settings` 호출 시 파싱된 구조화 설정(`settings`), 파일 원문 문자열(`raw_toml`), 백업 파일 존재 여부(`has_backup`) 및 수정 일시(`backup_modified_at`)를 평문(마스킹 없음)으로 반환한다.
- [x] `PUT /api/v1/system/settings`에서 `mode="form"`으로 수정 요청 시 기존 `settings.toml`의 한글 주석(`# ...`)을 보존하면서 각 섹션(`base_url`, `ws_url`, `database`, `accounts`, `backup`, `telegram`, `naver`) 값을 업데이트한다.
- [x] `PUT /api/v1/system/settings`에서 `mode="raw"`로 수정 요청 시 전달된 Raw TOML 원문으로 파일을 저장한다.
- [x] `PUT /api/v1/system/settings` 요청 시 TOML 문법 오류, 필수 키(`base_url`, `accounts` 등) 누락, 잘못된 타입/범위(`interval_hours < 1`, 비정상 `allowed_user_ids` 등)가 있으면 파일을 덮어쓰지 않고 HTTP 400 에러와 상세 사유를 반환한다.
- [x] 설정 저장(`PUT`) 시 덮어쓰기 직전 기존 `settings.toml`을 `settings.toml.bak`으로 자동 백업한다.
- [x] `POST /api/v1/system/settings/restore` 호출 시 `settings.toml.bak` 백업본으로 `settings.toml`을 복원하며, 백업 파일이 없을 경우 HTTP 404 에러를 반환한다.
- [x] 설정 저장 및 복원 성공 직후 `get_settings(reload=True)` 및 `KiwoomAuthManager` 싱글톤이 리셋되어 재시작 없이도 최신 설정이 메모리에서 조회된다.
- [x] `tmp_path`로 격리된 단위/통합 테스트(`tests/test_system_api.py` 등)가 작성되어 실제 `settings.toml`을 건드리지 않고 모든 케이스가 통과한다.
