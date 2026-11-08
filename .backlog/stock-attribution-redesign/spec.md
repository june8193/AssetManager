# Spec: 실제 발생 손익(Actual P&L) 기반 개별 종목 포트폴리오 수익기여도(Attribution) 재설계

## Problem Statement (문제 정의)

기존 `BenchmarkService.get_attribution_summary`는 개별 종목의 기간별 포트폴리오 수익기여도(`contribution %p`)를 단순히 **`기말 비중(weight) × 기간 주가 등락률(price_return)`**로 근사 계산하고 있습니다. 이로 인해 정기 자산 감사(`asset-auditor`) 수행 시 다음과 같은 심각한 데이터 왜곡이 발생합니다:

1. **미보유 기간 주가 등락 왜곡 (Unheld Period Gain/Loss)**: 기간 중(예: 7월) 신규 매수한 종목에 대해 보유하지 않았던 연초(1~6월) 주가 급등분까지 기말 비중에 곱해져, 포트폴리오 전체 YTD 수익률은 `-1.16%`인데 개별 종목 YTD 기여도가 `+8.93%p`, `+6.33%p`로 산출되는 모순이 발생합니다.
2. **중도 분할 매수(물타기/불타기) 및 매도 단가 무시**: 기간 중 추가 매수하거나 일부 매도한 실제 체결 단가와 수량 변화가 수익률 및 기여도 계산에 전혀 반영되지 않습니다.
3. **기간 중 전량 매도(청산) 종목 누락**: 기간 중 손절매 또는 익절매하여 기준일(`as_of_date`) 현재 보유 수량이 `0`이 된 종목(예: `KODEX 코스피100`)은 분석 대상에서 아예 제외되어, 기간 수익률을 깎아먹은 핵심 원인(Detractor)이 감사에서 증발합니다.
4. **자본 손익과 배당/세금 손익 미분리**: 채권 ETF(`TLT`, `SGOV`) 및 배당주(`O`, `PFE`, `KO` 등)가 포함된 포트폴리오임에도 배당/이자 수익(`INTEREST` - `TAX`)이 반영되지 않거나 주가 변동 손익과 구분되지 않습니다.
5. **미국 주식(USD) 통화 표기 및 환율 기준 모호성**: 미국 주식의 순수 달러(USD) 성과와 전체 원화(KRW) 포트폴리오 대비 체급 기여도가 명확히 분리되어 있지 않습니다.

## Solution (해결 방안)

단일 원장 엔진(`LedgerEngine`)의 거래 이력과 역사적 시세(`HistoricalPrice`)를 결합하여, **실제 발생 손익(Actual P&L) 기반의 수익기여도 산출 엔진**으로 전면 개편합니다.

1. **분석 대상 종목 확대**:
   - 현금(`KRW`, `USD`)을 제외한 모든 상장 자산(`주식`, `채권` ETF)을 대상으로 합니다.
   - 기준일(`as_of_date`) 현재 보유 중인 종목뿐만 아니라, **4대 분석 기간(`1M`, `3M`, `1Y`, `YTD`) 중 기초에 보유했거나 기간 내 매매(`BUY`, `SELL`, `INITIAL_BALANCE`, `INTEREST`, `TAX`) 이력이 있는 전량 매도 종목**도 모두 포함합니다 (전량 매도 종목은 기말 `weight: 0.0%`, `quantity: 0.0`으로 표기).
   - 각 종목에 `major_category`, `sub_category`, `currency` 메타데이터를 포함합니다.
2. **자본 손익(Capital P&L)과 배당/세금 손익(Dividend P&L) 분리 산출 및 합산 기여도 계산**:
   - **자본 손익 (`capital_pnl`)**: 순수 주가 변동 및 매수/매도에 따른 손익
   - **배당/세금 손익 (`dividend_pnl`)**: 기간 내 발생한 세후 배당/이자 수익 (`INTEREST` - `TAX`)
   - **총 손익 (`total_pnl`)**: `capital_pnl + dividend_pnl` (총 수익기여도 `%p`는 총 손익을 기준으로 계산하되, 자본 손익과 배당 손익 및 각각의 기여도를 별도 필드로 모두 리턴)
3. **미국 종목(USD) 기본 통화 유지 및 기준일 단일 환율 체급 매칭 (환차손익 왜곡 배제)**:
   - 미국 종목(`country == 'US'` 또는 `currency == 'USD'`)은 기본 손익(`capital_pnl`, `dividend_pnl`, `total_pnl`)과 포지션 수익률(`capital_returns`, `returns`)을 **환율 계산 없이 순수 USD 기준**으로 산출합니다.
   - 보조 지표인 원화 환산 손익(`capital_pnl_krw`, `dividend_pnl_krw`, `total_pnl_krw`) 및 포트폴리오 전체 수익기여도(`contributions %p`)를 계산할 때만 **기준일(`as_of_date`) 단일 환율(`exchange_rate`)**을 곱하여 원화 총자산과 체급(스케일)을 맞춥니다.
