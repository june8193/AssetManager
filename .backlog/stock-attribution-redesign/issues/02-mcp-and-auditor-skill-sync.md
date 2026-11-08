# 02 — MCP 도구 스키마 및 `asset-auditor` 스킬 리포트 포맷 동기화

**Spec:** [spec.md](../spec.md)

**What to build:** 개편된 `/api/benchmark/attribution` 응답 스키마에 맞춰 MCP 도구(`get_benchmark_attribution`)의 독스트링과 단위 테스트(`tests/test_mcp_benchmark.py`)를 업데이트하고, `.agents/skills/asset-auditor/SKILL.md`에 기술된 1단계 보유 종목 다기간 성과 및 기여도 분석/표 출력 지침을 갱신하여 감사 리포트 및 마스터 저널 작성 시 주가(자본) 손익과 배당/세금 손익 구분, 미국 종목 USD 기본 표기, 전량 매도 종목(`CLOSED`) 표기 규칙이 일관되게 적용되도록 합니다.

**Blocked by:** `01-actual-pnl-attribution-engine`

**Status:** ready-for-agent

- [ ] `src/mcp/tools/benchmark.py`의 `get_benchmark_attribution` 함수 독스트링(Docstring)에 자본 손익/배당 손익 분리, 포지션 실제 수익률 vs 시장 주가 등락률, 미국 종목 USD 기본 표기 및 전량 매도 종목(`CLOSED`) 포함 명세를 반영.
- [ ] `tests/test_mcp_benchmark.py`의 모킹 응답 픽스처 및 검증 어설션을 신규 스키마(`capital_pnl`, `dividend_pnl`, `total_pnl`, `capital_returns`, `returns`, `price_returns`, `contributions`, `status`, `currency` 등)에 맞게 업데이트하고 `uv run pytest tests/test_mcp_benchmark.py` 통과 확인.
- [ ] `.agents/skills/asset-auditor/SKILL.md`의 1단계(4번 항목 및 7번 항목 표 양식)와 6단계(저널/보고서 갱신 지침)를 업데이트하여, `[보유 종목 다기간 성과 및 기여도]` 표 출력 시 ① 내 포지션 자본수익(률)과 배당/세금 수익을 구분 표기하고, ② 미국 종목은 USD 기본 손익(KRW 환산 보조 병기)으로 표기하며, ③ 기간 중 전량 매도(`CLOSED`)된 주요 기여/부진 종목도 누락 없이 복기 표에 포함하도록 명시.
