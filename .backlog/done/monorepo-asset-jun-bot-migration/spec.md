# Feature Spec: Asset-jun-bot 잔여 스킬 및 텔레그램 기능 이관을 통한 AssetManager 모노레포 단일화

Status: done

## Problem Statement

현재 자산 관리 생태계는 1차 통합 작업을 통해 텔레그램 봇의 핵심 CLI 커맨드와 정기 보고서 5종 스킬을 `AssetManager`로 이관하였으나, 여전히 두 개의 저장소(`AssetManager`와 `Asset-jun-bot`)로 분리되어 운영되고 있습니다.

이로 인해 다음과 같은 문제점이 존재합니다:
1. **투자 자문 및 복기 스킬의 파편화**: 1:1 대화형 투자 상담 스킬(`asset-advisor`)과 다기간 성과 진단 및 원칙 검증 스킬(`asset-auditor`), 그리고 이들의 기반이 되는 투자 원칙 및 과거 매매 사례집(`docs/references/`)이 구 레포지토리인 `Asset-jun-bot`에 여전히 남아있어, `AssetManager` 단일 환경에서 자산 분석과 상담을 원스톱으로 수행할 수 없습니다.
2. **저장소 경로 및 과거 감사 기록 분리**: 기존 자산 감사 저널(`asset_audit_journal.md`)과 과거 보고서들이 저장된 Google Drive 저장소 경로와 `AssetManager`의 기본 설정 간에 연결이 끊어져 있어 이전 감사 이력과의 연속성이 단절될 위험이 있습니다.
3. **원격 프로세스 제어 부재**: `Asset-jun-bot`에서 상시 운영 중 지원되던 텔레그램 기반 원격 재시작(`/restart`) 커맨드가 누락되어, 서버 코드나 환경 설정 변경 후 원격에서 안전하게 데몬 프로세스를 재시동할 수 있는 제어 수단이 없습니다.
4. **모노레포 전환 지연**: 위 기능들이 이전되지 않아 `Asset-jun-bot` 레포지토리를 완전히 아카이빙하지 못하고 두 프로젝트를 번갈아 열람해야 하는 인지적·관리적 비효율이 지속되고 있습니다.

## Solution

`Asset-jun-bot` 레포지토리를 일체 수정하지 않고(Read-Only 참조), 필요한 잔여 에이전트 스킬, 핵심 지식 문서, 텔레그램 원격 제어 커맨드를 `AssetManager`로 이관하여 **완전한 단일 모노레포 체제**를 완성합니다.

1. **에이전트 스킬 2종 및 지식 베이스 완전 내재화**:
   - `asset-advisor`(투자 상담/원칙 코칭) 및 `asset-auditor`(다기간 성과/Alpha 분석, 원칙 검증 Grill-Me, 매매 복기) 스킬을 `AssetManager`의 에이전트 스킬 디렉토리로 이관합니다.
   - 투자 철학 및 원칙 가이드라인, 매매 사례 색인 및 개별 사례 상세 문서를 공용 참조 디렉토리로 이관하여 에이전트가 단일 저장소 내에서 즉각 탐색할 수 있도록 합니다.

2. **저장소 경로 일원화 및 과거 감사 기록 연속성 보장**:
   - 설정 파일의 텔레그램 저장소 경로(`storage_dir`)를 기존 감사 저널 및 보고서 히스토리가 누적된 Google Drive 디렉토리로 연결하여, 이전 감사 일자 파악 및 활성 전략 계승이 자연스럽게 이어지도록 합니다.

3. **텔레그램 `/restart` 명령어 및 재시작 완료 알림 복원**:
   - 텔레그램 명령어 디스패처에 `/restart` 라우팅을 추가하고, `/help` 안내 목록에 등록합니다.
   - `/restart` 수신 시 저장소 디렉토리에 재시작 대기 플래그를 생성하고 사용자에게 진행 안내를 보낸 뒤 프로세스를 안전하게 종료하여, PM2가 감지하고 프로세스를 자동 재시작하도록 유도합니다.
   - 서버 기동(FastAPI lifespan 시작) 시 재시작 플래그가 발견되면 등록된 허가 사용자들에게 재시작 완료 알림을 발송하고 플래그를 자동 정리합니다.

