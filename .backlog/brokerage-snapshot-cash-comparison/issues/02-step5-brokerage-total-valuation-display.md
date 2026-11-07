# 02 — 증권계좌 정산 응답 `total_valuation` 확장 및 5단계 최종 확인 총 평가액/예수금 병기

**Spec:** [spec.md](../spec.md)

**What to build:** 백엔드 증권계좌 정산 계산 API(`POST /api/db/snapshots/brokerage/calculate`) 응답 스키마(`BrokerageCalculateResponse`)에 계좌 총 평가액(`total_valuation`: 보유 주식 평가액 + 원화/달러 예수금 환산 합계)을 추가하고, 프론트엔드 5단계 최종 확인(`Step5FinalConfirm`) 테이블의 `최종 잔액/평가액` 컬럼에서 증권계좌 행에 계좌 총 평가액(원)을 메인으로 굵게 표시하며 하단에 원화/달러 예수금 내역을 보조 텍스트로 함께 표시합니다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `src/backend/schemas/snapshot.py`의 `BrokerageCalculateResponse`에 `total_valuation: float = 0.0` 필드를 추가하고, `src/backend/services/snapshot_engine.py`의 `SnapshotEngine.calculate_brokerage`에서 계산된 `total_valuation`을 응답에 포함하여 반환한다.
- [ ] `tests/test_brokerage_snapshot.py`에 `calculate_brokerage_snapshot` 호출 시 비현금 자산 평가액과 원화/달러 예수금이 합산된 `total_valuation`이 정확히 반환되는지 검증하는 테스트를 추가한다.
- [ ] `src/frontend/src/components/snapshot/wizard/Step5FinalConfirm.jsx`에서 증권계좌(`BROKERAGE`)의 `최종 잔액/평가액` 컬럼 렌더링 시, `calcResult.total_valuation`이 있으면 총 평가액(`{total_valuation}원`)을 메인 굵은 글씨로 표시하고 하단에 `예수금: {currentKrw}원` (달러가 0보다 클 경우 `· {currentUsd}$` 병기)을 보조 텍스트로 표시한다.
- [ ] `src/frontend/src/components/snapshot/wizard/WizardStepComponents.test.jsx`에 `Step5FinalConfirm`의 증권계좌 총 평가액 및 예수금 병기 렌더링 검증 테스트를 추가한다.
