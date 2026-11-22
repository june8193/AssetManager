import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileRiskChartsCard from './MobileRiskChartsCard';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div data-testid="mock-responsive-container" style={{ width: 320, height: 280 }}>
        {children}
      </div>
    ),
  };
});

const makeAssets = (count) => {
  const list = [
    {
      ticker: 'CASH',
      name: '원화 현금',
      is_cash: true,
      weight: 10,
      annualized_volatility: 0,
      volatility_share: 0,
    },
  ];
  for (let i = 1; i <= count; i++) {
    list.push({
      ticker: `TICK${i}`,
      name: `종목${i}`,
      is_cash: false,
      weight: 90 / count,
      annualized_volatility: 15 + i,
      volatility_share: 20 - i * 0.5,
    });
  }
  return list;
};

const mockBenchmarks = {
  sp500: { annualized_volatility: 14.5 },
  nasdaq: { annualized_volatility: 20.1 },
  kospi: { annualized_volatility: 17.2 },
};

const mockDrawdown = {
  dates: ['2026-10-01', '2026-10-15', '2026-11-01'],
  benchmarks: {
    sp500: [0, -2.5, -1.0],
    nasdaq: [0, -4.1, -2.2],
    kospi: [0, -3.2, -2.8],
  },
  portfolio_current: [0, -2.0, -0.8],
};

describe('MobileRiskChartsCard', () => {
  it('기본으로 변동성 vs 기여도 탭이 활성화되고, MDD 방어력 탭으로 전환되어야 한다', () => {
    render(
      <MobileRiskChartsCard
        assets={makeAssets(5)}
        benchmarks={mockBenchmarks}
        drawdownComparison={mockDrawdown}
      />
    );

    const barTab = screen.getByRole('tab', { name: /변동성 vs 기여도/i });
    const mddTab = screen.getByRole('tab', { name: /MDD 방어력/i });

    expect(barTab).toHaveAttribute('aria-selected', 'true');
    expect(mddTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('mobile-volatility-bar-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-mdd-line-chart')).not.toBeInTheDocument();

    fireEvent.click(mddTab);

    expect(barTab).toHaveAttribute('aria-selected', 'false');
    expect(mddTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('mobile-volatility-bar-chart')).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-mdd-line-chart')).toBeInTheDocument();
  });

  it('접기/펼치기 버튼 클릭 시 차트 패널이 숨겨지고 다시 표시되어야 한다', () => {
    render(
      <MobileRiskChartsCard
        assets={makeAssets(5)}
        benchmarks={mockBenchmarks}
        drawdownComparison={mockDrawdown}
      />
    );

    expect(screen.getByTestId('mobile-risk-chart-panel')).toBeInTheDocument();

    const collapseBtn = screen.getByRole('button', { name: /차트 접기/i });
    fireEvent.click(collapseBtn);

    expect(screen.queryByTestId('mobile-risk-chart-panel')).not.toBeInTheDocument();
    const expandBtn = screen.getByRole('button', { name: /차트 펼치기/i });
    fireEvent.click(expandBtn);

    expect(screen.getByTestId('mobile-risk-chart-panel')).toBeInTheDocument();
  });

  it('비현금 보유 종목이 8개 이하일 때 전체 보기 토글 버튼이 노출되지 않아야 한다', () => {
    render(
      <MobileRiskChartsCard
        assets={makeAssets(8)}
        benchmarks={mockBenchmarks}
        drawdownComparison={mockDrawdown}
      />
    );

    expect(screen.queryByTestId('risk-bar-toggle-all')).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-volatility-bar-chart')).toHaveAttribute('data-visible-count', '8');
  });

  it('비현금 보유 종목이 10개 이상일 때 기본 상위 8개만 표시하고 전체 보기 토글 시 전체가 표시되어야 한다', () => {
    render(
      <MobileRiskChartsCard
        assets={makeAssets(10)}
        benchmarks={mockBenchmarks}
        drawdownComparison={mockDrawdown}
      />
    );

    const chart = screen.getByTestId('mobile-volatility-bar-chart');
    expect(chart).toHaveAttribute('data-visible-count', '8');

    const toggleBtn = screen.getByTestId('risk-bar-toggle-all');
    expect(toggleBtn).toHaveTextContent(/전체 보기/i);

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('mobile-volatility-bar-chart')).toHaveAttribute('data-visible-count', '10');
    expect(toggleBtn).toHaveTextContent(/상위 8개만 보기/i);

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('mobile-volatility-bar-chart')).toHaveAttribute('data-visible-count', '8');
  });
});
