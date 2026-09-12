# Feature Spec: MCP 시스템 로그 조회(get_system_logs) 인터페이스 및 매핑 개선

Status: ready-for-agent

## Problem Statement

현재 AI 에이전트(개발 PC 또는 원격 환경)가 서버의 로그를 확인하기 위해 `get_system_logs` MCP 도구를 호출할 때 다음과 같은 문제와 사용성 저하가 발생합니다:

1. **서버 내부 파일명 노출 및 강결합**:
   - `get_system_logs` 도구의 파라미터로 실제 파일명(`filename`)을 직접 입력받도록 설계되어 있습니다.
   - 외부 에이전트나 호출자는 서버의 프로세스 구동 방식(PM2 등)이나 실제 파일명(`pm2-err.log`, `pm2-out.log`)을 사전에 알 수 없음에도 파일명을 요구받습니다.
2. **기본값 불일치로 인한 404 장애**:
   - `filename`의 기본값이 `"app.log"`로 하드코딩되어 있으나, 실제 운영 서버에는 PM2 로그 파일만 존재하여 파라미터 없이 도구를 호출하면 항상 404 (Not Found) 에러가 발생합니다.
3. **직관적이지 않은 목적 중심 호출**:
   - 에이전트가 시스템 오류를 진단할 때는 "에러 로그"를 보고 싶어 하고, 요청 흐름을 볼 때는 "표준 출력 로그"를 보고 싶어 하지만 이를 표현할 추상화된 인터페이스(`log_type`)가 없습니다.

## Solution

1. **`filename` 파라미터 제거 및 `log_type` 도입**:
   - MCP 도구 호출 인터페이스에서 내부 구현 상세인 `filename`을 완전히 숨깁니다.
   - 대신 `"error"`(에러 로그)와 `"output"`(표준/일반 출력 로그)을 지정할 수 있는 직관적인 `log_type` 파라미터를 제공합니다.
2. **에러 진단 목적의 기본값(`log_type="error"`) 설정**:
   - 에이전트가 인자 없이 `get_system_logs()`를 호출하면 가장 흔히 사용되는 에러 로그를 기본으로 조회하도록 설정하여 단 한 번의 호출로 문제 원인을 파악할 수 있도록 합니다.
3. **서버 환경 고정 매핑 처리**:
   - 서버 백엔드에서 `log_type="error"` 요청 시 `pm2-err.log`, `log_type="output"` 요청 시 `pm2-out.log`로 정확히 매핑하여 로그를 추출합니다.
4. **기존 웹 UI 하위 호환성 보장**:
   - 백엔드 REST API는 신규 `log_type` 쿼리 파라미터와 함께 기존 `filename` 파라미터도 계속 수용하여 기존 웹 대시보드(프론트엔드) 기능이 중단되지 않도록 완벽한 하위 호환성을 유지합니다.

## User Stories

1. As an AI agent diagnosing server issues, I want to call `get_system_logs()` without arguments, so that I can immediately inspect the latest backend error logs without knowing internal server file paths.
2. As an AI agent monitoring server activities, I want to call `get_system_logs(log_type="output")`, so that I can review recent HTTP requests and standard application outputs.
3. As an AI agent debugging a specific problem, I want to filter logs by keyword using `get_system_logs(log_type="error", keyword="database")`, so that I can quickly pinpoint relevant failure lines.
4. As an AI agent analyzing error severity, I want to specify log levels like `get_system_logs(log_type="output", level="WARN")`, so that I only see warnings or errors in the general stream.
5. As an AI agent needing deeper history, I want to specify line counts like `get_system_logs(log_type="error", lines=200)`, so that I can inspect longer backtraces up to the permitted limit.
6. As a frontend dashboard user, I want the web UI to continue retrieving specific log files using `filename`, so that my existing log viewer page does not break.
7. As a developer running unit tests, I want predictable mock responses when querying logs by `log_type`, so that test suites run reliably in continuous integration.

## Implementation Decisions

1. **MCP 도구 인터페이스 변경**:
   - `get_system_logs` 함수의 시그니처에서 `filename: str = "app.log"`를 제거합니다.
   - `log_type: str = "error"` 파라미터를 추가하며, 허용 값은 `"error"` 및 `"output"`으로 제한/검증합니다.
   - `lines: Optional[int] = 100`, `level: Optional[str] = None`, `keyword: Optional[str] = None` 파라미터는 기존 유지합니다.
   - MCP 도구 JSON 스키마 파일도 이에 맞추어 업데이트합니다.

2. **백엔드 REST API 매핑 및 하위 호환성**:
   - 백엔드의 로그 내용 조회 엔드포인트는 `log_type` (선택)과 `filename` (선택)을 모두 수신할 수 있도록 변경합니다.
   - 매핑 규칙:
     - `log_type == "error"`: 대상 파일을 `pm2-err.log`로 처리
     - `log_type == "output"`: 대상 파일을 `pm2-out.log`로 처리
     - `filename`이 명시적으로 전달된 경우: 전달받은 파일명을 우선 탐색 (웹 UI 호환용)
     - 둘 다 생략된 경우: 기본값인 `log_type="error"`(`pm2-err.log`)로 처리
   - 잘못된 `log_type` 값이 전달될 경우 명확한 400 Bad Request 에러 메시지를 반환합니다.

3. **응답 구조 유지**:
   - 기존 응답 구조(`filename`, `total_lines`, `lines`)를 그대로 유지하여 클라이언트 변경을 최소화합니다.

## Testing Decisions

- **좋은 테스트의 기준**: 내부 구현 파일의 절대 경로가 아닌, 외부 인터페이스(`log_type` 전달 시 기대하는 필터링 결과 및 오류 처리)의 동작을 검증합니다.
- **테스트 대상 모듈 및 Seam**:
  1. **MCP 시스템 도구 모듈 (MCP Seam)**: `get_system_logs` 호출 시 기본값이 올바르게 `log_type="error"`로 백엔드 클라이언트에 전달되는지, `log_type="output"` 전달 시 올바른 파라미터가 구성되는지 검증 (`tests/test_mcp_system_tools.py`).
  2. **백엔드 시스템 라우터 (API Seam)**: `TestClient`를 통해 `/api/v1/system/logs/content`에 `log_type="error"`, `log_type="output"`, `log_type="invalid"`, 그리고 기존 `filename=...` 요청 시의 정상 응답 및 예외 응답을 검증 (`tests/test_system_api.py`).
  3. **프론트엔드 서비스 (UI Seam)**: 기존 프론트엔드 `systemService.test.js` 테스트가 영향 없이 그대로 통과하는지 확인.
- **기존 테스트 참고 (Prior Art)**:
  - `tests/test_system_api.py`의 `test_get_log_content_*` 테스트 케이스.
  - `tests/test_mcp_system_tools.py`의 `test_get_system_logs_mcp` 테스트 케이스.

## Out of Scope

- 서버에 존재하는 로그 파일 목록을 조회하는 신규 MCP 도구(`get_log_files`) 추가 (인터페이스 단순화를 위해 제외).
- 로깅 라이브러리 교체 또는 로그 포맷 변경.
- 다중 파일 병합(Merge) 스트리밍 기능.

## Further Notes

- PM2 로그 파일(`pm2-err.log`, `pm2-out.log`) 외의 로그 파일을 개발 환경에서 테스트할 때 가상 파일(fixture)을 생성하여 테스트 격리를 보장해야 합니다.
