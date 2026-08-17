Status: resolved

# Spec: 레거시 잔재 정리, AssetService 심화 및 백그라운드 태스크 무결성 (Legacy Cleanup, AssetService Deepening & Background Task Integrity)

## Problem Statement

가계 금융 자산관리 시스템(AssetManager) 백엔드에 과거 개발 잔재 파일이 남아 있어 개발자와 자동화 도구에 혼선을 초래하고 있습니다. 또한, 자산(Asset) 마스터와 관련된 유효성 검증(계층형 카테고리 불변식, 티커 중복 방지, 종목명 검증 등)이 전용 도메인 서비스 없이 라우터와 여러 서비스 계층에 분산되어 있어 일관성이 결여되고 결합도가 높습니다. 아울러 백그라운드 태스크 관리자 내의 예외 처리 오타로 인해 종목 동기화 실패 시 2차 런타임 크래시가 유발될 수 있으며, 태스크 관리 인스턴스가 이원화되어 시스템 상태 모니터링의 신뢰성이 저하되는 문제가 있습니다.

## Solution

1. 미사용 과거 엔트리포인트를 완전히 정리하여 백엔드 진입점을 단일화합니다.
2. 자산 마스터 관리, 카테고리 불변식 검증, 티커 조회 및 실시간 검증을 캡슐화한 심화 모듈(Deep Module)인 `AssetService`를 구축하고, API 라우터와 제반 비즈니스 로직을 슬림화합니다.
3. 백그라운드 태스크 관리자의 오타 버그를 수정하고 전역 싱글톤 인스턴스의 생명주기를 통일하여 예외 복원력과 태스크 모니터링의 무결성을 확보합니다.

## User Stories

1. As a system maintainer, I want unused legacy backend entrypoints completely removed, so that there is no ambiguity about how the server is launched and configured.
2. As an asset manager user, I want the system to strictly validate 3-tier asset category hierarchies (Major/Sub categories) when creating or updating assets, so that my portfolio allocation data remains 100% compliant with domain invariants.
3. As an asset manager user, I want instant verification and duplicate prevention when registering new asset tickers, so that I cannot accidentally create duplicate or invalid assets.
4. As a dashboard user, I want cash asset identification (KRW/USD) to be handled cleanly and consistently, so that cash balances and foreign currency exchanges are calculated without missing metadata.
5. As a system maintainer, I want background stock synchronization errors to be safely caught and recorded without causing secondary attribute crashes, so that background loop resilience is guaranteed.
6. As a system operator, I want system task status queries to reflect the actual running background scheduler instance, so that task health metrics and last-run timestamps are accurate and reliable.
7. As an API developer, I want asset routers to act as thin controllers that delegate domain rules to a dedicated service, so that business logic is easily tested and maintained in isolation.
8. As an automated test suite, I want background tasks and asset services to be testable with clean isolated seams and in-memory databases, so that regression testing is fast and deterministic.

## Implementation Decisions

- **Entrypoint Unification**: Remove the unused legacy server entrypoint file. Ensure the main backend entrypoint remains the single source of truth for FastAPI startup and configuration.
- **Deep AssetService Architecture**:
  - Encapsulate all Asset domain operations behind a cohesive class-based service interface accepting a database session.
  - Centralize asset creation, update, deletion, ID-based and ticker-based queries.
  - Enforce domain invariant validations: strict verification against `VALID_CATEGORIES`, duplicate ticker checking, and currency asset helpers.
  - Encapsulate live market symbol verification (calling market price helpers for equities vs internal mapping for cash assets).
- **Thin Controller Refactoring**: Refactor the Asset API router to delegate all business decisions, validations, and ORM operations to `AssetService`, returning Pydantic schemas and raising appropriate HTTP exceptions based on service outcomes.
- **Background Task Manager Lifecycle & Bug Fix**:
  - Correct the task error recording invocation in the daily maintenance loop to invoke the proper public method without syntax errors.
  - Unify the background task manager instance into a single global singleton, ensuring both the FastAPI lifespan handler and API status endpoints interact with the exact same instance.
- **Script Backward Compatibility**: Update any maintenance and fix scripts that previously invoked standalone asset category functions to use the new `AssetService` interface.

## Testing Decisions

- **Black-box Behavioral Testing**: Tests should verify observable domain behavior (e.g., successful asset creation, rejection of invalid category pairs, correct error recording in task status) rather than internal ORM query execution details.
- **Module Coverage**:
  - Unit tests for `AssetService`: cover CRUD, duplicate ticker rejection, invalid category rejection, cash asset retrieval, and live ticker verification.
  - Unit tests for `BackgroundTaskManager`: cover task status tracking, successful task recording, error recording, exception resilience in maintenance loops, and singleton consistency.
  - Regression testing across all existing backend test suites.
- **Prior Art**: Follow the established testing patterns in existing unit tests (e.g., `tests/test_ledger_engine.py`, `tests/test_snapshot_engine.py`) using isolated test database fixtures.

## Out of Scope

- Introducing new asset types or expanding `VALID_CATEGORIES` taxonomy beyond existing domain rules.
- Modifying the public HTTP API schema or changing endpoint URL prefixes (`/api/db/assets`).
- Redesigning the frontend asset management user interface.
- Changing market data provider adapters (Kiwoom / Yahoo Finance).

## Further Notes

- All changes maintain 100% backward compatibility with existing frontend client calls.
- Completing this spec resolves Item #7 from `work/architecture-review.html`.
