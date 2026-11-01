# Spec: Alembic 기반 DB 버전 및 마이그레이션 관리 시스템 도입

## Problem Statement (문제 정의)

현재 AssetManager의 SQLite 데이터베이스(`src/assets.db`, `src/dev_assets.db`) 스키마 변경 관리는 세 가지 파편화된 방식에 의존하고 있습니다:
1. 백엔드 서버 기동 시(`src/backend/main.py`) `Base.metadata.create_all(bind=engine)` 호출을 통한 신규 테이블 생성 (기존 테이블의 컬럼 추가/변경은 감지 불가).
2. `src/backend/migrations.py`의 `run_migrations()` 함수에서 서버가 켜질 때마다 `PRAGMA table_info(...)`로 컬럼 존재 여부를 검사하고 수동 `ALTER TABLE` 및 레거시 데이터 `UPDATE` 쿼리를 반복 실행.
3. 컬럼 이름 변경이나 데이터 보정이 필요할 때마다 `scripts/` 및 `scripts/migrations/` 하위에 일회성 파이썬 스크립트를 작성하여 수동 실행.

이로 인해 다음과 같은 문제가 발생하고 있습니다:
- **버전 이력 부재**: 현재 각 DB 파일에 어떤 스키마 변경까지 적용되었는지 확인할 수 있는 버전 메타데이터가 전혀 없습니다.
- **스키마 드리프트(Schema Drift)**:
  - 코드(`src/backend/models.py`)에서 이미 제거된 `allocation_settings` 빈 테이블이 운영/개발 DB에 그대로 남아있습니다.
  - 일회성 스크립트(`cleanup_snapshots.py`)로 DB에 추가된 `account_snapshots(account_id, snapshot_date)` 유니크 인덱스가 `models.py`에는 정의되어 있지 않습니다.
  - 개발 DB(`dev_assets.db`)에는 존재하는 `expense_rules`, `simulation_presets` 테이블이 운영 DB(`assets.db`)에는 아직 생성되지 않는 등 환경 간 스키마 불일치가 존재합니다.
- **SQLite `ALTER TABLE` 제약**: 향후 제약조건(Foreign Key, Unique, NOT NULL) 변경이나 컬럼 타입 수정 시 SQLite 기본 `ALTER TABLE`만으로는 처리가 불가능하여 수동 테이블 재생성 스크립트를 짜야 하는 위험이 있습니다.

## Solution (해결 방안)

SQLAlchemy 공식 마이그레이션 도구인 **Alembic**을 도입하여 데이터베이스 스키마 버전 관리와 마이그레이션 워크플로우를 표준화합니다.

1. **표준 Alembic 환경 및 Batch Mode 구축**:
   - 프로젝트 루트에 `alembic.ini` 및 `alembic/`(`env.py`, `versions/`) 디렉토리를 구성하고, 마이그레이션 파일명에 생성 일시(`YYYYMMDD_HHMM_<rev>_<slug>.py`)가 기록되도록 설정합니다.
   - SQLite의 `ALTER TABLE` 제약을 해결하기 위해 `render_as_batch=True` (Batch Mode)와 `Base.metadata` 네이밍 컨벤션(`naming_convention`)을 기본 활성화합니다.
2. **초기 기준선(Initial Baseline) 수립 및 스키마 100% 동기화**:
   - `src/backend/models.py`와 실제 DB 스키마 간의 불일치(`AccountSnapshot` 유니크 제약조건 모델 반영, 미사용 레거시 테이블 `allocation_settings` 제거 등)를 완전히 해소하고, 현재 모델을 기준으로 초기 마이그레이션 리비전(`initial_baseline`)을 생성합니다.
3. **서버 기동 시 자동 마이그레이션 + 사전 자동 백업**:
   - 백엔드 서버 시작 시(`src/backend/migrations.py`의 `run_migrations(engine)`) 현재 DB의 Alembic 리비전과 코드의 최신 리비전(`head`)을 비교합니다.
   - 미적용 마이그레이션이 존재할 때만 `settings.toml`의 `[backup].path`(기본 `./backups`)에 `assets_YYYYMMDD_HHMMSS.db` 백업 파일을 자동으로 먼저 생성한 뒤, `alembic upgrade head`를 실행합니다.
   - 이미 최신(`head`) 버전인 경우 불필요한 백업이나 쿼리 실행 없이 즉시 통과합니다.
4. **레거시 일회성 스크립트 정리 및 규칙 문서화**:
   - 이미 반영 완료된 과거 일회성 마이그레이션 스크립트 7개를 제거하여 혼선을 방지하고, `GEMINI.md`에 Alembic 기반 스키마 변경 규칙을 문서화합니다.

## User Stories (사용자 스토리)

