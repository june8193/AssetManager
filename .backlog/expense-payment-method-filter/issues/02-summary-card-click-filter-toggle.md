# 02 — 결제수단별 지출 요약 카드 클릭 시 원장 결제수단 필터 토글 연동

**Spec:** [spec.md](../spec.md)

**What to build:**
데스크탑 지출관리 화면(`ExpensesPage.jsx`) 상단의 '결제수단별 지출 요약'(`stats.payment_method_breakdown`) 카드를 클릭하면 하단 거래 내역 원장의 결제수단 필터가 해당 결제수단(`payment_method_id`)으로 즉시 적용되고, 이미 선택된 카드를 다시 클릭하면 필터가 해제('결제수단 전체')되는 토글 인터랙션 및 선택된 카드의 시각적 활성 스타일을 구현합니다.

**Blocked by:** 01-payment-method-ledger-filter

**Status:** resolved

- [x] 상단 `'결제수단별 지출 요약'` 섹션의 각 카드(`pm.payment_method_id`가 존재하는 항목)를 클릭하면 하단 원장의 결제수단 필터(`selectedPaymentMethod`)가 해당 `payment_method_id`로 설정되고, `expenseService.getExpenses`가 해당 `payment_method_id`로 재호출된다.
- [x] 현재 결제수단 필터로 선택된 요약 카드를 다시 클릭하면 결제수단 필터가 해제(`''`, `'결제수단 전체'`)되고 전체 목록이 재조회된다.
- [x] 현재 필터로 활성화된 요약 카드는 비활성 카드와 구분되는 시각적 강조 스타일(예: 파란색 테두리/링/배경색 강조) 및 클릭 가능한 커서(`cursor-pointer`)가 적용된다.
- [x] 하단 드롭다운에서 직접 결제수단을 변경하거나 필터 초기화 버튼을 눌렀을 때도 상단 요약 카드의 활성 스타일이 동기화되어 반영된다.
- [x] 프론트엔드 단위 테스트(`src/frontend/src/pages/ExpensesPage.test.jsx`)에 요약 카드 클릭 필터 적용 및 재클릭 토글 해제 검증 테스트가 추가되고 통과한다.
