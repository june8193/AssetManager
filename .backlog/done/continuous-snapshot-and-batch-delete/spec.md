# Feature Spec: 연속 스냅샷 자동 생성 및 스냅샷 다중 일괄 삭제

Status: resolved

## Problem Statement

현재 AssetManager에서 스냅샷 저장은 위저드 실행 시점의 '오늘' 1개 날짜에 대해서만 저장됩니다. 사용자는 보통 1달에 한 번 정도 스냅샷을 저장하는데, 이로 인해 직전 스냅샷 저장일과 오늘 사이에 날짜 공백(Gap)이 발생하여 일별 자산 변화 및 수익률 차트의 연속성이 떨어집니다.

또한, 1달 치 스냅샷이 연속으로 저장되는 환경에서 만약 잘못된 정보로 스냅샷이 생성되었을 경우, 기존 DB 관리 화면에서는 날짜별로 일일이 1개씩 삭제해야 하여 약 30번의 삭제 작업을 수동으로 반복해야 하는 큰 불편함이 있습니다.

## Solution

1. **스냅샷 연속 자동 생성 (Backfill on Wizard Save)**
   - 스냅샷 마법사(Wizard)에서 최종 저장을 실행할 때, 직전 스냅샷 기준일 익일(`T_last + 1`)부터 오늘(`T_today`)까지의 **모든 캘린더 날짜(주말/공휴일 포함)**에 대한 일별 스냅샷을 원장 거래내역 리플레이 및 일별 역사적 시세/환율을 기반으로 자동 산출하여 원자적으로 일괄 저장합니다.
   - 비영업일 또는 시세 누락 시 직전 유효 종가/환율(Forward-fill)을 자동으로 적용하여 데이터 끊김 없이 온전한 시계열 데이터를 보장합니다.
   - 오늘 입력된 예수금 차액 보정(`CASH_ADJUSTMENT`) 및 신규 거래는 오늘 날짜(T_today)에만 정확히 반영됩니다.

2. **스냅샷 다중 일괄 삭제 (Batch Delete with Shift-Click)**
   - DB 관리 > 스냅샷 탭에서 테이블 헤더 전체 선택/해제 체크박스 및 각 행별 체크박스를 제공합니다.
   - **Shift + 클릭 범위 선택(Range Selection)**을 지원하여 시작 지점과 끝 지점을 클릭하는 것만으로 수십 개의 스냅샷을 즉시 한 번에 선택할 수 있습니다.
   - 선택된 항목들을 한 번에 안전하게 삭제할 수 있는 `선택 삭제 (N개)` 버튼 및 백엔드 일괄 삭제 API를 제공합니다.

## User Stories

1. As an asset manager, I want the system to automatically generate snapshots for all intermediate calendar days between the last snapshot date and today when I save a new snapshot, so that my asset history and daily return charts have continuous daily data without gaps.
2. As an asset manager, I want the system to replay ledger transactions up to each respective day when calculating intermediate snapshots, so that the cash balance and holding quantities on each day accurately reflect historical transactions.
3. As an asset manager, I want the system to use historical close prices and exchange rates for each day (forward-filling on weekends or market holidays), so that valuation fluctuations match historical market movements.
4. As an asset manager, I want the newly entered cash adjustments (`CASH_ADJUSTMENT`) and new transactions from the wizard to be applied only to today's snapshot date, so that intermediate historical states are not distorted by today's balance reconciliations.
5. As an asset manager, I want all generated daily snapshots to be committed in a single atomic database transaction, so that any failure during generation does not leave partial or corrupted snapshot states.
6. As a user viewing the DB management snapshot tab, I want to see checkboxes on each snapshot row and a header checkbox to select all, so that I can easily select multiple snapshots for deletion.
7. As a user managing snapshots, I want to use Shift + click to select a range of consecutive snapshot rows at once, so that I don't have to manually check dozens of checkboxes one by one.
8. As a user who selected multiple snapshots, I want to see a visible batch delete button with the count of selected items, so that I clearly know how many records will be removed.
9. As a user executing a batch delete, I want to receive a confirmation prompt detailing the date range/count before deletion, so that I avoid accidental data loss.
10. As a user executing a batch delete, I want the system to delete both the account snapshots and associated `CASH_ADJUSTMENT` transactions for the selected dates in one atomic operation, so that no orphaned adjustment transactions remain.

