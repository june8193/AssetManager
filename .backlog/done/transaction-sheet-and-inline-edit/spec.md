# Spec: 거래내역 다중 입력 시트 및 제자리(In-line) 수정 UI/UX 개선

## Problem Statement (문제 정의)

`DB 관리 > 마스터 관리 > 거래 내역`([`TransactionsTab.jsx`](file:///c:/localrepo/AssetManager/src/frontend/src/components/db/TransactionsTab.jsx))에서 거래 내역을 입력하고 수정할 때 다음과 같은 심각한 사용자 경험(UX) 불편함이 존재합니다:

1. **다중 거래 연속 입력의 불편함**: 상단 입력 영역이 1건 단위 고정 폼 구조로 되어 있어, 여러 건의 거래 내역을 한 번에 입력할 때 매번 필드를 채우고 제출 버튼을 누르는 과정을 반복해야 합니다. 엑셀이나 구글 스프레드시트처럼 여러 행을 빠르게 이어서 입력하고 한 번에 일괄 등록할 수 없습니다.
2. **기존 거래 단건 수정 시 과도한 상하 스크롤 왕복**: 하단 거래 내역 목록에서 특정 거래(특히 목록 아래쪽에 위치한 거래)를 수정하려면 해당 행의 `[수정]` 버튼을 클릭한 뒤 페이지 최상단 고정 입력 폼까지 스크롤해 올라가 값을 고치고 `[저장]`을 누른 뒤, 다시 아래로 스크롤해 결과를 확인해야 합니다.
3. **상·하단 정보 구조 불일치 및 메모 표시 누락**: DB 스키마([`TransactionSchema`](file:///c:/localrepo/AssetManager/src/backend/schemas/transaction.py))에는 `memo` 필드가 존재하지만 현재 `TransactionsTab.jsx`의 입력 폼과 조회 테이블 모두 `메모` 컬럼을 표시·편집하지 않으며, 자산 표시 방식도 입력 폼(`티커 (자산명)` 통합)과 조회 표(`티커` 열 / `자산명` 열 분리)가 서로 다릅니다.

## Solution (해결 방안)

상단 고정 단건 폼을 제거하고 **방식 B (이원화 그리드: 상단 '신규 거래 다중 입력 시트' + 하단 '등록된 거래 내역 표 제자리 인라인 수정')** 구조로 전면 개편합니다.

1. **상·하단 컬럼 1:1 통일**:
   - 상단 다중 입력 시트와 하단 거래 내역 표 모두 `[날짜 | 계좌 | 자산(티커·이름) | 유형 | 수량 | 단가/환율 | 총액 | 메모 | 관리]`의 9개 컬럼 구조로 통일합니다.
2. **상단 '신규 거래 다중 입력 시트' 및 빠른 연속 입력**:
   - 화면 진입 시(그리고 일괄 등록 완료 후) **기본 빈 입력 행 1줄이 자동으로 준비**되어 즉시 타이핑을 시작할 수 있습니다.
   - `[+ 행 추가]` 버튼을 누르거나 각 행의 마지막 입력 칸(`메모`)에서 `Enter` 키를 누르면 **직전 행의 날짜(`transaction_date`)와 계좌(`account_id`)를 자동으로 이어받는 새 입력 행**이 아래에 추가됩니다 (행 복제 버튼은 두지 않음).
   - `[일괄 등록 (N건)]` 클릭 시 백엔드 Bulk API(`POST /api/db/transactions/bulk`)를 호출하여 모든 행이 유효할 때만 **단일 DB 트랜잭션(All-or-Nothing)**으로 한 번에 저장합니다.
   - 다중 입력 행 중 최신 스냅샷 기준일(`latestSnapshotDate`) 이전 날짜가 1건이라도 포함되면 [`PastTransactionWarningModal`](file:///c:/localrepo/AssetManager/src/frontend/src/components/db/PastTransactionWarningModal.jsx)을 **1회 통합 표시**하고 확인 시 일괄 저장합니다.
3. **이체(`TRANSFER`) 및 환전(`EXCHANGE`) 선택 시 행 하단 보조 줄(`Sub-row`) 확장 (옵션 2)**:
   - 기본 행의 셀 너비와 레이아웃은 일반 거래와 100% 동일하게 유지합니다.
   - 거래 유형이 `TRANSFER`(이체)인 경우: 해당 행 바로 아래에 보라색 톤의 얇은 보조 설정 줄(`↳ [이체 상세 설정] 도착 계좌 선택`)이 열리며, 기본 행에서는 수량/단가 대신 이체 금액(`총액`)만 입력받아 수량=총액, 단가=1로 자동 동기화합니다.
   - 거래 유형이 `EXCHANGE`(환전)인 경우: 해당 행 바로 아래에 초록색 톤의 얇은 보조 설정 줄(`↳ [환전 상세 설정] 수령할 도착 통화 선택` + `수량 × 환율 = 총 지불금액` 계산 안내)이 열립니다.
   - 이 보조 줄(`Sub-row`) 확장 패턴은 상단 다중 입력 시트와 하단 인라인 수정 행 모두에 동일하게 적용됩니다.
4. **하단 거래 내역 표 단건 즉시 제자리(In-line) 수정**:
   - 하단 표에서 `[수정]` 버튼 클릭 또는 **행 더블클릭** 시 상단으로 스크롤할 필요 없이 **해당 행 그 자리에서 즉시 편집 가능한 입력 행(+ 이체/환전 시 보조 설정 줄)으로 전환**됩니다.
   - 한 번에 1개 행만 수정 모드로 열리며, 해당 행에서 `Enter`(또는 `[저장]` 버튼 클릭) 시 `PUT /api/db/transactions/{id}`를 호출해 즉시 반영하고, `Esc`(또는 `[취소]` 버튼 클릭) 시 원래 행으로 복구합니다.

## User Stories (사용자 스토리)

1. As a 사용자, I want 거래 내역 탭 진입 시 상단 다중 입력 시트에 기본 입력 행 1줄이 바로 열려 있기를 원한다, so that 별도 버튼을 누르지 않고도 즉시 첫 거래 입력을 시작할 수 있다.
2. As a 사용자, I want 상단 다중 입력 시트에서 `[+ 행 추가]` 버튼을 누르거나 마지막 칸(`메모`)에서 `Enter`를 치면 직전 행의 날짜와 계좌가 자동으로 채워진 새 행이 추가되기를 원한다, so that 같은 날/같은 계좌의 여러 거래를 엑셀처럼 빠르게 연속 입력할 수 있다.
3. As a 사용자, I want 다중 입력 시트나 인라인 수정 행에서 거래 유형을 `이체(TRANSFER)` 또는 `환전(EXCHANGE)`으로 변경했을 때 행 바로 아래에 보조 설정 줄(`Sub-row`)이 열려 도착 계좌나 도착 통화를 선택할 수 있기를 원한다, so that 기본 테이블 컬럼 너비를 해치지 않으면서도 이체와 환전 정보를 명확히 입력할 수 있다.
4. As a 사용자, I want 상단 다중 입력 시트에 작성한 여러 건(일반 거래, 이체, 환전 혼합 가능)을 `[일괄 등록 (N건)]` 버튼 하나로 원자적(All-or-Nothing)으로 한 번에 저장하기를 원한다, so that 일부 행만 부분 저장되어 데이터가 꼬이는 일 없이 안전하게 일괄 등록할 수 있다.
5. As a 사용자, I want 다중 입력 시트의 여러 행 중 최신 스냅샷 기준일 이전 날짜가 1건 이상 포함된 경우 과거 거래 경고 모달이 1번만 표시되고 확인 시 전체가 일괄 등록되기를 원한다, so that 행마다 경고 창을 반복해서 닫는 불편함 없이 스냅샷 정합성 경고를 확인할 수 있다.
6. As a 사용자, I want 하단 거래 내역 표에서 어떤 위치(맨 아래 포함)의 거래든 `[수정]` 버튼을 누르거나 행을 더블클릭하면 화면 스크롤 이동 없이 그 행 자리에서 바로 입력 칸으로 바뀌고 `Enter`(`저장`) 또는 `Esc`(`취소`)로 즉시 수정/취소할 수 있기를 원한다, so that 화면 위아래를 왔다 갔다 하는 불편함 없이 직관적으로 1건 수정을 끝낼 수 있다.
7. As a 사용자, I want 상단 다중 입력 시트와 하단 거래 내역 표 모두에서 `자산(티커·자산명)`과 `메모` 컬럼을 일관되게 조회하고 편집할 수 있기를 원한다, so that 거래 메모를 누락 없이 기록·확인하고 상·하단 표를 한눈에 대조할 수 있다.

## Implementation Decisions (구현 결정사항)

### 1. 백엔드 스키마 및 Bulk API (`src/backend/schemas/transaction.py`, `src/backend/routers/transactions.py`)
- **`BulkTransactionCreateRequest` 스키마 추가**:
  ```python
  class BulkTransactionCreateRequest(BaseModel):
      """다중 거래 내역 일괄 생성 요청 스키마입니다."""
      transactions: List[TransactionSchema]
  ```
- **`POST /api/db/transactions/bulk` 엔드포인트 추가**:
  - 요청 본문: `BulkTransactionCreateRequest` (`transactions: List[TransactionSchema]`)
  - 응답 본문: `List[TransactionSchema]` (생성된 모든 거래 레코드 목록; `TRANSFER`는 생성된 출금+입금 2건 모두 포함)
  - 에러 처리: 빈 배열 전송 시 422, 동일 계좌 이체 시 400, 계좌/자산 미존재 시 404, 기타 검증 실패 시 422 반환.

### 2. 백엔드 다중 생성 서비스 (`src/backend/services/transaction_service.py`)
- **`TransactionService.create_transactions_bulk(items: List[TransactionSchema]) -> List[Transaction]`**:
  - `items`가 비어 있으면 `ValueError("등록할 거래 내역이 없습니다.")` 발생.
  - 루프를 돌며 각 항목(`item`)을 검증하고 인스턴스를 준비하되, **루프 중간에는 `self.db.commit()`을 호출하지 않고 모든 항목 검증 및 `self.db.add()`가 끝난 뒤 마지막에 단 1회 `self.db.commit()`**을 수행하여 **All-or-Nothing 원자성**을 보장합니다.
  - 항목별 분기:
    - `item.type == "TRANSFER"`:
      - `item.target_account_id` 필수 검증 및 `item.account_id != item.target_account_id` 검증.
      - 자산 조회 후 `transfer_pair_id = str(uuid.uuid4())`를 생성하여 출발 계좌(`account_id`)의 `WITHDRAW` 거래와 도착 계좌(`target_account_id`)의 `DEPOSIT` 거래(`quantity=item.total_amount, price=1.0, total_amount=item.total_amount`) 2건을 세션에 추가.
    - `item.type != "TRANSFER"` (일반 거래 및 `EXCHANGE`):
      - 기존 `validate_and_extract_transaction_data(item)`로 유효성(환전 시 도착 현금자산 검증 등) 검사 후 `Transaction(**data)` 인스턴스를 세션에 추가.
  - 단일 `commit()` 후 생성된 모든 `Transaction` 인스턴스를 `refresh`하고 `check_past_snapshot_warning` 경고를 설정하여 반환합니다.

### 3. 프론트엔드 상·하단 통일 컬럼 및 상태 설계 (`src/frontend/src/components/db/TransactionsTab.jsx`)
- **통일된 9개 테이블 컬럼**:
  1. `날짜` (`transaction_date`)
  2. `계좌` (`account_id` / 읽기 전용 시 이체 상대 계좌 화살표 병기)
  3. `자산` (`asset_id`: 편집 시 `TICKER (자산명)` 드롭다운, 읽기 전용 시 티커 굵게 + 자산명 병기, 환전 시 `출발 ➔ 도착` 표시)
  4. `유형` (`type`)
  5. `수량` (`quantity`: 이체 시 `-` 비활성화)
  6. `단가/환율` (`price`: 현금 일반 거래 시 `1` 읽기전용, 이체 시 `-` 비활성화, 환전 시 적용 환율)
  7. `총액` (`total_amount`: 수량×단가 자동 계산, 환전 시 읽기전용, 이체 시 직접 입력)
  8. `메모` (`memo`: 텍스트 입력 / 읽기 전용 시 메모 텍스트 또는 `-`)
  9. `관리` (상단 시트: 행 삭제 버튼 `Trash2` — 단 1행만 남았을 때는 값 초기화; 하단 표: 읽기 모드 `[수정]`/`[삭제]`, 인라인 편집 모드 `[저장]`/`[취소]`)
- **특수 거래(`TRANSFER`, `EXCHANGE`) 하단 보조 설정 줄 (`Sub-row`)**:
  - 상단 시트 행 또는 하단 인라인 수정 행에서 `row.type === 'TRANSFER'`이면 바로 아래 `<tr className="bg-purple-50/70 ..."><td colSpan={9}>` 보조 줄을 렌더링하여 **도착 계좌(`target_account_id`) 선택 드롭다운**을 표시합니다.
  - `row.type === 'EXCHANGE'`이면 바로 아래 `<tr className="bg-emerald-50/70 ..."><td colSpan={9}>` 보조 줄을 렌더링하여 **수령할 도착 통화(`target_asset_id`) 선택 드롭다운**과 환전 계산 요약(`수량 × 환율 = 총 지불금액`)을 표시합니다.
- **상단 다중 입력 시트 (`draftRows` 배열 상태)**:
  - 각 행은 고유 `tempId`를 가집니다.
  - 초기 데이터 로드 완료 시 기본 1행이 자동 생성됩니다 (상단 `accountFilter !== 'all'`이면 해당 계좌를 기본 계좌로 사용).
  - `handleAddDraftRow(baseRow)`: 마지막 행(또는 `Enter`를 누른 기준 행)의 `transaction_date`, `account_id`를 복제하고 기본 자산/유형/수량(0)/금액(0)/메모('')로 초기화된 새 행을 `draftRows`에 추가합니다.
  - 각 행의 `메모` `<input>`에서 `onKeyDown`으로 `e.key === 'Enter'` 감지 시 `e.preventDefault()` 후 새 행을 추가합니다.
  - `[일괄 등록 (N건)]` 클릭 시:
    - `draftRows` 중 과거 스냅샷 기준일(`isPastDate(row.transaction_date, latestSnapshotDate)`)에 해당하는 행이 하나라도 있으면 `pendingPastAction` 모달을 1회 띄우고(가장 이른 과거 날짜 또는 건수 표시), 확인 시 `POST /api/db/transactions/bulk`로 일괄 전송합니다.
    - 저장 성공 시 목록(`fetchData()`)을 갱신하고 `draftRows`를 기본 빈 1행으로 리셋합니다.
- **하단 테이블 단건 제자리 인라인 수정 (`editingId` & `editFormData` 상태)**:
  - 하단 테이블의 일반 `<tr>`을 더블클릭(`onDoubleClick`)하거나 우측 `[수정]` 버튼 클릭 시 `editingId = tx.id`로 설정하고 해당 행 위치에 즉시 입력 컨트롤 행(+ 이체/환전 시 보조 줄)을 렌더링합니다 (페이지 스크롤 이동 없음).
  - 인라인 편집 행 내부 입력 요소에서 `Enter` 입력 시 즉시 수정 저장(`handleInlineSave`), `Esc` 입력 시 즉시 수정 취소(`handleInlineCancel`)를 수행합니다.
  - 수정 저장 시 대상 거래의 변경 전/후 날짜 중 하나라도 `latestSnapshotDate` 이전이면 기존과 동일하게 `PastTransactionWarningModal`을 거쳐 `PUT /api/db/transactions/{editingId}`를 호출합니다.

## Testing Decisions (테스트 결정사항)

- **백엔드 테스트 심 (`tests/test_transaction_service.py`)**:
  - `test_create_transactions_bulk_mixed_success`: 일반 거래(`BUY`/`DEPOSIT`), 환전(`EXCHANGE`), 계좌 이체(`TRANSFER`)가 섞인 다중 요청을 `create_transactions_bulk`(및 `POST /api/db/transactions/bulk`)로 호출했을 때 모든 거래(이체 쌍 2건 포함)가 정상 생성되는지 검증.
  - `test_create_transactions_bulk_atomic_rollback`: 3건 중 마지막 1건에 유효성 오류(예: 동일 계좌 이체 또는 환전 도착 자산 누락)가 있을 때 앞선 2건도 DB에 저장되지 않고 전체 롤백(All-or-Nothing)되는지 검증.
- **프론트엔드 테스트 심 (`src/frontend/src/components/db/TransactionsTab.test.jsx`)**:
  - 초기 렌더링 시 상단 다중 입력 시트에 기본 1행이 존재하고, `[+ 행 추가]` 및 메모 칸 `Enter` 입력 시 직전 행의 날짜·계좌를 이어받은 새 행이 추가되는지 검증.
  - 다중 입력 시트 및 인라인 수정 행에서 `TRANSFER` 선택 시 도착 계좌 보조 줄(`Sub-row`)이, `EXCHANGE` 선택 시 도착 자산 보조 줄(`Sub-row`)이 렌더링되는지 검증.
  - `[일괄 등록]` 클릭 시 `POST /api/db/transactions/bulk`가 호출되고, 과거 날짜 포함 시 경고 모달이 1회 표시되는지 검증.
  - 하단 테이블에서 `[수정]` 클릭(또는 행 더블클릭) 시 해당 행이 인라인 편집 모드로 전환되고 `PUT /api/db/transactions/{id}`로 저장 및 `Esc`/취소 버튼으로 복구되는지 검증.

## Out of Scope (범위 제외 사항)

- SQLite `transactions` 테이블 스키마 변경(Alembic 마이그레이션 불필요).
- 엑셀 클립보드(TSV) 붙여넣기(`Ctrl+V`) 파서 및 행 복제 버튼.
- 스냅샷 위저드(`src/frontend/src/components/snapshot/wizard/TransactionTable.jsx`) 내 거래 테이블 UI 변경.
