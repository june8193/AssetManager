import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaskingProvider } from '../contexts/MaskingContext';
import PerformanceAnalysisPage from './PerformanceAnalysisPage';

const makeMockVolatilityResponse = (period = '1Y', overrides = {}) => ({
  period,
  as_of_date: '2026-11-22',
  total_valuation_krw: 100000000,
  portfolio: {
    annualized_volatility: 14.82,
    daily_volatility_pct: 0.93,
    daily_volatility_krw: 930000,
    sp500_ratio: 1.09,
    nasdaq_ratio: 0.77,
    kospi_ratio: 0.56,
    ...(overrides.portfolio || {}),
  },
  benchmarks: {
    sp500: { ticker: '^GSPC', name: 'S&P 500', annualized_volatility: 13.61, max_mdd: -8.4 },
    nasdaq: { ticker: '^IXIC', name: 'NASDAQ', annualized_volatility: 19.31, max_mdd: -13.2 },
    kospi: { ticker: '^KS11', name: 'KOSPI', annualized_volatility: 26.4, max_mdd: -18.5 },
  },
  assets: [
    {
      ticker: 'CASH',
      name: '현금 (원화·달러 예수금)',
      category_label: '현금',
      is_cash: true,
      is_added: false,
      valuation_krw: 20000000,
      weight: 20.0,
      annualized_volatility: 0.0,
      component_volatility: 0.0,
      volatility_share: 0.0,
    },
    {
      ticker: 'NVDA',
      name: 'NVIDIA',
      category_label: '알파(성장)',
      is_cash: false,
      is_added: false,
      valuation_krw: 30000000,
      weight: 30.0,
      annualized_volatility: 42.5,
      component_volatility: 8.82,
      volatility_share: 59.51,
    },
    {
      ticker: '005930',
      name: '삼성전자',
      category_label: '코어(지수)',
      is_cash: false,
      is_added: false,
      valuation_krw: 30000000,
      weight: 30.0,
      annualized_volatility: 24.1,
      component_volatility: 4.5,
      volatility_share: 30.36,
    },
    {
      ticker: 'TLT',
      name: 'iShares 20+ Year Treasury',
      category_label: '미국장기채',
      is_cash: false,
      is_added: false,
      valuation_krw: 20000000,
      weight: 20.0,
      annualized_volatility: 12.0,
      component_volatility: 1.5,
      volatility_share: 10.13,
    },
  ],
  covariance_matrix: [
    [0, 0, 0, 0],
    [0, 1806.25, 400, 50],
    [0, 400, 580.81, 30],
    [0, 50, 30, 144],
  ],
  drawdown_comparison: {
    dates: ['2026-11-20', '2026-11-21'],
    benchmarks: { sp500: [0, -0.5], nasdaq: [0, -0.8], kospi: [0, -1.1] },
    portfolio_current: [0, -0.6],
    asset_daily_returns: { CASH: [0, 0], NVDA: [0, -0.01], '005930': [0, -0.005], TLT: [0, 0.002] },
  },
});

const renderPage = () =>
  render(
    <MaskingProvider>
      <PerformanceAnalysisPage />
    </MaskingProvider>
  );

