# Spec: 스냅샷 생성 순서 변경 (현금계좌 → 주식계좌) 및 위저드 계좌 이체(TRANSFER) 자동 연동

Status: open

## Problem Statement (문제 정의)

1. **스냅샷 위저드 및 백엔드 저장 순서 역전**:
   - 현재 스냅샷 생성 위저드(`SnapshotWizardPage.jsx`, `useSnapshotWizardEngine.js`)는 **1~2단계(증권/주식계좌) → 3~4단계(은행/현금계좌) → 5단계(최종 확인)** 순서로 진행되며, 백엔드 통합 저장(`SnapshotEngine.save_unified`) 또한 증권계좌를 먼저 처리한 후 은행계좌를 처리합니다.
   - 그러나 실제 개인 자산 관리 워크플로우에서는 급여/현금이 **은행(현금계좌)에서 증권(주식계좌)으로 이체**되므로, 현금계좌의 입출금 및 이체 내역을 먼저 정리한 뒤 주식계좌를 정산하는 것이 자연스럽습니다.
2. **주식계좌 정산 시 예수금 입금 내역 누락**:
   - 현재 스냅샷 위저드의 거래 입력 컴포넌트(`TransactionTable.jsx`)에는 `입금(DEPOSIT)`, `출금(WITHDRAW)`, `이자(INTEREST)`, `수수료(FEE)`, `세금(TAX)`, `현금 보정(CASH_ADJUSTMENT)`만 존재하고 **`이체(TRANSFER)` 유형이 지원되지 않습니다.**
   - 또한 키움증권 자동동기화(`kt00015`)는 매매/배당/환전만 수집하고 은행발 예수금 이체 입금은 수집하지 않습니다.
   - 이로 인해 은행 계좌에서 주식 계좌로 예수금을 이체했음에도 주식 계좌 정산 시 해당 입금 내역이 누락되어, 실제 예수금 잔액과 이론상 잔액 사이에 비정상 차액(`diff_krw` / `CASH_ADJUSTMENT`)이 발생하고 기간 입금액(`period_deposit`)과 기간 수익(`period_profit`)이 왜곡되는 문제가 발생합니다.

## Solution (해결 방안)

1. **스냅샷 위저드 및 통합 저장 순서를 '현금계좌(은행) → 주식계좌(증권)'로 변경**:
   - 위저드 5단계를 **1단계(기본 정보 및 은행 계좌 선택) → 2단계(은행 상세 입력) → 3단계(증권 계좌 선택) → 4단계(증권 상세 입력) → 5단계(최종 확인, 은행→증권 순 표시)**로 재구성합니다.
   - 백엔드 `SnapshotEngine.save_unified`에서도 `_process_bank_accounts`를 먼저 실행한 뒤 `_process_brokerage_accounts`를 실행합니다.
2. **위저드 내 `이체(TRANSFER)` 거래 입력 및 도착 계좌 예수금 입금 자동 연동**:
   - 2단계(은행 상세)와 4단계(증권 상세) 모두에서 신규 거래 추가 시 `이체(TRANSFER)` 유형과 **도착 계좌(`target_account_id`, 본인 계좌를 제외한 전체 활성 은행/증권 계좌)**를 선택할 수 있게 합니다 (원화 `KRW` 기준).
   - 출발 계좌에서 입력한 `TRANSFER` 거래는:
     - **출발 계좌 정산 시**: 출금(`WITHDRAW`)과 동일하게 잔액 차감 및 기간 출금액에 반영됩니다.
     - **도착 계좌 상세 화면(예: 4단계 주식계좌) 진입 시**: 거래 내역 테이블(`TransactionTable.jsx`)에 `'DEPOSIT (이체 연동: {출발계좌명})'` **읽기 전용 행**으로 자동 표시됩니다 (데이터 정합성을 위해 수정/삭제는 출발 계좌에서만 가능).
     - **도착 계좌 정산 계산 시**: 타 계좌에서 현재 계좌로 보낸 `TRANSFER` 내역들이 도착 계좌의 신규 `DEPOSIT`으로 자동 합산되어 `calculate_brokerage` / `calculate_bank`에 전달됨으로써, 예수금 입금 누락 없이 이론 잔액(`theoretical_krw`), 차액(`diff_krw`), 기간 입금액(`period_deposit`)이 정확히 산출됩니다.
     - **위저드 계좌 선택 상태 보존**: 도착 계좌로 지정되더라도 위저드의 계좌 선택 체크박스 상태(`selectedAccountIds`)는 임의로 변경하지 않습니다.
     - **최종 통합 저장(`save_unified`) 시**: 출발 계좌의 `TRANSFER` 거래 1건당 고유 `transfer_pair_id`(UUID)를 공유하는 출발 계좌 `WITHDRAW` + 도착 계좌 `DEPOSIT` 트랜잭션 쌍을 원자적으로 DB에 생성합니다.

## User Stories (사용자 스토리)

