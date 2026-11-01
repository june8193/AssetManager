# 01 — Alembic 환경 구축, 모델 정합성 동기화 및 초기 Baseline 리비전 생성

**Spec:** [spec.md](../spec.md)

**What to build:** `alembic` 패키지를 설치하고 프로젝트 루트에 표준 Alembic 환경(`alembic.ini`, `alembic/env.py`, `alembic/versions/`)을 구축합니다. `src/backend/models.py`의 `AccountSnapshot` 유니크 제약조건을 실제 DB 스키마와 일치시킨 뒤, 전체 모델을 포괄하는 초기 Baseline 마이그레이션 리비전을 생성하고, 마이그레이션 적용 결과와 `Base.metadata` 간에 스키마 드리프트가 없음을 단위 테스트로 검증합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `pyproject.toml` 및 가상환경에 `alembic` 의존성이 추가되고 `uv run alembic --version` 명령이 정상 동작한다.
- [ ] `alembic.ini`에 날짜 기반 파일 템플릿(`YYYYMMDD_HHMM_<rev>_<slug>.py`)이 설정되고, `alembic/env.py`에서 `src.backend.database.load_database_url()` 연동 및 `target_metadata=Base.metadata`, `render_as_batch=True`, `compare_type=True`가 설정된다.
- [ ] `src/backend/models.py`의 `AccountSnapshot` 모델에 `(account_id, snapshot_date)` 복합 유니크 제약조건(`idx_account_snapshot_unique`)이 반영된다.
- [ ] `alembic/versions/` 하위에 현재 `models.py`의 전체 19개 테이블을 생성하는 초기 Baseline 마이그레이션 스크립트가 생성된다.
- [ ] 격리된 테스트 DB에서 Alembic `upgrade head`를 실행한 후 `alembic.autogenerate.compare_metadata`로 검사했을 때 `Base.metadata`와의 스키마 차이(diff)가 0건임을 검증하는 테스트가 통과한다.
