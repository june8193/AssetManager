# 02 — 리포트 스킬 5종 정합화 및 ADR-0001 기록

**Spec:** [spec.md](../spec.md)

**What to build:** 5개 정기 리포트 스킬의 텔레그램 발송 호출을 멀티라인 문자열 대신 생성된 보고서 파일 경로 인자 전달 방식으로 통일하고, `asset-monthly-report`의 종목별 기여도 산출을 기존 `get_benchmark_attribution` MCP 도구 호출로 연결하며, 스킬 정책·포맷 마크다운 유지 및 서버 로컬 배치 CLI 유지 원칙을 `docs/adr/0001-...md`로 기록한다.

**Blocked by:** 01-remove-orphan-cli-scripts-and-dead-tests

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 5개 리포트 스킬 모두 `send_telegram.py` 호출 시 생성된 보고서 파일 경로를 전달하도록 갱신된다.
- [ ] `asset-monthly-report` 스킬이 종목별 시세 N회 개별 조회 대신 `get_benchmark_attribution` MCP 도구를 사용해 기여도를 산출한다.
- [ ] `docs/adr/`에 `ADR-0001` 문서가 한국어 ADR 형식에 맞춰 생성된다.
- [ ] `uv run pytest tests/test_report_scripts.py`가 통과한다.
