# Spec: 백엔드·프론트엔드 테스트 이음새 정렬 및 시나리오 하네스 심화

Status: ready-for-agent

## Problem Statement (문제 정의)

백엔드 테스트 99개 파일 중 `FakeMarketAdapter`를 활용하는 파일은 7개뿐이며, 다수의 테스트가 `conftest.py`의 격리 DB·클라이언트 대신 8벌의 중복 SQLite 엔진·전역 `TestClient` 인스턴스·40+개 수동 ORM 셋업을 복제하고 매 테스트마다 불필요한 `lifespan` 마이그레이션을 헛돌리고 있다. 또한 MCP·텔레그램 테스트 200여 건은 실제 FastAPI 앱을 거치지 않고 수동 JSON 문자열을 `AsyncMock`으로 모킹해 백엔드 스키마가 바뀌어도 통과하는 계약 단절 상태이다. 프론트엔드 역시 얕은 패스스루 `Service` → `Hook` → `Page` 3중 적층 모킹과 생 `fetch` 문자열 스텁 때문에 `total_assets`나 `latest_snapshot_date` 같은 가짜 필드명이 테스트를 모두 통과하는 현상이 발생했다.

## Solution (해결 방안)

*Replace, don't layer* 원칙에 따라 백엔드는 `conftest.py` 단일 DB/클라이언트 하네스·도메인 시나리오 빌더·`FakeMarketAdapter`·인메모리 `ASGITransport` 어댑터로 내부 `patch`와 수동 JSON 모킹을 대체한다. 프론트엔드는 얕은 패스스루 단위 테스트와 중복 차트 스텁을 제거하고, 화면/도메인 인터페이스 ↔ 단일 계약 검증 Fake HTTP 어댑터 이음새에서만 검증하도록 전환한다.

## User Stories (사용자 스토리)

1. As an 백엔드 개발자, I want 모든 테스트가 `conftest.py`의 단일 격리 DB와 도메인 시나리오 빌더를 공유하기를, so that ORM 컬럼 추가 시 40+개 테스트 파일을 고치지 않고 빌더 한 곳만 수정할 수 있다.
2. As an 백엔드·MCP·텔레그램 개발자, I want `FakeMarketAdapter`와 인메모리 `ASGITransport`를 통해 실제 FastAPI 라우터까지 관통 검증하기를, so that 백엔드 응답 필드 변경 시 MCP·텔레그램 계약 파손을 즉시 포착할 수 있다.
3. As an 프론트엔드 개발자, I want 3중 모킹 적층을 없애고 실제 백엔드 계약을 따르는 단일 Fake HTTP 어댑터와 공통 렌더 헬퍼로 테스트하기를, so that 존재하지 않는 필드명 모킹으로 버그가 숨는 일을 막을 수 있다.

## Implementation Decisions (구현 결정사항)

- **백엔드 단일 하네스 및 시나리오 빌더**: 개별 테스트 파일의 중복 `create_engine`/`TestingSessionLocal` 및 모듈 전역 `TestClient(app)`를 제거하고 `conftest.py`로 일원화한다. 계좌·자산·환율·거래·스냅샷·지출 기본 카테고리를 선언적으로 조립하는 도메인 시나리오 빌더 모듈을 제공한다.
- **내부 `patch` 및 수동 JSON 모킹 대체**: 외부 시세·키움 호출은 `FakeMarketAdapter`/키움 Fake 어댑터 주입으로 대체하고, MCP·텔레그램 테스트는 `httpx.ASGITransport` 인메모리 어댑터를 통해 실제 FastAPI 앱과 인메모리 SQLite를 관통 검증한다.
- **프론트엔드 적층 모킹 제거**: 얕은 1줄 패스스루 서비스 단위 테스트를 삭제하고, 공통 테스트 셋업에 `recharts` 스텁·`renderWithProviders` 헬퍼·계약 일치 응답 팩토리를 집약해 화면/도메인 인터페이스 ↔ 단일 Fake HTTP 어댑터 이음새에서 검증한다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 내부 함수 호출 횟수나 ORM 쿼리 체인 모킹이 아니라 공개 인터페이스와 진짜 어댑터 이음새의 관찰 결과만을 단언한다.
- **사전 합의된 테스트 심 (Pre-agreed Seams)**:
  - 백엔드 단일 하네스(`conftest` 인메모리 SQLite + `ScenarioBuilder` + `FakeMarketAdapter` + `ASGITransport`): **Catches** 백엔드–MCP–텔레그램 계약 파손, 중복 `lifespan` 마이그레이션, ORM 변경 회귀 / **Misses** 프로덕션 파일 DB 락 경합
  - 프론트엔드 공통 렌더 헬퍼 + 계약 검증 Fake HTTP 어댑터: **Catches** `total_assets`·`latest_snapshot_date` 같은 가짜 모킹 통과 버그 / **Misses** 실제 브라우저 렌더링 차이
- **참고할 기존 테스트 패턴**: `tests/conftest.py`의 `fake_market_provider` 패턴 및 `src/frontend/src/test/setup.js`.

## Out of Scope (범위 제외 사항)

- Playwright 기반 브라우저 E2E 하네스 구축 및 34개 레거시 스크립트 삭제(별도 피처 `official-isolated-e2e-harness`에서 다룸).

## Further Notes (기타 참고사항)

- 백엔드 피처(`market-data-provider-unification`, `client-seam-and-expense-domain-deepening`) 및 프론트엔드 피처(`frontend-transport-and-state-machines`)와 연계하면 테스트 교체 비용이 최소화된다.
