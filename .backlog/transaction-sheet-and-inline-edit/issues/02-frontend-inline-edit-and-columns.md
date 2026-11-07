# 02 — 프론트엔드 하단 거래내역 표 컬럼 통일 및 제자리 인라인(In-line) 수정 구현

**Spec:** [spec.md](../spec.md)

**What to build:** `TransactionsTab.jsx`의 하단 거래내역 조회 테이블을 `[날짜 | 계좌 | 자산(티커·이름) | 유형 | 수량 | 단가/환율 | 총액 | 메모 | 관리]` 9개 컬럼 구조로 개편하고, 행의 `[수정]` 버튼 클릭 또는 행 더블클릭 시 상단 폼으로 이동하지 않고 **해당 행 그 자리에서 즉시 편집 행(+ 이체/환전 선택 시 행 하단 보조 설정 줄 `Sub-row`)으로 전환**하여 단건 즉시 수정(`Enter` 저장 / `Esc` 취소)하도록 구현합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `src/frontend/src/components/db/TransactionsTab.jsx`의 하단 거래내역 테이블 헤더와 읽기 전용 행을 `[날짜 | 계좌 | 자산 | 유형 | 수량 | 단가/환율 | 총액 | 메모 | 관리]` 9개 컬럼으로 개편하여, `자산` 셀에 티커와 자산명을 함께 표시하고 `메모` 셀에 `tx.memo || '-'`를 표시한다.
- [ ] 하단 테이블에서 `[수정]` 버튼 클릭 또는 읽기 전용 행 더블클릭(`onDoubleClick`) 시 `editingId`를 해당 거래 ID로 설정하고, 해당 행 위치에서 즉시 인라인 편집 입력 컨트롤(`날짜`, `계좌`, `자산`, `유형`, `수량`, `단가`, `총액`, `메모` 및 우측 `[저장]`/`[취소]` 버튼)을 렌더링한다.
- [ ] 인라인 편집 중인 행의 거래 유형(`type`)이 `'TRANSFER'`(이체)인 경우 기본 행 바로 아래에 보조 설정 줄(`Sub-row`: `<tr data-testid="inline-subrow-transfer">`)을 렌더링하여 도착 계좌(`target_account_id`) 드롭다운을 표시하고, 기본 행의 수량/단가 입력은 비활성화(`-`)하며 총액(이체 금액)만 입력받는다.
- [ ] 인라인 편집 중인 행의 거래 유형(`type`)이 `'EXCHANGE'`(환전)인 경우 기본 행 바로 아래에 보조 설정 줄(`Sub-row`: `<tr data-testid="inline-subrow-exchange">`)을 렌더링하여 수령할 도착 통화(`target_asset_id`) 드롭다운과 환전 계산 요약(`수량 × 환율 = 총 지불금액`)을 표시한다.
- [ ] 인라인 편집 행 내부 입력 필드에서 `Enter` 키 입력 시 저장(`PUT /api/db/transactions/{id}`, 과거 스냅샷 기준일 이전 거래인 경우 `PastTransactionWarningModal` 확인 경유), `Esc` 키 입력 시 편집 취소(`editingId = null`)가 동작하도록 구현한다.
- [ ] `src/frontend/src/components/db/TransactionsTab.test.jsx`에 (1) 하단 테이블 메모 컬럼 표시, (2) 행 수정 버튼 클릭/더블클릭 시 제자리 인라인 편집 전환 및 `PUT` 저장/취소(`Enter`/`Esc` 포함), (3) 인라인 편집 중 `TRANSFER`/`EXCHANGE` 보조 줄(`Sub-row`) 렌더링을 검증하는 테스트를 추가하고 통과시킨다.
