# 01 — 백엔드 스냅샷 엔진 현금계좌 우선 처리 및 위저드 이체(TRANSFER) 쌍 연산/영속화 지원

**Spec:** [spec.md](../spec.md)

**What to build:** 스냅샷 정산 계산(`calculate_bank`, `calculate_brokerage`)에서 신규 `TRANSFER` 거래를 출발 계좌 출금으로 계산하고, 통합 저장(`save_unified`) 시 현금계좌(은행) → 주식계좌(증권) 순서로 처리하며 `TRANSFER` 거래를 `transfer_pair_id`로 묶인 출발 계좌 `WITHDRAW` + 도착 계좌 `DEPOSIT` 쌍으로 원자적 생성하는 백엔드 엔드투엔드 기능.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `TransactionSchema`(`src/backend/schemas/transaction.py`)에 `target_account_id: Optional[int] = None` 필드가 추가되고, `SnapshotEngine._create_transaction_from_schema`에서 ORM 생성 시 `target_account_id`가 안전하게 제외된다.
- [ ] `LedgerEngine.replay`, `SnapshotEngine.calculate_bank`, `SnapshotEngine.calculate_brokerage`에서 `type == "TRANSFER"`인 신규 거래가 출발 계좌의 출금(`WITHDRAW`)과 동일하게 현금 잔액 차감, `total_withdraw` 가산, `period_deposit` 차감으로 계산된다.
- [ ] `SnapshotEngine.save_unified`에서 거래 처리 순서가 `_process_bank_accounts` → `_process_brokerage_accounts` 순서로 실행된다.
- [ ] `_process_bank_accounts` 및 `_process_brokerage_accounts`에서 `tx_schema.type == "TRANSFER"`일 때 `target_account_id` 유효성을 검증(누락 또는 출발 계좌와 동일 시 `ValueError`)하고, 공유 `transfer_pair_id`(UUID)를 가진 출발 계좌 `WITHDRAW`와 도착 계좌 `DEPOSIT` 트랜잭션 2건을 원자적으로 생성한다.
- [ ] `save_unified` 실행 시 생성된 도착 계좌의 `DEPOSIT` 트랜잭션이 직후 실행되는 연속 스냅샷(`_generate_intermediate_snapshots`) 및 당일 스냅샷(`preview`)의 도착 계좌 현금 잔고와 `period_deposit`에 정확히 반영된다.
- [ ] `tests/test_snapshot_engine.py` 등에 단위/통합 테스트가 추가되고 `uv run pytest` 전체 테스트가 통과한다.
