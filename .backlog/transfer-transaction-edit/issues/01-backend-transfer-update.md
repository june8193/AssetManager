# 01 — 백엔드 이체(TRANSFER) 거래 수정 시 이체 쌍(WITHDRAW+DEPOSIT) 생성·갱신·해제 지원

**Spec:** [spec.md](../spec.md)

**What to build:** `PUT /api/db/transactions/{transaction_id}`(`TransactionService.update_transaction`) 호출 시 `target_account_id`를 전달받아, (1) 단건 거래를 `TRANSFER`로 수정하면 출발 계좌 `WITHDRAW` + 도착 계좌 `DEPOSIT` 이체 쌍으로 변환/생성하고, (2) 기존 이체 쌍을 `TRANSFER`로 수정하면 양쪽 계좌(`account_id` / `target_account_id`) 및 금액·일자·메모를 동기화하며, (3) 기존 이체 쌍을 일반 거래 유형으로 변경하면 상대 짝 거래를 자동 삭제하고 단독 거래로 전환합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `src/backend/schemas/transaction.py`의 `TransactionSchema`에 `target_account_id: Optional[int] = None` 필드를 추가하고, `TransactionService.validate_and_extract_transaction_data`의 `exclude` 집합에 `"target_account_id"`를 추가하여 SQLAlchemy `Transaction` 모델 생성/수정 시 알 수 없는 키워드 인자 에러가 발생하지 않도록 한다.
- [ ] `TransactionService.update_transaction`에서 `transaction.type == "TRANSFER"`일 때 `target_account_id`가 없거나 `transaction.account_id == transaction.target_account_id`이면 `ValueError`를 발생시킨다.
- [ ] `db_transaction.transfer_pair_id`가 없는 거래(기존 `type="TRANSFER"` 단일 행 포함)를 `type="TRANSFER"`로 수정하면, 새 `transfer_pair_id`(UUID)를 생성하여 현재 거래를 출발 계좌(`account_id`)의 `WITHDRAW`(`quantity=total_amount, price=1.0`)로 갱신하고, 도착 계좌(`target_account_id`)에 `DEPOSIT`(`quantity=total_amount, price=1.0`) 짝 거래를 신규 생성한다.
- [ ] `db_transaction.transfer_pair_id`가 있는 기존 이체 거래(출금 행 또는 입금 행)를 `type="TRANSFER"`로 수정하면, 쌍을 이루는 두 거래 중 `WITHDRAW` 행의 계좌를 `transaction.account_id`(출발 계좌)로, `DEPOSIT` 행의 계좌를 `transaction.target_account_id`(도착 계좌)로 갱신하고 두 행의 `asset_id`, `transaction_date`, `quantity`(`total_amount`), `price`(`1.0`), `total_amount`, `currency`, `memo`를 동기화한다.
- [ ] `db_transaction.transfer_pair_id`가 있는 기존 이체 거래를 `type != "TRANSFER"`(일반 거래 유형)로 수정하면, 상대방 계좌의 짝 거래를 삭제하고 현재 거래의 `transfer_pair_id`를 `None`으로 해제하여 단독 거래로 저장한다.
- [ ] `tests/test_transaction_service.py`에 위 시나리오(단건➔이체 전환, 기존 이체 도착 계좌 수정, 기존 이체➔일반 거래 전환 시 짝 삭제, 동일 계좌 이체 수정 예외)를 검증하는 테스트를 추가하고 통과시킨다.
