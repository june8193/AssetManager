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

  it('일별 탭을 클릭하면 일별 데이터가 YY.MM.DD 포맷 배지와 함께 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobilePerformanceSummaryCard data={mockSummary} />
      </MaskingProvider>
    );

    const dailyTab = screen.getByRole('button', { name: '일별' });
    fireEvent.click(dailyTab);

    // 일별 배지 포맷 (YY.MM.DD: 26.05.15, 26.05.14)
    expect(screen.getByText('26.05.15')).toBeInTheDocument();
    expect(screen.getByText('+0.40%')).toBeInTheDocument();
    expect(screen.getByText('26.05.14')).toBeInTheDocument();
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

  describe('페이지네이션 (Pagination)', () => {
    // 12개 월별 테스트 데이터 생성 (2026-12 ~ 2026-01)
    const mock12Months = Array.from({ length: 12 }, (_, i) => {
      const m = String(12 - i).padStart(2, '0');
      return {
        month: `2026-${m}`,
        contribution: 1000000,
        profit: (12 - i) * 100000,
        roi: 12 - i,
        assets: 100000000 + i * 1000000,
        increase: 1000000,
      };
    });

    const paginationSummary = {
      total_profit: 50000000,
      cumulative_roi: 30.0,
      yearly: mockYearlyData, // 2개
      monthly: mock12Months,  // 12개 (3페이지)
      daily: mockDailyData,   // 2개
    };

    it('5개 이하 항목인 경우 페이지네이션 컨트롤이 노출되지 않아야 한다', () => {
      render(
        <MaskingProvider>
          <MobilePerformanceSummaryCard data={paginationSummary} />
        </MaskingProvider>
      );

      // 기본 연도별 탭은 2개이므로 이전/다음 버튼이 없어야 함
      expect(screen.queryByRole('button', { name: /이전/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /다음/ })).not.toBeInTheDocument();
    });

    it('5개를 초과하는 경우 1페이지에 5개만 표시되고 이전 버튼은 disabled, 다음 버튼은 enabled 되어야 한다', () => {
      render(
        <MaskingProvider>
          <MobilePerformanceSummaryCard data={paginationSummary} />
        </MaskingProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: '월별' }));

      // 1페이지 항목 5개 (26.12 ~ 26.08) 노출
      expect(screen.getByText('26.12')).toBeInTheDocument();
      expect(screen.getByText('26.11')).toBeInTheDocument();
      expect(screen.getByText('26.10')).toBeInTheDocument();
      expect(screen.getByText('26.09')).toBeInTheDocument();
      expect(screen.getByText('26.08')).toBeInTheDocument();

      // 6번째 이후 항목은 1페이지에 없어야 함
      expect(screen.queryByText('26.07')).not.toBeInTheDocument();

      // 페이지 번호 표시 (1 / 3 또는 1/3)
      expect(screen.getByText(/1\s*\/\s*3/)).toBeInTheDocument();

      // 버튼 상태
      const prevBtn = screen.getByRole('button', { name: /이전/ });
      const nextBtn = screen.getByRole('button', { name: /다음/ });
      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeEnabled();
    });

    it('다음 버튼 클릭 시 2페이지(6~10번째 항목)로 이동하고 이전/다음 버튼 모두 활성화되어야 한다', () => {
      render(
        <MaskingProvider>
          <MobilePerformanceSummaryCard data={paginationSummary} />
        </MaskingProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: '월별' }));
      const nextBtn = screen.getByRole('button', { name: /다음/ });
      fireEvent.click(nextBtn);

      // 2페이지 항목 (26.07 ~ 26.03) 노출
      expect(screen.getByText('26.07')).toBeInTheDocument();
      expect(screen.getByText('26.03')).toBeInTheDocument();
      expect(screen.queryByText('26.12')).not.toBeInTheDocument();
      expect(screen.queryByText('26.02')).not.toBeInTheDocument();

      // 페이지 번호 표시
      expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();

      const prevBtn = screen.getByRole('button', { name: /이전/ });
      expect(prevBtn).toBeEnabled();
      expect(nextBtn).toBeEnabled();
    });

    it('마지막 페이지로 이동 시 다음 버튼이 disabled 되어야 하고, 이전 버튼 클릭 시 이전 페이지로 복귀해야 한다', () => {
      render(
        <MaskingProvider>
          <MobilePerformanceSummaryCard data={paginationSummary} />
        </MaskingProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: '월별' }));
      const nextBtn = screen.getByRole('button', { name: /다음/ });
      fireEvent.click(nextBtn); // 2페이지
      fireEvent.click(nextBtn); // 3페이지

      // 3페이지 항목 (26.02, 26.01) 노출
      expect(screen.getByText('26.02')).toBeInTheDocument();
      expect(screen.getByText('26.01')).toBeInTheDocument();
      expect(screen.getByText(/3\s*\/\s*3/)).toBeInTheDocument();

      const prevBtn = screen.getByRole('button', { name: /이전/ });
      expect(prevBtn).toBeEnabled();
      expect(nextBtn).toBeDisabled();

      // 이전 버튼 클릭하여 2페이지로 복귀
      fireEvent.click(prevBtn);
      expect(screen.getByText('26.07')).toBeInTheDocument();
      expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();
    });

    it('탭(연도별/월별/일별)을 전환할 때 현재 페이지가 항상 1페이지로 자동 초기화되어야 한다', () => {
      render(
        <MaskingProvider>
          <MobilePerformanceSummaryCard data={paginationSummary} />
        </MaskingProvider>
      );

      // 월별 탭 이동 후 2페이지로 이동
      fireEvent.click(screen.getByRole('button', { name: '월별' }));
      const nextBtn = screen.getByRole('button', { name: /다음/ });
      fireEvent.click(nextBtn);
      expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();

      // 일별 탭으로 전환했다가 다시 월별 탭으로 전환
      fireEvent.click(screen.getByRole('button', { name: '일별' }));
      fireEvent.click(screen.getByRole('button', { name: '월별' }));

      // 1페이지로 리셋되어 첫 5개 항목이 보여야 함
      expect(screen.getByText('26.12')).toBeInTheDocument();
      expect(screen.getByText(/1\s*\/\s*3/)).toBeInTheDocument();
    });
  });
});
