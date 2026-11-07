# 03 — 프론트엔드 상단 다중 입력 시트(연속 행 추가·보조 줄·일괄 등록) 전환

**Spec:** [spec.md](../spec.md)

**What to build:** `TransactionsTab.jsx` 상단의 기존 단건 고정 입력 폼을 **'신규 거래 다중 입력 시트'**로 전면 교체하여, (1) 초기 진입 및 저장 후 기본 1행 자동 준비, (2) `[+ 행 추가]` 버튼 및 마지막 칸(`메모`) `Enter` 입력 시 직전 행의 날짜·계좌를 이어받는 빠른 연속 행 추가, (3) `TRANSFER`/`EXCHANGE` 선택 시 행 하단 보조 설정 줄(`Sub-row`) 확장, (4) 과거 스냅샷 기준일 경고 1회 통합 확인 및 `POST /api/db/transactions/bulk` 원자적 일괄 등록을 완결합니다.

**Blocked by:** `01-backend-bulk-transactions`, `02-frontend-inline-edit-and-columns`

**Status:** resolved

- [x] `src/frontend/src/components/db/TransactionsTab.jsx`에서 기존 상단 단건 입력 폼을 제거하고, 하단 테이블과 동일한 9개 컬럼(`[날짜 | 계좌 | 자산 | 유형 | 수량 | 단가/환율 | 총액 | 메모 | 관리]`)을 가진 **'신규 거래 다중 입력 시트'**(`draftRows` 배열 상태)를 렌더링한다.
- [x] 초기 데이터 로딩 완료 시 및 일괄 등록 완료 후 `draftRows`에 기본 빈 입력 행 1줄이 자동으로 준비되도록 하고, 상단 계좌 필터(`accountFilter`)가 특정 계좌로 선택되어 있으면 새 기본 행의 `account_id`에 해당 계좌를 기본값으로 반영한다.
- [x] 상단 시트의 `[+ 행 추가]` 버튼을 클릭하거나 각 행의 마지막 입력 칸(`메모`)에서 `Enter` 키를 누르면, 직전 행(또는 현재 행)의 `transaction_date`와 `account_id`를 그대로 이어받는 새 입력 행이 `draftRows`에 추가되도록 구현한다 (행 복제 버튼은 두지 않으며, 행 삭제 버튼 클릭 시 행이 2개 이상이면 해당 행을 제거하고 1개뿐이면 값을 초기화한다).
- [x] 다중 입력 시트의 각 행에서도 거래 유형이 `'TRANSFER'`이면 바로 아래에 도착 계좌 선택 보조 줄(`Sub-row`)을, `'EXCHANGE'`이면 바로 아래에 도착 통화 선택 및 환전 계산 요약 보조 줄(`Sub-row`)을 확장 렌더링한다.
- [x] `[일괄 등록 (N건)]` 버튼 클릭 시 `draftRows`의 모든 행 페이로드를 구성하여 `POST /api/db/transactions/bulk`를 호출하되, `draftRows` 중 최신 스냅샷 기준일(`latestSnapshotDate`) 이전 날짜인 행이 1건 이상 존재하면 `PastTransactionWarningModal`을 1회만 표시하고 확인 시 일괄 전송한다.
- [x] `src/frontend/src/components/db/TransactionsTab.test.jsx`의 기존 단건 폼 기준 테스트를 다중 입력 시트 및 인라인 수정 기준으로 갱신하고, (1) 기본 1행 자동 준비, (2) `[+ 행 추가]` 및 메모 칸 `Enter` 입력 시 직전 날짜·계좌 계승 행 추가, (3) 다중 행(`TRANSFER`/`EXCHANGE` 보조 줄 포함) 작성 후 `[일괄 등록]` 클릭 시 `POST /api/db/transactions/bulk` 요청 페이로드 및 과거 날짜 경고 모달 1회 통합 동작을 검증하는 테스트를 통과시킨다.