4. **운영 체제 단순화**:
   - 불필요한 파일 롤링 로거 및 중복 테스트 코드는 제외하여 코드베이스를 슬림하게 유지하며, 모든 자산 관리/투자 상담/자동 알림을 `AssetManager` 단일 레포지토리에서 총괄합니다.

## User Stories

1. As an investor, I want to use the `asset-advisor` skill directly in the AssetManager workspace, so that I can receive real-time portfolio advice and coaching without switching repositories.
2. As an investor, I want to execute the `asset-auditor` skill within AssetManager, so that I can audit multi-period portfolio returns (1M, 3M, 1Y, YTD), benchmark alpha, and trade attributions in one place.
3. As an investor, I want the agent to strictly refer to my documented investment principles during advisory and auditing conversations, so that I maintain disciplined, thesis-driven investing.
4. As an investor, I want the agent to cite historical trade cases from the cases library when reviewing my new trades or market scenarios, so that I avoid repeating past behavioral errors.
5. As an investor, I want the `storage_dir` setting to point directly to my Google Drive storage folder, so that all previous audit journals and past market reports are immediately accessible.
6. As an investor, I want the audit journal to record newly completed asset audits sequentially, so that my active strategy history and historical audit dates remain unbroken.
7. As an investor, I want to send `/restart` in Telegram, so that I can remotely restart the production AssetManager daemon when maintenance or refresh is required.
8. As an investor, I want to receive an immediate response message in Telegram when I issue `/restart`, so that I know the shutdown sequence has initiated.
9. As an investor, I want the server process to exit cleanly upon `/restart` so that PM2 automatically restarts the production service without zombie processes.
10. As an investor, I want to receive a "Restart Completed" notification in Telegram once the backend server comes back online, so that I have certainty that the service is operational.
11. As an investor, I want `/help` in Telegram to list `/restart` alongside other available commands, so that I can discover and reference all supported CLI operations.
12. As a developer, I want all migrations to be performed purely within AssetManager without modifying `Asset-jun-bot`, so that the existing legacy repository remains safe and intact.
13. As a developer, I want the file rolling logger to be excluded in favor of existing PM2 log management, so that log output mechanisms remain unified and simple.
14. As a developer, I want redundant skill-mirror tests excluded to avoid bloating the test suite, keeping the CI pipeline lean and focused on business logic.
15. As a developer, I want the restart pending flag to be automatically cleaned up after the completion alert is dispatched, so that subsequent server restarts do not trigger false notifications.

## Implementation Decisions

1. **단일 저장소 모노레포 완결**:
   - `AssetManager`를 모든 자산 관리(웹 대시보드, 키움 증권 연동, 백엔드 API, 텔레그램 알림 봇, 7종 에이전트 스킬)의 단일 원천(Single Source of Truth)으로 확립합니다.
   - 외부 레포지토리 의존성을 완전히 제거합니다.

2. **지식 베이스 및 에이전트 스킬 통합**:
   - 공용 레퍼런스 디렉토리 아래에 투자 원칙, 매매 사례 색인, 개별 상세 사례 마크다운 문서를 구성합니다.
   - 에이전트 스킬 디렉토리 아래에 `asset-advisor`와 `asset-auditor` 스킬 정의서를 배치합니다.
   - 스킬 내부의 모든 상대 경로 참조(투자 원칙, 매매 사례집, 스토리지 조회 스크립트)가 모노레포 구조와 자연스럽게 부합하도록 유지합니다.

3. **설정값 동기화**:
   - 통합 설정 파일의 텔레그램 설정 섹션에서 저장소 디렉토리 경로를 기존 Google Drive 저장소 절대 경로로 갱신하여 자산 감사 저널 및 누적 리포트와의 연결을 유지합니다.

