# Map: 샤프/소티노 지수 및 총 자산 MDD 계산 기능 추가

- **공식 사양서**: [spec.md](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/spec.md)

## Destination

각 지수, 종목 및 입출금이 배제된 총 자산(포트폴리오)에 대해 샤프 지수(Sharpe Ratio), 소티노 지수(Sortino Ratio), 최대 낙폭(MDD)을 정확히 계산하고 백엔드 API, MCP 서비스 및 프론트엔드 UI에 통합하여 체계적인 위험조정 성과 분석 기능을 제공하는 것.

## Notes

- **관련 도메인 문서**: `docs/adr/`, `CONTEXT.md`
- **핵심 원칙**: TDD 준수, 입출금(입금/출금/계정간 이체)이 총 자산 수익률 및 변동성에 영향을 주지 않도록 TWR(시간가중수익률) 기반 순수 수익률 계산 적용.
- **연산 기준**: 일별 수익률(Daily Return) 기반 연율화(Annualization factor = \sqrt{252} 또는 252일, 단리 $R_{f, daily} = R_{f, annual}/252$).

## Open Tickets (Frontier)

- [01-risk-free-rate-setting](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/01-risk-free-rate-setting.md) — 무위험 수익률 DB 저장 및 API/UI 설정 기능 *(Blocked by: None — ready to start)*
- [02-asset-risk-performance-metrics](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/02-asset-risk-performance-metrics.md) — 지수 및 개별 종목 위험조정 지수(Sharpe, Sortino) API 및 UI 노출 *(Blocked by: 01)*
- [03-portfolio-twr-and-risk-metrics](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/03-portfolio-twr-and-risk-metrics.md) — 불규칙 스냅샷 보간 기반 총 자산 TWR & 샤프/소티노 계산 엔진 및 API *(Blocked by: 01)*
- [04-portfolio-mdd-chart-ui](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/04-portfolio-mdd-chart-ui.md) — 총 자산 MDD 추이 차트 및 성과 대시보드 UI 구현 *(Blocked by: 03)*
- [05-performance-info-modal](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/05-performance-info-modal.md) — AssetManager 실제 계산 알고리즘 안내 모달(`PerformanceInfoModal`) 구현 *(Blocked by: 02, 03, 04)*
- [06-mcp-tool-risk-metrics-extension](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/06-mcp-tool-risk-metrics-extension.md) — MCP 서버 도구 연동 (`get_portfolio_status`, `get_asset_ratios`) *(Blocked by: 02, 03)*

## Decisions so far

- [01-risk-free-rate-policy](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/01-risk-free-rate-policy.md) — 무위험 수익률($R_f$)은 사용자가 웹 UI에서 직접 설정하고 DB에 저장하여 관리하기로 함.
- [02-sharpe-sortino-calculation-spec](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/02-sharpe-sortino-calculation-spec.md) — 연율화 252일 표준 및 단순 산술 일별 무위험 수익률 $R_{f, daily} = R_{f, annual}/252$을 차감한 샤프/소티노 지수 세부 공식 확정.
- [03-portfolio-twr-engine](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/03-portfolio-twr-engine.md) — `account_snapshots`의 `total_valuation`과 `period_deposit`을 기반으로 입출금이 배제된 일별 TWR($r_t$) 및 불규칙 스냅샷 간격 일별 보간 적응 엔진 구축 결정.
- [04-total-asset-mdd-spec](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/04-total-asset-mdd-spec.md) — 기존 지수 분석 메뉴와 동등하게 최근 MDD, 기간 내 최고 MDD 및 일별 Drawdown 백분율 추이 차트 시계열 제공 확정.
- [05-api-mcp-and-ui-integration](file:///c:/localrepo/AssetManager/.scratch/risk-performance-metrics/issues/05-api-mcp-and-ui-integration.md) — 온디맨드 동적 계산 REST API 및 MCP 도구, 프론트엔드 대시보드 UI 연동 설계 확정 (주기적 배치 저장 제외).

## Not yet specified

- 벤치마크 지수 대비 포트폴리오의 알파/베타/트레이너 지수 확장 여부

## Out of scope

- 레버리지/파생상품 특수 Option Greeks 계산
- 복잡한 몬테카를로 시뮬레이션 기반 추정 MDD
- 1차 버전에서의 주기적(배치) 샤프/소티노 미리 계산 테이블 저장 (온디맨드 연산 우선 적용)
