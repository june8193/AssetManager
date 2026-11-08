# Spec: 지출관리 결제수단별 필터링 전환 및 요약 카드 인터랙션 (Expense Payment Method Filtering)

Status: resolved

## Problem Statement (문제 정의)

현재 지출관리 화면(`ExpensesPage.jsx`)의 '거래 내역 원장'은 카테고리와 금융기관(`institution`, 예: '현대카드', '카카오뱅크') 단위로만 필터링을 지원하고 있습니다. 그러나 사용자는 동일한 금융기관 내에서도 용도나 소유주에 따라 여러 결제수단(예: `장준 현대카드`, `장준 카카오뱅크 생활비`, `장준 카카오뱅크 모임통장` 등)을 구분하여 등록·관리하고 있으며, 상단 대시보드 역시 '결제수단별 지출 요약' 카드를 통해 개별 결제수단 단위로 지출을 보여주고 있습니다.

이로 인해 다음과 같은 불편이 발생합니다:
1. **필터 기준 불일치**: 상단 요약 카드는 '결제수단' 단위인데 하단 원장 필터는 '기관' 단위여서, 특정 결제수단(카드/계좌)만의 상세 거래 내역을 정확히 조회하거나 대조하기 어렵습니다.
2. **조건부 일괄 삭제의 정밀도 부족**: '현재 조건 전체 삭제' 실행 시 기관(`institution`) 기준으로만 조건이 전달되어, 동일 기관의 다른 결제수단 내역까지 함께 삭제될 위험이 있거나 원하는 결제수단만 골라 정리하기 불편합니다.
3. **요약 카드와 원장 간의 단절**: 상단 '결제수단별 지출 요약' 카드에서 특정 카드의 지출 금액을 확인한 후, 그 내역을 보려면 하단 원장 필터를 별도로 조작해야 합니다.

## Solution (해결 방안)

1. **'기관 전체' 필터를 삭제하고 '결제수단 전체' 필터로 완전 대체**:
   - 백엔드 `GET /api/expenses` API에 `payment_method_id` 쿼리 파라미터 필터를 추가합니다 (하위 호환성을 위해 기존 `institution` 파라미터도 백엔드에서는 유지).
   - 프론트엔드 거래 내역 원장 툴바에서 기존 금융기관 드롭다운(`selectedInstitution`, `institutionOptions`)을 제거하고, 결제수단 드롭다운(`selectedPaymentMethod`)으로 대체합니다.
2. **상단 소유주 탭(`전체`/`장준`/`성은`)과 결제수단 필터 옵션 연동**:
   - 상단 소유주 탭 선택에 따라 드롭다운에 노출되는 결제수단 목록을 해당 소유주의 결제수단으로 필터링합니다.
   - 옵션 표시명은 결제수단의 별칭(`alias`)을 우선 표시하고, 별칭이 없는 경우 `${owner} ${institution}` 형태로 표시합니다.
   - 소유주 탭 전환 시, 현재 선택된 결제수단이 변경된 소유주에 속하지 않으면 결제수단 필터를 자동으로 `'결제수단 전체'('')`로 초기화합니다 (소유주가 일치하거나 `'전체'`로 전환할 때는 선택 유지).
3. **'현재 조건 전체 삭제' 기능의 결제수단 기준 연동**:
   - 우측 상단 '현재 조건 전체 삭제' 클릭 시 기존 `institution` 대신 선택된 `payment_method_id`를 `DELETE /api/expenses/clear` API로 전달합니다.
   - 삭제 확인 대화상자(`window.confirm`)의 조건 설명 문구에 선택된 결제수단의 표시명(예: `[2026-09월 / 장준 / 장준 현대카드]`)을 명확히 노출합니다.
4. **상단 '결제수단별 지출 요약' 카드 클릭 토글 필터링**:
   - 상단 요약 카드를 클릭하면 하단 원장의 결제수단 필터가 해당 카드의 `payment_method_id`로 즉시 적용됩니다.
   - 이미 선택된 요약 카드를 다시 클릭하면 결제수단 필터가 해제(`''`)됩니다.
   - 현재 필터로 선택된 요약 카드에는 시각적 활성 스타일(예: 파란색 테두리/배경 링 강조)을 표시하여 어떤 결제수단이 필터링 중인지 직관적으로 보여줍니다.

