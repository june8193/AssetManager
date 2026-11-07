# Spec: 증권계좌 스냅샷 예수금 2단 비교 대조 UI 및 5단계 총 평가액 표시 개선

## Problem Statement (문제 정의)

1. **증권계좌 예수금 수동 입력 시 오타 및 누락 즉시 인지 불가**:
   신규 스냅샷 생성 위저드의 4단계(`Step4BrokerageDetail`)에서는 증권계좌의 현재 원화(KRW) 및 달러(USD) 예수금을 사용자가 직접 타이핑하여 입력합니다. 그러나 현재 화면에는 시스템 원장(DB)과 신규 거래를 반영한 '예상 예수금'이 함께 표시되지 않아, 사용자가 숫자를 입력할 때 자릿수 오타(`0`을 하나 더 입력하거나 덜 입력함)를 내거나 입출금 내역을 누락했더라도 `[정산 결과 계산하기]` 버튼을 누르기 전까지 전혀 인지할 수 없습니다.
2. **5단계(최종 확인) 요약 테이블의 증권계좌 평가액 표기 혼선**:
   5단계(`Step5FinalConfirm`) 요약 표의 우측 끝 컬럼명은 `최종 잔액/평가액`이지만, 은행 계좌는 전체 계좌 잔액(총 평가액)을 표시하는 반면 증권 계좌는 보유 주식 평가액을 제외한 **입력 예수금(원화/달러)만** 표시하고 있어 실제 계좌의 총 자산 평가액으로 오인하기 쉽습니다.

## Solution (해결 방안)

1. **실시간 예상 예수금 산출 및 2단 비교 대조형 입력 UI 제공 (`Step4BrokerageDetail`)**:
   - 스냅샷 기준일(`inputDate`) 기준 계좌의 기존 DB 원장 예수금(`base_cash_krw`, `base_cash_usd`)을 로드하고, 현재 위저드에서 입력한 신규 거래(`newTransactions`) 및 타 계좌발 연동 이체 입금(`incomingTransfers`)을 프론트엔드에서 실시간으로 합산하여 **현재 계좌 예상 원화/달러 예수금**을 산출합니다.
   - 원화(KRW)와 달러(USD) 입력 영역을 각각 **좌우 2단 비교 대조형 레이아웃**으로 구성합니다:
     - **좌측 카드**: `현재 계좌 예상 원화/달러` 금액 표시 및 `[동일 적용 →]` 버튼 배치 (클릭 시 우측 입력창에 해당 금액 즉시 반영).
     - **우측 입력창**: `실제 증권사 원화/달러 예수금 입력` (초기값은 기존대로 `'0'`을 유지하여 사용자의 확인을 유도).
     - **하단 실시간 차액 배지**: 예상 잔액과 실제 입력값의 차액(`실제 입력값 - 예상 잔액`)을 타이핑 즉시 하단에 표시합니다. (별도의 과도한 차액 임계값 경고 색상 구분 없이 차액만 명확히 안내).
2. **5단계(최종 확인) 증권계좌 총 평가액 및 예수금 병기 (`Step5FinalConfirm`)**:
   - 백엔드 증권 정산 계산 응답(`BrokerageCalculateResponse`)에 비현금(주식) 평가액과 예수금을 합산한 계좌 총 평가액(`total_valuation`)을 포함하여 반환합니다.
   - 5단계 요약 테이블의 `최종 잔액/평가액` 컬럼에서 증권계좌 행에 **실제 계좌 총 평가액(원)**을 메인 굵은 글씨로 표시하고, 그 아래 작은 글씨로 `예수금: {원화}원` (달러 보유 시 `· ${달러}`)을 함께 표시합니다.

## User Stories (사용자 스토리)