## Implementation Decisions

1. **도메인 엔진 확장 (SnapshotEngine)**:
   - `save_unified` 및 `save_snapshots` 실행 시 직전 스냅샷 날짜(`T_last`)를 탐색.
   - `T_last`가 존재하고 `T_today > T_last + 1일`인 경우, `T_last + 1`일부터 `T_today - 1`일까지의 날짜 시퀀스를 생성.
   - 각 날짜 T에 대해 `LedgerEngine.get_positions(db, account_id, as_of=T)`로 자산 포지션 및 현금 잔고 산출.
   - `HistoricalPriceCache` 및 `ExchangeRate`로부터 T일자의 시세를 일괄 조회(Batch Fetch) 후 Forward-fill 적용하여 `total_valuation`, `period_deposit`, `period_profit` 산출.
   - 중간 날짜 스냅샷과 오늘 최종 스냅샷을 단일 트랜잭션으로 저장.

2. **백엔드 일괄 삭제 API**:
   - `DELETE /api/db/snapshots/batch` 엔드포인트 구현 (Body 또는 Query 파라미터로 `dates: List[date]` 전달).
   - 지정된 모든 날짜의 `AccountSnapshot` 및 해당 일자의 `CASH_ADJUSTMENT` 트랜잭션을 단일 트랜잭션에서 일괄 삭제.

3. **프론트엔드 UI/UX (SnapshotsTab)**:
   - 체크박스 선택 상태 관리 (`selectedDates: Set[string]`).
   - `lastClickedIndex` 상태를 유지하여 Shift 키가 눌린 상태에서 체크박스 클릭 시 `Math.min(lastIdx, currIdx)`부터 `Math.max(lastIdx, currIdx)`까지의 모든 행을 일괄 선택/해제.
   - 상단 툴바에 선택된 항목 수 표시 및 `선택 삭제 (N개)` 버튼 제공.
   - 삭제 확인 모달/알림창 표시 후 `dbService.deleteSnapshotsBatch(dates)` 호출 및 목록 새로고침.

## Testing Decisions

- **좋은 테스트 원칙**: 구현 세부사항(내부 루프 등)이 아닌 외부 노출 인터페이스(엔진 메서드, API 응답, UI 렌더링 및 사용자 클릭 인터랙션)의 동작을 검증.
- **백엔드 테스트 (`tests/test_snapshot_engine.py`, `tests/test_snapshots_api.py`)**:
  - 직전 스냅샷이 있는 상태에서 5일 후 스냅샷 저장 시 5개 일자 스냅샷이 모두 생성되는지 검증.
  - 중간 날짜의 원장 거래 및 시세 Forward-fill이 정확히 반영되는지 검증.
  - 일괄 삭제 API 호출 시 여러 날짜의 스냅샷 및 CASH_ADJUSTMENT가 한 번에 삭제되는지 검증.
- **프론트엔드 테스트 (`SnapshotsTab.test.jsx`)**:
  - 체크박스 렌더링 및 전체 선택/해제 동작 검증.
  - Shift + 클릭 시 범위 내 모든 행이 일괄 선택되는지 인터랙션 검증.
  - 선택 삭제 버튼 클릭 시 일괄 삭제 API 호출 및 UI 갱신 검증.

## Out of Scope

- 위저드 저장 외에 과거 전체 기간(수년 치)의 띄엄띄엄한 스냅샷 갭을 한 번에 소급 채워 넣는 독립적인 '과거 전체 일괄 보간(Full-history Backfill)' 기능 (추후 필요 시 별도 개발).
- 개별 계좌 단위의 부분 일자 스냅샷 삭제 (스냅샷은 항상 날짜 단위로 모든 활성 계좌가 일괄 관리됨).

## Further Notes

- 모든 신규 코드는 프로젝트 코딩 규칙(`GEMINI.md`)에 따라 Python 실행은 `uv`, 언어는 한국어 주석/문서, TDD(Red-Green-Refactor)를 준수합니다.