4. **포트폴리오 기간 기준자본(분모) 정합성 확보**:
   - 각 기간(`1M`, `3M`, `1Y`, `YTD`)의 기여도(`%p`) 산출 시 분모는 해당 기간의 **`포트폴리오 기초 총자산(KRW) + 기간 내 순입출금액(KRW)`**으로 정의하여, 포트폴리오 기간 수익률 수식의 분모와 수학적 정합성을 맞춥니다.

## User Stories (사용자 스토리)

1. As an 자산 감사자(`asset-auditor`), I want 기간 중 신규 매수하거나 분할 매수(물타기)한 종목의 수익률과 기여도가 내가 실제로 보유한 시점과 매수 단가를 기준으로 계산되기를 원한다, so that 보유하지도 않았던 과거 기간의 주가 급등분이 내 성과로 왜곡 산입되는 것을 방지할 수 있다.
2. As an 자산 감사자(`asset-auditor`), I want 분석 기간(1M, 3M, 1Y, YTD) 중 전량 매도하여 현재 잔고가 0주인 종목도 기간 내 발생 손익과 기여도 및 Top/Bottom 3 랭킹에 포함되기를 원한다, so that 기간 중 손절하거나 익절한 매매가 포트폴리오 전체 성과에 미친 영향을 누락 없이 복기할 수 있다.
3. As an 자산 감사자(`asset-auditor`), I want 개별 종목의 성과에서 주가 변동으로 인한 자본 손익(`capital_pnl`, `capital_returns`)과 배당/세금으로 인한 수익(`dividend_pnl`)이 별도 필드로 분리되어 리턴되고 총 기여도(`contributions`)에는 합산되기를 원한다, so that 채권 ETF(`TLT`, `SGOV`) 및 배당주의 현금흐름 기여와 주가 변동 기여를 명확히 구분하여 진단할 수 있다.
4. As an 자산 감사자(`asset-auditor`), I want 미국 주식(USD)의 손익과 수익률은 순수 달러(USD) 기준으로 기본 제공되고 원화 환산 손익(`*_krw`) 및 포트폴리오 기여도(`%p`)에만 기준일 단일 환율이 적용되기를 원한다, so that 수동 환율 변경에 따른 환차손익 왜곡 없이 종목 자체의 알파(Alpha)를 평가하고 한국 주식과 공정하게 기여도 랭킹을 비교할 수 있다.
5. As an 자산 감사자(`asset-auditor`), I want `2026-04-18` 초기 잔고 등록(`INITIAL_BALANCE`) 종목들이 YTD/1Y 기간 조회 시 등록된 실제 매입 평단가(`total_amount`)를 취득원가로 인정받기를 원한다, so that 증권사 계좌의 실제 평단가 대비 손익과 일관된 장기 성과를 확인할 수 있다.

## Implementation Decisions (구현 결정사항)

### 1. 대상 모듈 및 인터페이스 계약
- **백엔드 서비스**: `src/backend/services/benchmark_service.py` (`BenchmarkService.get_attribution_summary`, `BenchmarkService._extract_attribution_ranking`)
- **백엔드 라우터**: `src/backend/routers/benchmark.py` (`GET /api/benchmark/attribution`)
- **MCP 도구**: `src/mcp/tools/benchmark.py` (`get_benchmark_attribution`)
- **에이전트 스킬**: `.agents/skills/asset-auditor/SKILL.md`

### 2. 핵심 계산 수식 및 불변식 (Invariants)

분석 기준일 $T_{\text{end}} = \text{as\_of}$ 및 각 기간 $P \in \{\text{1M}, \text{3M}, \text{1Y}, \text{YTD}\}$의 시작일 $T_{\text{start}}$에 대하여:

#### A. 기준일 단일 환율 ($FX_{\text{as\_of}}$)
- `ExchangeRate` 테이블에서 `date <= as_of`인 가장 최신 환율을 조회 (없을 경우 `DEFAULT_USD_KRW_RATE = 1350.0`).
- 자산 $i$의 기본 통화 $C_i$는 `asset.country == "US"`이면 `"USD"`, 그 외에는 `"KRW"`.

