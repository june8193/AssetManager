import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobilePerformanceSummaryCard from './MobilePerformanceSummaryCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobilePerformanceSummaryCard', () => {
  const mockYearlyData = [
    {
      year: '2026',
      contribution: 5000000,
      profit: 12000000,
      roi: 15.5,
      assets: 125000000,
      increase: 17000000,
    },
    {
      year: '2025',
      contribution: 20000000,
      profit: 8000000,
      roi: 9.8,
      assets: 108000000,
      increase: 28000000,
    },
  ];

  const mockSummary = {
    total_profit: 25000000,
    cumulative_roi: 25.0,
    yearly: mockYearlyData,
  };

  it('누적 수익률 및 연도별 성과 요약이 올바르게 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={mockSummary} />
      </MaskingProvider>
    );

    // 누적 성과 헤더 확인
    expect(screen.getByText('성과 요약')).toBeInTheDocument();
    expect(screen.getByText('+25.00%')).toBeInTheDocument();

    // 연도별 항목 렌더링 확인
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('+15.50%')).toBeInTheDocument();

    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('+9.80%')).toBeInTheDocument();
  });

  it('마스킹 활성화 시 자산 및 수익 금액이 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={mockSummary} />
      </MaskingProvider>
    );

    const maskedElements = screen.getAllByText(/\*\*\*/);
    expect(maskedElements.length).toBeGreaterThanOrEqual(1);

    localStorage.removeItem('isMasked');
  });
});
