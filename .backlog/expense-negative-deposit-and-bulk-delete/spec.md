# 계좌 입금 음수 지출 반영 및 거래 일괄 삭제 기능 사양서 (Expense Bank Deposit Negative Amount & Bulk Delete Spec)

Status: ready-for-agent

## Problem Statement

현재 AssetManager의 지출 관리 시스템은 다음과 같은 사용자 불편과 기능적 한계를 가지고 있습니다:

1. **계좌 입금 거래의 왜곡된 지출 합산**:
   - 사용자가 친구들과의 모임 등에서 카드로 결제(예: 60,000원 결제) 후, 친구들에게 더치페이 금액(예: 각 20,000원씩 총 40,000원)을 계좌로 송금받는 상황이 빈번합니다.
   - 현재 은행 명세서 파서(`kakaobank`, `kbbank`, `shinhanbank`)는 입금 내역도 절댓값(`abs()`)으로 변환하여 양수(+) 지출로 등록합니다.
   - 이로 인해 실제 본인 부담금액은 20,000원이지만, 카드 결제액 60,000원에 계좌 입금액 40,000원까지 가산되어 총 100,000원의 과다 지출로 통계가 심각하게 왜곡됩니다.
   
2. **업로드 미리보기 화면에서 입출금 구분 가독성 부족**:
   - 명세서 업로드 미리보기 모달에서 거래 구분 뱃지가 모두 동일하거나 단조로운 회색 톤(`bg-slate-700/50`)으로 표시되어, 어떤 거래가 출금(지출)이고 어떤 거래가 입금(상계/환급)인지 직관적으로 구분하기 어렵습니다.

3. **거래 내역 일괄 삭제 기능 부재**:
   - 현재 지출 관리 화면에서는 각 행의 휴지통 아이콘을 클릭하여 1건씩 삭제하는 기능만 제공됩니다.
   - 특정 월의 명세서를 잘못 올렸거나(예: 9월 카카오뱅크 명세서), 수십~수백 건의 거래를 한 번에 정리하려 할 때 1건씩 반복 삭제해야 하는 매우 큰 비효율이 존재합니다.

## Solution

1. **계좌 입금 거래의 음수(-) 지출 변환 및 카테고리 누적액 차감**:
   - 은행 파서(`kakaobank`, `kbbank`, `shinhanbank`)에서 원본 거래 구분이 '입금'인 경우 금액을 음수(`-amount`)로 생성합니다.
   - 업로드 미리보기 및 DB 등록 시 음수 금액이 그대로 반영되며, 당월 총 지출액(`period_total`) 및 지정된 해당 카테고리(예: `식비/카페`)의 누적 금액에서 직접 차감(상계) 집계됩니다.
   - 음수 지출 거래라도 통계 반영 대상인 경우 유효한 카테고리 지정이 필요하다는 정합성 규칙을 유지합니다.

2. **명세서 업로드 미리보기 UI의 입금/출금 뱃지 및 금액 색상 구분**:
   - **입금**: 에메랄드/녹색 계열 뱃지(`bg-emerald-500/20 text-emerald-300 border border-emerald-500/30`) 및 녹색 텍스트(예: `-20,000원`)로 눈에 띄게 강조합니다.
   - **출금/일시불/할부**: 차분한 블루/슬레이트 계열 뱃지(`bg-blue-500/10 text-blue-300 border border-blue-500/20`)와 기본 텍스트 색상을 적용합니다.
   - 미리보기 상단의 '통계 반영' 합계 금액도 음수 입금액이 자연스럽게 상계된 순 지출 합계로 실시간 집계됩니다.

3. **지출 관리 화면의 다중 선택 삭제 및 필터 조건별 전체 삭제 기능 신설**:
   - **백엔드 API**:
     - `POST /api/expenses/bulk-delete`: 전달받은 지출 ID 리스트(`{ ids: [1, 2, 3] }`)를 한 번의 트랜잭션으로 일괄 삭제.
     - `DELETE /api/expenses/clear`: 현재 필터 조건(지정 연월 `year_month`, 특정 결제수단 `payment_method_id` 또는 `institution`)에 속한 거래 전체를 일괄 삭제.
   - **프론트엔드 UI**:
     - 지출 관리 테이블의 각 행에 개별 다중 선택 체크박스 컬럼 제공 (기존 `통계 제외` 체크박스와는 완전히 분리된 별도 체크박스).
     - 테이블 헤더에 전체 선택/해제 마스터 체크박스 제공.
     - 항목 선택 시 상단에 플로팅 액션바 노출: `"{N}개 선택됨" | "선택 항목 일괄 삭제"`.
     - 필터 바 영역에 `"현재 조건(월/기관) 전체 삭제"` 버튼 및 안전한 확인 팝업(`window.confirm` 등) 제공.

