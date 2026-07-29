Title: 입출금 내역을 배제한 총 자산 시간가중수익률(TWR) 및 일별 수익률 산출 구조 설계
Type: research
Status: resolved
Blocked by: none

## Question

총 자산의 샤프/소티노 지수 및 MDD 계산 시, 입출금(현금 유입/유출)으로 인한 자산 평가액 변동 착시 현상을 완벽히 제거하기 위해 **시간가중수익률(TWR, Time-Weighted Return)** 및 순수 투자자산 일별 수익률 시계열을 어떻게 구축할 것인가?

## Answer

### 1. 데이터 소스 검증 결과
- `account_snapshots` 테이블의 `total_valuation`(일별 총 평가액 $V_t$)과 `period_deposit`(추가 입금/외부 입출금 $CF_t$) 데이터를 날짜별로 집계하여 활용할 수 있음을 확인했습니다.

### 2. 불규칙한 스냅샷 간격($\Delta t_k$) 적응형 연율화 처리
- 스냅샷 생성 주기가 불규칙(예: 3일, 14일, 30일 등)하므로, 각 스냅샷 구간별 **실제 경과 일수 $\Delta t_k = \text{Date}_k - \text{Date}_{k-1}$**를 기반으로 한 불규칙 시계열 연산식을 채택합니다.
  - 구간 TWR 수익률: $r_k = \frac{V_k - CF_k - V_{k-1}}{V_{k-1}}$
  - 구간 일별 환산 수익률: $r_{daily, k} = (1 + r_k)^{1/\Delta t_k} - 1$
- 불규칙한 스냅샷 데이터를 일별 단위로 보간(Daily Interpolated Time-series)하여 축적한 후, 252일 연율화 표준변동성($\sigma_{annual} = \sigma_{daily} \times \sqrt{252}$) 및 MDD를 계산함으로써 스냅샷의 불규칙한 간격에 완전히 정교하게 대응합니다.
