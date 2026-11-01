# 02 — 서버 기동 시 사전 자동 백업 연동 Alembic 마이그레이션 러너 구현

**Spec:** [spec.md](../spec.md)

**What to build:** 백엔드 서버 기동 시(`src/backend/main.py`의 `lifespan`) 호출되는 `src/backend/migrations.py`의 `run_migrations(engine)`를 Alembic 기반 자동 실행기로 개편합니다. 미적용된 마이그레이션이나 레거시 DB가 감지되면 변경 전 자동으로 `backups/assets_YYYYMMDD_HHMMSS.db` 백업을 생성하고, 레거시 스키마 정합성 보정(누락 컬럼/테이블 반영 및 미사용 `allocation_settings` 테이블 제거) 후 최신 Alembic 리비전(`head`)으로 업그레이드합니다.

**Blocked by:** 01-alembic-baseline-and-schema-sync

**Status:** claimed

- [x] `src/backend/services/backup_service.py`의 기본 DB 경로 오류(`src/assets.db`)가 수정되고, 지정된 SQLite DB 파일을 백업 디렉토리에 `assets_YYYYMMDD_HHMMSS.db` 형식으로 즉시 복사하는 기능이 동작한다.
- [x] `src/backend/migrations.py`의 `run_migrations(engine)`가 대상 DB의 현재 Alembic 리비전과 `head` 리비전을 비교하여:
  - 이미 `head` 버전이면 백업이나 추가 쿼리 없이 즉시 종료(No-op)한다.
  - 빈 신규 DB이면 `alembic upgrade head`를 실행하여 모든 테이블과 `alembic_version`을 생성한다.
  - `alembic_version`이 없는 기존 레거시 파일 DB이면 사전 백업을 생성한 뒤, 레거시 보정(누락 컬럼 추가, `allocation_settings` 및 `expense_sub_categories` 제거, 누락 테이블 생성 등)을 수행하고 `head` 리비전으로 동기화한다.
  - 구버전 리비전의 파일 DB이면 사전 백업을 생성한 뒤 `alembic upgrade head`를 실행한다.
- [x] `src/backend/main.py`의 `lifespan`에서 중복되던 `Base.metadata.create_all(bind=engine)` 호출을 제거하고 `run_migrations(engine)`를 통해 초기화 및 마이그레이션이 일원화된다.
- [x] `tests/test_migration.py`에서 빈 DB 업그레이드, 레거시 DB 전환(데이터 보존 + 사전 백업 파일 생성 + `allocation_settings` 삭제 + `alembic_version` 기록), 최신 DB 재실행 시 백업 생략(멱등성), 예외 발생 시 `RuntimeError` 처리를 검증하는 테스트가 모두 통과한다.