1. **As a** 개발자 및 AI 에이전트, **I want** `src/backend/models.py`를 수정한 뒤 `uv run alembic revision --autogenerate -m "..."` 명령어로 마이그레이션 스크립트를 자동 생성하기를 원합니다, **so that** 수동으로 `ALTER TABLE` SQL을 작성하다가 발생하는 실수를 방지할 수 있습니다.
2. **As a** 개발자 및 AI 에이전트, **I want** SQLite 환경에서도 컬럼 삭제, 이름 변경, 제약조건 수정이 Alembic Batch Mode(`render_as_batch=True`)를 통해 안전하게 수행되기를 원합니다, **so that** SQLite의 `ALTER TABLE` 문법 제약에 구애받지 않고 모델을 발전시킬 수 있습니다.
3. **As a** 사용자(운영자), **I want** 백엔드 서버(`dev.py` 또는 `run_prod.py`)를 시작할 때 미적용된 DB 마이그레이션이 있으면 자동으로 감지하여 적용하되, 스키마가 변경되기 직전에 `./backups/assets_YYYYMMDD_HHMMSS.db` 백업 파일이 자동으로 생성되기를 원합니다, **so that** 별도의 수동 명령어 입력 없이도 안전하게 최신 DB 스키마를 유지하고 문제 발생 시 즉시 복구할 수 있습니다.
4. **As a** 사용자(운영자), **I want** DB가 이미 최신 마이그레이션 버전(`head`)일 때는 서버 기동 시 반복적인 `ALTER`/`UPDATE` 쿼리나 중복 백업 없이 빠르게 시작되기를 원합니다, **so that** 불필요한 디스크 I/O와 기동 지연을 줄일 수 있습니다.
5. **As a** 개발자, **I want** 기존 운영 DB(`src/assets.db`)와 개발 DB(`src/dev_assets.db`)의 데이터를 단 1건의 손실도 없이 초기 Alembic 기준선(`head`)으로 전환하고 레거시 잔재 테이블(`allocation_settings`)을 정리하기를 원합니다, **so that** 모든 환경의 DB 스키마가 `models.py`와 100% 일치된 상태에서 버전 관리를 시작할 수 있습니다.
6. **As a** 개발자, **I want** `pytest` 실행 시 `models.py`와 Alembic 마이그레이션 히스토리 간에 누락된 스키마 변경(드리프트)이 없는지 자동으로 검증되기를 원합니다, **so that** 모델만 수정하고 마이그레이션 파일 생성을 누락하는 실수를 테스트 단계에서 즉시 잡아낼 수 있습니다.

## Implementation Decisions (구현 결정사항)

### 1. 디렉토리 및 설정 구조 (`alembic.ini`, `alembic/env.py`)
- 루트 경로에 `alembic.ini`와 `alembic/` 폴더를 배치합니다.
- `alembic.ini`의 `file_template`을 `%%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s`로 설정하여 리비전 파일이 생성 시간순으로 정렬되도록 합니다.
- `alembic/env.py`는 `config.get_main_option("sqlalchemy.url")`이 외부(프로그래매틱 호출 또는 테스트)에서 주입된 경우 이를 우선 사용하고, 그렇지 않으면 `src.backend.database.load_database_url()`을 호출하여 현재 환경(`APP_ENV`)에 맞는 DB URL을 동적으로 로드합니다.
- `context.configure()` 호출 시 `target_metadata=Base.metadata`, `render_as_batch=True`, `compare_type=True`를 필수 옵션으로 지정합니다.

### 2. SQLAlchemy 메타데이터 및 모델 정합성 (`src/backend/database.py`, `src/backend/models.py`)
- `AccountSnapshot` 모델(`src/backend/models.py`)의 `__table_args__`에 기존 DB의 `idx_account_snapshot_unique`와 동일한 유니크 제약조건/인덱스(`UniqueConstraint("account_id", "snapshot_date", name="idx_account_snapshot_unique")`)를 명시하여 모델과 실제 DB 스키마를 일치시킵니다.
- 기존 `BackupService`(`src/backend/services/backup_service.py`)에서 기본 DB 경로가 `base_dir / "assets.db"`로 잘못 지정되어 있던 경로 계산을 `base_dir / "src" / "assets.db"`로 수정하고, 임의의 대상 DB 파일 경로를 받아 즉시 백업 파일을 생성하는 헬퍼 메서드/함수를 제공합니다.

