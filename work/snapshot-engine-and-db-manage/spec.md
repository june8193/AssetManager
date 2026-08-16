# 스펙: 스냅샷 파이프라인 심화(SnapshotEngine) 및 db_manage.py 해체

Status: completed

## Problem Statement

현재 AssetManager의 백엔드는 1,000줄이 넘는 거대 단일 라우터(`db_manage.py`)에 사용자, 계좌, 자산 마스터, 거래내역, 스냅샷 등 5개 도메인의 모든 CRUD 엔드포인트가 한곳에 집중되어 있습니다. 이로 인해 다음과 같은 심각한 아키텍처적 문제가 발생하고 있습니다:

1. **비즈니스 로직의 라우터 침범**: 증권/은행 계좌의 차액(Diff) 계산, 정산 트랜잭션 생성 등 180줄 이상의 핵심 비즈니스 연산이 서비스 계층 없이 라우터 엔드포인트 핸들러에 직접 하드코딩되어 있습니다.
2. **코드 중복 및 순환 참조(Circular Dependency)**: 스냅샷 저장 및 차액 처리 로직이 라우터와 서비스 계층에 이중으로 작성되어 있고, 서비스 내부에서 라우터 파일에 정의된 Pydantic 스키마를 불러오기 위해 지연 임포트(Lazy Import)를 사용하는 악취가 존재합니다.
3. **스냅샷 생성의 원자성(Atomicity) 취약**: 환율 기록, 보정 거래(이자/세금/입출금) 자동 생성, 계좌별 스냅샷 캐시 갱신이 단일 트랜잭션으로 견고하게 캡슐화되지 않아, 부분 실패 시 원장의 데이터 정합성이 깨질 위험이 있습니다.

## Solution

1. **독립된 Pydantic 스키마 패키지(`schemas/`) 구축**: 도메인별(계좌, 자산, 거래, 스냅샷, 공통) 입출력 스키마를 라우터로부터 완전히 독립시켜 순환 참조를 원천 차단합니다.
2. **단일 거대 라우터의 4대 전용 라우터 분할**: `db_manage.py`를 책임 영역에 따라 4개의 전용 라우터(`accounts`, `assets`, `transactions`, `snapshots`)로 분할하여 모듈의 응집도를 높이고 크기를 150~250줄 내외로 최적화합니다.
3. **딥 도메인 엔진(`SnapshotEngine`) 구축**: 스냅샷 미리보기, 차액 정산, 보정 거래 생성, 스냅샷 영속화 전체 과정을 `SnapshotEngine` 내부로 캡슐화하고, 단일 DB 트랜잭션 단위로 실행하여 원자적 데이터 무결성을 보장합니다.

## User Stories

1. 자산 관리자로서, 사용자(User) 및 계좌(Account) 목록을 조회하고 신규 계좌를 등록/수정/삭제하여 자산 관리 대상을 유연하게 설정하고 싶다.
2. 자산 관리자로서, 계좌 유형(BROKERAGE, BANK) 및 활성/비활성 여부를 독립된 계좌 관리 인터페이스를 통해 관리하고 싶다.
3. 자산 관리자로서, 신규 자산 마스터를 등록할 때 3-Tier 계층 분류(대분류, 중분류) 유효성을 검증받아 잘못된 자산 분류가 원장에 유입되는 것을 방지하고 싶다.
4. 자산 관리자로서, 자산 티커, 자산명, 국가(KR/US) 메타데이터를 독립된 자산 엔드포인트를 통해 안정적으로 등록/수정하고 싶다.
5. 투자자로서, 특정 계좌의 거래 내역(매수, 매도, 입출금, 배당 등)을 기록하고, 잘못 입력된 거래를 수정/삭제하여 원장의 신뢰도를 유지하고 싶다.
6. 투자자로서, 두 계좌 간의 자금 이체(Transfer)를 등록할 때 출금과 입금 거래가 원자적인 한 쌍(Pair)으로 안전하게 기록되기를 원한다.
7. 투자자로서, 월말 자산 평가 시 스냅샷 생성 마법사를 통해 기준일자의 실시간 평가액과 기간 입출금액을 정확히 미리보고(Preview) 싶다.
8. 투자자로서, 증권 계좌의 실제 예수금과 원장 계산상 이론상 현금 간의 차액을 스냅샷 엔진이 자동으로 계산하여 정산 보정 거래(이자/세금)를 생성해주길 원한다.
9. 투자자로서, 은행 계좌의 신규 입출금 거래 및 기말 잔액을 반영하여 은행 자산 스냅샷이 오차 없이 반영되기를 원한다.
10. 투자자로서, 증권/은행 계좌의 통합 스냅샷 저장 요청 시 환율 저장, 보정 거래 생성, 계좌 스냅샷 캐시 갱신이 단 하나의 DB 트랜잭션으로 원자적으로 저장되어 부분 실패가 발생하지 않기를 원한다.
11. 개발자로서, Pydantic 스키마가 독립된 패키지에 위치하여 서비스나 라우터 어디서든 순환 참조나 Lazy import 없이 깔끔하게 타입을 임포트하고 싶다.
12. 개발자로서, 1,000줄 모놀리스 라우터 대신 4개의 작은 전용 라우터를 통해 원하는 API 엔드포인트와 로직의 위치를 즉시 파악하고 유지보수하고 싶다.

