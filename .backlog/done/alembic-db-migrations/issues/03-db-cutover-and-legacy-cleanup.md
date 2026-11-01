# 03 — 운영/개발 DB Alembic 전환 검증, 일회성 스크립트 정리 및 규칙 문서화

**Spec:** [spec.md](../spec.md)

**What to build:** 실제 개발 DB(`src/dev_assets.db`)와 운영 DB(`src/assets.db`)를 사전 백업 후 새로운 Alembic 마이그레이션 러너로 전환하여 두 DB 모두 최신 `head` 리비전으로 동기화하고 데이터 정합성을 교차 검증합니다. 또한 이미 반영 완료된 과거 일회성 마이그레이션 스크립트 7개를 제거하고 `GEMINI.md`에 Alembic 워크플로우를 문서화합니다.

**Blocked by:** 02-auto-migration-runner-with-backup

**Status:** resolved

- [x] 전환 전/후로 `src/assets.db` 및 `src/dev_assets.db`의 핵심 데이터(계좌 수, 자산 수, 트랜잭션 수, 스냅샷 수 및 평가액/수익 합계)가 100% 일치함이 검증된다.
- [x] `src/assets.db`와 `src/dev_assets.db` 모두에서 미사용 `allocation_settings` 테이블이 제거되고, 19개 모델 테이블과 `alembic_version` 테이블(최신 `head` 리비전 기록)이 동일하게 존재한다.
- [x] 이미 적용 완료된 과거 일회성 마이그레이션 스크립트 7개(`scripts/migrate_bank_snapshots.py`, `scripts/migrate_bond_categories.py`, `scripts/migrate_target_asset_id.py`, `scripts/migrations/*.py`)가 삭제된다.
- [x] `GEMINI.md`의 데이터베이스 관리 규칙에 Alembic 마이그레이션 생성(`uv run alembic revision --autogenerate -m "..."`) 및 적용/검증 절차가 반영된다.
- [x] 전체 백엔드 테스트(`uv run pytest`)가 모두 통과하고, 개발 서버(`uv run scripts/dev.py`) 기동 시 오류 없이 대시보드가 정상 렌더링된다.