4. **원격 재시작(/restart) 아키텍처**:
   - 텔레그램 커맨드 패키지 내에 별도의 재시작 핸들러 모듈을 신설하고, 커맨드 라우터에 `/restart`를 등록합니다.
   - 핸들러 실행 시 저장소 디렉토리에 전용 플래그 파일을 기록하고 확인 메시지를 발송한 뒤, 비동기 지연 태스크를 통해 메인 프로세스를 정상 종료(`exit 0`)합니다.
   - 프로덕션 PM2 데몬은 비정상/정상 종료를 감지하여 프로세스를 자동으로 다시 구동합니다.
   - 텔레그램 봇의 기동 라이프사이클(롱폴링 시작 직전)에 플래그 파일 검사 루틴을 배치하여, 플래그가 존재할 때만 완료 안내 메시지를 브로드캐스트하고 플래그 파일을 삭제합니다.

5. **범위 통제 및 미이관 요소 확정**:
   - 파일 롤링 로거는 도입하지 않고 기존 PM2 표준 스트림 로깅을 유지합니다.
   - 단순 스킬 마크다운 파일의 존재 여부만 확인하는 불필요한 미러링 단위 테스트는 추가하지 않습니다.
   - `Asset-jun-bot` 저장소의 파일은 일체 수정하거나 삭제하지 않습니다.

## Testing Decisions

1. **테스트 품질 원칙**:
   - 내부 세부 구현 대신 외부 관측 가능한 동작(커맨드 수신, 메시지 응답, 플래그 파일 생성 및 삭제, 알림 발송)만을 검증합니다.
   - 네트워크 통신 및 실제 프로세스 강제 종료는 Mocking을 통해 격리하여 테스트 실행 환경의 안전성을 보장합니다.

2. **테스트 대상 및 시나리오**:
   - **`/restart` 커맨드 디스패치**: `/restart` 명령 수신 시 안내 메시지가 전송되고 재시작 플래그 파일이 올바르게 생성되는지 검증.
   - **`/help` 목록 갱신**: `/help` 명령어 실행 시 반환되는 텍스트에 `/restart` 안내가 포함되어 있는지 검증.
   - **재시작 플래그 감지 및 복구 알림**: 기동 루틴에서 플래그 파일이 있을 때 텔레그램 알림이 발송되고 파일이 삭제되는지, 플래그가 없을 때는 알림이 생략되는지 검증.
   - **기존 테스트 회귀 방지**: 기존 텔레그램 코어 커맨드 및 리포트 스크립트 테스트가 100% 통과하는지 회귀 검증.

3. **기존 테스트 선례 (Prior Art)**:
   - 기존 텔레그램 커맨드 테스트 모듈(`test_telegram_core.py`, `test_telegram_tx_stats.py`)의 비동기 Mock 패턴 및 Fixture를 준용.

## Out of Scope

- `Asset-jun-bot` 레포지토리 내 파일 수정, 이동, 또는 삭제 (해당 레포는 보존 목적의 읽기 전용).
- 파일 롤링 로거(`TimedRotatingFileHandler`) 추가 (기존 PM2 로그 파일 체계 유지).
- 스킬 파일 존재 여부만을 체크하는 스킬 미러 단위 테스트 추가.
- 자연어 LLM 텔레그램 대화 기능 복원 (Antigravity IDE 내 에이전트 대화로 완전 일원화).

## Further Notes

- 이관 완료 후 `Asset-jun-bot`은 더 이상 독립 프로세스로 기동할 필요가 없으며, 모든 일상적 자산 관리 및 에이전트 협업은 `AssetManager` 워크스페이스 단일 환경에서 수행할 수 있습니다.
- 스킬 실행 시 MCP 서버(`assetmanager`)의 포트폴리오, 거래내역, 시장 데이터 도구들과 유기적으로 결합되어 실시간 팩트 기반 상담 및 감사가 원활히 동작합니다.
