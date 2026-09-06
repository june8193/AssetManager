import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MobileBenchmarkSection from './MobileBenchmarkSection';
import { MaskingProvider } from '../../contexts/MaskingContext';

const mockBenchmarkData = {
  portfolio: {
    total_valuation: 150000000,
    actual_latest_valuation: 150000000,
    actual_latest_date: '2026-06-03',
    ytd_return: 12.45,
  },
  indices: {
    '^GSPC': { name: 'S&P 500', return: 8.5, alpha: 3.95, judgment: '아웃퍼폼', value: 5200.0, mdd: -5.4 },
    '^IXIC': { name: 'NASDAQ', return: 14.2, alpha: -1.75, judgment: '언더퍼폼', value: 17500.0, mdd: -8.2 },
    '^KS11': { name: 'KOSPI', return: 3.1, alpha: 9.35, judgment: '아웃퍼폼', value: 2650.0, mdd: -4.3 },
    '^KQ11': { name: 'KOSDAQ', return: -2.4, alpha: 14.85, judgment: '아웃퍼폼', value: 850.0, mdd: -10.5 },
  },
  chart: {
    labels: ['2026-06-01', '2026-06-02', '2026-06-03'],
    datasets: [
      { label: '내 포트폴리오', data: [0.0, 1.2, 2.5] },
      { label: 'S&P 500', data: [0.0, 0.8, 1.5] },
      { label: 'NASDAQ', data: [0.0, 1.1, 2.1] },
      { label: 'KOSPI', data: [0.0, -0.3, 0.2] },
      { label: 'KOSDAQ', data: [0.0, -0.8, -1.2] },
    ],
  },
  alpha_analysis: [
    { benchmark: 'S&P 500', ticker: '^GSPC', benchmark_return: 8.5, portfolio_return: 12.45, alpha: 3.95, judgment: '시장 상회' },
    { benchmark: 'NASDAQ', ticker: '^IXIC', benchmark_return: 14.2, portfolio_return: 12.45, alpha: -1.75, judgment: '시장 하회' },
    { benchmark: 'KOSPI', ticker: '^KS11', benchmark_return: 3.1, portfolio_return: 12.45, alpha: 9.35, judgment: '시장 상회' },
    { benchmark: 'KOSDAQ', ticker: '^KQ11', benchmark_return: -2.4, portfolio_return: 12.45, alpha: 14.85, judgment: '시장 상회' },
  ],
};

const mockPortfolioPerf = {
  sharpe_ratio: 1.45,
  sortino_ratio: 2.10,
  mdd: -3.85,
  max_mdd: -6.20,
  annualized_return: 18.5,
  annualized_volatility: 12.3,
  period: 'YTD',
};

function renderComponent(props = {}) {
  return render(
    <MaskingProvider>
      <MobileBenchmarkSection {...props} />
    </MaskingProvider>
  );
}

describe('MobileBenchmarkSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/market/benchmark') || urlStr.includes('/api/benchmark')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockBenchmarkData),
        });
      }
      if (urlStr.includes('/api/v1/performance/portfolio')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPortfolioPerf),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('기간 선택기(YTD, 1M, 3M, 1Y)가 렌더링되고 기본값은 YTD이다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('benchmark-period-ytd')).toBeInTheDocument();
    });

    const ytdBtn = screen.getByTestId('benchmark-period-ytd');
    const m1Btn = screen.getByTestId('benchmark-period-1m');
    const m3Btn = screen.getByTestId('benchmark-period-3m');
    const y1Btn = screen.getByTestId('benchmark-period-1y');

    expect(ytdBtn).toHaveAttribute('aria-pressed', 'true');
    expect(m1Btn).toHaveAttribute('aria-pressed', 'false');
    expect(m3Btn).toHaveAttribute('aria-pressed', 'false');
    expect(y1Btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('기간 버튼 클릭 시 활성 상태가 변경되고 해당 기간 API가 호출된다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('benchmark-period-1m')).toBeInTheDocument();
    });

    const m1Btn = screen.getByTestId('benchmark-period-1m');
    fireEvent.click(m1Btn);

    expect(m1Btn).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => {
      const calls = global.fetch.mock.calls.map((call) => String(call[0]));
      expect(calls.some((url) => url.includes('period=1M'))).toBe(true);
    });
  });

  it('상단 MDD 요약 카드가 렌더링되고 포트폴리오 수익률과 4대 지수 MDD가 표시된다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('mdd-summary-card')).toBeInTheDocument();
      expect(screen.getByTestId('masked-return')).toHaveTextContent('+12.45%');
      expect(screen.getByTestId('portfolio-mdd-value')).toHaveTextContent('-3.85%');
    });

    expect(screen.getByTestId('index-mdd-sp500')).toHaveTextContent('-5.4');
    expect(screen.getByTestId('index-mdd-nasdaq')).toHaveTextContent('-8.2');
  });

  it('누적 수익률 비교 선 차트 컨테이너와 5개 범례 칩이 렌더링된다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('benchmark-chart-container')).toBeInTheDocument();
      expect(screen.getByTestId('legend-chip-내 포트폴리오')).toBeInTheDocument();
      expect(screen.getByTestId('legend-chip-S&P 500')).toBeInTheDocument();
      expect(screen.getByTestId('legend-chip-NASDAQ')).toBeInTheDocument();
      expect(screen.getByTestId('legend-chip-KOSPI')).toBeInTheDocument();
      expect(screen.getByTestId('legend-chip-KOSDAQ')).toBeInTheDocument();
    });
  });

  it('범례 칩 터치 시 해당 시리즈가 활성/비활성 토글된다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('legend-chip-S&P 500')).toBeInTheDocument();
    });

    const sp500Chip = screen.getByTestId('legend-chip-S&P 500');
    expect(sp500Chip).toHaveAttribute('aria-pressed', 'true');

    // 칩 클릭 -> 비활성화
    fireEvent.click(sp500Chip);
    expect(sp500Chip).toHaveAttribute('aria-pressed', 'false');

    // 다시 클릭 -> 활성화
    fireEvent.click(sp500Chip);
    expect(sp500Chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('isMasked prop이 true이면 포트폴리오 수익률이 마스킹된다', async () => {
    renderComponent({ isMasked: true });

    await waitFor(() => {
      expect(screen.getByTestId('masked-return')).toHaveTextContent('***');
    });
  });

  it('refreshTrigger 변경 시 데이터를 다시 재조회한다', async () => {
    const { rerender } = renderComponent({ refreshTrigger: 0 });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const initialCallCount = global.fetch.mock.calls.length;

    // trigger 변경
    rerender(
      <MaskingProvider>
        <MobileBenchmarkSection refreshTrigger={1} />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
