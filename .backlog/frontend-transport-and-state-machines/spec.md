# Spec: 프론트엔드 원격 통신 이음새 단일화 및 원장 편집기·스냅샷 위저드 상태 머신 심화

Status: ready-for-agent

## Problem Statement (문제 정의)

얕은 패스스루 `services/*.js` 계층(호출처 0건인 죽은 메서드 21개 포함)을 우회하여 18개 UI 모듈이 59곳에서 생 `fetch()`를 직접 호출하면서 URL·에러 파싱·응답 스키마 계약이 파편화되었다. 특히 `TransactionsTab`이 최신 스냅샷 일자 API 응답(`{ latest_date }`)을 존재하지 않는 `latest_snapshot_date` 필드로 읽고 테스트까지 오타로 모킹해 실제 운영 환경에서 과거 거래 경고 모달이 작동하지 않는 결함이 발생했다. 또한 `TransactionsTab`(1,527줄) 내부에 다중 입력 시트와 인라인 편집 전이 규칙이 이중 복제되어 드리프트가 생겼으며, 스냅샷 5단계 위저드는 연동 이체(`TRANSFER`) 시 도착 계좌 무효화 누락, 정합성 경고 4중 복제, `EXCHANGE` 계산 드리프트, 엔진 내부 `window.alert/confirm` 13곳 결합을 안고 있다.

## Solution (해결 방안)

모든 프론트엔드 원격 통신을 `apiClient` 단일 이음새로 수렴시키고 죽은 패스스루 메서드를 정리하여 `latest_date` 스키마 계약을 복구한다. 동시에 원장 거래 행 전이·검증 규칙을 순수 `in-process` 도메인 모듈로 추출하여 다중 입력과 인라인 편집이 100% 동일한 규칙을 따르게 하고, 스냅샷 위저드 상태 머신에 연동 이체 도착 계좌 원자적 무효화·단일 정합성 경고 판정·브라우저 전역 알림 분리를 적용한다.

## User Stories (사용자 스토리)

1. As an 원장 관리자, I want 최근 스냅샷 기준일 이전의 거래를 등록·수정·삭제할 때 과거 거래 경고 모달이 정상 작동하기를, so that 확정된 스냅샷 정산 내역이 경고 없이 오염되지 않는다.
2. As an 원장 관리자, I want 다중 입력 시트와 인라인 행 편집이 동일한 자산·통화·이체·환전 연쇄 규칙과 숫자 파싱을 따르기를, so that 편집 방식에 따라 유효하지 않은 거래 조합이나 소수부 절삭이 발생하지 않는다.
3. As an 스냅샷 마법사 사용자, I want 계좌 B에서 확정된 계좌 A로 이체(`TRANSFER`)를 추가·수정하거나 잔액을 변경하면 영향받는 계좌의 확정 상태가 자동으로 무효화되기를, so that 이전 정산 결과가 그대로 저장되는 정합성 오류를 막을 수 있다.
4. As an 프론트엔드 개발자, I want 위저드 상태 머신이 `window.alert/confirm`에 직접 결합되지 않고, 죽은 계산 유틸·별칭이 제거되기를, so that DOM이나 전역 스파잉 없이 상태 전이 불변식을 검증할 수 있다.

## Implementation Decisions (구현 결정사항)

- **단일 HTTP 통신 이음새**: 59곳의 생 `fetch()` 호출을 `apiClient` 기반으로 통합하고, 호출처 0건인 죽은 서비스 메서드를 제거하며, 최신 스냅샷 일자(`latest_date`) 등 응답 계약을 정규화한다.
- **순수 원장 거래 행 엔진**: 초기 행 생성, 필드 연쇄 변경(현금/비현금/이체/환전), 유효성 검증, API DTO 직렬화, 과거 스냅샷 판별, 거래 표시 메타데이터(모바일 목록과 공유)를 단일 `in-process` 모듈로 통합한다(기존 `formatters` 유틸 재사용).
- **스냅샷 위저드 상태 머신 심화**: 4곳에 복제된 정합성 경고 판정(`0.01` 임계값)과 경고 확인 상태(`step5WarningConfirmed`), `canSave` 가드를 엔진 내부 파생 상태로 흡수한다. 거래/잔액 변경 시 출발 계좌뿐 아니라 영향받는 도착 계좌(`prev/next target_account_id`)의 `calcResult`·`isConfirmed`를 원자적으로 무효화한다. 또한 예상 예수금 계산의 `EXCHANGE` 처리 규칙을 백엔드 `LedgerEngine`과 정렬하고, 미사용 유틸 3종·구형 서비스 메서드 4종·레거시 별칭을 제거하며, `alert/confirm` 직접 호출을 상태/결과 반환으로 전환한다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 원장 행 전이 및 위저드 5단계 상태 머신 불변식을 순수 `in-process` 인터페이스에서 검증하고, 통신 계층은 `latest_date` 등 실제 백엔드 계약을 준수하는 Fake 어댑터로 검증한다.
- **사전 합의된 테스트 심 (Pre-agreed Seams)**:
  - 순수 `in-process` 상태 머신 인터페이스(원장 거래 행 엔진·스냅샷 위저드 엔진): **Catches** 다중입력 vs 인라인 드리프트, 연동 이체 도착 계좌 미무효화, 정합성 경고 불일치, `EXCHANGE` 계산 드리프트 / **Misses** HTTP 직렬화 오류
  - `apiClient` 단일 통신 어댑터 + 계약 검증 Fake 어댑터: **Catches** `latest_date` 스키마 불일치, 베이스 URL 결합 및 에러 파싱 오류 / **Misses** 백엔드 서버 런타임 장애
- **참고할 기존 테스트 패턴**: `src/frontend/src/utils/snapshotCalculator.test.js`, `src/frontend/src/components/db/TransactionsTab.test.jsx`.

## Out of Scope (범위 제외 사항)

- 백엔드 스냅샷 및 원장 API 스키마 변경.
- 데스크톱·모바일 간 시황/리스크/지출 도메인 통합(별도 피처 `frontend-shared-domain-modules`에서 다룸).

## Further Notes (기타 참고사항)

- 01번 티켓 완료 후 02·03번 티켓은 병렬로 진행 가능하다.