#### B. 종목별 기간 기초/기말 평가액 및 기간 내 거래 집계 (종목 기본 통화 $C_i$ 기준)
1. **기초 수량 ($Q_{i, \text{start}}$)** 및 **기말 수량 ($Q_{i, \text{end}}$)**:
   - `LedgerEngine.get_positions(db, as_of=T_start)`의 보유 수량 $Q_{i, \text{start}}$
   - `LedgerEngine.get_positions(db, as_of=T_end)`의 보유 수량 $Q_{i, \text{end}}$
2. **기초 평가액 ($V_{i, \text{start}}$)** 및 **기말 평가액 ($V_{i, \text{end}}$)**:
   - $P_{i, \text{start}}$: `HistoricalPrice`에서 `price_date <= T_start`인 직전 유효 종가 (`close_price > 0`). 만약 $Q_{i, \text{start}} == 0$이면 $V_{i, \text{start}} = 0.0$.
   - $P_{i, \text{end}}$: `HistoricalPrice`에서 `price_date <= T_end`인 직전 유효 종가 (`close_price > 0`). 만약 $Q_{i, \text{end}} == 0$이면 $V_{i, \text{end}} = 0.0$.
   - $V_{i, \text{start}} = Q_{i, \text{start}} \times P_{i, \text{start}}$, $\quad V_{i, \text{end}} = Q_{i, \text{end}} \times P_{i, \text{end}}$
3. **기간 내($T_{\text{start}} < t \le T_{\text{end}}$) 활성 계좌 트랜잭션 집계 (종목 기본 통화 $C_i$ 기준)**:
   - 거래 금액 환산 헬퍼: 트랜잭션 `tx.currency`가 종목 기본 통화 $C_i$와 다를 경우(예: USD 종목의 `TAX`가 KRW로 기록된 경우), $C_i == \text{"USD"}$이면 `tx.total_amount / FX_as_of`, $C_i == \text{"KRW"}$이면 `tx.total_amount * FX_as_of`로 변환.
   - $\text{BuyCost}_i = \sum_{t \in (T_{\text{start}}, T_{\text{end}}]} \text{amount}(tx \mid \text{type} \in \{\text{BUY}, \text{INITIAL\_BALANCE}\})$
     - 단, `INITIAL_BALANCE` 레코드의 `total_amount`가 0이거나 없는 경우에는 `quantity * price` (또는 해당일 종가)를 사용.
   - $\text{SellProceeds}_i = \sum_{t \in (T_{\text{start}}, T_{\text{end}}]} \text{amount}(tx \mid \text{type} == \text{SELL})$
   - $\text{DividendGross}_i = \sum_{t \in (T_{\text{start}}, T_{\text{end}}]} \text{amount}(tx \mid \text{type} == \text{INTEREST})$
   - $\text{DividendTax}_i = \sum_{t \in (T_{\text{start}}, T_{\text{end}}]} \text{amount}(tx \mid \text{type} == \text{TAX})$

#### C. 종목별 손익 분리 산출 (기본 통화 $C_i$ 및 보조 KRW)
1. **자본 손익 (`capital_pnl`)**:
   $$\text{CapitalPnL}_i = V_{i, \text{end}} - V_{i, \text{start}} - (\text{BuyCost}_i - \text{SellProceeds}_i)$$
2. **배당/세금 손익 (`dividend_pnl`)**:
   $$\text{DividendPnL}_i = \text{DividendGross}_i - \text{DividendTax}_i$$
3. **총 손익 (`total_pnl`)**:
   $$\text{TotalPnL}_i = \text{CapitalPnL}_i + \text{DividendPnL}_i$$
4. **원화(KRW) 환산 보조 손익 (`capital_pnl_krw`, `dividend_pnl_krw`, `total_pnl_krw`)**:
   - $C_i == \text{"USD"}$이면 각 손익에 $FX_{\text{as\_of}}$를 곱하여 반올림(`round`), $C_i == \text{"KRW"}$이면 동일.

#### D. 종목별 기간 수익률(%) 3종
- **기간 투입 원금 ($\text{InvestedCapital}_i$)**:
  $$\text{InvestedCapital}_i = V_{i, \text{start}} + \text{BuyCost}_i$$
1. **`capital_returns[P]` (%)** (내 포지션 순수 주가/자본 수익률):
   $$\text{InvestedCapital}_i > 0 \implies \text{round}\left(\frac{\text{CapitalPnL}_i}{\text{InvestedCapital}_i} \times 100, 2\right), \text{ else } 0.0$$
2. **`returns[P]` (%)** (내 포지션 총수익률 = 자본 + 배당):
   $$\text{InvestedCapital}_i > 0 \implies \text{round}\left(\frac{\text{TotalPnL}_i}{\text{InvestedCapital}_i} \times 100, 2\right), \text{ else } 0.0$$
