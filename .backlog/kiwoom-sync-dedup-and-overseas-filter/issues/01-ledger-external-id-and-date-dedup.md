# 01 — 원장 거래 external_id 일자 결합 및 중복 검증 일자 조건 보강

**What to build:**
키움 종합원장(`kt00015`)에서 수집되는 환전, 배당금, 배당세 등 모든 원장 항목의 외부 식별자(`external_id`)를 `거래일자_거래번호`(예: `20260910_000000002`) 규격으로 고유화합니다. 또한 DB 중복 검사 시 `transaction_date` 조건을 필수로 비교하여, 일자가 다른 동일 당일 순번 거래가 누락(Silent Skip)되지 않고 정상 적재되도록 보장합니다. 이미 DB에 레거시 단일 순번(`000000002`)으로 저장되어 있는 기존 거래에 대해서도 중복 적재가 발생하지 않도록 하위 호환 매칭을 지원합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 종합거래내역(`kt00015`) 파싱 시 환전(`EXCHANGE`), 배당금(`INTEREST`), 배당세(`TAX`)의 `external_id`가 `{trde_dt}_{ext_id}` 포맷으로 생성된다.
- [ ] 환전 거래(`_sync_exchange_transaction`)의 중복 검사 쿼리에 `Transaction.transaction_date == tx_data["date"]` 조건이 포함된다.
- [ ] 일반 거래(배당금, 배당세 등)의 중복 검사 쿼리에도 `Transaction.transaction_date == tx_data["date"]` 조건이 포함된다.
- [ ] 과거 레거시 식별자(`000000002`)로 저장된 거래가 있는 동일 일자에 대해 신규 규격(`20260825_000000002`)으로 재동기화가 시도될 때 중복으로 인식되어 스킵된다(하위 호환성).
- [ ] 서로 다른 거래일자에 동일한 `trde_no="000000002"`를 가진 2개 이상의 환전 거래가 각각 누락 없이 DB에 정상 커밋된다.
