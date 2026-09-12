# 02 — MCP get_system_logs Interface Refinement & Schema Sync

**What to build:**
외부 AI 에이전트(개발 PC 등)가 시스템 로그를 조회할 때 파일명을 입력할 필요 없이 `log_type`('error' 또는 'output')을 통해 직관적으로 서버 로그를 조회할 수 있도록 MCP 도구 인터페이스와 스키마를 개편합니다. 인자 없이 `get_system_logs()`를 호출하면 자동으로 최신 에러 로그를 조회하여 신속한 문제 진단이 가능하도록 합니다.

**Blocked by:** 01 — Backend API log_type Parameter & Fixed Mapping Support

**Status:** ready-for-agent

- [ ] `get_system_logs` MCP 도구 시그니처에서 `filename` 파라미터를 완전히 제거하고 `log_type: str = "error"`를 추가합니다.
- [ ] 도구 독스트링(Docstring) 및 설명문구를 한글 규칙에 맞추어 명확하게 갱신합니다.
- [ ] Antigravity lazy-loaded MCP 도구 스키마 파일(`get_system_logs.json`)을 새로운 시그니처에 맞추어 갱신합니다.
- [ ] MCP 단위 테스트(`tests/test_mcp_system_tools.py`)를 갱신하여 `log_type` 기반 호출 및 기본값 동작을 검증합니다.
- [ ] 서버 환경에서 실제 MCP 도구 호출 E2E 검증을 수행하여 인자 없는 기본 호출 및 `log_type="output"` 호출이 정상 동작하는지 확인합니다.
