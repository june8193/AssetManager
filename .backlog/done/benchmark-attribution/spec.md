# Spec: 벤치마크 다기간 성과 및 보유 종목 손익 기여도(Attribution) API와 MCP 도구 개발

Status: ready-for-agent

## Problem Statement

자산 점검 및 투자 복기(`asset-auditor`) 수행 시, 에이전트(클라이언트)가 포트폴리오의 4개 기간(1개월, 3개월, 1년, 연초 대비) 수익률과 S&P 500 대비 초과수익률(Alpha), 그리고 15~20개에 달하는 전체 보유 종목의 기간별 주가 수익률과 포트폴리오 손익 기여도(Top Contributors & Detractors)를 산출하기 위해 개별 종목 시세를 외부 API로 순차 조회하면서 3~5분 이상의 극심한 지연(병목)이 발생했습니다.

또한, 입출금(원금 변동)이 보정된 정규화 누적 수익률을 산출하는 단일 MCP 도구가 부재하여 에이전트가 백엔드 소스코드를 임의로 열람하여 알고리즘을 역공학하거나 로컬 DB(`db_query.py`)를 직접 조회하려 시도하는 등 운영 원칙을 위반하고 시스템 신뢰성을 저해하는 문제가 있었습니다.

## Solution

서버 백엔드가 이미 보유하고 있는 스냅샷 및 캐시된 시세 데이터와 벤치마크 연산 엔진을 활용하여, 1회 호출로 0.5초 이내에 다음 데이터를 일괄 산출하여 반환하는 신규 API 엔드포인트(`GET /api/benchmark/attribution`)와 전용 MCP 도구(`get_benchmark_attribution`)를 구축합니다:

1. **4대 기간(1M, 3M, 1Y, YTD) 벤치마크 및 초과수익률(Alpha)**: 포트폴리오(입출금 시간가중 보정 누적 ROI), S&P 500, NASDAQ, KOSPI 수익률 및 S&P 500 대비 Alpha.
2. **보유 종목별 다기간 성과 및 손익 기여도(Attribution)**: 전체 보유 종목의 4대 기간 현지통화 주가 수익률 및 자산 가중 손익 기여도($\text{비중(\%)} \times \text{종목수익률(\%)} / 100$).
3. **핵심 성과 요약 랭킹**: YTD 및 1M 기준 Top 3 기여 종목(Top Contributors) 및 Bottom 3 부진 종목(Top Detractors).

이를 통해 `asset-auditor` 스킬은 로컬 DB나 백엔드 소스코드를 건드릴 필요 없이, 원격 서버의 검증된 고속 MCP 도구 호출 단 1번으로 완벽한 성과 및 종목 기여도 분석을 수행할 수 있게 됩니다.

## User Stories

1. As an 투자자 및 자산 관리자, I want 원격 서버 백엔드가 포트폴리오의 1M, 3M, 1Y, YTD 입출금 보정 누적 수익률을 정확히 계산하여 제공하기를, so that 중간 입출금에 의한 왜곡 없이 시장 지수(S&P 500, 나스닥, 코스피) 대비 나의 실제 알파(Alpha)를 객관적으로 평가할 수 있다.
2. As an 자산 감사 에이전트(asset-auditor), I want 단 1회의 MCP 도구(`get_benchmark_attribution`) 호출로 4대 기간 벤치마크 성과표를 즉시 수집하기를, so that 3~5분간의 지연이나 로컬 DB 조회 없이 1~2초 내에 사용자에게 예비 진단 브리핑을 제공할 수 있다.
3. As an 투자자, I want 포트폴리오 전체 성과를 이끈 상위 3개 기여 종목(Top Contributors)과 손실을 유발한 상위 3개 부진 종목(Top Detractors)을 YTD 및 1M 기준으로 명확히 파악하기를, so that 어떤 가설(Thesis)이 성공했고 어떤 종목이 알파를 갉아먹고 있는지 명확한 팩트에 기반해 투자 복기를 진행할 수 있다.
4. As an 자산 감사 에이전트, I want 전체 보유 종목의 4개 기간별 현지 통화 주가 수익률과 자산 가중 기여도 리스트를 한 번에 확보하기를, so that 특정 부진 종목이나 과열 종목에 대해 깊이 있는 질의(Grill-Me)를 정밀하게 전개할 수 있다.
5. As an 시스템 개발자, I want 벤치마크 기여도 계산 로직이 백엔드 서비스 계층에 캡슐화되어 단위 테스트(TDD)로 철저히 검증되기를, so that 웹 대시보드 화면과 MCP 도구 간 지표 계산의 정합성을 100% 보장하고 유지보수를 용이하게 할 수 있다.