## User Stories (사용자 스토리)

1. As a user, I want to filter the expense ledger by a specific payment method instead of an institution, so that I can inspect transactions for an exact card or bank account (e.g., '장준 현대카드', '장준 카카오뱅크 생활비').
2. As a user, I want the payment method filter dropdown options to only show payment methods belonging to the currently selected owner tab ('전체', '장준', '성은'), so that I don't have to scroll through irrelevant payment methods.
3. As a user, I want each payment method option in the dropdown to display its alias (or `'소유주 기관명'` if no alias is set), so that the names match the summary cards at the top of the page.
4. As a user, I want the selected payment method filter to automatically reset to '결제수단 전체' when I switch to an owner tab that does not own the currently selected payment method, so that I don't end up with an invalid empty filter state.
5. As a user, I want the selected payment method filter to be preserved when switching from '전체' to the matching owner tab (or from an owner tab to '전체'), so that my filtering context is maintained seamlessly.
6. As a user, I want the '현재 조건 전체 삭제' button to delete transactions based on the currently selected payment method (and display its name in the confirmation prompt), so that I can safely wipe a specific card/account's monthly statement without affecting other accounts at the same bank.
7. As a user, I want to click on a card in the '결제수단별 지출 요약' section to immediately filter the transaction ledger by that payment method (and click again to clear the filter), so that I can quickly drill down into a payment method's transactions.

## Implementation Decisions (구현 결정사항)

### 1. 백엔드 API 확장 (`src/backend/routers/expenses.py`)
- **`GET /api/expenses` (`get_expenses`)**:
  - 쿼리 파라미터 추가: `payment_method_id: Optional[int] = Query(None, description="결제수단 ID 필터")`
  - 필터링 로직:
    ```python
    if payment_method_id is not None:
        query = query.filter(Expense.payment_method_id == payment_method_id)
    ```
  - 기존 `institution: Optional[str]` 파라미터는 외부 호출이나 레거시 호환을 위해 남겨두되, 프론트엔드에서는 `payment_method_id`를 사용합니다.
- **`DELETE /api/expenses/clear` (`clear_expenses`)**:
  - 이미 `payment_method_id: Optional[int] = Query(None, description="결제수단 ID 필터")`가 구현되어 있으므로 별도 백엔드 스키마 변경 없이 프론트엔드 호출 파라미터만 연동합니다.

### 2. 프론트엔드 서비스 계층 (`src/frontend/src/services/expenseService.js`)
- `getExpenses(params)` JSDoc 주석에 `payment_method_id` 파라미터 명세를 반영합니다.

### 3. 프론트엔드 상태 및 필터 로직 (`src/frontend/src/pages/ExpensesPage.jsx`)
- **상태 교체**:
  - `const [selectedInstitution, setSelectedInstitution] = useState('');` 제거
  - `const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');` 추가 (문자열화된 결제수단 ID 또는 빈 문자열 `''`)
- **결제수단 표시명 헬퍼 및 필터 옵션 (`filteredPaymentMethods`)**:
  - 결제수단 표시명 규칙: `const getPaymentMethodLabel = (pm) => pm.alias || `${pm.owner} ${pm.institution}`;`
  - 소유주 연동 옵션 목록:
    ```javascript
    const filteredPaymentMethods = useMemo(() => {
      if (!selectedOwner || selectedOwner === '전체') return paymentMethods;
      return paymentMethods.filter((pm) => pm.owner === selectedOwner);
    }, [paymentMethods, selectedOwner]);
    ```
- **소유주 변경 시 결제수단 필터 정합성 유지**:
  - `selectedOwner`가 `'전체'`가 아닐 때, 현재 `selectedPaymentMethod`에 해당하는 결제수단의 `owner`가 `selectedOwner`와 다르면 `selectedPaymentMethod`를 `''`로 초기화합니다.
- **조회 및 더보기 API 파라미터 연동 (`fetchData`, `handleLoadMore`)**:
  - `if (selectedPaymentMethod) expenseParams.payment_method_id = Number(selectedPaymentMethod);`