1. **As a** 스냅샷을 기록하는 사용자, **I want** 4단계 증권 상세 화면에서 기존 DB 원장 잔액과 내가 방금 추가한 신규 거래(및 타 계좌 이체 입금)가 합산된 '현재 계좌 예상 원화/달러 예수금'을 입력창 바로 옆(좌측)에서 나란히 볼 수 있기를 원한다, **so that** 증권사 앱의 실제 예수금과 시스템 예상 예수금을 1:1로 눈으로 대조하며 입력할 수 있다.
2. **As a** 스냅샷을 기록하는 사용자, **I want** 예상 예수금 옆의 `[동일 적용 →]` 버튼을 눌러 예상 금액을 실제 예수금 입력창에 원클릭으로 복사할 수 있기를 원한다, **so that** 배당이나 이자 등 변동이 없는 계좌의 예수금을 일일이 타이핑하지 않고 빠르게 입력할 수 있다.
3. **As a** 스냅샷을 기록하는 사용자, **I want** 실제 예수금 입력창에 숫자를 타이핑하는 즉시 예상 예수금 대비 차액(`+12,400원`, `-$4.50` 또는 `차액 없음`)이 하단에 실시간으로 표시되기를 원한다, **so that** 자릿수 오타를 내거나 거래 내역을 빠뜨렸을 때 정산 계산 버튼을 누르기 전에 즉시 인지하고 수정할 수 있다.
4. **As a** 스냅샷을 최종 검토하는 사용자, **I want** 5단계 최종 확인 테이블의 `최종 잔액/평가액` 컬럼에서 증권계좌의 전체 평가액(주식+예수금 합산)을 메인으로 확인하고 하단 보조 텍스트로 원화/달러 예수금을 함께 볼 수 있기를 원한다, **so that** 은행 계좌와 동일한 기준으로 계좌 총 평가액을 직관적으로 파악할 수 있다.

## Implementation Decisions (구현 결정사항)

### 1. 백엔드 API 및 스키마 계약
- **기초 원장 예수금 조회**:
  - 스냅샷 위저드가 특정 계좌의 기간 내 거래 내역을 로드할 때(`GET /api/db/accounts/{account_id}/transactions/period` 또는 스냅샷 기준일 기준 원장 현금 조회 API `GET /api/db/accounts/{account_id}/cash-balance?as_of={end_date}`), `LedgerEngine.get_positions(db, account_id=account_id, as_of=end_date)`를 통해 산출된 `cash_krw`와 `cash_usd`를 프론트엔드에 제공합니다.
  - 기존 `/api/db/accounts/{account_id}/transactions/period`의 응답 배열 하위 호환성을 깨지 않도록, 전용 경량 엔드포인트 `GET /api/db/accounts/{account_id}/cash-balance` (`as_of: Optional[date] = None` 쿼리 파라미터, 응답: `AccountCashBalanceResponse(cash_krw: float, cash_usd: float)`)를 추가하거나 `snapshotService.fetchAccountWizardData`에서 병렬 호출하여 계좌별 기초 원장 예수금을 상태에 저장합니다.
- **증권 정산 계산 응답 스키마 확장 (`src/backend/schemas/snapshot.py` & `src/backend/services/snapshot_engine.py`)**:
  ```python
  class BrokerageCalculateResponse(BaseModel):
      theoretical_krw: float
      theoretical_usd: float
      diff_krw: float
      diff_usd: float
      total_valuation: float = 0.0  # (current_krw + current_usd * exchange_rate) + non_cash_valuation
      existing_transactions: List[TransactionSchema] = []
      period_deposit: float = 0.0
      period_profit: float = 0.0
      need_last_exchange_rate: bool = False
      last_snapshot_date: Optional[date] = None
      integrity_warnings: List[str] = []
  ```
  - `SnapshotEngine.calculate_brokerage` 내부에서 이미 계산하고 있는 `total_valuation = (req.current_krw + req.current_usd * req.exchange_rate) + non_cash_valuation` 값을 `BrokerageCalculateResponse.total_valuation` 필드에 담아 반환합니다.

### 2. 프론트엔드 순수 계산 유틸리티 (`src/frontend/src/utils/snapshotCalculator.js`)
- **`calculateExpectedBrokerageCash` 순수 함수 추가**:
  - 입력: `{ baseKrw = 0, baseUsd = 0, newTransactions = [], incomingTransfers = [] }`
  - 동작: `baseKrw`, `baseUsd`에 `newTransactions` 및 `incomingTransfers`의 통화별(`KRW` / `USD`) 현금 증감을 합산하여 `{ expectedKrw, expectedUsd }`를 반환합니다.
  - 거래 유형별 부호 규칙 (`calculateCashDifference` 및 `LedgerEngine`과 동일):
    - 가산(`+`): `DEPOSIT`, `INTEREST`, `DIVIDEND`, `CASH_ADJUSTMENT`, `SELL`
    - 차감(`-`): `WITHDRAW`, `TRANSFER`, `TAX`, `FEE`, `BUY`

### 3. 프론트엔드 UI 및 상태 머신 (`useSnapshotWizardEngine.js`, `Step4BrokerageDetail.jsx`, `Step5FinalConfirm.jsx`)
- **초기 입력값 불변식**:
  - 4단계 진입 시 `currentKrw`, `currentUsd` 초기값은 기존과 동일하게 `'0'`으로 유지합니다 (자동 프리필하지 않음).
