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
        const overrides = is1M
          ? { portfolio: { annualized_volatility: 18.4, daily_volatility_pct: 1.16, sp500_ratio: 1.35 } }
          : {};
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeMockVolatilityResponse(period, overrides)),
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
});
