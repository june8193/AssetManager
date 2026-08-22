Status: resolved

# Spec: 프론트엔드 테스트 환경 및 실행 성능 최적화 (Frontend Test Environment & Performance Optimization)

## Problem Statement

현재 AssetManager의 프론트엔드 테스트 스위트(Vitest 4.x 기반, 41개 파일, 248개 테스트)는 전체 실행에 약 125.43초(2분 5초)가 소요되어 개발자의 TDD 피드백 루프와 CI/CD 및 자동화 검증 속도를 크게 저해하고 있습니다.
측정 결과 병목의 80% 이상이 실제 테스트 로직 실행(약 45초)이 아닌 무거운 `jsdom` 가상 DOM 인스턴스의 빈번한 생성/파기(`environment` 누적 967초), 불필요한 모듈 재파싱(`import` 누적 593초), Recharts 차트 렌더링 시 발생하는 가상 크기 계산 실패에 따른 수백 줄의 stderr 콘솔 경고 폭주, 미모킹된 백엔드 네트워크 호출로 인한 연결 대기(`ECONNREFUSED`), 그리고 DOM 조작이 없는 순수 비즈니스/유틸리티 로직에 대한 불필요한 브라우저 환경 오버헤드에서 기인하고 있습니다.

## Solution

1. **초경량 DOM 환경(`happy-dom`) 도입**: 무거운 `jsdom` 대신 경량화되고 고속으로 동작하는 `happy-dom`으로 테스트 환경을 전환하여 DOM 초기화 및 모듈 로딩 시간을 대폭 단축합니다.
2. **글로벌 차트 및 DOM 옵저버 모킹 체계화**: 테스트 전역 설정에서 `ResizeObserver` 및 Recharts의 레이아웃 의존 컴포넌트(`ResponsiveContainer` 등)를 경량 목(Mock) 처리하여 무의미한 레이아웃 연산과 콘솔 에러 출력을 방지합니다.
3. **환경 분리(Environment Tiering)**: DOM 조작이 전혀 필요 없는 순수 서비스 계층 및 계산/포맷터 유틸리티 테스트 스위트를 초고속 `node` 환경으로 분리 실행합니다.
4. **테스트 파이프라인 튜닝**: 불필요한 CSS 파싱/로딩을 비활성화하고 Vitest 워커 풀과 파일 격리 옵션을 최적화합니다.
5. **네트워크 격리 및 비동기 수습**: 전역 및 페이지 단위 테스트에서 실제 서버 연결을 시도하는 백그라운드 태스크 및 비동기 폴링 호출을 완벽히 모킹하고 비동기 상태 업데이트 경고를 해소합니다.
6. **성능 목표 달성**: 248개 모든 프론트엔드 테스트의 100% 무결성을 유지하면서 총 실행 시간을 125초대에서 15~25초대 이하로 80% 이상 단축합니다.

## User Stories

1. As a frontend developer practicing TDD, I want test suites to run within 20 seconds, so that I can maintain a rapid Red-Green-Refactor development cycle without long idle delays.
2. As a frontend developer, I want pure business utility and calculation tests to run instantly in a lightweight Node environment, so that mathematical invariants can be validated in milliseconds.
3. As a frontend developer, I want pure API service tests to execute without initializing unnecessary browser DOM mock trees, so that network client abstraction tests run with minimal overhead.
4. As a test runner, I want chart components to render predictably without spamming container size calculation warnings, so that test logs remain clean and console I/O does not degrade performance.
5. As a frontend maintainer, I want background task polling and SSE endpoints to be safely mocked during page tests, so that tests do not attempt real socket connections or waste time timing out on unmocked ports.
6. As a frontend developer, I want state-updating async operations in page tests to resolve cleanly without React act() warnings, so that test execution is deterministic and free of race conditions.
7. As a CI/CD system, I want all 248 existing frontend unit and integration tests to pass with 100% parity after optimization, so that code quality and UI behavior guarantees are strictly preserved.
8. As a system operator, I want frontend test execution commands to remain simple and standard (e.g. npm test or npx vitest run), so that developer workflow and automated tooling require zero friction.

## Implementation Decisions

- **Test Environment Optimization**:
  - Replace the heavy virtual DOM runner with a fast, lightweight DOM runtime across all component/hook/page tests.
  - Configure pure calculations (formatters, snapshot calculators) and API service layers to execute under the native Node runtime without initializing any DOM environment.
- **Global Test Setup Enhancements**:
  - Centralize global mocks in the shared test setup layer.
  - Implement a standard mock for `ResizeObserver` and window layout functions (`scrollTo`, `alert` fallback) to prevent runtime warnings.
  - Mock chart layout containers (such as Recharts `ResponsiveContainer`) to immediately render children with fixed dimensions in memory, completely eliminating dimension warning logs and recalculation loops.
- **Build & Test Runner Configuration**:
  - Disable test-time CSS parsing and CSS processing in the test runner configuration to avoid redundant stylesheet compilation during unit tests.
  - Optimize Vitest worker pool settings (forks/threads and isolation balance) suitable for multi-core environments.
- **Network Call & Async State Guarding**:
  - Ensure global `fetch` / API client mocks catch all background dashboard polling, task health checks, and stream calls so that unhandled network requests never hit live ports.
  - Wrap pending state updates in affected page tests with clean async waiting utilities to eliminate unhandled `act(...)` warnings.

## Testing Decisions

- **Black-box Behavioral Verification**:
  - Optimization is successful only when all 41 test files and 248 tests pass with identical behavioral outcomes without changing test assertions.
  - Verification must measure the exact wall-clock time reduction and confirm that no tests are skipped or silently disabled.
- **Regression Boundaries**:
  - All interactive UI flows (Wizard steps, modal toggles, table sorts, tab navigations) must continue to function exactly as asserted in their existing integration tests.
- **Prior Art**:
  - Follow the existing testing patterns in the repository using `@testing-library/react` and Vitest, ensuring full compatibility with existing React 19 test utilities.

## Out of Scope

- Modifying product UI component logic or changing runtime React component styling/markup.
- Changing frontend production dependencies or build pipelines for Vite production bundling (`npm run build`).
- Modifying backend FastAPI endpoints or Python pytest test suites.
- Rewriting existing test cases into completely new testing frameworks.

## Further Notes

- Baseline measured duration: 125.43s (41 files, 248 tests).
- Target duration: < 25s (Wall-clock time).
