# 04 — 키움·백업 모듈의 settings.toml 설정 로더 단일화

**Spec:** [spec.md](../spec.md)

**What to build:** 키움 인증/API 및 백업 모듈이 각자 `settings.toml`을 따로 파싱하거나 상대 경로(`src/assets.db`)를 하드코딩하던 문제를 해결하여, `SETTINGS_PATH` 환경변수와 데이터베이스 URL을 존중하는 단일 통합 설정 모델(`accounts` 섹션 포함)로 일원화한다.

**Blocked by:** 01-expand-market-provider-and-async-kiwoom

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 통합 설정 모델이 `accounts` 섹션을 포함해 `settings.toml` 전체 섹션을 단일 소스로 파싱한다.
- [ ] 키움 클라이언트와 백업 모듈의 생성자 파일 I/O 부작용 및 하드코딩 경로 참조가 제거된다.
- [ ] `settings.toml` 파일이 없는 격리 테스트 환경에서도 주입된 설정 객체만으로 관련 테스트가 통과한다(`uv run pytest`).