## Implementation Decisions

### 1. 백엔드 서비스 계층 확장
- 기존 벤치마크 서비스 클래스에 다기간 벤치마크 및 종목별 성과 기여도를 일괄 계산하는 통합 메서드(`get_attribution_summary`)를 추가합니다.
- 기준일자(기본값: 오늘)를 기준으로 1M(30일 전), 3M(90일 전), 1Y(365일 전), YTD(당해 1월 1일)의 4개 기간 범위를 산출합니다.
- 기존의 스냅샷 기반 시간가중 정규화 누적 수익률 계산 엔진을 활용하여 포트폴리오 및 3대 시장 지수(^GSPC, ^IXIC, ^KS11)의 기간 수익률 및 S&P 500 대비 Alpha를 도출합니다.
- 현재 포트폴리오 보유 종목 및 비중(전체 자산 평가액 대비)을 조회하고, 캐시된 역사적 시세 저장소에서 각 종목의 기간별 시작일 및 종료일 종가를 조회하여 현지 통화 기준 주가 변동률을 계산합니다.
- 각 종목의 손익 기여도는 $\text{포트폴리오 비중(\%)} \times \frac{\text{종목 기간 수익률(\%)}}{100}$ 공식으로 산출하며, YTD 및 1M 기준 상위 3개 기여 종목과 하위 3개 부진 종목을 정렬하여 추출합니다.

### 2. 백엔드 REST API 엔드포인트 신설
- 벤치마크 라우터에 `GET /api/benchmark/attribution` 경로를 추가합니다.
- 선택적 쿼리 파라미터로 `as_of_date` (형식: YYYY-MM-DD)를 수신하여 과거 특정 시점 기준의 소급 조회를 지원합니다.
- 반환 페이로드 스키마 규격:
  ```json
  {
    "as_of_date": "2026-09-28",
    "benchmarks": {
      "1M": { "portfolio": 0.44, "sp500": 3.84, "nasdaq": 4.88, "kospi": 1.48, "alpha_vs_sp500": -3.40 },
      "3M": { "portfolio": -1.97, "sp500": 13.56, "nasdaq": 16.03, "kospi": 4.77, "alpha_vs_sp500": -15.53 },
      "1Y": { "portfolio": 3.75, "sp500": 15.68, "nasdaq": 19.86, "kospi": 5.48, "alpha_vs_sp500": -11.93 },
      "YTD": { "portfolio": 5.39, "sp500": 12.33, "nasdaq": 14.51, "kospi": 4.19, "alpha_vs_sp500": -6.94 }
    },
    "top_contributors_ytd": [
      { "ticker": "GOOGL", "name": "Alphabet Inc.", "weight": 11.62, "return": 80.98, "contribution": 9.41 },
      ...
    ],
    "top_detractors_ytd": [
      { "ticker": "000660", "name": "SK하이닉스", "weight": 9.25, "return": -21.54, "contribution": -1.99 },
      ...
    ],
    "top_contributors_1m": [ ... ],
    "top_detractors_1m": [ ... ],
    "holdings_attribution": [
      {
        "ticker": "GOOGL",
        "name": "Alphabet Inc.",
        "weight": 11.62,
        "valuation_krw": 53168143,
        "returns": { "1M": 6.69, "3M": 15.20, "1Y": 45.10, "YTD": 80.98 },
        "contributions": { "1M": 0.78, "3M": 1.77, "1Y": 5.24, "YTD": 9.41 }
      },
      ...
    ]
  }
  ```

### 3. MCP 도구 모듈 구성 및 등록
- `src/mcp/tools/benchmark.py` 모듈을 신규 생성하여 벤치마크 및 기여도 전용 도구 함수 `get_benchmark_attribution`을 작성합니다.
- 내부적으로 백엔드 HTTP 클라이언트를 통해 위 API 엔드포인트를 호출하고 결과를 반환합니다.
- `src/mcp/main.py`에 임포트하고 FastMCP 도구로 등록합니다.
- Antigravity IDE MCP 클라이언트를 위한 도구 스키마 명세 JSON(`get_benchmark_attribution.json`)을 해당 mcp 디렉터리에 생성합니다.

