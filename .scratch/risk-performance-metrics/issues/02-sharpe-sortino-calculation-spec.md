Title: 지수 및 개별 종목의 샤프/소티노 지수 세부 산출 공식 및 기간 산정 기준 정의
Type: grilling
Status: resolved
Blocked by: 01

## Question

개별 지수(KOSPI, S&P500 등)와 개별 종목(AAPL, 005930 등)의 일별 시세(Historical Price)를 바탕으로 샤프 지수와 소티노 지수를 계산하는 세부 공식 및 기간 산정 기준을 어떻게 확정할 것인가?

## Answer

### 1. 무위험 수익률 일별 환산 공식
- 연율 무위험 수익률 $R_{f, annual}$ (사용자가 DB 설정에 입력한 연 금리 %, 예: 3.5% = 0.035)
- **단순 산술 나눗셈 연산식**:
  $$R_{f, daily} = \frac{R_{f, annual}}{252}$$

### 2. 샤프 지수 (Sharpe Ratio)
- 일별 수익률 평균 $\mu_{daily} = \frac{1}{N}\sum r_t$, 일별 수익률 표준편차 $\sigma_{daily} = \sqrt{\frac{1}{N-1}\sum (r_t - \mu_{daily})^2}$
- 연율화 수익률 $\mu_{annual} = \mu_{daily} \times 252$, 연율화 변동성 $\sigma_{annual} = \sigma_{daily} \times \sqrt{252}$
- $$\text{Sharpe Ratio} = \frac{\mu_{annual} - R_{f, annual}}{\sigma_{annual}}$$

### 3. 소티노 지수 (Sortino Ratio)
- 하방 변동성(Downside Deviation) $\sigma_{down, daily} = \sqrt{\frac{1}{N}\sum_{t=1}^N \min(0, r_t - R_{f, daily})^2}$
- 연율화 하방 변동성 $\sigma_{down, annual} = \sigma_{down, daily} \times \sqrt{252}$
- $$\text{Sortino Ratio} = \frac{\mu_{annual} - R_{f, annual}}{\sigma_{down, annual}}$$
*(단, 하방 편차가 0일 경우 소티노 지수를 None/N/A 또는 과도하게 큰 값 대신 적절한 최대값/안내 표기)*

### 4. 분석 기간
- 1M, 3M, 6M, 1Y, 3Y, YTD, Max 기간 옵션 제공 (최소 10 영업일 이상 데이터 존재 시 연산).