- **필터 초기화 버튼 (`RotateCcw`)**:
  - 노출 조건 및 클릭 핸들러에서 `selectedInstitution`을 `selectedPaymentMethod`로 교체합니다.
- **조건부 전체 삭제 (`handleClearFiltered`)**:
  - 선택된 결제수단 객체 조회: `const matchedPm = paymentMethods.find((pm) => String(pm.id) === String(selectedPaymentMethod));`
  - `conditionDesc` 배열에 `matchedPm ? getPaymentMethodLabel(matchedPm) : ''` 반영.
  - `clearParams`에 `if (selectedPaymentMethod) clearParams.payment_method_id = Number(selectedPaymentMethod);` 전달.

### 4. 상단 '결제수단별 지출 요약' 카드 클릭 연동 (`src/frontend/src/pages/ExpensesPage.jsx`)
- `stats.payment_method_breakdown`의 각 카드(`pm`) 렌더링 시:
  - `pm.payment_method_id`가 존재하는 카드에 클릭 이벤트(`onClick`) 및 `cursor-pointer` 스타일 부여.
  - 클릭 시 `String(selectedPaymentMethod) === String(pm.payment_method_id)`이면 `setSelectedPaymentMethod('')`로 해제, 아니면 `setSelectedPaymentMethod(String(pm.payment_method_id))`로 선택.
  - 선택된 카드는 `border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30` 등의 활성 스타일로 시각적 피드백을 제공합니다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 내부 상태 변수명이 아닌 사용자 관점의 드롭다운 렌더링, 옵션 필터링, API 호출 파라미터(`payment_method_id`), 요약 카드 클릭 토글, 조건부 삭제 확인 팝업 문구를 검증합니다.
- **핵심 테스트 심(Test Seam) 및 기존 패턴**:
  1. **백엔드 통합 테스트 (`tests/test_expense_dashboard_api.py`)**:
     - FastAPI `TestClient`와 인메모리 SQLite 세션을 사용하여 `GET /api/expenses?payment_method_id={id}` 호출 시 해당 결제수단의 거래만 정확히 반환되는지 검증합니다.
  2. **프론트엔드 컴포넌트 단위 테스트 (`src/frontend/src/pages/ExpensesPage.test.jsx`)**:
     - Vitest + React Testing Library 기반으로 `expenseService`를 모킹하여 검증합니다:
       - 기존 `'기관 전체'` 옵션이 사라지고 `'결제수단 전체'` 및 결제수단 별칭 옵션들이 표시되는지 확인.
       - 결제수단 드롭다운 변경 시 `expenseService.getExpenses`가 `payment_method_id: <number>`와 함께 호출되는지 확인.
       - 소유주 탭(`장준` -> `성은`) 전환 시 드롭다운 옵션 목록이 필터링되고, 타 소유주의 결제수단 선택 상태가 자동 초기화되는지 확인.
       - 결제수단 선택 후 `'현재 조건 전체 삭제'` 클릭 시 확인 문구에 결제수단 별칭이 포함되고 `expenseService.clearExpenses`에 `payment_method_id`가 전달되는지 확인.
       - 상단 `'결제수단별 지출 요약'` 카드 클릭 시 해당 결제수단으로 필터가 적용되고 재클릭 시 해제되는지 확인.

## Out of Scope (범위 제외 사항)

- 모바일 지출 페이지(`MobileExpensesPage.jsx`)의 원장 필터 툴바 신설 (현재 모바일 화면은 간소화된 뷰로 원장 상세 필터 바가 없으므로 데스크탑 `ExpensesPage.jsx`를 대상으로 함).
- 대시보드 상단 통계(`GET /api/expenses/stats`) 자체를 특정 결제수단 하나로 필터링하는 기능 (상단 요약 카드 및 차트는 해당 기간/소유주의 전체 지출 비중을 보여주며, 결제수단 필터는 하단 '거래 내역 원장' 조회 및 조건부 삭제에 적용됨).
- DB 스키마 변경 (이미 `expenses.payment_method_id` 컬럼과 외래키가 존재하므로 마이그레이션 불필요).
