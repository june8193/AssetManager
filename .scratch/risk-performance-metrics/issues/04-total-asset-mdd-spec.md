Title: 입출금을 배제한 총 자산 MDD(Maximum Drawdown) 산출 세부 사양 정의
Type: grilling
Status: resolved
Blocked by: 03

## Question

입출금 내역이 제거된 총 자산 수익률 시계열(Cumulative TWR Index)로부터 **최대 낙폭(MDD, Maximum Drawdown)**을 계산하고 제공하는 세부 사양을 어떻게 구성할 것인가?

## Answer

### 1. 지수 분석 메뉴와 동등한 MDD 시계열 및 지표 제공
- 누적 TWR 지수 $I_t$ ($I_0 = 1.0$)로부터 일별 Drawdown 백분율 추이($DD_t$)를 계산합니다:
  $$\text{Peak}_t = \max_{0 \le s \le t} I_s, \quad DD_t (\%) = \frac{I_t - \text{Peak}_t}{\text{Peak}_t} \times 100$$

### 2. UI/API 표기 항목 확정
- **최근 MDD (Current Drawdown)**: 조회 기간의 가장 최근(마지막 일자) Drawdown (%)
- **기간 내 최고 낙폭 (Max MDD)**: 해당 선택 기간 중 전체 일자에서의 최소 $DD_t$ 값 (예: -18.5%)
- **MDD 차트 시계열**: X축(날짜 `dates`), Y축(Drawdown 백분율 `mdd`) 시계열 데이터 세트 제공. (지수 분석 메뉴의 MDD 추이 차트 컴포넌트와 동일한 UX/차트 스타일 연동)
