# AssetManager 에이전트 규칙 (GEMINI.md)

이 파일은 프로젝트 개발 시 에이전트가 항상 준수해야 하는 공통 규칙들을 담고 있습니다.

## 1. 기본 원칙 (언어 및 실행 환경)
- **언어 정책**: 대답(Reply), 아티팩트(Artifact) 문서, Docstring(Google Style) 및 주석, Git 커밋 메시지 모두 항상 **한국어**로 작성합니다.
- **Python 실행**: 모든 파이썬 스크립트 실행은 반드시 `uv`를 사용합니다 (`uv run <script_path>`, 예: `uv run pytest`, `uv run scripts/dev.py`).
- **PowerShell 환경**: Windows 환경이므로 `&&` 대신 `;` 사용, 리다이렉션은 `2>$null`, `grep` 대신 `Select-String`, `rm -rf` 대신 `Remove-Item -Recurse -Force`를 사용합니다.
- **Scratch 스크립트 관리**: 임시 테스트/분석을 위해 `scratch/` 폴더에 작성한 스크립트도 Git 커밋으로 이력을 관리합니다.

## 2. TDD (Test Driven Development) 규칙
- **개발 절차 (Red-Green-Refactor)**: 
  1. **Red**: 실패하는 테스트를 먼저 작성합니다.
  2. **Green**: 테스트를 통과하는 최소한의 코드를 작성합니다.
  3. **Refactor**: 테스트 통과 상태를 유지하며 코드를 개선(리팩토링)합니다.
- **테스트 도구 및 위치**:
  - **백엔드**: `pytest` (`tests/test_*.py`)
  - **프론트엔드**: `Vitest` + `React Testing Library` (컴포넌트 디렉토리 내 `*.test.jsx`)
- **데이터베이스 격리 (필수)**: 테스트는 반드시 격리된 환경(인메모리 또는 테스트용 DB)에서 수행하며, 실제 운영 DB에 영향을 주지 않도록 합니다.

## 3. E2E (End-to-End) 테스트 규칙
- **원칙**: 기능 구현 및 수정 후에는 내장 브라우저 도구로 실제 동작을 검증합니다.
- **개발 서버 구동**: 반드시 `uv run scripts/dev.py`를 백그라운드 태스크(Async)로 실행합니다 (개발용 DB `src/dev_assets.db` 자동 격리 사용). `scripts/run_prod.py` 또는 `--prod` 플래그는 절대 사용 금지.
- **테스트 수행**: `http://localhost:5173`에 접속하여 시나리오별로 기능을 검증합니다.
- **스크린샷 및 정리**: 주요 화면은 `screenshots/YYYYMMDD_HHMMSS_작업명/` 폴더에 스크린샷을 저장하고, 검증 완료 후 개발 서버 백그라운드 태스크를 반드시 종료(kill)합니다.

## 4. 데이터베이스 관리, 수정 및 검증 규칙
- **원칙**: DB 테이블 구조/데이터 확인을 위해 일회성 스크립트를 작성하지 않으며, 데이터 조사는 **SELECT** 쿼리만 수행합니다.
  - **로컬 DB 조회**: `uv run scripts/db_query.py` 사용 (`--list-tables` 또는 `"SELECT ..."`).
  - **서버 DB 조회**: `assetmanager` MCP 도구(`get_db_tables`, `get_db_schema`, `execute_db_query` 등) 사용.
- **수정 전 사전 백업**: 마이그레이션 스크립트 실행 등 DB 수정 전, 반드시 `settings.toml`의 `[backup].path`(기본 `./backups`)에 `assets_YYYYMMDD_HHMMSS.db` 백업 파일을 생성합니다.
- **수정 후 지표 검증**: 작업 전/후 대시보드 핵심 지표(총 누적수익, 연도별 수익, 자산별 잔고 및 자산내역, 최근 스냅샷 정합성)를 API/스크립트 및 웹 화면(UI)으로 교차 비교 검증합니다.
- **불일치 시 롤백**: 지표 불일치나 데이터 왜곡 발견 시 즉시 백업본으로 원복(롤백) 후 원인을 재분석합니다.

## 5. Agent skills
- **Issue tracker**: `.backlog/<feature-slug>/` (완료 시 `.backlog/done/<feature-slug>/` 이동, 참조: `docs/agents/issue-tracker.md`)
- **Triage labels**: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` (참조: `docs/agents/triage-labels.md`)
