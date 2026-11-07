# 01 — 증권계좌 스냅샷 실시간 예상 예수금 산출 및 2단 비교 대조 UI 구현

**Spec:** [spec.md](../spec.md)

**What to build:** 스냅샷 생성 위저드 4단계(`Step4BrokerageDetail`) 진입 시 스냅샷 기준일(`inputDate`) 기준 계좌의 기초 원장 예수금(`cash_krw`, `cash_usd`)을 조회하고, 화면에서 입력된 신규 거래(`newTransactions`) 및 타 계좌발 연동 이체 입금(`incomingTransfers`)을 실시간으로 합산한 '현재 계좌 예상 원화/달러'를 좌우 2단 비교 대조형 UI(옵션 C)로 표시합니다. `[동일 적용 →]` 원클릭 복사 버튼과 입력 시 실시간 차액 표시를 통해 사용자가 입력 오타나 거래 누락을 즉시 인지할 수 있게 합니다.

**Blocked by:** None — can start immediately

**Status:** claimed

- [x] 백엔드에 특정 계좌의 기준일(`as_of`) 기준 원장 예수금 잔액을 반환하는 API(`GET /api/db/accounts/{account_id}/cash-balance`, 응답: `cash_krw`, `cash_usd`)를 추가하고 `LedgerEngine.get_positions`와 연동한다 (`tests/test_brokerage_snapshot.py` 검증).
- [x] `src/frontend/src/utils/snapshotCalculator.js`에 기초 예수금(`baseKrw`, `baseUsd`)과 신규 거래(`newTransactions`), 연동 이체 입금(`incomingTransfers`)을 통화별로 실시간 합산하는 순수 함수 `calculateExpectedBrokerageCash`를 구현하고 단위 테스트를 작성한다.
- [x] `snapshotService` 및 `useSnapshotWizardEngine`에서 계좌 상세 진입 시 기초 원장 예수금을 함께 로드하여 위저드 상태(`baseCash` 또는 계좌별 데이터)에 저장한다.
- [x] `Step4BrokerageDetail.jsx`의 예수금 입력 영역을 원화(KRW)/달러(USD) 각각 좌우 2단 비교 대조형 레이아웃(좌측: 현재 계좌 예상 원화/달러 + `[동일 적용 →]` 버튼, 우측: 실제 증권사 예수금 입력창, 하단: 예상 잔액 대비 실시간 차액 안내 배지)으로 개편한다.
- [x] 초기 입력값(`currentKrw`, `currentUsd`)은 기존과 동일하게 `'0'`으로 유지하며, 과도한 차액 경고 색상 구분 없이 일치 여부(`차액 없음`) 또는 실시간 차액 금액(`예상 잔액 대비 차액: +/-OOO원/$OOO`)만 깔끔하게 표시한다 (`WizardStepComponents.test.jsx` 검증).