3. **`price_returns[P]` (%)** (시장 단순 주가 등락률, 보조 지표):
   $$P_{i, \text{start}} > 0 \text{ and } P_{i, \text{end}} > 0 \implies \text{round}\left(\frac{P_{i, \text{end}} - P_{i, \text{start}}}{P_{i, \text{start}}} \times 100, 2\right), \text{ else } 0.0$$

#### E. 포트폴리오 기간 기준자본($\text{BaseCap}_P$) 및 수익기여도(`%p`)
1. **포트폴리오 기간 기준자본 ($\text{BaseCap}_P$, KRW)**:
   - 우선순위 1 (원장 기준): $T_{\text{start}}$ 시점의 원장 총평가액(보유종목 기초 원화평가액 합 + 기초 원화/달러 예수금 원화환산액) + 기간 내 순입출금액(`LedgerEngine.calculate_net_deposits(..., start_date=T_start, end_date=T_end, usd_rate=FX_as_of)`) + 기간 내 현금/주식 `INITIAL_BALANCE` 원화환산 총액(단, $T_{\text{start}}$가 `INITIAL_BALANCE` 이전인 경우).
   - 만약 $T_{\text{start}}$ 이전에 `AccountSnapshot`이 존재하고 $T_{\text{start}}$가 원장 최초 거래일(`2026-04-18`) 이전인 경우(예: YTD, 1Y): `calculate_cumulative_returns`와 동일하게 $T_{\text{start}}$ 직전 스냅샷 총평가액(`base_val`) + 기간 내 스냅샷 순입금액(`net_deposit`)을 사용하여 포트폴리오 기간 수익률 분모와 정합성을 유지합니다. (단, 스냅샷이 없는 테스트/신규 환경에서는 원장 기준 투입자본으로 폴백).
2. **기여도 3종 (`%p`)**:
   - `capital_contributions[P]` = $\text{round}\left(\frac{\text{CapitalPnL}_{i, \text{KRW}}}{\text{BaseCap}_P} \times 100, 2\right)$
   - `dividend_contributions[P]` = $\text{round}\left(\frac{\text{DividendPnL}_{i, \text{KRW}}}{\text{BaseCap}_P} \times 100, 2\right)$
   - `contributions[P]` = $\text{round}\left(\frac{\text{TotalPnL}_{i, \text{KRW}}}{\text{BaseCap}_P} \times 100, 2\right)$

#### F. 응답 스키마 (`holdings_attribution` 및 `top_contributors_*` / `top_detractors_*`)
```python
# holdings_attribution 개별 아이템 구조
{
    "ticker": str,
    "name": str,
    "major_category": str,          # "주식", "채권" 등
    "sub_category": str,            # "코어(지수)", "알파(성장)", "미국장기채" 등
    "currency": str,                # "KRW" | "USD" (종목 기본 통화)
    "status": str,                  # "HOLDING" (기말 수량 > 0) | "CLOSED" (기말 수량 == 0, 기간 내 거래 존재)
    "quantity": float,              # 기말 보유 수량
    "weight": float,                # 기말 포트폴리오 비중 (%, CLOSED인 경우 0.0)
    "valuation": float,             # 기말 평가액 (종목 기본 통화 기준)
    "valuation_krw": int,           # 기말 원화 환산 평가액
    "capital_pnl": Dict[str, float],            # 기간별 자본 손익 (기본 통화)
    "dividend_pnl": Dict[str, float],           # 기간별 세후 배당/이자 손익 (기본 통화)
    "total_pnl": Dict[str, float],              # 기간별 총 손익 (기본 통화)
    "capital_pnl_krw": Dict[str, int],          # 기간별 자본 손익 (KRW 환산 보조)
    "dividend_pnl_krw": Dict[str, int],         # 기간별 세후 배당/이자 손익 (KRW 환산 보조)
    "total_pnl_krw": Dict[str, int],            # 기간별 총 손익 (KRW 환산 보조)
    "capital_returns": Dict[str, float],        # 기간별 내 포지션 자본 수익률 (%)
    "returns": Dict[str, float],                # 기간별 내 포지션 총수익률 (자본+배당, %)
    "price_returns": Dict[str, float],          # 기간별 시장 단순 주가 등락률 (보조, %)
    "capital_contributions": Dict[str, float],  # 기간별 자본 수익기여도 (%p)
    "dividend_contributions": Dict[str, float], # 기간별 배당 수익기여도 (%p)
    "contributions": Dict[str, float],          # 기간별 총 수익기여도 (자본+배당 합산, %p)
}

# top_contributors_{ytd,1m} / top_detractors_{ytd,1m} 개별 아이템 구조
{
    "ticker": str,
    "name": str,
    "major_category": str,
    "sub_category": str,
    "currency": str,
    "status": str,                  # "HOLDING" | "CLOSED"
    "weight": float,
    "capital_pnl": float,           # 해당 기간 자본 손익 (기본 통화)
    "dividend_pnl": float,          # 해당 기간 배당 손익 (기본 통화)
    "total_pnl": float,             # 해당 기간 총 손익 (기본 통화)
    "total_pnl_krw": int,           # 해당 기간 총 손익 (KRW 보조)
    "capital_return": float,        # 해당 기간 내 포지션 자본 수익률 (%)
    "return": float,                # 해당 기간 내 포지션 총수익률 (%)
    "price_return": float,          # 해당 기간 시장 단순 주가 등락률 (%)
    "capital_contribution": float,  # 해당 기간 자본 기여도 (%p)
    "dividend_contribution": float, # 해당 기간 배당 기여도 (%p)
    "contribution": float,          # 해당 기간 총 기여도 (%p)
}
```
- **노이즈 필터링**: 특정 기간 $P$에서 기초 수량이 0이고 기간 내 거래도 전혀 없는 종목은 해당 기간 손익/기여도가 `0.0`이며, Top/Bottom 3 랭킹 추출(`_extract_attribution_ranking`) 시 해당 기간에 실제 보유 또는 거래 이력이 있었거나(`TotalPnL != 0` 또는 기초/기말 보유) 기여도가 존재하는 종목 중에서 정렬합니다. 특히 `top_contributors`는 `contribution > 0` (또는 내림차순 상위), `top_detractors`는 오름차순 하위 종목을 추출합니다.