- **4단계 2단 비교 대조 레이아웃 (`Step4BrokerageDetail.jsx`)**:
  - 원화(KRW) 행과 달러(USD) 행 각각을 2컬럼 그리드(`grid-cols-1 md:grid-cols-2`) 카드로 렌더링합니다.
  - 좌측: `현재 계좌 예상 원화` (또는 `현재 계좌 예상 달러`) 금액 표시 + `[동일 적용 →]` 버튼. 클릭 시 `updateAccData(accId, { currentKrw: String(Math.round(expectedKrw)) })` (달러는 소수점 둘째 자리까지 `String(Number(expectedUsd.toFixed(2)))`) 호출.
  - 우측: 실제 증권사 원화/달러 예수금 입력 `input`.
  - 하단 실시간 차액 표시:
    - `abs(diff) < 0.01`: `✓ 예상 잔액과 일치합니다 (차액 없음)` (초록색 텍스트)
    - `abs(diff) >= 0.01`: `예상 잔액 대비 차액: +12,400원` / `+$4.50` 및 `정산 시 예수금 보정(배당/이자/수수료)으로 처리됩니다` 안내 배지 표시 (과도한 차액 경고 구분 없음).
- **4단계 확정 완료 요약 카드**:
  - 안 1(기존 유지)에 따라 확정 완료 후 나타나는 초록색 요약 카드는 기존 구성을 그대로 유지합니다.
- **5단계 최종 확인 테이블 (`Step5FinalConfirm.jsx`)**:
  - 증권계좌(`BROKERAGE`)의 `최종 잔액/평가액` 셀:
    - `data.calcResult?.total_valuation`이 존재하면 해당 총 평가액(`Math.round(totalValuation).toLocaleString()원`)을 상단 굵은 글씨로 표시하고, 하단에 작은 글씨(`text-xs text-slate-500`)로 `예수금: {krw}원` (달러가 0보다 크면 `· ${usd}$`)을 표시합니다.

## Testing Decisions (테스트 결정사항)

- **백엔드 테스트 심 (`tests/test_brokerage_snapshot.py`)**:
  - `calculate_brokerage_snapshot` 호출 시 비현금 자산(주식) 평가액과 원화/달러 예수금이 합산된 `total_valuation`이 응답에 정확히 포함되는지 검증합니다.
  - 계좌 기준일 원장 예수금 조회 엔드포인트(`GET /api/db/accounts/{account_id}/cash-balance`)가 `INITIAL_BALANCE`, `DEPOSIT`, `BUY` 등을 반영한 정확한 `cash_krw`, `cash_usd`를 반환하는지 검증합니다.
- **프론트엔드 단위/컴포넌트 테스트 심**:
  - `src/frontend/src/utils/snapshotCalculator.test.js` (또는 기존 테스트): `calculateExpectedBrokerageCash`가 기초 예수금 + 신규 입출금 + 연동 이체 입금을 통화별로 정확히 합산하는지 검증합니다.
  - `src/frontend/src/components/snapshot/wizard/WizardStepComponents.test.jsx`:
    - `Step4BrokerageDetail`에서 예상 원화/달러 예수금과 `[동일 적용 →]` 버튼이 렌더링되고, 버튼 클릭 시 `updateAccData`가 예상 금액으로 호출되는지, 입력값과 예상값 차이에 따라 실시간 차액 텍스트가 표시되는지 검증합니다.
    - `Step5FinalConfirm`에서 증권계좌의 총 평가액(`total_valuation`)이 메인으로 표시되고 하단에 예수금 내역이 함께 렌더링되는지 검증합니다.
  - `src/frontend/src/hooks/useSnapshotWizardEngine.test.jsx`:
    - 4단계 진입 시 계좌의 기초 원장 예수금 데이터를 로드하여 상태를 구성하는지 검증합니다.

## Out of Scope (범위 제외 사항)

- 과도한 차액(예: 20% 이상 또는 50만원 이상)에 대한 별도의 빨간색 임계값 경고 배지 (사용자 결정에 따라 단순 실시간 차액 표시만 수행하며, 확정 시의 정합성 체크박스 가드는 기존의 `WizardIntegrityWarningCard`가 그대로 담당함).
- 4단계 정산 확정 완료 후 나타나는 초록색 요약 카드의 레이아웃 변경 (기존 유지).
- 2단계(은행 계좌 상세) UI 변경.
