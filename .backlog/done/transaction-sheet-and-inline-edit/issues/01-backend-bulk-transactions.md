# 01 — 백엔드 다중 거래 원자적 일괄 등록(Bulk Create) API 및 서비스 구현

**Spec:** [spec.md](../spec.md)

**What to build:** 일반 거래(`BUY`, `SELL`, `DEPOSIT`, `WITHDRAW` 등), 환전(`EXCHANGE`), 계좌 이체(`TRANSFER` ➔ 출금+입금 쌍 생성)가 혼합된 다중 거래 배열을 받아 단일 DB 트랜잭션(All-or-Nothing)으로 검증 및 일괄 생성하는 `POST /api/db/transactions/bulk` 엔드포인트와 `TransactionService.create_transactions_bulk` 메서드를 구현합니다.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `src/backend/schemas/transaction.py`에 `transactions: List[TransactionSchema]` 필드를 가지는 `BulkTransactionCreateRequest` 스키마를 정의하고 `src/backend/schemas/__init__.py`에 export한다.
- [x] `src/backend/services/transaction_service.py`의 `TransactionService`에 `create_transactions_bulk(self, items: List[TransactionSchema]) -> List[Transaction]` 메서드를 구현한다:
  - 빈 리스트인 경우 `ValueError("등록할 거래 내역이 없습니다.")`를 발생시킨다.
  - 각 항목이 `type == "TRANSFER"`이면 `target_account_id` 필수 및 출발/도착 계좌 상이 여부를 검증한 뒤 `transfer_pair_id`(UUID)로 묶인 `WITHDRAW`(출발 계좌) + `DEPOSIT`(도착 계좌) 2건의 `Transaction` 인스턴스를 준비한다.
  - 각 항목이 일반 거래 또는 `EXCHANGE`이면 `validate_and_extract_transaction_data`로 검증한 뒤 `Transaction` 인스턴스를 준비한다.
  - 모든 항목의 검증 및 `self.db.add` 준비가 완료된 후 단 1회 `self.db.commit()`을 수행하여 일부 항목 실패 시 앞선 항목도 저장되지 않도록 원자성(All-or-Nothing)을 보장한다.
- [x] `src/backend/routers/transactions.py`에 `POST /api/db/transactions/bulk` (`response_model=List[TransactionSchema]`) 라우터를 추가하고, `ValueError` 발생 시 기존 규칙(`"동일할 수 없습니다"` ➔ 400, `"찾을 수 없습니다"` ➔ 404, 그 외 ➔ 422)에 맞게 `HTTPException`으로 변환한다.
- [x] `tests/test_transaction_service.py`에 (1) 일반 거래 + 환전 + 이체가 혼합된 다중 거래 일괄 생성 성공 테스트와 (2) 다중 항목 중 마지막 항목 검증 실패 시 전체 트랜잭션이 롤백되어 DB에 0건만 남는지 검증하는 테스트를 추가하고 `uv run pytest`를 통과시킨다.