### 3. 프로그래매틱 마이그레이션 러너 및 레거시 DB 전환 (`src/backend/migrations.py`, `src/backend/main.py`)
- `src/backend/main.py`의 `lifespan`에서 호출하던 `Base.metadata.create_all(bind=engine)`을 제거하고, `run_migrations(engine)`가 스키마 생성 및 버전 업그레이드를 전담하도록 일원화합니다.
- `run_migrations(engine: Engine)` 동작 계약:
  1. 대상 `engine`의 현재 Alembic 리비전(`MigrationContext.configure(conn).get_current_revision()`)과 스크립트 디렉토리의 최신 리비전(`ScriptDirectory.from_config(cfg).get_current_head()`)을 조회합니다.
  2. **이미 `current_rev == head_rev`인 경우**: 아무 작업도 수행하지 않고(백업 생략) 즉시 반환합니다.
  3. **신규 빈 DB인 경우** (`current_rev is None` 이고 기존 도메인 테이블이 없는 경우): 백업 없이 `command.upgrade(cfg, "head")`를 실행하여 전체 테이블과 `alembic_version`을 생성합니다.
  4. **기존 레거시 DB 전환 또는 미적용 마이그레이션이 있는 경우** (`current_rev != head_rev` 이고 기존 데이터가 존재하는 파일 DB인 경우):
     - 파일 기반 SQLite DB(`:memory:`가 아닌 경우)이고 DB 파일이 존재하면, 변경 작업 수행 전 `backups/assets_YYYYMMDD_HHMMSS.db` 형식으로 **사전 자동 백업**을 수행합니다.
     - `current_rev is None`인 기존 레거시 DB(이미 `users`, `accounts`, `transactions` 테이블이 존재하는 DB)의 경우:
       - 기존 `migrations.py`의 멱등 보정 로직(누락 컬럼 추가, 레거시 카테고리 표준화, `expense_sub_categories` 및 `allocation_settings` 레거시 테이블 `DROP TABLE IF EXISTS`, `Base.metadata.create_all`로 누락 테이블 보완, `idx_account_snapshot_unique` 보장)을 1회 수행하여 초기 Baseline 스키마와 100% 일치시킨 뒤, 초기 Baseline 리비전으로 `command.stamp(cfg, baseline_rev)`를 찍고 이후 리비전이 있다면 `command.upgrade(cfg, "head")`까지 진행합니다.
     - `current_rev is not None`인 버전 관리 중 DB의 경우: 곧바로 `command.upgrade(cfg, "head")`를 실행합니다.
- 호환성을 위해 기존 테스트에서 임포트하는 `seed_expense_masters(db_or_conn=None)` no-op 함수는 `src/backend/migrations.py`에 그대로 유지합니다.

### 4. 레거시 일회성 스크립트 정리
- 이미 운영 및 개발 DB에 반영 완료된 다음 일회성 스크립트 7개(및 빈 `scripts/migrations/` 디렉토리)를 삭제합니다:
  - `scripts/migrate_bank_snapshots.py`
  - `scripts/migrate_bond_categories.py`
  - `scripts/migrate_target_asset_id.py`
  - `scripts/migrations/cleanup_snapshots.py`
  - `scripts/migrations/migrate_20260528_snapshots.py`
  - `scripts/migrations/migrate_initial_balance.py`
  - `scripts/migrations/migrate_total_deposit_to_period_deposit.py`

## Testing Decisions (테스트 결정사항)

- **일반 테스트 속도 유지 (`tests/conftest.py`)**:
  - 기존 수백 개의 API/서비스 단위 테스트는 인메모리 SQLite에서 `Base.metadata.create_all(bind=engine)`을 사용하는 현행 구조를 유지하여 테스트 실행 속도를 보존합니다.
- **마이그레이션 전용 테스트 (`tests/test_migration.py`)**:
  - 최상위 공개 인터페이스인 `run_migrations(engine)` 및 Alembic의 `autogenerate.compare_metadata`를 테스트 심(Test Seam)으로 활용합니다:
    1. **빈 DB 초기화 검증**: 빈 SQLite DB에 `run_migrations(engine)` 실행 시 모든 모델 테이블과 `alembic_version` 테이블이 최신 `head`로 생성되는지 검증.
    2. **레거시 DB 무손실 전환 및 정리 검증**: `alembic_version`이 없고 `allocation_settings` 등 레거시 테이블과 구버전 `transactions` 데이터를 가진 파일 DB에 `run_migrations(engine)` 실행 시, ① 사전 백업 파일이 생성되고, ② 기존 데이터가 보존되며, ③ `allocation_settings`가 제거되고, ④ `alembic_version`이 `head`로 기록되는지 검증.
    3. **최신 버전 멱등성(No-op) 검증**: 이미 `head` 버전인 DB에 `run_migrations(engine)` 재실행 시 추가 백업 파일이 생성되지 않고 정상 통과하는지 검증.
    4. **모델-마이그레이션 드리프트 제로 검증**: 빈 DB를 `upgrade head`한 뒤 `compare_metadata(mc, Base.metadata)`를 호출했을 때 차이점(diff)이 빈 리스트(`[]`)인지 검증.

## Out of Scope (범위 제외 사항)

- 비즈니스 도메인 로직이나 프론트엔드 UI 변경.
- SQLite 이외의 외부 RDBMS(PostgreSQL, MySQL 등) 도입.
- `scripts/recalculate_snapshots.py`나 `scripts/data_imports/` 등 스키마 마이그레이션이 아닌 운영/데이터 임포트 유틸리티 스크립트 삭제(유지 대상).

## Further Notes (기타 참고사항)

- 실제 DB 파일(`src/assets.db`, `src/dev_assets.db`)에 전환을 적용할 때는 `GEMINI.md`의 **4. 데이터베이스 관리, 수정 및 검증 규칙**을 엄격히 준수하여 사전 백업 생성 및 전환 전/후 대시보드 핵심 지표(총 누적수익, 자산별 잔고, 최근 스냅샷 건수/합계) 교차 검증을 수행합니다.