describe('PerformanceAnalysisPage - 포트폴리오 내재 변동성 진단 UI', () => {
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn((url) => {
      if (url.includes('/api/v1/risk/volatility')) {
        const is1M = url.includes('period=1M');
        const is3M = url.includes('period=3M');
        const period = is1M ? '1M' : is3M ? '3M' : '1Y';
        const base = makeMockVolatilityResponse(period);
        if (is1M) {
          base.portfolio = {
            ...base.portfolio,
            annualized_volatility: 18.4,
            daily_volatility_pct: 1.16,
            sp500_ratio: 1.35,
          };
        }
        if (url.includes('extra_tickers=AAPL')) {
          base.assets.push({
            ticker: 'AAPL',
            name: 'Apple Inc.',
            category_label: '미보유 편입',
            is_cash: false,
            is_added: true,
            valuation_krw: 0,
            weight: 0,
            annualized_volatility: 26.5,
            component_volatility: 0,
            volatility_share: 0,
          });
          base.covariance_matrix = base.covariance_matrix.map((row) => [...row, 120]);
          base.covariance_matrix.push([0, 120, 100, 20, 702.25]);
          base.drawdown_comparison.asset_daily_returns.AAPL = [0, -0.008];
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(base),
        });
      }
      if (url.includes('/api/watchlist?country=KR')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 1, stock_code: '000660', stock_name: 'SK하이닉스', country: 'KR' },
            ]),
        });
      }
      if (url.includes('/api/watchlist?country=US')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 2, stock_code: 'AAPL', stock_name: 'Apple Inc.', country: 'US' },
            ]),
        });
      }
      if (url.includes('/api/stocks/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { stock_code: 'MSFT', stock_name: 'Microsoft Corp.', market: 'NASDAQ' },
            ]),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('구버전 샤프·소티노 UI 없이 내재 변동성 3열 KPI, 스펙트럼 게이지, 가이드 배너, 종목 테이블을 렌더링한다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('포트폴리오 내재 변동성')).toBeInTheDocument();
    });

    // 구버전 레거시 UI 미존재 확인
    expect(screen.queryByText(/샤프 지수/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/소티노 지수/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/무위험 수익률/i)).not.toBeInTheDocument();

    // 3열 KPI 확인
    expect(screen.getByText('14.82%')).toBeInTheDocument();
    expect(screen.getByText('±0.93%')).toBeInTheDocument();
    expect(screen.getByText(/930,000/)).toBeInTheDocument();
    expect(screen.getByText(/S&P 500의 1\.09배/)).toBeInTheDocument();
    expect(screen.getByText('시장 유사')).toBeInTheDocument();

    // 벤치마크 스펙트럼 게이지 라벨 확인
    expect(screen.getAllByText('S&P 500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NASDAQ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('KOSPI').length).toBeGreaterThan(0);

    // 액셀 Top 3 및 완충 자산 가이드 배너 확인
    expect(screen.getByText('액셀 Top 3')).toBeInTheDocument();
    expect(screen.getByText('완충 자산')).toBeInTheDocument();

    // 종목별 변동성·기여도 테이블 데이터 확인
    expect(screen.getAllByText('NVIDIA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('삼성전자').length).toBeGreaterThan(0);
    expect(screen.getAllByText('현금 (원화·달러 예수금)').length).toBeGreaterThan(0);
    expect(screen.getByText('59.51%')).toBeInTheDocument();
  });

  it('상단 기간 전환 버튼 클릭 시 해당 period로 API를 재호출하고 KPI를 갱신한다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '1개월' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/risk/volatility?period=1M'));
      expect(screen.getByText('18.40%')).toBeInTheDocument();
      expect(screen.getByText(/S&P 500의 1\.35배/)).toBeInTheDocument();
      expect(screen.getByText('공격적 (시장 상회)')).toBeInTheDocument();
    });
  });

  it('금액 마스킹 활성화 시 일평균 원화 체감 폭과 종목 평가액이 ***로 마스킹된다', async () => {
    localStorage.setItem('isMasked', 'true');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    expect(screen.queryByText(/930,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30,000,000/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/\*\*\*/).length).toBeGreaterThan(0);
  });

  it('시각화 차트 카드에서 2종 차트 탭 전환과 차트 접기/펼치기 토글이 정상 동작한다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    // 기본 활성 탭: 종목별 자체 변동성 vs 기여도
    const barTab = screen.getByRole('button', { name: '종목별 자체 변동성 vs 기여도' });
    const mddTab = screen.getByRole('button', { name: '벤치마크 대비 낙폭(MDD) 방어력' });
    expect(barTab).toBeInTheDocument();
    expect(mddTab).toBeInTheDocument();

    // S&P 500, NASDAQ 기준선 및 차트 영역 표시 확인
    expect(screen.getByTestId('risk-chart-panel')).toBeInTheDocument();
    expect(screen.getByTestId('volatility-bar-chart')).toBeInTheDocument();

    // MDD 방어력 탭으로 전환
    fireEvent.click(mddTab);
    expect(screen.queryByTestId('volatility-bar-chart')).not.toBeInTheDocument();
    expect(screen.getByTestId('mdd-line-chart')).toBeInTheDocument();

    // 차트 접기 / 차트 펼치기 토글
    const collapseBtn = screen.getByRole('button', { name: /차트 접기/ });
    fireEvent.click(collapseBtn);
    expect(screen.queryByTestId('risk-chart-panel')).not.toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /차트 펼치기/ });
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('risk-chart-panel')).toBeInTheDocument();
  });

  it('매매 시뮬레이터 조작 시 서버 재요청 없이 즉시 변동성·현금 자동 정산·스펙트럼 마커가 갱신되고 현금 부족 경고를 표시한다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    const initialFetchCount = fetchMock.mock.calls.length;

    // NVIDIA 행 찾기 및 전량매도 클릭
    const nvdaRow = screen.getByTestId('sim-row-NVDA');
    const sellAllBtn = nvdaRow.querySelector('button[data-action="sell-all"]');
    fireEvent.click(sellAllBtn);

    // 서버 재요청이 없어야 함
    expect(fetchMock.mock.calls.length).toBe(initialFetchCount);

    // 현금 자동 정산: 기존 현금 20,000,000 + NVIDIA 매도 30,000,000 = 50,000,000
    const cashRow = screen.getByTestId('sim-row-CASH');
    expect(cashRow).toHaveTextContent('50,000,000');

    // 변동성 증감 %p 배지 및 스펙트럼 게이지 '조정 후' 마커 표시 확인
    expect(screen.getByTestId('sim-delta-badge')).toHaveTextContent(/%p/);
    expect(screen.getByText(/조정 후/)).toBeInTheDocument();

    // NVIDIA 금액 직접 입력으로 현금 초과 매수 (기존 30,000,000 -> 60,000,000 = +30,000,000, 현금 20,000,000 초과 => -10,000,000 부족)
    const nvdaInput = screen.getByLabelText('NVIDIA 시뮬레이션 금액 입력');
    fireEvent.change(nvdaInput, { target: { value: '60000000' } });

    expect(screen.getByTestId('cash-shortage-badge')).toBeInTheDocument();
    expect(screen.getByTestId('cash-shortage-badge')).toHaveTextContent(/10,000,000/);

    // 빠른 매매 버튼(+500) 클릭 시 5,000,000원 증가 -> 부족 금액 15,000,000원
    const plus500Btn = nvdaRow.querySelector('button[data-action="add-500"]');
    fireEvent.click(plus500Btn);
    expect(screen.getByTestId('cash-shortage-badge')).toHaveTextContent(/15,000,000/);
  });

  it('여유자금 추가/인출 및 시뮬레이션 초기화가 동작하고 정렬 시에도 현금 행이 최상단에 고정된다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    const cashRow = screen.getByTestId('sim-row-CASH');
    expect(cashRow).toHaveTextContent('20,000,000');

    // 여유자금 +500만, +1,000만, 0원 버튼 검증
    fireEvent.click(screen.getByRole('button', { name: '+500만' }));
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('25,000,000');

    fireEvent.click(screen.getByRole('button', { name: '+1,000만' }));
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('35,000,000');

    fireEvent.click(screen.getByRole('button', { name: '0원' }));
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('20,000,000');

    // 여유자금 직접 입력 (-5,000,000 인출) + NVIDIA 전량매도 후 초기화
    const extraCashInput = screen.getByLabelText('여유자금 추가/인출');
    fireEvent.change(extraCashInput, { target: { value: '-5000000' } });
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('15,000,000');

    const nvdaRow = screen.getByTestId('sim-row-NVDA');
    fireEvent.click(nvdaRow.querySelector('button[data-action="sell-all"]'));
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('45,000,000');

    // 시뮬레이션 초기화
    fireEvent.click(screen.getByRole('button', { name: /시뮬레이션 초기화/ }));
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('20,000,000');
    expect(screen.queryByTestId('sim-delta-badge')).not.toBeInTheDocument();

    // 정렬 시 현금 행 최상단 고정 확인 (자체 변동성순 오름차순/내림차순 모두)
    const volSortBtn = screen.getByRole('button', { name: '자체 변동성' });
    fireEvent.click(volSortBtn);
    let rows = screen.getAllByTestId(/^sim-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'sim-row-CASH');

    fireEvent.click(volSortBtn);
    rows = screen.getAllByTestId(/^sim-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'sim-row-CASH');

    const amountSortBtn = screen.getByRole('button', { name: '보유 금액' });
    fireEvent.click(amountSortBtn);
    rows = screen.getAllByTestId(/^sim-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'sim-row-CASH');
  });

  it('미보유/관심종목 편입 테스트에서 관심종목·종목검색을 통해 신규 티커를 추가하고 매수 시뮬레이션 및 초기화할 수 있다', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    // 편입 테스트 모달 열기
    fireEvent.click(screen.getByRole('button', { name: /\+ 미보유\/관심종목 편입 테스트/ }));

    // 관심종목(KR/US) 로드 확인
    await waitFor(() => {
      expect(screen.getByText('SK하이닉스')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });

    // 국내/미국 종목 검색 확인
    const searchInput = screen.getByPlaceholderText(/종목명 또는 티커 검색/);
    fireEvent.change(searchInput, { target: { value: 'MSFT' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    await waitFor(() => {
      expect(screen.getByText('Microsoft Corp.')).toBeInTheDocument();
    });

    // 관심종목 AAPL 선택 -> extra_tickers=AAPL로 API 호출
    fireEvent.click(screen.getByRole('button', { name: /Apple Inc\./ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('extra_tickers=AAPL'));
      expect(screen.getByTestId('sim-row-AAPL')).toBeInTheDocument();
    });

    // 편입된 AAPL에 +500 매수 시뮬레이션 -> 현금 20,000,000 -> 15,000,000 감소
    const aaplRow = screen.getByTestId('sim-row-AAPL');
    fireEvent.click(aaplRow.querySelector('button[data-action="add-500"]'));
    expect(screen.getByTestId('sim-row-CASH')).toHaveTextContent('15,000,000');

    // 시뮬레이션 초기화 시 편입 종목(AAPL)도 원상 복구
    fireEvent.click(screen.getByRole('button', { name: /시뮬레이션 초기화/ }));
    await waitFor(() => {
      expect(screen.queryByTestId('sim-row-AAPL')).not.toBeInTheDocument();
    });
  });
});