1. As an asset manager, I want the Snapshot Wizard to start with Bank (Cash) account selection and settlement in Steps 1–2 before Brokerage (Stock) account selection and settlement in Steps 3–4, so that I can reconcile my cash flows in the natural order cash moves.
2. As an asset manager, I want to add a `TRANSFER` transaction in a Bank (or Brokerage) account step and select any other active account (Brokerage or Bank) as the target account, so that I don't have to manually enter both a withdrawal and a deposit in two separate steps.
3. As an asset manager, I want any `TRANSFER` transaction entered in a source account to automatically appear as a read-only linked deposit row (`이체 입금 (연동됨 - 출발계좌명)`) in the target account's transaction table during the wizard flow, so that I can clearly see the incoming deposit and avoid editing it out of sync.
4. As an asset manager, I want the linked incoming `TRANSFER` deposits to be automatically included when calculating the target Brokerage (or Bank) account's expected balance (`theoretical_krw`), difference (`diff_krw`), and period deposit (`period_deposit`), so that my stock account's cash deposit is never omitted during settlement calculation.
5. As an asset manager, I want the wizard to leave my selected account checkboxes (`selectedAccountIds`) untouched when I choose a transfer target account, so that I retain full manual control over which accounts are included in the wizard steps.
6. As an asset manager, I want the final snapshot save (`save_unified`) to process Bank accounts before Brokerage accounts and persist each `TRANSFER` as an atomic `WITHDRAW` (source) + `DEPOSIT` (target) pair linked by `transfer_pair_id`, so that the ledger and subsequent snapshot calculations remain 100% consistent.

## Implementation Decisions (구현 결정사항)

1. **스키마 확장 (`src/backend/schemas/transaction.py`)**:
   - `TransactionSchema`에 `target_account_id: Optional[int] = None` 필드를 추가합니다 (`type: Literal[..., "TRANSFER"]`는 이미 정의되어 있음).
   - `SnapshotEngine._create_transaction_from_schema`에서 `Transaction` ORM 인스턴스 생성 시 `exclude` 집합에 `"target_account_id"`를 추가합니다.
2. **백엔드 정산 및 영속화 엔진 (`src/backend/services/ledger_engine.py`, `src/backend/services/snapshot_engine.py`)**:
   - `LedgerEngine.replay`: `t_type == "TRANSFER"`인 메모리상 트랜잭션이 전달될 경우(출발 계좌 기준), `WITHDRAW`와 동일하게 현금(`cash_krw`/`cash_usd`)을 차감하고 누적 출금액(`accumulated_withdrawals_krw`)에 가산합니다.
   - `SnapshotEngine.calculate_bank` 및 `SnapshotEngine.calculate_brokerage`: `new_transactions` 내 `tx.type == "TRANSFER"`를 `WITHDRAW`와 동일하게 취급하여 `total_withdraw` 가산 및 `period_deposit` 차감에 반영합니다.
   - `SnapshotEngine._process_bank_accounts` 및 `SnapshotEngine._process_brokerage_accounts`:
     - `tx_schema.type == "TRANSFER"`인 경우:
       - `tx_schema.target_account_id` 필수 여부 및 출발/도착 계좌 동일 여부(`account_id == target_account_id`)를 검증(위반 시 `ValueError`).
       - `transfer_pair_id = str(uuid.uuid4())`를 생성하여 출발 계좌(`acc_req.account_id`)에 `type="WITHDRAW"`, 도착 계좌(`tx_schema.target_account_id`)에 `type="DEPOSIT"`인 `Transaction` 2건을 생성합니다.
   - `SnapshotEngine.save_unified`:
     - 실행 순서를 `self._save_exchange_rate(...)` → `self._process_bank_accounts(...)` → `self._process_brokerage_accounts(...)` → `self.db.flush()` 순서로 변경합니다.
3. **프론트엔드 상태 머신 및 계산기 (`src/frontend/src/hooks/useSnapshotWizardEngine.js`, `src/frontend/src/utils/snapshotCalculator.js`)**:
   - **단계 순서 매핑**:
     - `step === 1`: 기본 정보(기준 일자, 기준 환율) + **은행 계좌(`bankAccounts`) 선택**
     - `step === 2`: **은행 계좌 상세 입력** (`selectedBankIds` 순회, `calculateBankDiff`)
     - `step === 3`: **증권 계좌(`brokerageAccounts`) 선택**
     - `step === 4`: **증권 계좌 상세 입력** (`selectedBrokerageIds` 순회, `calculateAccountDiff`)
     - `step === 5`: **최종 확인** (`Step5FinalConfirm`, 은행 계좌 먼저, 증권 계좌 나중 정렬)
   - **연동 이체 헬퍼 (`getIncomingTransferDeposits`)**:
     - 전체 `accountsFormData`를 순회하며 `otherAccId !== String(targetAccId)`인 계좌의 `newTransactions` 중 `tx.type === 'TRANSFER' && String(tx.target_account_id) === String(targetAccId)`인 항목들을 추출하여 읽기 전용 표시 및 정산 계산용 `DEPOSIT` 트랜잭션 리스트로 변환합니다.
   - **정산 계산 페이로드 조립 (`buildBankCalculatePayload`, `buildBrokerageCalculatePayload`)**:
     - 해당 계좌의 고유 `newTransactions`(`TRANSFER` 포함)와 `getIncomingTransferDeposits`로 추출된 연동 입금(`type: 'DEPOSIT'`)을 합쳐서 백엔드 `/bank/calculate` 및 `/brokerage/calculate`로 전송합니다.
   - **최종 저장 페이로드 조립 (`buildSnapshotPayload`)**:
     - 각 계좌의 고유 `newTransactions`만 전송하되 `target_account_id`를 포함하여 전송합니다 (백엔드에서 `WITHDRAW` + `DEPOSIT` 쌍을 생성하므로 중복 생성 방지).
   - **유효성 검사 (`validateStep2`, `validateStep4`)**:
     - `newTransactions` 중 `type === 'TRANSFER'`이면서 `target_account_id`가 비어 있는 항목이 있으면 확정/다음 진행을 차단하고 안내 메시지를 표시합니다.
