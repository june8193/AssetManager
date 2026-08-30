# 01 — [백엔드] 월간 자산 통계 계산 엔진, 대시보드 API 및 MCP 도구 구현

**What to build:** 
스냅샷 데이터를 기반으로 연월(YYYY-MM) 단위의 자산 통계(기초자산, 기말자산, 순입금, 투자손익, ROI)를 산출하는 백엔드 도메인 서비스, 대시보드 월간 통계 조회 REST API, 그리고 AI 에이전트용 `get_monthly_stats` MCP 도구를 구현합니다.

**Blocked by:** None — can start immediately

**Status:** done

- [x] 스냅샷 데이터를 연월(YYYY-MM) 단위로 집계하여 기말자산(당월 마지막 스냅샷 평가액) 및 순입금액(당월 모든 스냅샷의 period_deposit 합)을 계산할 수 있다.
- [x] 직전 월의 마지막 스냅샷 평가액을 기초자산으로 삼아 전월비 증감, 투자손익, 월간 ROI(수익률)를 수학적으로 정확하게 산출한다 (최초 기록 월은 첫 스냅샷의 valuation - deposit을 기초자산으로 적용).
- [x] 결과는 최신 연월이 가장 앞에 오도록 내림차순 정렬되어 반환된다.
- [x] `GET /api/dashboard/stats/monthly` (또는 `GET /api/dashboard/monthly_stats`) REST API 호출 시 월간 통계 목록 JSON 응답을 제공한다.
- [x] `get_monthly_stats` MCP 도구를 통해 월간 통계를 조회할 수 있다.
- [x] pytest 단위 테스트를 통해 단일 월, 다중 월, 입출금 발생, 비활성 계좌 포함 여부 등 다양한 시나리오에 대해 검증한다.