## Testing Decisions (테스트 결정사항)

- **검증 기준**: 내부 구현 세부사항이 아닌 `BenchmarkService.get_attribution_summary` 및 `GET /api/benchmark/attribution`의 반환 데이터 정합성을 검증합니다.
- **핵심 테스트 시나리오 (`tests/test_benchmark_attribution.py`)**:
  1. **기간 중 신규 매수 시나리오 (Unheld Period Gain 배제 검증)**: 1월~6월에 주가가 +100% 급등한 종목을 7월에 매수한 뒤 주가가 -10% 하락했을 때, YTD `price_returns`는 양수(+)더라도 내 포지션 `capital_returns`, `returns`, `contributions`는 음수(-)로 정확히 산출되는지 검증.
  2. **기간 중 분할 매수(물타기) 및 일부 매도 시나리오**: 기간 중 추가 매수 및 일부 매도가 발생했을 때 실제 투입 원금과 실현/미실현 손익이 반영되는지 검증.
  3. **기간 중 전량 매도(CLOSED) 종목 포함 검증**: 기간 중 매수 후 전량 손절매하여 기말 수량이 `0`인 종목이 `status="CLOSED"`, `weight=0.0`으로 `holdings_attribution` 및 `top_detractors`에 포함되는지 검증.
  4. **자본 손익(`capital_pnl`)과 배당/세금 손익(`dividend_pnl`) 분리 및 합산 검증**: `INTEREST`와 `TAX`(특히 USD 종목의 KRW 세금 포함) 발생 시 자본 손익과 배당 손익이 정확히 분리되고 `total_pnl` 및 `contributions`에 합산되는지 검증.
  5. **미국 종목(USD) 기본 통화 및 KRW 보조 지표 검증**: USD 종목의 `capital_pnl`, `dividend_pnl`, `total_pnl`은 환율 개입 없이 USD로 산출되고, `*_krw` 및 `contributions`에만 기준일 단일 환율이 적용되는지 검증.
- **참고할 기존 테스트 패턴**: `tests/test_benchmark_attribution.py`, `tests/test_mcp_benchmark.py`

## Out of Scope (범위 제외 사항)

- 데이터베이스 스키마 변경 및 Alembic 마이그레이션 (기존 테이블 구조만으로 100% 구현 가능).
- 프론트엔드 웹 UI 컴포넌트 수정 (`/api/benchmark/attribution`은 MCP 도구 및 `asset-auditor` 전용 API임).
- 일별 시간가중 브린슨(Daily Brinson-Fachler) 섹터/통화 효과 분해.

## Further Notes (기타 참고사항)

- 모든 쿼리는 기존과 동일하게 벌크 조회(N+1 쿼리 방지) 및 메모리 내 리플레이(`LedgerEngine.replay`)를 활용하여 외부 API 호출 없이 밀리초(ms) 단위로 동작해야 합니다.
