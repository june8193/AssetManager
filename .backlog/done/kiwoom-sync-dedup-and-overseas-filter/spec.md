# Feature Spec: 키움증권 동기화 환전 중복 방지 및 해외주식 0달러 적재 필터링

Status: resolved

## Problem Statement

키움증권 거래내역 동기화(`/sync`) 실행 시 다음과 같은 두 가지 심각한 데이터 정합성 문제가 발생합니다:

1. **환전 거래 누락 (일자 무시 중복 오인)**:
   키움증권 종합거래내역(`kt00015`)에서 발급되는 거래번호(`trde_no`)는 전역 고유값이 아니라 당일 기준 일련번호(예: `000000002`)입니다. 환전 거래 저장 시 거래일자(`transaction_date`) 조건을 검사하지 않고 계좌 ID와 거래번호만으로 중복을 검사함에 따라, 과거 다른 날짜에 동일한 일련번호로 저장된 환전 거래가 있으면 신규 환전 거래가 기존 거래로 오인되어 조용히 저장이 생략(스킵)됩니다. 이로 인해 2026-09-10에 정상 처리된 원화주문 외화매수 내역이 시스템에 반영되지 못했습니다.

2. **해외주식 0달러 매수 이중 적재**:
   종합거래내역(`kt00015`) 원장에 해외주식 매수 내역이 포함되어 내려올 때, 외화 결제 대상이라 원화 거래금액(`trde_amt`)이 0으로 표기됩니다. 소급 매매 파서가 이를 국내 주식 매매와 동일하게 취급하여 거래금액을 수량으로 나누는 과정에서 단가 0달러, 총액 0달러 매수 거래를 생성합니다. 또한 종합원장의 식별자와 미국주식 체결내역 API(`ust21510`)의 주문/체결번호 체계가 달라, 0달러 매수 건과 정상 달러 매수 건이 각각 별개 거래로 이중 저장됩니다.

## Solution

1. **종합원장 수집 항목 식별자 고유화 및 일자 결합 중복 검증**
   - 종합거래내역(`kt00015`) 원장에서 수집되는 모든 거래(환전, 배당금, 배당세 등)의 외부 식별자(`external_id`)를 `거래일자_거래번호`(예: `YYYYMMDD_000000002`) 형식으로 결합하여 생성함으로써 일자 간 번호 충돌을 원천 차단합니다.
   - DB 적재 시 중복 검사 쿼리에 반드시 거래일자(`transaction_date`) 조건을 필수로 포함하여 계좌, 거래유형, 거래일자, 식별자가 모두 일치할 때만 중복으로 판정합니다.

2. **종합원장 소급 주식 매매 파싱 범위 한정**
   - 종합거래내역(`kt00015`)에서는 원화 거래금액이 유효하고 국내 6자리 종목코드를 가진 순수 국내 주식 매매 건만 수집하도록 제한합니다.
   - 원화 거래금액이 0원이거나, 외화 거래금액이 존재하거나, 해외 시장 체결 건은 종합원장 파싱에서 제외하고 미국 전용 체결 API(`ust21510`)가 전담하도록 책임을 명확히 분리합니다.

## User Stories

1. As an asset manager, I want foreign exchange transactions executed on different calendar days to be recognized as distinct transactions even if they share the same daily sequence number from Kiwoom, so that my currency exchange history is completely and accurately tracked without silent omissions.
2. As an asset manager, I want the external identifier for ledger-based transactions to incorporate the transaction date, so that daily sequential identifiers (like `000000002`) never collide across different days.
3. As an asset manager, I want the duplicate transaction check for currency exchanges and dividends to compare transaction dates alongside account and external IDs, so that recurring sequence numbers from different periods are not treated as duplicates.
4. As an asset manager, I want overseas stock buys executed in US markets to only be populated by the dedicated overseas execution API with valid USD prices, so that invalid \$0.00 buy transactions are never recorded in my database.
5. As an asset manager, I want the general ledger retroactive parser to ignore transactions with zero KRW trade amounts or positive foreign currency amounts, so that foreign stock settlement records in the unified ledger do not create duplicate stock transactions.
6. As an asset manager, I want executing `/sync` on Telegram to cleanly fetch and store both currency exchanges and overseas stock buys without manual intervention or data corruption.
7. As an asset manager, I want existing legacy transactions with un-prefixed external IDs to remain compatible with duplicate checking, so that running sync retroactively does not duplicate already-saved historical records.