## User Stories

1. As a user, I want bank statement deposit transactions to be parsed as negative expense amounts, so that money received from friends (split bills) or refunds automatically offsets my monthly total expense.
2. As a user, I want to assign an expense category (such as '식비/카페') to a negative deposit transaction, so that the accumulated spending in that specific category is properly deducted.
3. As a user, I want the system to require category assignment for included negative deposit transactions just like normal expenses, so that all active transactions remain categorized.
4. As a user, I want deposit transactions in the upload preview modal to have distinct emerald/green badges, so that I can immediately distinguish incoming money from outgoing spending.
5. As a user, I want negative deposit amounts in the preview modal to be formatted clearly with minus signs and distinct colors, so that I have visual confirmation of expense deduction.
6. As a user, I want the upload preview modal's summary metrics (total included amount) to accurately subtract negative deposit amounts, so that I can preview the net spend before committing.
7. As a user, I want multi-select checkboxes on the desktop expenses management table, so that I can select multiple unwanted transactions at once.
8. As a user, I want a select-all checkbox in the table header, so that I can quickly select all visible transactions on the current page.
9. As a user, I want a floating batch action bar showing the number of selected items and a 'Delete Selected' button, so that I can remove multiple transactions with a single click.
10. As a user, I want a 'Clear Filtered / Clear Month' button, so that I can wipe all transactions for a specific payment method or month (e.g., September KakaoBank) when an erroneous statement was uploaded.
11. As a user, I want a confirmation dialog before deleting multiple transactions, so that I do not accidentally delete important financial records.
12. As a user, I want the dashboard summary cards and monthly trend charts to immediately recalculate after bulk deletion, so that the displayed figures always reflect the current ledger state.

## Implementation Decisions

### 1. 백엔드 은행 파서 모듈 변경
- **대상 파서**: 카카오뱅크(`kakaobank.py`), 국민은행(`kbbank.py`), 신한은행(`shinhanbank.py`).
- **금액 부호 로직**:
  - `original_type`이 '입금'인 경우 `amount` 필드에 음수 값(`-amount_val`)을 부여합니다.
  - `original_type`이 '출금'인 경우 기존대로 양수 값(`amount_val`)을 유지합니다.
  - 현대카드 파서는 카드 매출전표 특성상 기존 양수(취소표는 기존 취소 로직)를 유지합니다.

### 2. 백엔드 API 계약 확장
- **`POST /api/expenses/bulk-delete` 엔드포인트 신설**:
  - Request Body: `{ "ids": [int, ...] }`
  - Response: `{ "status": "success", "deleted_count": int }`
  - 트랜잭션 내에서 전달된 ID 목록을 `db.query(Expense).filter(Expense.id.in_(payload.ids)).delete()`로 일괄 삭제 후 커밋.
- **`DELETE /api/expenses/clear` 엔드포인트 신설**:
  - Query Parameters: `year_month: str`, `payment_method_id: Optional[int]`, `institution: Optional[str]`, `owner: Optional[str]`
  - Response: `{ "status": "success", "deleted_count": int }`
  - 지정된 조건에 부합하는 거래 내역을 일괄 삭제.

### 3. 프론트엔드 모달 UI 변경 (`ExpenseUploadModal.jsx`)
- 테이블 행의 `구분` 컬럼 렌더링:
  - `tx.original_type === '입금'`인 경우: `bg-emerald-500/20 text-emerald-300 border border-emerald-500/30` 뱃지 적용.
  - 기타('출금', '일시불' 등): `bg-blue-500/10 text-blue-300 border border-blue-500/20` 뱃지 적용.
- 금액 표시:
  - 음수인 경우 `-15,000원` 형태 및 `text-emerald-400 font-bold` 스타일 적용.
