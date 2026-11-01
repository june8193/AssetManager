# 02 — 프론트엔드 거래 내역 탭(TransactionsTab) 이체 수정 폼 자동 매핑 및 PUT 페이로드 연동

**Spec:** [spec.md](../spec.md)

**What to build:** `TransactionsTab.jsx`에서 이체 거래(`transfer_pair_id` 보유 또는 `type === 'TRANSFER'`)의 수정 버튼 클릭 시 자동으로 `유형 = 이체(TRANSFER)` 폼으로 열고 출발 계좌와 도착 계좌를 채워주며, 저장 시 수정된 `target_account_id`와 이체 금액이 `PUT /api/db/transactions/{id}`로 전송되어 화면 목록에 반영되도록 합니다.

**Blocked by:** `01-backend-transfer-update`

**Status:** resolved

- [x] `src/frontend/src/components/db/TransactionsTab.jsx`의 `handleEdit(tx)`에서 `tx.transfer_pair_id`가 존재하는 경우 `transactions` 목록에서 짝 거래(`pairTx`)를 찾아 `WITHDRAW` 쪽 `account_id`를 출발 계좌(`formData.account_id`), `DEPOSIT` 쪽 `account_id`를 도착 계좌(`formData.target_account_id`), 거래 유형(`formData.type`)을 `'TRANSFER'`로 설정한다.
- [x] `handleEdit(tx)`에서 `tx.transfer_pair_id`가 없더라도 `tx.type === 'TRANSFER'`인 경우 `formData.target_account_id`를 빈 문자열(`''`)로 두지 않고 `findAlternative(accounts, tx.account_id)`를 통해 유효한 기본 도착 계좌 ID로 초기화한다.
- [x] `executeSubmit`에서 수정 모드(`customEditingId` 존재)이면서 `customFormData.type === 'TRANSFER'`인 경우, `PUT` 요청 `payload`에 `target_account_id: parseInt(customFormData.target_account_id)`, `quantity: parseFormattedNumber(customFormData.total_amount)`, `price: 1`, `total_amount: parseFormattedNumber(customFormData.total_amount)`가 포함되도록 구성한다.
- [x] `src/frontend/src/components/db/TransactionsTab.test.jsx`에 (1) 이체 쌍 거래 수정 클릭 시 출발/도착 계좌 및 `TRANSFER` 유형 자동 세팅, (2) 단일 `TRANSFER` 거래 수정 및 도착 계좌 변경 저장 시 `PUT` 요청의 `target_account_id` 전송을 검증하는 단위 테스트를 추가하고 통과시킨다.
