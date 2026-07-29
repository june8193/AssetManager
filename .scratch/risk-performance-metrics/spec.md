# Feature Spec: 위험조정지표 (Sharpe, Sortino Ratio) 및 총 자산 MDD 계산 기능

- **Status**: Draft / Ready for Implementation
- **Feature Slug**: `risk-performance-metrics`
- **Target Project**: `AssetManager` (`c:\localrepo\AssetManager`)
- **Created Date**: 2026-07-29

---

## 1. 개요 (Overview)

각 금융 지수(KOSPI, S&P500 등), 개별 투자 종목 및 외부 입출금(현금 유입/유출)이 배제된 총 자산(포트폴리오 시간가중수익률 TWR 기반)에 대해 **샤프 지수(Sharpe Ratio)**, **소티노 지수(Sortino Ratio)** 및 **최대 낙폭(MDD)**을 정교하게 산출하고, 이를 백엔드 REST API, MCP 서버 도구 및 프론트엔드 대시보드 UI에 노출하여 투자 위험 대비 성과 분석 기능을 제공합니다.

---

## 2. 사용자 요구사항 (User Requirements)

1. **무위험 수익률 사용자 설정 및 DB 저장**:
   - 웹 UI에서 사용자가 직접 연율 무위험 수익률($R_{f, annual}$, 예: 3.5%)을 설정할 수 있으며, 이 값은 DB에 지속 저장·관리됩니다 (`settings.toml` 불필요).
2. **지수 및 개별 종목 위험조정 지수**:
   - 각 지수 및 종목의 일별 수정종가 시계열을 바탕으로 연율화 샤프 지수 및 소티노 지수를 계산합니다.
3. **입출금 내역 배제 총 자산 샤프 / 소티노 / MDD 지수**:
   - 추가 입금/출금 등 외부 현금 흐름으로 인한 총 자산 변동 착시 현상을 TWR(시간가중수익률)로 완벽히 배제하고 순수 투자 성과만을 연산합니다.
4. **불규칙한 계좌 스냅샷 간격 대응**:
   - 총 자산 계좌 스냅샷(`account_snapshots`)의 작성 주기가 불규칙(예: 3일, 14일, 30일 간격 등)하더라도 실제 경과 일수($\Delta t$) 기반 일별 보간을 수행하여 정교한 연율화 지수를 산출합니다.
5. **MDD 및 추이 차트 제공**:
   - 기존 지수 분석 메뉴의 MDD 추이 차트와 동등한 UX로 **최근 MDD**, **기간 내 최고 MDD(Max MDD)** 및 **Drawdown 백분율 추이 차트 시계열**을 제공합니다.
6. **동적(On-demand) 연산 방식**:
   - 사전 주기적 배치 저장이 아닌, 웹 UI/API 요청 시 사용자가 선택한 기간(1M, 3M, 6M, 1Y, YTD, Max 등)에 맞춰 동적으로 즉시 연산합니다.
7. **웹 UI 상 상세 계산 방식 & AssetManager 실제 알고리즘 안내 모달**:
   - 지표 카드 마우스 호버 시 **요약 툴팁**과 함께, 클릭 시 **[AssetManager 실제 계산 방식 및 지표 가이드] 모달 팝업**을 제공하여 개념, 사용된 무위험 수익률, TWR 보정 수식 및 지표 해석 팁을 명확히 안내합니다.

---

## 3. 수학적 연산 공식 및 사양 (Calculation Engine Specification)

### 3.1. 무위험 수익률 환산
- 연율 무위험 수익률 $R_{f, annual}$ (사용자 입력 설정값 %, 기본값 3.5%)
- 일별 무위험 수익률 단순 산술 나눗셈:
  $$R_{f, daily} = \frac{R_{f, annual}}{252}$$

### 3.2. 총 자산 시간가중수익률 (TWR) 및 불규칙 간격 보간
- `account_snapshots`의 일별 자산 총 평가액 $V_k$와 추가 입금액 $CF_k$ 활용:
  $$r_k = \frac{V_k - CF_k - V_{k-1}}{V_{k-1}}$$
- 스냅샷 간 실제 경과 일수 $\Delta t_k = \text{Date}_k - \text{Date}_{k-1}$ 기반 구간 일일 환산 수익률:
  $$r_{daily, k} = (1 + r_k)^{1/\Delta t_k} - 1$$
- 일별 시계열 $r_t$ 보간 구축 및 누적 TWR 지수 시계열 $I_t = I_{t-1} \times (1 + r_t)$ ($I_0 = 1.0$) 생성.

### 3.3. 샤프 지수 (Sharpe Ratio)
- 연율화 수익률: $\mu_{annual} = \mu_{daily} \times 252$
- 연율화 전체 변동성: $\sigma_{annual} = \sigma_{daily} \times \sqrt{252}$
- $$\text{Sharpe Ratio} = \frac{\mu_{annual} - R_{f, annual}}{\sigma_{annual}}$$