- 상단 요약 배너:
  - `includedAmount` 집계 시 음수 금액이 가감되어 순 지출액으로 정확히 합산되도록 처리.

### 4. 프론트엔드 지출관리 페이지 변경 (`ExpensesPage.jsx`, `expenseService.js`)
- `expenseService.js`:
  - `bulkDeleteExpenses(ids: number[])`: `POST /api/expenses/bulk-delete` 호출.
  - `clearExpenses(params: object)`: `DELETE /api/expenses/clear` 호출.
- `ExpensesPage.jsx`:
  - `selectedIds` (Set/Array) 상태 관리.
  - 테이블 헤더에 '선택' 체크박스 (전체 선택/해제).
  - 각 행 첫 번째 컬럼에 개별 선택 체크박스 추가.
  - 1개 이상 선택 시 하단 또는 테이블 상단에 플로팅 액션 바 노출 (`{selectedIds.length}개 선택됨`, `선택 삭제` 버튼).
  - 테이블 상단 필터/작업 영역에 `현재 조건 전체 삭제` 버튼 제공.
  - 삭제 완료 후 목록 재조회 및 지출 요약 통계(`stats`) 자동 갱신.

## Testing Decisions

### 1. 테스트 원칙 및 품질 기준
- **외부 동작(Behavior) 중심 검증**: 파서의 입금 추출 결과 부호, API를 통한 일괄 삭제 성공 여부 및 DB 반영 건수 등 계약과 동작 위주로 검증합니다.
- **데이터베이스 격리**: 인메모리 테스트 DB 세션을 활용하여 실제 운영 및 개발 DB와 철저히 분리된 상태에서 검증합니다.

### 2. 테스트 영역 및 Seams
1. **은행 파서 단위 테스트 (`tests/test_expense_parser.py`)**:
   - 카카오뱅크, 국민은행, 신한은행 파서에서 입금 거래 파싱 시 `amount`가 음수로 반환되는지 검증.
   - 출금 거래는 기존대로 양수로 반환되는지 검증.
2. **업로드 및 커밋 통합 테스트 (`tests/test_expense_upload_flow.py`)**:
   - 음수 금액을 가진 입금 거래가 포함된 명세서의 미리보기 및 확정 적재(커밋) 정상 동작 검증.
   - 음수 거래의 카테고리 지정 및 미분류 검증 통과 여부 확인.
3. **일괄 삭제 API 단위/통합 테스트 (`tests/test_expenses.py` 또는 `tests/test_expense_bulk_delete.py`)**:
   - `POST /api/expenses/bulk-delete`: 복수 ID 전달 시 원자적 삭제 및 삭제 건수 반환 검증.
   - `DELETE /api/expenses/clear`: 특정 월/결제수단 조건 전달 시 해당 데이터만 정확히 삭제되는지 검증.
4. **프론트엔드 컴포넌트 단위 테스트 (`ExpenseUploadModal.test.jsx`, `ExpensesPage.test.jsx`)**:
   - `ExpenseUploadModal`: 입금/출금 뱃지 클래스 분기 및 음수 금액 포맷팅 렌더링 검증.
   - `ExpensesPage`: 체크박스 선택 시 일괄 삭제 바 노출 및 일괄 삭제 서비스 호출 검증.

## Out of Scope

- 계좌 입금 거래를 지출 차감이 아닌 '순수 수입(월급 등)' 독립 장부로 분리 관리하는 기능 (현재는 지출 관리 모니터링 시스템 내 상계 처리에 집중).
- 모바일 화면에서의 명세서 업로드 및 복잡한 일괄 편집 (모바일 페이지는 단순 조회/삭제 유지).

## Further Notes

- 사용자가 언급한 9월 카카오뱅크 내역은 본 일괄 삭제 API 및 UI가 완성된 후 웹 화면에서 버튼 한 번으로 손쉽게 전체 정리할 수 있게 됩니다.
- 기존 지출 통계 집계 쿼리는 `func.coalesce(func.sum(Expense.amount), 0.0)`를 사용하고 있으므로, 음수 금액이 DB에 적재되면 카테고리별/월별 합계에서 별도의 쿼리 수정 없이도 자연스럽게 차감(상계) 계산됩니다.