## Implementation Decisions

### 1. 3단계 점진적 리팩토링 로드맵
- **Step 1 (스키마 패키지 독립화)**: 모든 Pydantic 모델을 독립 스키마 모듈로 이동하고, 기존 라우터 및 서비스의 import 구문을 정리하여 순환 참조를 제거한다.
- **Step 2 (기본 엔티티 라우터 3종 분할)**: 계좌/사용자, 자산, 거래내역 라우터를 각각 독립된 모듈로 분할하고 메인 애플리케이션에 등록한다. (기존 API 엔드포인트 URL 호환성 100% 유지)
- **Step 3 (SnapshotEngine 구축 및 db_manage 완전 해체)**: 스냅샷 계산/저장 비즈니스 로직을 `SnapshotEngine`으로 이관하고 스냅샷 전용 라우터를 생성한 뒤 `db_manage` 파일을 완전히 삭제한다.

### 2. 스키마 패키지 구조 결정
- `schemas/` 패키지 아래에 도메인별 스키마를 분리 정의:
  - `account.py`: `UserSchema`, `AccountSchema`
  - `asset.py`: `AssetSchema`, 카테고리 검증기(`validate_categories`)
  - `transaction.py`: `TransactionSchema`, `TransferRequestSchema`
  - `snapshot.py`: `SnapshotSchema`, `SnapshotPreviewSchema`, `SaveSnapshotRequest`, `BrokerageCalculateRequest/Response`, `BankCalculateRequest/Response`, `UnifiedSaveRequest`
  - `common.py`: 공통 응답 모델

### 3. SnapshotEngine의 책임 및 인터페이스 설계
- **작은 인터페이스 (Small Interface)**:
  - `preview(snapshot_date: date, exchange_rate: float) -> List[SnapshotPreview]`: 계좌별 평가액, 기간 입출금, 이론상 현금 산출.
  - `calculate_brokerage(snapshot_date, accounts_input) -> BrokerageCalculationResult`: 증권계좌별 예수금 차액 및 보정 내역 산출.
  - `calculate_bank(snapshot_date, accounts_input) -> BankCalculationResult`: 은행계좌 신규 거래 반영 및 평가액 산출.
  - `save_unified(snapshot_date, exchange_rate, brokerage_data, bank_data) -> List[AccountSnapshot]`: 환율 기록, 보정 거래 삽입, 스냅샷 캐시 갱신을 단일 DB `commit()`으로 원자화.
- **깊은 구현 (Deep Implementation)**: `LedgerEngine` 및 시세/환율 제공 모듈과 협력하여 복잡한 다중 통화 환산, 누적 입출금 필터링, 정산 거래 생성을 내부에 은닉.

### 4. API 하위 호환성 유지
- 프론트엔드 변경을 최소화하기 위해 기존 `/api/db/...` 경로의 접두사 및 엔드포인트 규격을 그대로 유지하거나 에일리어스를 제공하여 기존 프론트엔드 기능에 장애가 발생하지 않도록 보장.

## Testing Decisions

- **좋은 테스트의 원칙**: 라우터나 엔진의 내부 구현 상세(Private 변수, 중간 배열 등)를 테스트하지 않고, 공개 인터페이스와 최종 영속화된 DB 상태(스냅샷 레코드, 보정 트랜잭션, 환율 레코드 등)의 외부 동작만을 검증한다.
- **테스트 격리**: `GEMINI.md` 규칙에 따라 실제 운영 DB에 영향을 주지 않도록 인메모리 SQLite 또는 격리된 테스트 DB 세션에서 실행한다.
- **테스트 계층**:
  - 단위 테스트: `SnapshotEngine`의 차액 계산, 다중 통화 환산, 원자적 저장 무결성 검증.
  - API 통합 테스트: FastAPI `TestClient`를 통해 분할된 4개 라우터의 엔드포인트 정상 응답 및 스키마 유효성 검증.
  - 회귀 검증: 기존 백엔드 전체 테스트(247개)를 매 단계마다 실행하여 회귀가 없음을 확인.
  - E2E 테스트: Playwright를 통해 스냅샷 생성 마법사 페이지 진입, 차액 확인, 스냅샷 최종 저장 플로우 검증.

## Out of Scope

- 프론트엔드 스냅샷 마법사 UI의 대규모 디자인 개편 (기존 UI 동작 및 API 호출 호환성 유지가 원칙).
- 외부 증권사 API(키움 등) 연동 파이프라인 변경.
- 자산 배분 비율(Target Ratio) 계산 로직 변경.

## Further Notes

- 모든 단계는 Git 커밋을 분리하여 안전하게 롤백 가능한 상태를 유지합니다.
- `to-spec` 이후 각 단계별 이슈 티켓(`issues/01-*.md` 등)을 생성하여 순차적으로 진행할 수 있습니다.
