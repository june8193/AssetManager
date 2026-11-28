# Spec: 포트폴리오 원화 평가·순입출금·시계열 수식 모듈 심화 및 유령 SnapshotService 제거

Status: ready-for-agent

## Problem Statement (문제 정의)

원장 리플레이를 담당하는 `LedgerEngine` 위에 구축된 "보유 포지션 원화 평가" 로직이 6개 모듈에 중복되어 있고, 기간 순입출금(`period_deposit`) 산출식이 5가지 변종으로 분열되어 있다. 이로 인해 스냅샷 과거 재계산(`recalculate`) 시 외화(USD) 입출금 환율 환산이 누락되는 버그와, 스냅샷 마법사 계산 단계 vs 저장 단계 간 이체(`TRANSFER`) 반영 불일치가 발생하고 있다. 또한 프로덕션 호출자가 0건인 구형 `SnapshotService`가 남아 있으며, 시장분석과 벤치마크 간 연간·월간 지수 수익률 기준가(직전 기말 종가 vs 당해 첫 거래일 종가)가 서로 달라 동일 지수 수익률이 화면마다 어긋나고 있다.

## Solution (해결 방안)

프로덕션에서 쓰이지 않는 유령 `SnapshotService`를 삭제하고, `LedgerEngine` 위에 단일 원화 포지션 평가 모듈과 통화 환산·이체 규칙이 통일된 순입출금 계산을 세워 모든 상위 모듈이 공유하게 한다. 동시에 순수 `in-process` 시계열 수식·MDD·백테스트 코어를 추출하여 직전 기말 종가 기준 수익률과 일별 리밸런싱 규칙을 단일화한다.

## User Stories (사용자 스토리)

1. As an 투자자, I want 외화 입출금이나 계좌 간 이체가 포함된 과거 스냅샷을 재계산하더라도 정확한 원화 환산 순입출금과 수익이 산출되기를, so that 달러 입금이 1:1 원화로 왜곡되지 않는다.
2. As an 투자자, I want 시장 분석 화면과 벤치마크 성과 비교 화면에서 동일한 연도·월의 KOSPI 및 S&P 500 수익률이 일치하기를, so that 화면마다 다른 지수 수익률로 혼란을 겪지 않는다.
3. As an 자산 배분 시뮬레이션 사용자, I want 거치식·적립식·동적 리밸런싱 시뮬레이션이 동일한 말일 리밸런싱 및 MDD 계산 규칙을 따르기를, so that 모드 간 백테스트 결과를 신뢰하고 비교할 수 있다.
4. As an 백엔드 개발자, I want 프로덕션 호출자 없는 유령 모듈과 중복 평가 루프·3N 쿼리가 제거되기를, so that 원장·평가·정산 도메인의 변경 지점이 한 곳에 집중된다.

## Implementation Decisions (구현 결정사항)

- **유령 모듈 삭제 및 순입출금 단일화**: 프로덕션 호출자가 없는 `SnapshotService`를 삭제한다. `preview`, `calculate`, 중간 스냅샷 생성, 과거 재계산(`recalculate`), 대시보드 미반영 입금 산출이 모두 `tx.exchange_rate` 우선 환산과 동일한 `TRANSFER` 포함/제외 불변식을 공유하도록 단일 순입출금 계산 함수로 통합한다.
- **이체 쌍 생성 단일화**: 스냅샷 정산 중 생성되는 계좌 간 이체 쌍 트랜잭션은 원장 트랜잭션 팩토리 메서드를 재사용해 중복 생성 규칙을 제거한다.
- **일괄 원화 포지션 평가 모듈**: 계좌별 3N 반복 쿼리와 6개 모듈의 중복 평가 루프를 대체하여, 한 번의 일괄 조회로 계좌별·티커별·카테고리별 원화/외화 평가액을 반환하는 깊은 평가 모듈을 제공한다.
- **순수 시계열 및 백테스트 코어**: 연/월/일 스냅샷 ROI 버킷 집계, 직전 기말 종가 기준 지수·종목 기간 수익률, MDD 시계열, 차트 다운샘플링을 순수 `in-process` 모듈로 통합하고, 시뮬레이션 3종 루프를 단일 파라미터화 백테스트 코어로 병합한다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 원장·스냅샷 정산 인터페이스와 순수 시계열 코어의 외부 관찰 결과(외화 환산 금액, `TRANSFER` 반영, 동일 지수 기간 수익률 일치, MDD 수치)를 검증하며, 제거되는 `SnapshotService` 전용 구형 테스트는 함께 정리한다.
- **사전 합의된 테스트 심 (Pre-agreed Seams)**:
  - 정산·평가 도메인 인터페이스(`LedgerEngine`·`PortfolioValuation`·`SnapshotEngine`) + 인메모리 SQLite + `FakeMarketAdapter`: **Catches** 외화 입출금 환산 누락, `TRANSFER` 부호 불일치, 이체 쌍 중복, 3N 쿼리 회귀 / **Misses** 위저드 UI 상태 바인딩
  - 순수 `in-process` 시계열·백테스트 수식 모듈 인터페이스: **Catches** 직전 기말 vs 당해 첫날 기준가 불일치, MDD 오류, 리밸런싱 경계일 누락 / **Misses** 외부 시세 캐시 미스 처리
- **참고할 기존 테스트 패턴**: `tests/test_ledger_engine.py`, `tests/test_snapshot_engine.py`, `tests/test_simulation_dynamic.py`.

## Out of Scope (범위 제외 사항)

- 프론트엔드 시뮬레이션 UI 및 스냅샷 위저드 상태 머신 개편(별도 피처 `frontend-transport-and-state-machines`에서 다룸).
- 데이터베이스 스키마 변경 및 Alembic 마이그레이션.

## Further Notes (기타 참고사항)

- 시세 조회 의존 부분은 `market-data-provider-unification` 피처와 맞물리며, 01·03번 티켓은 선행 의존성 없이 즉시 시작 가능하다.