### 3.4. 소티노 지수 (Sortino Ratio)
- 일별 하방 변동성 (MAR = $R_{f, daily}$ 이하 손실 구간):
  $$\sigma_{down, daily} = \sqrt{\frac{1}{N} \sum_{t=1}^{N} \min(0, r_t - R_{f, daily})^2}$$
- 연율화 하방 변동성: $\sigma_{down, annual} = \sigma_{down, daily} \times \sqrt{252}$
- $$\text{Sortino Ratio} = \frac{\mu_{annual} - R_{f, annual}}{\sigma_{down, annual}}$$

### 3.5. MDD (Maximum Drawdown) 및 Drawdown 추이
- 일별 Peak 및 Drawdown 연산:
  $$\text{Peak}_t = \max_{0 \le s \le t} I_s, \quad DD_t (\%) = \frac{I_t - \text{Peak}_t}{\text{Peak}_t} \times 100$$
- **최근 MDD**: $DD_N$ (마지막 일자 기준 하락률)
- **기간 최고 MDD**: $\min_{1 \le t \le N} DD_t$

---

## 4. 백엔드 및 DB 구현 사양 (Backend Specification)

### 4.1. DB 스키마 (`SystemSetting`)
```python
class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(50), primary_key=True)  # 예: 'risk_free_rate'
    value = Column(String(255), nullable=False) # 예: '3.5'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### 4.2. 서비스 클래스 (`PerformanceService`)
`src/backend/services/performance_service.py`:
- `get_risk_free_rate() -> float` / `set_risk_free_rate(rate: float)`
- `calculate_asset_performance(ticker: str, period: str) -> Dict`
- `calculate_portfolio_performance(period: str) -> Dict`

### 4.3. REST API 라우터 (`/api/v1/performance`)
`src/backend/routers/performance.py`:
- `GET /api/v1/performance/settings/risk-free-rate`: 무위험 수익률 조회
- `PUT /api/v1/performance/settings/risk-free-rate`: 무위험 수익률 변경 (`{"rate": 3.5}`)
- `GET /api/v1/performance/asset/{ticker}`: 특정 지수/종목 성과 지표 (Sharpe, Sortino, MDD)
- `GET /api/v1/performance/portfolio`: 총 자산 TWR 기반 성과 지표 & MDD 차트 시계열

### 4.4. MCP 서버 연동 (`src/mcp/`)
- `get_portfolio_status`, `get_asset_ratios` 도구 응답 JSON 스키마에 `sharpe_ratio`, `sortino_ratio`, `mdd` 필드 보강.

---

## 5. 프론트엔드 UI 사양 (Frontend Specification)

### 5.1. 성과 분석 대시보드 (`PerformanceAnalysis.jsx`)
- **무위험 수익률 설정 컴포넌트**: 현재 설정된 $R_{f}$ 수치 표시 및 변경 폼/모달 제공.
- **포트폴리오 KPI 카드 & 툴팁**:
  - Sharpe Ratio 카드 (마우스 호버시 요약 툴팁 + `ⓘ` 클릭 시 안내 모달)
  - Sortino Ratio 카드 (마우스 호버시 요약 툴팁 + `ⓘ` 클릭 시 안내 모달)
  - 최근 MDD 카드 (%) 및 기간 최고 MDD 카드 (%)
- **[AssetManager 실제 계산 알고리즘 및 지표 안내] 모달 팝업 (`PerformanceInfoModal.jsx`)**:
  - **AssetManager 연산 방식 상세 설명**:
    1. 무위험 수익률 적용: 연율 $R_{f, annual}$ $\rightarrow$ 일별 $R_{f, daily} = R_{f, annual}/252$
    2. 입출금 차감 TWR 원리: $r_k = (V_k - CF_k - V_{k-1}) / V_{k-1}$
    3. 불규칙 스냅샷 일별 보간: $(1 + r_k)^{1/\Delta t_k} - 1$
    4. 연율화 252 영업일 기준 표준편차 및 소티노 하방 편차 수식
  - **지표별 해석 가이드 표**
- **MDD 추이 차트**: 기존 지수 분석 차트 컴포넌트를 재활용하여 Drawdown(%) 시간 경과 시계열 영역 그래프 렌더링.

---

## 6. 인수 조건 및 검증 계획 (Acceptance Criteria)

1. **단위 테스트 (Unit Test)**:
   - `pytest tests/test_performance_service.py` 실행 시 무위험 수익률 CRUD, Sharpe/Sortino 계산, 입출금 차감 TWR 연산, 불규칙 스냅샷 보간 MDD 연산 테스트 100% 통과.
2. **E2E 및 UI 테스트**:
   - `uv run scripts/dev.py`로 서버 기동 후 Playwright MCP를 통한 대시보드 접속.
   - 무위험 수익률 수정 후 DB 반영 확인.
   - 총 자산 Sharpe, Sortino 지수 수치 카드, `ⓘ` 클릭 시 상세 모달 오픈 및 AssetManager 연산 공식 표시 확인.
   - MDD 추이 차트 렌더링 확인 후 스크린샷 저장 (`screenshots/YYYYMMDD_HHMMSS_performance_metrics/`).
