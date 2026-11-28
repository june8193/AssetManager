# 01 — 고아 CLI 스크립트 4종 및 대응 죽은 테스트 삭제

**Spec:** [spec.md](../spec.md)

**What to build:** 스킬이 MCP로 전환된 뒤 호출자가 0건인 고아 CLI 스크립트 4종(`query_asset.py`, `query_market.py`, `query_stock.py`, `resolve_url.py`)을 삭제하고, 리포트 스크립트 테스트 파일에서 해당 죽은 모킹 테스트 섹션과 독스트링 언급을 정리한다.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 고아 CLI 스크립트 4종이 레포지토리에서 삭제되고, 과거 완료 백로그(`.backlog/done/`) 외에 잔존 참조가 0건이다.
- [ ] `tests/test_report_scripts.py`에서 삭제된 4개 스크립트 테스트가 제거되고 유지 대상 CLI(저장소 경로·텔레그램·한/미 뉴스) 테스트가 모두 통과한다(`uv run pytest tests/test_report_scripts.py`).
