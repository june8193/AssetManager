import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MaskingProvider } from '../../contexts/MaskingContext';
import MobileRiskSection from './MobileRiskSection';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div data-testid="mock-responsive-container" style={{ width: 320, height: 260 }}>
        {children}
      </div>
    ),
  };
});

const makeMockVolatilityResponse = (period = '1Y') => ({
  period,
  as_of_date: '2026-11-22',
  total_valuation_krw: 100000000,
  portfolio: {
    annualized_volatility: period === '1M' ? 18.4 : 14.82,
    daily_volatility_pct: period === '1M' ? 1.16 : 0.93,
    daily_volatility_krw: period === '1M' ? 1160000 : 930000,
    sp500_ratio: period === '1M' ? 1.35 : 1.09,
    nasdaq_ratio: 0.77,
    kospi_ratio: 0.56,
  },
  benchmarks: {
    sp500: { ticker: '^GSPC', name: 'S&P 500', annualized_volatility: 13.61, max_mdd: -8.4 },
    nasdaq: { ticker: '^IXIC', name: 'NASDAQ', annualized_volatility: 19.31, max_mdd: -13.2 },
    kospi: { ticker: '^KS11', name: 'KOSPI', annualized_volatility: 26.4, max_mdd: -18.5 },
  },
  assets: [
    {
      ticker: 'CASH',
      name: '원화·달러 현금',
      category_label: '현금',
      is_cash: true,
      valuation_krw: 20000000,
      weight: 20.0,
      annualized_volatility: 0.0,
      volatility_share: 0.0,
    },
    {
      ticker: 'NVDA',
      name: 'NVIDIA',
      category_label: '알파(성장)',
      is_cash: false,
      valuation_krw: 15000000,
      weight: 15.0,
      annualized_volatility: 42.5,
      volatility_share: 59.51,
    },
    {
      ticker: '005930',
      name: '삼성전자',
      category_label: '코어(지수)',
      is_cash: false,
      valuation_krw: 45000000,
      weight: 45.0,
      annualized_volatility: 24.1,
      volatility_share: 30.36,
    },
    {
      ticker: 'TLT',
      name: '미국 장기채',
      category_label: '채권',
      is_cash: false,
      valuation_krw: 20000000,
      weight: 20.0,
      annualized_volatility: 12.0,
      volatility_share: 10.13,
    },
  ],
  drawdown_comparison: {
    dates: ['2026-11-20', '2026-11-21'],
    benchmarks: { sp500: [0, -0.5], nasdaq: [0, -0.8], kospi: [0, -1.1] },
    portfolio_current: [0, -0.6],
  },
});

const renderSection = (props = {}) =>
  render(
    <MaskingProvider>
      <MobileRiskSection {...props} />
    </MaskingProvider>
  );

describe('MobileRiskSection', () => {
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchMock = vi.fn((url) => {
      const urlStr = String(url);
      const period = urlStr.includes('period=1M')
        ? '1M'
        : urlStr.includes('period=3M')
        ? '3M'
        : '1Y';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeMockVolatilityResponse(period)),
      });
    });
    global.fetch = fetchMock;
  });

  it('마운트 시 기본 1Y 기간으로 API를 호출하고 로딩 스켈레톤을 표시한 뒤 리스크 진단 지표를 렌더링해야 한다', async () => {
    renderSection();

    expect(screen.getByText(/리스크 데이터를 불러오는 중/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/risk/volatility?period=1Y'));
    expect(screen.getByText('시장 유사')).toBeInTheDocument();
    expect(screen.getByText('±0.93%')).toBeInTheDocument();
    expect(screen.getByText(/930,000/)).toBeInTheDocument();
    expect(screen.getByText(/S&P 500의 1\.09배/)).toBeInTheDocument();
    expect(screen.getByText('액셀 Top 3')).toBeInTheDocument();
    expect(screen.getByText('완충 자산')).toBeInTheDocument();

    // Read-Only 확인: 입력 폼/저장 버튼 없음
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /저장/i })).not.toBeInTheDocument();
  });

  it('기간 전환 버튼(1개월, 3개월) 클릭 시 해당 기간으로 재조회해야 한다', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '1개월' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/risk/volatility?period=1M'));
      expect(screen.getByText('18.40%')).toBeInTheDocument();
      expect(screen.getByText('공격적 (시장 상회)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '3개월' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/risk/volatility?period=3M'));
    });
  });

  it('금액 마스킹 활성화 시 하루 평균 원화 출렁임과 종목 보유금액이 마스킹되어야 한다', async () => {
    localStorage.setItem('isMasked', 'true');
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    expect(screen.queryByText(/930,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/45,000,000/)).not.toBeInTheDocument();
    const maskedEls = screen.getAllByText(/\*\*\*/);
    expect(maskedEls.length).toBeGreaterThanOrEqual(4);
  });

  it('종목 정렬 기준 변경 시 현금은 최상단에 고정되고 비현금 종목만 정렬되어야 한다', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });

    // 기본(기여도순): CASH -> NVDA(59.51%) -> 005930(30.36%) -> TLT(10.13%)
    let rows = screen.getAllByTestId(/^mobile-risk-asset-/);
    expect(rows.map((r) => r.dataset.ticker)).toEqual(['CASH', 'NVDA', '005930', 'TLT']);

    // 보유금액순 클릭: CASH -> 005930(45M) -> TLT(20M) -> NVDA(15M)
    fireEvent.click(screen.getByRole('button', { name: '보유금액순' }));
    rows = screen.getAllByTestId(/^mobile-risk-asset-/);
    expect(rows.map((r) => r.dataset.ticker)).toEqual(['CASH', '005930', 'TLT', 'NVDA']);

    // 자체 변동성순 클릭: CASH -> NVDA(42.5) -> 005930(24.1) -> TLT(12.0)
    fireEvent.click(screen.getByRole('button', { name: '자체 변동성순' }));
    rows = screen.getAllByTestId(/^mobile-risk-asset-/);
    expect(rows.map((r) => r.dataset.ticker)).toEqual(['CASH', 'NVDA', '005930', 'TLT']);
  });

  it('API 요청 실패 시 에러 카드가 노출되고 다시 시도 클릭 시 재조회해야 한다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network Error'));
    renderSection();

    await waitFor(() => {
      expect(screen.getByText(/내재 변동성 데이터를 불러오는 데 실패했습니다/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });
  });
});
