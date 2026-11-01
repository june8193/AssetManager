# 03 — 위저드 내 계좌 이체(TRANSFER) 입력 UI 및 도착 계좌(주식계좌 등) 예수금 입금 자동 연동

**Spec:** [spec.md](../spec.md)

**What to build:** 위저드 2단계(은행 상세) 및 4단계(증권 상세)의 거래 테이블에서 `이체(TRANSFER)` 및 도착 계좌 선택을 지원하고, 도착 계좌 화면에 읽기 전용 이체 입금 내역을 자동 표시하며, 도착 계좌 정산 계산(`calculateAccountDiff`/`calculateBankDiff`) 시 해당 입금액을 자동 반영하고 최종 저장 및 E2E 브라우저 검증까지 완료하는 기능.

**Blocked by:** `02-wizard-bank-first-step-order`

**Status:** closed

- [x] `TransactionTable.jsx`의 신규 거래 유형 선택에 `이체 (TRANSFER)` 옵션이 추가되고(2단계 은행 및 4단계 증권 모두 지원), 선택 시 본인 계좌를 제외한 전체 활성 계좌(은행 + 증권) 중 도착 계좌(`target_account_id`)를 선택할 수 있는 드롭다운이 표시된다.
- [x] 출발 계좌에서 입력한 `TRANSFER` 거래가 있을 때, 도착 계좌의 위저드 선택 여부(`selectedAccountIds`)는 변경되지 않는다.
- [x] 도착 계좌 상세 화면(예: 4단계 증권 계좌)의 `TransactionTable.jsx`에 출발 계좌에서 입력한 이체 내역이 `'DEPOSIT (이체 연동: {출발계좌명})'` 읽기 전용 행으로 표시되며, 도착 계좌에서는 수정/삭제할 수 없다.
- [x] 도착 계좌에서 `정산 결과 계산하기`(`calculateAccountDiff` 또는 `calculateBankDiff`) 실행 시, 타 계좌에서 현재 계좌로 보낸 `TRANSFER` 내역들이 신규 `DEPOSIT`으로 계산 요청 페이로드에 자동 합산되어 예수금 이론 잔액(`theoretical_krw`), 차액(`diff_krw`), 기간 입금액(`period_deposit`)에 즉시 반영된다.
- [x] `TRANSFER` 거래에서 도착 계좌(`target_account_id`)가 선택되지 않은 경우 계좌 정산 계산 또는 확정 시 유효성 검사 안내 메시지를 표시한다.
- [x] 최종 저장(`buildSnapshotPayload`) 시 출발 계좌의 `new_transactions`에 `type: 'TRANSFER'`와 `target_account_id`가 포함되어 백엔드 `save_unified`로 전달되며, 읽기 전용 연동 행은 중복 전송되지 않는다.
- [x] 프론트엔드 단위/통합 테스트 추가 및 통과 후, 개발 서버(`uv run scripts/dev.py`)와 내장 브라우저를 이용한 E2E 테스트(은행 → 증권 이체 입력 후 증권 계좌 정산 및 스냅샷 저장) 및 스크린샷 검증을 완료한다.
