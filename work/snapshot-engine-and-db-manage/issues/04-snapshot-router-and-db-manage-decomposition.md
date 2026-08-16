# 04 — 스냅샷 전용 라우터 추출 및 db_manage.py 완전 해체

**What to build:** 스냅샷 관련 모든 API 엔드포인트를 전용 라우터(`routers/snapshots.py`)로 추출하여 `SnapshotEngine`과 연결하고, 모놀리스 파일인 `db_manage.py`를 완전히 해체/삭제하여 리팩토링을 완료 및 E2E 검증합니다.

**Blocked by:** 02 — 기본 CRUD 라우터 분할, 03 — 딥 스냅샷 엔진 구축

**Status:** resolved

- [x] 스냅샷 관련 모든 엔드포인트(미리보기, 증권/은행 정산 계산, 단일/통합 저장, 최신일자 조회, 삭제 등)를 `routers/snapshots.py`로 이관한다.
- [x] `routers/snapshots.py`가 `SnapshotEngine`을 주입받아 비즈니스 연산 없이 순수하게 요청/응답 변환만 처리하도록 단순화한다.
- [x] 모놀리스 파일이었던 `src/backend/routers/db_manage.py`를 완전히 삭제한다.
- [x] `main.py`에 `routers/snapshots.py`를 마운트하여 기존 `/api/db/...` 경로 호환성을 완벽하게 유지한다.
- [x] 전체 백엔드 단위/통합 테스트와 프론트엔드 E2E(스냅샷 마법사 저장 플로우) 테스트를 수행하여 모든 기능이 정상 동작함을 검증한다.
