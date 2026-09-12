# 02 — 구글 드라이브 스토리지 경로 일원화 및 과거 감사 기록 연결 슬라이스

**What to build:**
`AssetManager`의 `settings.toml` 및 `settings.toml.example`의 `storage_dir` 기본 경로를 기존 자산 감사 저널(`asset_audit_journal.md`) 및 과거 보고서들이 누적 보관된 Google Drive 저장소 경로(`G:\내 드라이브\투자\Asset_jun_bot_storage`)로 일원화하여 이전 감사 기록의 연속성을 확보합니다.

**Blocked by:** 01 — 에이전트 스킬 2종 및 투자 참조 문서 이관 슬라이스

**Status:** ready-for-agent

- [ ] `settings.toml` 및 `settings.toml.example`의 `[telegram].storage_dir` 기본값이 `G:\내 드라이브\투자\Asset_jun_bot_storage`로 동기화된다.
- [ ] `scripts/get_storage_dir.py` 및 관련 설정 로더가 공백, 따옴표, 백슬래시가 포함된 경로를 안정적으로 반환한다.
- [ ] 기존 테스트 세트에서 경로 관련 설정 단위 테스트가 정상 통과한다.
