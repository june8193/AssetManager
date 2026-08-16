# 05 — Service Migration and Full Regression Verification

**What to build:** 기존 `PriceService`, `BenchmarkService`, 라우터 및 관련 서비스들의 외부 API 직접 호출부를 `MarketDataProvider`로 위임/전환하고, AssetManager MCP 및 기존 백엔드 전체 회귀 테스트를 검증합니다.

**Blocked by:** 04 — Real Market Adapters (Kiwoom and YahooFinance)

**Status:** resolved

- [x] `PriceService`의 공개 메서드들이 내부적으로 `MarketDataProvider`를 호출하도록 위임 전환된다.
- [x] `BenchmarkService`의 과거 시세 및 지수 조회 로직이 `MarketDataProvider`를 호출하도록 전환된다.
- [x] 기존 FastAPI 라우터 엔드포인트 응답 규격 및 AssetManager MCP 도구들과의 하위 호환성이 100% 유지된다.
- [x] 전체 백엔드 테스트(`uv run pytest`)가 회귀 없이 100% 통과한다.