4. **프론트엔드 UI 컴포넌트 (`src/frontend/src/components/snapshot/wizard/*`)**:
   - `WizardProgressBar.jsx`: `DEFAULT_STEPS` 라벨을 `1: 기본 정보/은행 선택`, `2: 은행 상세 입력`, `3: 증권 계좌 선택`, `4: 증권 상세 입력`, `5: 최종 확인`으로 변경합니다.
   - `TransactionTable.jsx`:
     - `accounts`(전체 활성 계좌 목록)와 `incomingTransfers`(타 계좌발 이체 입금 목록) prop을 받습니다.
     - 기존 거래 내역 행 바로 아래에 `incomingTransfers`를 파란색/보라색 강조 읽기 전용 행(`DEPOSIT (이체 연동: {출발계좌명})`, 동작: `출발 계좌에서 수정`)으로 렌더링합니다.
     - 신규 거래 행의 유형 `<select>`에 `<option value="TRANSFER">이체</option>`을 추가합니다.
     - `tx.type === 'TRANSFER'`일 때 통화는 `KRW`로 고정하고, `종목` 컬럼에 도착 계좌 선택 `<select>`(`accounts.filter(a => a.is_active && a.id !== accId)`)를 렌더링합니다.

## Testing Decisions (테스트 결정사항)

- **백엔드 테스트 (`tests/test_snapshot_engine.py`, `tests/test_bank_calculate.py`, `tests/test_brokerage_snapshot.py`)**:
  - `calculate_bank` 및 `calculate_brokerage` 호출 시 `TRANSFER` 거래가 출금으로 계산되어 예상 잔액 및 기간 입출금액에 반영되는지 검증.
  - `save_unified` 호출 시 은행 계좌의 `TRANSFER`가 출발 계좌 `WITHDRAW` + 도착 증권 계좌 `DEPOSIT` 쌍(`transfer_pair_id` 공유)으로 생성되고, 도착 증권 계좌의 스냅샷 `period_deposit`과 현금 잔고에 정확히 반영되는지 검증.
- **프론트엔드 단위/통합 테스트 (`src/frontend/src/utils/snapshotCalculator.test.js`, `src/frontend/src/hooks/useSnapshotWizardEngine.test.jsx`, `src/frontend/src/pages/SnapshotWizardPage.test.jsx`, `src/frontend/src/components/snapshot/wizard/WizardStepComponents.test.jsx`)**:
  - 1단계(은행 선택) → 2단계(은행 상세) → 3단계(증권 선택) → 4단계(증권 상세) → 5단계(최종 확인) 네비게이션 및 건너뛰기/이전 이동 검증.
  - 2단계 은행 계좌에서 증권 계좌로 `TRANSFER` 입력 시 4단계 증권 계좌 화면에 읽기 전용 이체 입금 내역이 표시되고, 증권 계좌 `calculateBrokerage` 호출 페이로드에 해당 입금(`DEPOSIT`)이 자동 포함되는지 검증.
- **E2E 브라우저 검증**:
  - `uv run scripts/dev.py` 환경에서 스냅샷 생성 마법사 전 과정을 실행하여 은행 → 증권 이체 연동 및 스냅샷 저장 결과를 검증하고 스크린샷을 기록.

## Out of Scope (범위 제외 사항)

- 키움증권 Open API(`kt00015`) 종합원장 파서에서의 원화 예수금 입출금 자동 수집 (수동 이체 거래와의 중복 적재 방지를 위해 제외).
- 외화(USD) 계좌 간 직접 이체 (위저드 내 계좌 간 이체는 원화 `KRW` 기준으로 처리).

## Further Notes (기타 참고사항)

- 프로젝트 공통 규칙(`GEMINI.md`)에 따라 한국어 주석/문서화, `uv run pytest` 및 Vitest 기반 TDD(Red-Green-Refactor), 격리된 테스트 DB 사용 원칙을 엄격히 준수합니다.
