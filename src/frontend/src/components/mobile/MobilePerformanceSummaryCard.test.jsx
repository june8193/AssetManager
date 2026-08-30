import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      profit: -3000000,
      roi: -2.8,
      assets: 108000000,
      increase: 17000000,
    },
  ];

  const mockMonthlyData = [
    {
      month: '2026-05',
      contribution: 1000000,
      profit: 2500000,
      roi: 2.1,
      assets: 125000000,
      increase: 3500000,
    },
    {
      month: '2026-04',
      contribution: 1000000,
      profit: -1200000,
      roi: -0.98,
      assets: 121500000,
      increase: -200000,
    },
  ];

  const mockDailyData = [
    {
      date: '2026-05-15',
      contribution: 0,
      profit: 500000,
      roi: 0.4,
      assets: 125000000,
      increase: 500000,
    },
    {
      date: '2026-05-14',
      contribution: 500000,
      profit: -300000,
      roi: -0.24,
      assets: 124500000,
      increase: 200000,
    },
  ];

  const mockSummary = {
    total_profit: 25000000,
    cumulative_roi: 25.0,
    yearly: mockYearlyData,
    monthly: mockMonthlyData,
    daily: mockDailyData,
  };

  it('누적 ROI 헤더 및 기본값인 연도별 탭 성과가 올바르게 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={mockSummary} />
      </MaskingProvider>
    );

    // 누적 성과 헤더 확인
    expect(screen.getByText('성과 요약')).toBeInTheDocument();
    expect(screen.getByText('+25.00%')).toBeInTheDocument();

    // 탭 버튼 3개 렌더링 확인
    expect(screen.getByRole('button', { name: '연도별' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '월별' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일별' })).toBeInTheDocument();

    // 연도별 항목 렌더링 확인
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('+15.50%')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('-2.80%')).toBeInTheDocument();
  });

  it('월별 탭을 클릭하면 월별 데이터가 YY.MM 포맷 배지와 함께 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={mockSummary} />
      </MaskingProvider>
    );

    const monthlyTab = screen.getByRole('button', { name: '월별' });
    fireEvent.click(monthlyTab);

    // 월별 배지 포맷 (YY.MM: 26.05, 26.04)
    expect(screen.getByText('26.05')).toBeInTheDocument();
    expect(screen.getByText('+2.10%')).toBeInTheDocument();
    expect(screen.getByText('26.04')).toBeInTheDocument();
    expect(screen.getByText('-0.98%')).toBeInTheDocument();
  });

  it('일별 탭을 클릭하면 일별 데이터가 MM.DD 포맷 배지와 함께 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={mockSummary} />
      </MaskingProvider>
    );

    const dailyTab = screen.getByRole('button', { name: '일별' });
    fireEvent.click(dailyTab);

    // 일별 배지 포맷 (MM.DD: 05.15, 05.14)
    expect(screen.getByText('05.15')).toBeInTheDocument();
    expect(screen.getByText('+0.40%')).toBeInTheDocument();
    expect(screen.getByText('05.14')).toBeInTheDocument();
    expect(screen.getByText('-0.24%')).toBeInTheDocument();
  });

  it('마스킹 활성화 시 자산 및 수익/추가 금액이 마스킹되어야 한다', () => {
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

  it('해당 기간의 데이터가 없을 경우 안내 문구가 표시되어야 한다', () => {
    const emptyData = {
      total_profit: 0,
      cumulative_roi: 0,
      yearly: [],
      monthly: [],
      daily: [],
    };

    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={emptyData} />
      </MaskingProvider>
    );

    expect(screen.getByText('해당 기간 성과 데이터가 없습니다.')).toBeInTheDocument();

    const monthlyTab = screen.getByRole('button', { name: '월별' });
    fireEvent.click(monthlyTab);
    expect(screen.getByText('해당 기간 성과 데이터가 없습니다.')).toBeInTheDocument();
  });
});
