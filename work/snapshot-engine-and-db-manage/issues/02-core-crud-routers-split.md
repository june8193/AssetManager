# 02 — 기본 CRUD 라우터 분할 (Accounts, Assets, Transactions)

**What to build:** `db_manage.py`에 혼재된 기본 엔티티 엔드포인트를 도메인별 3개 전용 라우터(`routers/accounts.py`, `routers/assets.py`, `routers/transactions.py`)로 분할 추출하고, 메인 애플리케이션에 등록하여 API 하위 호환성을 유지합니다.

**Blocked by:** 01 — 독립 Pydantic 스키마 패키지 구축

**Status:** resolved

- [x] 사용자 및 계좌 관리 CRUD 엔드포인트를 `routers/accounts.py`로 분리한다.
- [x] 자산 마스터 CRUD 및 카테고리 검증 엔드포인트를 `routers/assets.py`로 분리한다.
- [x] 거래 내역 CRUD 및 이체(Transfer) 등록 엔드포인트를 `routers/transactions.py`로 분리한다.
- [x] `main.py`에 신규 라우터들을 등록하고 기존 프론트엔드가 호출하는 `/api/db/...` 경로 호환성을 완벽히 유지한다.
- [x] 분할된 엔드포인트에 대한 통합 API 테스트가 모두 통과한다.
