# 03 — 딥 스냅샷 엔진(SnapshotEngine) 구축 및 비즈니스 로직 캡슐화

**What to build:** 라우터와 서비스 계층에 분산되어 있던 스냅샷 미리보기, 증권/은행 계좌 차액(Diff) 계산, 정산 보정 거래(이자/세금/입출금) 자동 생성 및 스냅샷 캐시 영속화 전체 과정을 `SnapshotEngine`으로 캡슐화하고, 단일 DB 트랜잭션으로 원자적(Atomic) 실행을 보장합니다.

**Blocked by:** 01 — 독립 Pydantic 스키마 패키지 구축

**Status:** resolved

- [x] `SnapshotEngine`이 실시간 시세 및 `LedgerEngine`과 연동하여 계좌별 평가액, 기간 입출금액, 이론상 현금을 정확히 산출한다.
- [x] `db_manage.py`에 직접 하드코딩되어 있던 증권 계좌 차액 계산 및 정산 트랜잭션 생성 로직(180줄)을 `SnapshotEngine` 내부로 이관 및 캡슐화한다.
- [x] 은행 계좌의 신규 거래 등록 및 잔액 갱신 계산 로직을 `SnapshotEngine` 내부로 캡슐화한다.
- [x] `save_unified` 실행 시 환율 기록, 보정 거래 삽입, 스냅샷 캐시 저장을 단일 DB 트랜잭션으로 원자적으로 커밋하여 무결성을 보장한다.
- [x] `SnapshotEngine`의 핵심 연산 및 원자성 검증을 위한 단위 테스트를 작성하고 통과한다.