## Implementation Decisions

1. **원장 외부 식별자(External ID) 포맷 고유화**:
   - `kt00015` 종합거래내역에서 파싱되는 환전(`EXCHANGE`), 배당금(`INTEREST`), 배당세(`TAX`), 국내주식 매매(`BUY`/`SELL`) 건의 `external_id`를 `{trde_dt}_{seq_or_trde_no}` (예: `20260910_000000002`) 규격으로 생성.
   - 당일 기준 일련번호의 기간별 충돌을 근본적으로 방지.

2. **중복 검사(De-duplication) 조건 강화**:
   - 환전 트랜잭션 중복 검사 시 `account_id`, `type == 'EXCHANGE'`, `transaction_date == tx_data['date']`를 필수 조건으로 검사.
   - `external_id` 비교 시 새로운 포맷(`{trde_dt}_{trde_no}`)뿐만 아니라 기존에 저장되어 있던 레거시 단일 번호(`trde_no`)도 함께 매칭되도록 하위 호환성 유지.
   - 일반 거래(주식, 배당금 등) 중복 검사 시에도 `transaction_date` 조건을 동등하게 적용.

3. **종합원장 소급 주식 매매 필터 강화**:
   - 종합거래내역(`kt00015`)에서 매매 적요를 만났을 때, 다음 조건 중 하나라도 해당하면 파싱을 건너뜀(Skip):
     - 원화 거래금액(`trde_amt`) <= 0
     - 외화 거래금액(`fc_trde_amt`) > 0
     - 거래소명(`stex_nm`)이 '미국' 또는 해외 거래소이거나, 종목코드가 표준 6자리 국내 숫자가 아닌 경우
   - 해외주식 매매는 오직 미국주식 체결 API(`ust21510`)를 통해서만 단가와 수량을 단일 파이프라인으로 수집.

## Testing Decisions

- **좋은 테스트 원칙**:
  내부 헬퍼 메서드 단위가 아니라 서비스의 공개 진입점인 거래내역 동기화(`sync_transactions`) 엔드포인트를 호출하여, 입력된 API 페이로드에 대해 DB 세션에 최종 커밋되는 트랜잭션들의 정확성을 검증합니다.
- **테스트 대상 모듈**:
  - 키움 동기화 서비스 (`KiwoomTransactionService`)
- **테스트 시나리오**:
  1. **환전 날짜 독립성 및 중복 방지 테스트**: 서로 다른 날짜(예: 8월 25일, 9월 10일)에 동일한 `trde_no="000000002"`를 가진 2개의 환전 응답이 주어졌을 때, 2건 모두 정상적으로 커밋되고 각각 고유 식별자를 갖는지 검증.
  2. **해외주식 0달러 매수 방지 테스트**: `kt00015` 응답에 `trde_amt="0"`, `fc_trde_amt="9124.69"`, `stk_cd="VOO"`인 내역과 `ust21510` 미국 체결 응답에 VOO 13주 @ \$701.90가 함께 주어졌을 때, 0달러 거래는 생성되지 않고 \$701.90 정가 거래 1건만 저장되는지 검증.
  3. **레거시 식별자 하위 호환성 테스트**: 이미 DB에 레거시 `external_id="000000002"`로 저장된 환전 거래가 있을 때, 동일 날짜에 대한 재동기화 시 중복 저장되지 않는지 검증.

## Out of Scope

- 기존 서버 DB에 이미 적재된 비정상 거래(ID 253: VOO 13주 @ \$0.00)의 백엔드 강제 삭제 (사용자가 웹 UI를 통해 직접 삭제하기로 합의).
- 키움증권 Open API 스펙 자체의 변경 대응 (기존 `kt00015`, `ust21510` 응답 스키마 내에서 처리).

## Further Notes

- 본 수정사항이 배포된 후 텔레그램 `/sync`를 다시 호출하면, 누락되었던 2026-09-10 원화주문 외화매수 환전 건(원화 17,882,829원 ➔ \$13,330.97, 정산 환율 약 1,341.45원)이 정상적으로 자동 적재됩니다.
