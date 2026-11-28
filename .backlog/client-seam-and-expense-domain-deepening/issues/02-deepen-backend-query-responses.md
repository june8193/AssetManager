# 02 — 관심종목·리스크·지출 백엔드 조회 인터페이스 심화

**Spec:** [spec.md](../spec.md)

**What to build:** 클라이언트 계층으로 누수되던 파생 계산과 데이터 결함을 백엔드 인터페이스로 흡수하여, 관심종목 시세 응답에 `stock_name`을 포함하고, 리스크 변동성 응답에 `max_mdd`·`risk_weight_ratio`·`top_risk_contributors`를 기본 제공하며, 지출 조회가 `category_name` 필터와 페이징 이전 전체 매칭 건수(`total_count`)를 반환하도록 심화한다.

**Blocked by:** 01-extract-expense-domain-module-and-pdf-pipeline

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] 관심종목 시세 조회 응답에 각 종목의 `stock_name`이 누락 없이 포함된다.
- [ ] 리스크 변동성 조회 응답에 포트폴리오 `max_mdd` 및 상위 리스크 기여 종목 파생 지표가 포함된다.
- [ ] 지출 목록 조회가 `category_name` 필터와 페이징(`limit`)과 무관한 정확한 전체 매칭 건수(`total_count`)를 반환한다.
- [ ] `uv run pytest`로 관심종목·리스크·지출·MCP 관련 테스트가 모두 통과한다.