### 4. `asset-auditor` 스킬 연동 및 복원 (`writing-great-skills` 원칙 적용)
- **예측 가능성(Predictability) 및 정보 위계(Information Hierarchy)**:
  - 에이전트가 실행마다 동일한 확정적 프로세스를 따르도록 1단계(정보 수집 및 예비 진단)부터 단계별 완료 조건(Completion Criteria)을 명확하고 검증 가능하게(Checkable & Exhaustive) 정의합니다.
  - `get_benchmark_attribution` 단 1회의 MCP 도구 호출로 다기간 성과표와 종목별 손익 기여도(Top/Bottom 3)를 수집하여 3~5초 이내에 브리핑을 완성하도록 단계를 설계합니다.
- **단일 진실 공급원(SSOT) 준수**:
  - 저널 저장 경로는 스킬 본문에 하드코딩하지 않고, `settings.toml`의 `storage_dir`을 유일한 기준(SSOT)으로 삼아 `scripts/get_storage_dir.py`를 통해 동적으로 결정합니다.
- **네거티브 스티어링 방지 및 긍정적 대체 행동 페어링(Positive Guardrails)**:
  - "로컬 DB(`db_query.py`)를 조회하지 마라"와 같은 금지형(Negation) 지시는 모델의 인지 가용성을 왜곡하므로, 반드시 "오직 `assetmanager` 원격 MCP 도구(`get_benchmark_attribution`, `get_asset_summary` 등)를 통해서만 데이터를 획득하라"는 구체적인 긍정적 목표 행동(Positive Target Behavior)과 1:1로 페어링합니다.
- **선도 단어(Leading Words) 활용 및 군더더기 가지치기(Pruning)**:
  - `Attribution`, `Alpha`, `Grill-Me`, `SSOT` 등 사전학습된 강력한 선도 단어로 개념을 압축하여 중복(Duplication)과 맥락 부하(Context Load)를 최소화합니다.
  - 모델이 기본적으로 수행하는 당연한 서술(No-op)이나 불필요하게 비대해진 설명(Sprawl/Sediment)을 전면 가지치기합니다.

## Testing & Review Decisions

- **외부 동작 중심 백엔드 테스트**: API 엔드포인트와 서비스 메서드가 올바른 4개 기간 벤치마크 수치와 종목별 가중 기여도 계산 결과를 규격에 맞춰 반환하는지 검증합니다 (`pytest.mark.asyncio`, 격리된 테스트 환경).
- **스킬 품질 및 코드리뷰 검증 기준 (`writing-great-skills` 규격)**:
  - 스킬 파일 변경 후 코드리뷰 수행 시 다음 원칙을 필수 검증 항목으로 평가합니다:
    1. **Predictability**: 에이전트가 매 실행 시 동일한 프로세스를 따르는가?
    2. **Checkable Completion Criteria**: 각 단계가 성급한 종료(Premature completion)를 유발하지 않도록 검증 가능한 완료 조건을 갖추었는가?
    3. **SSOT**: 경로 및 설정이 단일 원천(`settings.toml`)에 의존하고 하드코딩되지 않았는가?
    4. **Positive Guardrails**: 금지 사항이 긍정적 대체 행동(`assetmanager` MCP 호출)과 명확히 페어링되어 있는가?
    5. **Pruning & No-op Free**: 토큰 낭비, 중복(Duplication), 퇴적물(Sediment), No-op 문장이 배제되었는가?

## Out of Scope

- 시장 지표(S&P 500 고점 대비 MDD, 최근 20거래일 VIX)의 신규 엔드포인트 통합 (기존 `get_market_history` 도구 유지 및 활용).
- 자산 배분 비중 및 리밸런싱 가이드의 본 API 통합 (기존 `get_asset_ratios` 도구 유지).
- 매매 거래 내역 및 미복기 필터링 로직의 본 API 통합 (기존 `get_transactions` 도구 유지).

## Further Notes

- 서버 캐시 시세(`historical_prices`)에 특정 보유 종목 데이터가 누락된 경우를 대비하여 `close_price > 0` 유효 레코드 기반으로 방어적으로 처리합니다.
- 이 기능이 완성되면 에이전트의 1단계 감사 준비 소요 시간이 기존 3~5분에서 1~2초 이내로 단축됩니다.
