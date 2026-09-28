# 02 — 벤치마크 기여도 MCP 도구 구현 및 등록

**What to build:**
백엔드의 `GET /api/benchmark/attribution` 엔드포인트를 호출하여 포트폴리오 다기간 벤치마크 성과표와 종목별 가중 손익 기여도(Top/Bottom 3 랭킹 포함)를 반환하는 `get_benchmark_attribution` FastMCP 도구를 구현하고 등록합니다.

**Blocked by:** 01 — 백엔드 벤치마크 기여도 계산 서비스 및 REST API 엔드포인트 구현

**Status:** resolved

## Acceptance Criteria

- [x] `src/mcp/tools/benchmark.py` 모듈이 신규 생성되고, `get_benchmark_attribution(as_of_date: Optional[str] = None)` 도구 함수가 구현되어 있다.
- [x] `src/mcp/main.py`에 `get_benchmark_attribution`이 임포트되어 FastMCP 도구로 등록되어 있다.
- [x] Antigravity IDE MCP 클라이언트를 위한 도구 스키마 명세 파일(`C:\Users\june8\.gemini\antigravity\mcp\assetmanager\get_benchmark_attribution.json`)이 생성되어 있다.
- [x] `get_benchmark_attribution` 호출 시 백엔드 API로부터 정상적으로 벤치마크 및 기여도 페이로드를 받아 반환한다.
