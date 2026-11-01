# Spec: 계좌 이체(TRANSFER) 거래 내역 수정 및 도착 계좌 연동

## Problem Statement (문제 정의)

`DB 관리 > 마스터 관리 > 거래 내역`([`TransactionsTab.jsx`](file:///c:/localrepo/AssetManager/src/frontend/src/components/db/TransactionsTab.jsx))에서 기존 거래 내역을 `TRANSFER`(계좌 이체) 유형으로 수정하거나, 이미 등록된 이체 거래의 도착 계좌를 수정할 때 변경 사항이 정상적으로 반영되지 않습니다.

구체적인 원인은 다음과 같습니다:
1. **데이터 모델 구조와 단건 수정 로직의 불일치**: 시스템의 [`Transaction`](file:///c:/localrepo/AssetManager/src/backend/models.py) 모델은 `target_account_id` 컬럼을 두지 않고, 동일한 `transfer_pair_id`(UUID)를 공유하는 **출발 계좌(`WITHDRAW`) + 도착 계좌(`DEPOSIT`) 2건의 쌍(Pair)**으로 이체를 표현합니다. 그러나 단건 수정 API(`PUT /api/db/transactions/{id}`)는 단일 행만 수정하며 이체 쌍 생성·갱신·해제를 처리하지 않습니다.
2. **백엔드 스키마 및 서비스 누락**: [`TransactionSchema`](file:///c:/localrepo/AssetManager/src/backend/schemas/transaction.py)에 `target_account_id` 필드가 없어 프론트엔드가 보낸 도착 계좌 ID가 Pydantic 검증 시 유실되며, [`TransactionService.update_transaction`](file:///c:/localrepo/AssetManager/src/backend/services/transaction_service.py)에서도 상대 거래의 계좌(`account_id`) 변경이나 단일 거래의 이체 쌍 전환을 수행하지 않습니다. 이로 인해 일반 거래를 `TRANSFER`로 수정하면 `transfer_pair_id = null`, `type = "TRANSFER"`인 고립된 단일 행이 생성되어 원장 엔진([`LedgerEngine`](file:///c:/localrepo/AssetManager/src/backend/services/ledger_engine.py)) 예수금 계산에서도 누락됩니다.
3. **프론트엔드 수정 폼 상태 초기화 결함**: [`TransactionsTab.jsx`](file:///c:/localrepo/AssetManager/src/frontend/src/components/db/TransactionsTab.jsx)의 `handleEdit`이 수정 진입 시 `target_account_id`를 무조건 빈 문자열(`''`)로 초기화하고, 기존 이체 쌍(`transfer_pair_id` 존재)의 출발/도착 계좌를 폼에 매핑하지 않습니다.

## Solution (해결 방안)

SQLite DB 테이블 스키마 변경(마이그레이션) 없이 기존의 **`transfer_pair_id` 기반 2행(`WITHDRAW` + `DEPOSIT`) 원장 구조**를 그대로 유지하면서, 백엔드 수정 서비스와 프론트엔드 수정 폼이 이체 쌍의 생성·갱신·해제를 원자적으로 처리하도록 개선합니다.

1. **백엔드 이체 수정 지원**:
   - `TransactionSchema`에 선택적 요청 필드 `target_account_id: Optional[int] = None`을 추가합니다.
   - `TransactionService.update_transaction`에서:
     - 일반 거래(또는 `transfer_pair_id=null, type='TRANSFER'`인 단일 행)를 `TRANSFER`로 수정 시: 출발 계좌의 `WITHDRAW` 행으로 변환하고 도착 계좌(`target_account_id`)의 `DEPOSIT` 짝 거래를 신규 생성하여 새 `transfer_pair_id`로 묶습니다.
     - 기존 이체 쌍(`transfer_pair_id` 존재)을 `TRANSFER`로 수정 시: 출금(`WITHDRAW`) 행과 입금(`DEPOSIT`) 행의 출발/도착 계좌(`account_id`), 금액, 일자, 자산, 통화, 메모를 함께 갱신합니다.
     - 기존 이체 쌍(`transfer_pair_id` 존재)을 일반 거래(`type != 'TRANSFER'`)로 수정 시: 상대방 계좌의 짝 거래를 자동 삭제하고 현재 거래의 `transfer_pair_id`를 `None`으로 해제하여 단독 거래로 전환합니다.
2. **프론트엔드 이체 수정 UI/UX 개선**:
   - 이체 거래(`transfer_pair_id` 존재)의 출금 행이든 입금 행이든 '수정' 버튼 클릭 시 자동으로 유형을 `TRANSFER`로 열고, `WITHDRAW` 쪽 계좌를 출발 계좌(`account_id`), `DEPOSIT` 쪽 계좌를 도착 계좌(`target_account_id`)로 자동 세팅합니다.
   - `type === 'TRANSFER'`이면서 `transfer_pair_id`가 없는 단일 행 수정 시에도 기본 대체 계좌를 `target_account_id`에 세팅하여 빈 값 전송을 방지합니다.
   - 수정(`PUT`) 제출 시 `TRANSFER` 유형이면 `target_account_id`, `quantity = total_amount`, `price = 1`을 페이로드에 명시적으로 담아 전송합니다.

## User Stories (사용자 스토리)

1. As a 사용자, I want 일반 거래(또는 `transfer_pair_id`가 없는 `TRANSFER` 단일 거래)를 수정하여 유형을 `이체(TRANSFER)`로 지정하고 도착 계좌를 선택해 저장할 수 있기를 원한다, so that 출발 계좌(`WITHDRAW`)와 도착 계좌(`DEPOSIT`)가 `transfer_pair_id`로 묶인 정상 이체 쌍으로 변환되고 원장 잔고에 정확히 반영된다.
2. As a 사용자, I want 이미 등록된 이체 거래(`transfer_pair_id`가 있는 출금 또는 입금 행)의 수정 버튼을 눌렀을 때 폼이 자동으로 `이체(TRANSFER)` 모드로 열리고 기존 출발 계좌와 도착 계좌가 채워지기를 원한다, so that 출발/도착 계좌나 이체 금액·날짜를 직관적으로 확인하고 수정할 수 있다.
3. As a 사용자, I want 기존 이체 거래 수정 시 출발 계좌나 도착 계좌를 변경하여 저장하면 연동된 `WITHDRAW` 행과 `DEPOSIT` 행의 계좌 및 금액·날짜·메모가 동시에 갱신되기를 원한다, so that 두 계좌 간 이체 정합성이 깨지지 않는다.
4. As a 사용자, I want 기존 이체 거래를 수정하여 일반 거래 유형(`WITHDRAW`, `DEPOSIT` 등)으로 변경 저장할 수 있기를 원한다, so that 상대방 계좌의 짝 거래가 자동 삭제되고 현재 거래 1건만 단독 거래로 남는다.
5. As a 사용자, I want 이체 수정 시 출발 계좌와 도착 계좌를 동일하게 지정하거나 도착 계좌를 누락했을 때 명확한 검증 에러(400/422)로 차단되기를 원한다, so that 잘못된 동일 계좌 이체 데이터가 생성되지 않는다.

## Implementation Decisions (구현 결정사항)

### 1. 백엔드 스키마 (`src/backend/schemas/transaction.py`)
- `TransactionSchema`에 `target_account_id: Optional[int] = None` 필드를 추가합니다.
- `Transaction` SQLAlchemy 모델에는 `target_account_id` 컬럼이 없으므로, `TransactionService.validate_and_extract_transaction_data`의 `model_dump(exclude=...)` 대상에 `"target_account_id"`를 추가합니다.

### 2. 백엔드 서비스 상태 전이 규칙 (`src/backend/services/transaction_service.py`)
`TransactionService.update_transaction(transaction_id: int, transaction: TransactionSchema)`의 전이 규칙:

| 기존 거래 상태 (`db_transaction`) | 수정 요청 유형 (`transaction.type`) | 처리 동작 (State Transition) |
| :--- | :--- | :--- |
| **단독 거래** (`transfer_pair_id is None`, 기존 `type="TRANSFER"` 단일 행 포함) | `"TRANSFER"` | 1. `target_account_id` 필수 및 `account_id != target_account_id` 검증<br>2. 신규 `pair_id = str(uuid.uuid4())` 발급<br>3. `db_transaction`을 출발 계좌(`account_id`)의 `type="WITHDRAW"`, `quantity=total_amount`, `price=1.0`, `transfer_pair_id=pair_id`로 갱신<br>4. 도착 계좌(`target_account_id`)의 `type="DEPOSIT"`, `quantity=total_amount`, `price=1.0`, `transfer_pair_id=pair_id` 신규 `Transaction` 생성 및 추가 |
| **이체 쌍 거래** (`transfer_pair_id is not None`) | `"TRANSFER"` | 1. `target_account_id` 필수 및 `account_id != target_account_id` 검증<br>2. 동일 `transfer_pair_id`를 가진 상대 거래 조회<br>3. `WITHDRAW` 역할 행은 `account_id = transaction.account_id`(출발 계좌), `DEPOSIT` 역할 행은 `account_id = transaction.target_account_id`(도착 계좌)로 설정하고 두 행 모두 `asset_id`, `transaction_date`, `quantity=total_amount`, `price=1.0`, `total_amount`, `currency`, `memo` 동기화 (상대 행이 유실된 경우 신규 생성하여 보완) |
| **이체 쌍 거래** (`transfer_pair_id is not None`) | `"TRANSFER"` 외 일반 유형 (`"DEPOSIT"`, `"WITHDRAW"` 등) | 1. 동일 `transfer_pair_id`를 가진 상대방 짝 거래(`Transaction.id != db_transaction.id`)를 DB에서 삭제<br>2. `db_transaction.transfer_pair_id = None`으로 해제하고 요청 필드로 단독 갱신 |
| **단독 거래** (`transfer_pair_id is None`) | `"TRANSFER"` 외 일반 유형 | 기존 단건 수정 로직과 동일하게 `db_transaction` 필드 갱신 |

- 라우터(`src/backend/routers/transactions.py`)의 `PUT /api/db/transactions/{transaction_id}`는 `ValueError` 발생 시 `"동일할 수 없습니다"`는 400(또는 422), `"찾을 수 없습니다"`는 404, 그 외는 422를 반환합니다.

### 3. 프론트엔드 수정 폼 (`src/frontend/src/components/db/TransactionsTab.jsx`)
- **`handleEdit(tx)`**:
  - `tx.transfer_pair_id`가 존재하는 경우: `transactions` 배열에서 `t.transfer_pair_id === tx.transfer_pair_id && t.id !== tx.id`인 `pairTx`를 찾습니다.
    - `tx.type === 'DEPOSIT'`이고 `pairTx`가 존재하면: 출발 계좌 `account_id = pairTx.account_id`, 도착 계좌 `target_account_id = tx.account_id`.
    - 그 외(`tx.type === 'WITHDRAW'` 등): 출발 계좌 `account_id = tx.account_id`, 도착 계좌 `target_account_id = pairTx ? pairTx.account_id : (findAlternative(accounts, tx.account_id)?.id || '')`.
    - `type = 'TRANSFER'`로 설정합니다.
  - `tx.transfer_pair_id`가 없지만 `tx.type === 'TRANSFER'`인 경우:
    - `account_id = tx.account_id`, `target_account_id = findAlternative(accounts, tx.account_id)?.id || ''`, `type = 'TRANSFER'`로 설정합니다.
- **`executeSubmit(customFormData, customEditingId)`**:
  - `customEditingId`가 있는 수정(`PUT`) 요청 시 `isTransfer`(`customFormData.type === 'TRANSFER'`)이면:
    - `account_id: parseInt(customFormData.account_id)`
    - `target_account_id: customFormData.target_account_id ? parseInt(customFormData.target_account_id) : null`
    - `quantity: parseFormattedNumber(customFormData.total_amount)`
    - `price: 1`
    - `total_amount: parseFormattedNumber(customFormData.total_amount)`
    를 `payload`에 담아 전송합니다.

## Testing Decisions (테스트 결정사항)

- **백엔드 테스트 심 (`tests/test_transaction_service.py`, `tests/test_db_manage.py`)**:
  - 단건 거래(`WITHDRAW` 및 `type="TRANSFER", transfer_pair_id=None`)를 `type="TRANSFER", target_account_id=acc2.id`로 수정 시 `WITHDRAW` + `DEPOSIT` 2건의 이체 쌍이 생성되고 `transfer_pair_id`가 일치하는지 검증.
  - 기존 이체 쌍(`transfer_pair_id` 보유)에서 도착 계좌(`target_account_id`) 및 금액을 수정했을 때 상대 `DEPOSIT` 거래의 `account_id`와 금액이 함께 변경되는지 검증.
  - 기존 이체 쌍(`transfer_pair_id` 보유)을 일반 `WITHDRAW`로 유형 변경 수정했을 때 상대방 짝 거래가 삭제되고 `transfer_pair_id`가 `None`이 되는지 검증.
  - 출발 계좌와 도착 계좌가 동일할 때 `ValueError`가 발생하는지 검증.
- **프론트엔드 테스트 심 (`src/frontend/src/components/db/TransactionsTab.test.jsx`)**:
  - 이체 쌍 거래(`transfer_pair_id` 존재)의 수정 버튼 클릭 시 폼이 `TRANSFER` 유형으로 열리고 출발 계좌와 도착 계좌 드롭다운 값이 올바르게 채워지는지 검증.
  - 도착 계좌 변경 후 '저장' 클릭 시 `PUT /api/db/transactions/{id}` 요청 바디에 변경된 `target_account_id`가 포함되어 전송되는지 검증.

## Out of Scope (범위 제외 사항)

- SQLite `transactions` 테이블의 컬럼 추가/삭제 등 DB 스키마 마이그레이션.
- 스냅샷 위저드(`Step2BrokerageDetail`, `Step4BankDetail`) 내 인라인 신규 거래 테이블에서의 계좌 이체 생성/수정 UI 추가.
