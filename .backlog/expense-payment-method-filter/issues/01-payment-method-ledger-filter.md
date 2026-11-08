# 01 — 지출 내역 원장 결제수단별 필터링 API 및 UI 전환 (기관 필터 대체 및 조건부 삭제 연동)

**Spec:** [spec.md](../spec.md)

**What to build:**
백엔드 지출 거래 목록 조회 API(`GET /api/expenses`)에 `payment_method_id` 필터 파라미터를 추가하고, 데스크탑 지출관리 화면(`ExpensesPage.jsx`)의 거래 내역 원장에서 기존 '기관 전체' 드롭다운을 제거하고 상단 소유주 탭(`전체`/`장준`/`성은`)과 연동되는 '결제수단 전체' 드롭다운으로 대체합니다. 또한 소유주 탭 변경 시 선택된 결제수단의 정합성을 유지(불일치 시 자동 초기화)하며, '현재 조건 전체 삭제' 및 '필터 초기화' 버튼이 선택된 결제수단을 기준으로 동작하도록 구현합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 백엔드 `GET /api/expenses` 엔드포인트가 `payment_method_id` 쿼리 파라미터(Optional[int])를 지원하며, 지정 시 해당 결제수단의 지출 내역만 필터링하여 반환한다 (기존 `institution` 파라미터는 하위 호환 유지).
- [ ] `ExpensesPage.jsx`의 거래 내역 원장 필터 영역에서 기존 `'기관 전체'` 드롭다운이 제거되고 `'결제수단 전체'`를 기본값으로 하는 결제수단 선택 드롭다운이 렌더링된다.
- [ ] 결제수단 드롭다운의 옵션은 상단 소유주 탭(`전체`/`장준`/`성은`) 선택에 연동되어 해당 소유주의 결제수단만 표시하며, 옵션 라벨은 별칭(`alias`)을 우선 표시하고 별칭이 없으면 `'소유주 기관명'`으로 표시한다.
- [ ] 결제수단 드롭다운에서 특정 결제수단을 선택하면 첫 페이지 조회(`fetchData`) 및 더보기(`handleLoadMore`) 시 `expenseService.getExpenses`에 `payment_method_id: Number(selectedPaymentMethod)`가 전달된다.
- [ ] 상단 소유주 탭을 변경할 때, 기존에 선택되어 있던 결제수단이 변경된 소유주에 속하지 않으면 결제수단 필터가 자동으로 `'결제수단 전체'('')`로 초기화된다 (`'전체'`로 이동하거나 소유주가 일치할 때는 유지).
- [ ] 결제수단 필터가 선택된 상태에서 `'현재 조건 전체 삭제'` 클릭 시, 확인 팝업 메시지에 선택된 결제수단 표시명이 포함되고 `expenseService.clearExpenses` 호출 시 `payment_method_id`가 전달된다 (기존 `institution` 전달 제거).
- [ ] 결제수단 필터가 선택된 경우 필터 초기화(`RotateCcw`) 버튼이 노출되며, 클릭 시 결제수단 필터도 함께 초기화된다.
- [ ] 백엔드 API 테스트(`tests/test_expense_dashboard_api.py`) 및 프론트엔드 단위 테스트(`src/frontend/src/pages/ExpensesPage.test.jsx`)에 위 동작에 대한 테스트 케이스가 추가되고 모두 통과한다.
