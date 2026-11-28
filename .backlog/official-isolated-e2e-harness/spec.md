# Spec: 방치된 34개 일회성 E2E 스크립트 청산 및 격리형 공식 E2E 러너 모듈 심화

Status: ready-for-agent

## Problem Statement (문제 정의)

공식 테스트 러너와 릴리즈 게이트에서 완전히 배제된 34개의 일회성·임시 E2E 스크립트(`run_e2e_*.cjs`, `test_*_e2e.cjs`, `scratch*.cjs`, `scripts/e2e/*`)가 레포지토리에 추적된 채 방치되어 있다. 이 스크립트들은 `waitForTimeout(8000)` 같은 고정 대기와 취약한 Tailwind 클래스 셀렉터에 의존하고 단언(`expect`) 없이 로그만 남기며, 심지어 공유 개발 DB(`src/dev_assets.db`)에 직접 접속해 `DELETE FROM expenses`나 하드코딩 ID 삭제·삽입으로 개발 데이터를 파괴하고 있다.

## Solution (해결 방안)

전용 격리 SQLite DB와 `FakeMarketAdapter` 기반의 백엔드·프론트엔드 서버 수명주기 관리, 결정론적 시드 픽스처 주입, 접근성 역할(`getByRole`) 기반 단언을 내부에 캡슐화한 공식 `@playwright/test` E2E 러너 모듈을 구축한다. 핵심 사용자 여정 5~7개를 공식 스펙으로 구현하여 통합 테스트 러너에 연결한 뒤, 방치된 34개의 일회성·임시 스크립트를 일괄 삭제한다.

## User Stories (사용자 스토리)

1. As an 개발자, I want E2E 테스트를 실행하더라도 공유 개발 DB(`src/dev_assets.db`)의 데이터가 절대 삭제되거나 변조되지 않기를, so that 평소 개발 데이터와 E2E 검증이 서로 간섭하지 않는다.
2. As an 릴리즈 관리자, I want 단일 명령으로 결정론적 풀스택 E2E 회귀 검증을 수행하기를, so that 34개의 방치된 스크립트 대신 신뢰할 수 있는 릴리즈 게이트를 확보할 수 있다.
3. As an 테스트 유지보수자, I want 고정 `sleep`과 스타일 클래스 셀렉터 대신 웹 표준 접근성 역할과 자동 대기(`expect`)를 사용하기를, so that UI 스타일 리팩토링 시 E2E 테스트가 깨지지 않는다.

## Implementation Decisions (구현 결정사항)

- **격리된 E2E 하네스**: 전용 임시/격리 SQLite DB(`e2e_assets.db`)와 `FakeMarketAdapter`가 활성화된 백엔드·프론트엔드 서버를 자동으로 기동·시드·종료하는 `@playwright/test` 설정(`webServer` 및 글로벌 셋업/티어다운)을 구축한다.
- **핵심 사용자 여정 스펙**: 대시보드 조회, 원장 거래 등록·수정, 스냅샷 5단계 위저드, 지출 업로드·분류·통계, 자산 비중·리스크 진단, 모바일 주요 화면 여정을 접근성 역할 기반 셀렉터와 `expect` 단언으로 작성한다.
- **레거시 정리 및 러너 연결**: 기존 34개 일회성·임시 E2E 스크립트를 일괄 삭제하고 통합 테스트 러너에서 공식 E2E 스위트를 실행할 수 있도록 연결한다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 헤드리스 브라우저에서 실제 HTTP 통신과 DB 영속화를 포함한 풀스택 사용자 여정의 최종 화면 상태와 데이터를 단언한다.
- **사전 합의된 테스트 심 (Pre-agreed Seams)**:
  - 공식 Playwright E2E 러너 인터페이스(격리 SQLite DB + `FakeMarketAdapter` 서버 + 헤드리스 브라우저): **Catches** 풀스택 라우팅, 핵심 사용자 여정, 백엔드-프론트엔드 통합 회귀 / **Misses** 외부 증권사 실시간 API 장애
- **참고할 기존 테스트 패턴**: `scripts/test.py`의 통합 테스트 실행 구조 및 프론트엔드 `package.json` 스크립트 규약.

## Out of Scope (범위 제외 사항)

- 실 운영 서버 또는 외부 증권사 API를 직접 호출하는 크로스브라우저/프로덕션 E2E 테스트.

## Further Notes (기타 참고사항)

- 01 → 02 → 03 순서로 진행하여 공식 E2E 스위트가 완전히 동작함을 확인한 뒤 레거시 스크립트를 삭제한다.
