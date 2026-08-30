import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PerformanceTable from './PerformanceTable';
import { MaskingProvider } from '../contexts/MaskingContext';

describe('PerformanceTable', () => {
  const yearlyStatusData = [
    {
      year: 2023,
      contribution: 1000,
      profit: 200,
      roi: 20,
      assets: 1200,
      increase: 200,
    },
    {
      year: 2022,
      contribution: 1000,
      profit: 100,
      roi: 10,
      assets: 1000,
      increase: 100,
    },
  ];

  const dailyStatusData = [
    {
      date: '2024-01-03',
      contribution: 0,
      profit: -300,
      roi: -7.5,
      assets: 3700,
      increase: -300,
    },
    {
      date: '2024-01-02',
      contribution: 500,
      profit: 500,
      roi: 14.29,
      assets: 4000,
      increase: 1000,
    },
    {
      date: '2024-01-01',
      contribution: 3000,
      profit: 0,
      roi: 0,
      assets: 3000,
      increase: 3000,
    },
  ];

  const monthlyStatusData = [
    {
      month: '2024-03',
      contribution: 500,
      profit: 300,
      roi: 6.0,
      assets: 5800,
      increase: 800,
    },
    {
      month: '2024-02',
      contribution: 1000,
      profit: -200,
      roi: -4.0,
      assets: 5000,
      increase: 800,
    },
    {
      month: '2024-01',
      contribution: 4200,
      profit: 0,
      roi: 0,
      assets: 4200,
      increase: 4200,
    },
  ];

  const yearlyComparisonData = [
    {
      year: 2026,
      assets: 1500000,
      roi: 15.38,
      kospi: 10.0,
      kosdaq: -5.2,
      sp500: 8.5,
      nasdaq: 12.0,
    },
    {
      year: 2025,
      assets: 1000000,
      roi: 20.0,
      kospi: 10.0,
      kosdaq: 10.0,
      sp500: 10.0,
      nasdaq: 10.0,
    },
  ];

  const generateDailyData = (count) => {
    return Array.from({ length: count }, (_, idx) => {
      const day = String(count - idx).padStart(2, '0');
      return {
        date: `2024-01-${day}`,
        contribution: 100,
        profit: 10,
        roi: 1.5,
        assets: 1000 + (count - idx) * 10,
        increase: 10,
        kospi: 0.5,
        kosdaq: -0.2,
        sp500: 0.8,
        nasdaq: 1.1,
      };
    });
  };

  const generateMonthlyData = (count) => {
    return Array.from({ length: count }, (_, idx) => {
      const monthNum = count - idx;
      const year = 2020 + Math.floor((monthNum - 1) / 12);
      const month = String(((monthNum - 1) % 12) + 1).padStart(2, '0');
      return {
        month: `${year}-${month}`,
        contribution: 500,
        profit: 50,
        roi: 2.0,
        assets: 5000 + (count - idx) * 100,
        increase: 100,
        kospi: 1.0,
        kosdaq: -0.5,
        sp500: 1.2,
        nasdaq: 1.5,
      };
    });
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. type="status" & period="yearly" (연도별 현황)', () => {
    it('연도별 현황 테이블과 컬럼, 데이터가 올바르게 렌더링되어야 한다', () => {
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="yearly" data={yearlyStatusData} lastSnapshotDate="2024-04-26" />
        </MaskingProvider>
      );

      expect(screen.getByText('연도별 현황')).toBeInTheDocument();
      expect(screen.getByText('Yearly Performance')).toBeInTheDocument();
      expect(screen.getByText(/최근 스냅샷 기준:/)).toBeInTheDocument();
      expect(screen.getByText('2024-04-26')).toBeInTheDocument();

      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('2023');
      expect(rows[1]).toHaveTextContent('+200');
      expect(rows[2]).toHaveTextContent('2022');
      expect(rows[2]).toHaveTextContent('-'); // 최초 연도 증가액은 '-'
    });
  });

  describe('2. type="status" & period="monthly" (월별 현황)', () => {
    it('월별 현황 테이블과 컬럼, 데이터가 올바르게 렌더링되어야 한다', () => {
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="monthly" data={monthlyStatusData} />
        </MaskingProvider>
      );

      expect(screen.getByText('월별 현황')).toBeInTheDocument();
      expect(screen.getByText('Monthly Performance')).toBeInTheDocument();
      expect(screen.getByText('연월')).toBeInTheDocument();

      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('2024-03');
      expect(rows[1]).toHaveTextContent('+300');
      expect(rows[1]).toHaveTextContent('6%');
      expect(rows[2]).toHaveTextContent('2024-02');
      expect(rows[2]).toHaveTextContent('-200');
      expect(rows[3]).toHaveTextContent('2024-01');
      expect(rows[3]).toHaveTextContent('-'); // 최초 월 증가액은 '-'
    });

    it('10개 초과 시 월별 모드에서도 페이지네이션 컨트롤이 작동해야 한다', () => {
      const largeData = generateMonthlyData(15);
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="monthly" data={largeData} />
        </MaskingProvider>
      );

      expect(screen.getAllByRole('row')).toHaveLength(11); // 1 header + 10 items
      const nextBtn = screen.getByLabelText('다음 페이지');
      fireEvent.click(nextBtn);

      expect(screen.getAllByRole('row')).toHaveLength(6); // 1 header + 5 items
    });
  });

  describe('3. type="status" & period="daily" (일자별 현황)', () => {
    it('일자별 현황 데이터가 렌더링되고 최초 날짜 증가액은 "-"로 표시되어야 한다', () => {
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="daily" data={dailyStatusData} />
        </MaskingProvider>
      );

      expect(screen.getByText('일자별 현황')).toBeInTheDocument();
      expect(screen.getByText('Snapshot Performance')).toBeInTheDocument();

      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('2024-01-03');
      expect(rows[3]).toHaveTextContent('2024-01-01');
      expect(rows[3]).toHaveTextContent('-');
    });

    it('10개 초과 시 페이지네이션 컨트롤이 작동해야 한다', () => {
      const largeData = generateDailyData(12);
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="daily" data={largeData} />
        </MaskingProvider>
      );

      expect(screen.getAllByRole('row')).toHaveLength(11); // 1 header + 10 items
      expect(screen.getByText('2024-01-12')).toBeInTheDocument();
      expect(screen.queryByText('2024-01-01')).not.toBeInTheDocument();

      const nextBtn = screen.getByLabelText('다음 페이지');
      fireEvent.click(nextBtn);

      expect(screen.getAllByRole('row')).toHaveLength(3); // 1 header + 2 items
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.queryByText('2024-01-12')).not.toBeInTheDocument();
    });

    it('페이지 크기 변경(10 -> 20)이 정상 작동해야 한다', () => {
      const largeData = generateDailyData(25);
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="daily" data={largeData} />
        </MaskingProvider>
      );

      const pageSizeSelect = screen.getByLabelText('페이지당 표시 개수');
      expect(pageSizeSelect).toBeInTheDocument();
      fireEvent.change(pageSizeSelect, { target: { value: '20' } });

      expect(screen.getAllByRole('row')).toHaveLength(21); // 1 header + 20 items
    });
  });

  describe('4. type="comparison" & period="yearly" (연간 지수 비교)', () => {
    it('연간 지수 비교 테이블과 4대 지수 컬럼이 렌더링되어야 한다', () => {
      render(
        <MaskingProvider>
          <PerformanceTable type="comparison" period="yearly" data={yearlyComparisonData} />
        </MaskingProvider>
      );

      expect(screen.getByText('연간 수익률 비교')).toBeInTheDocument();
      expect(screen.getByText('Yearly Index Comparison')).toBeInTheDocument();
      expect(screen.getByText('₩ 1,500,000')).toBeInTheDocument();
      expect(screen.getByText('+15.38%')).toBeInTheDocument();
      expect(screen.getByText('-5.20%')).toBeInTheDocument();
      expect(screen.getByText('+8.50%')).toBeInTheDocument();
    });
  });

  describe('5. type="comparison" & period="monthly" (월간 지수 비교)', () => {
    it('월간 지수 비교 테이블 및 페이지네이션이 렌더링되어야 한다', () => {
      const largeData = generateMonthlyData(12);
      render(
        <MaskingProvider>
          <PerformanceTable type="comparison" period="monthly" data={largeData} />
        </MaskingProvider>
      );

      expect(screen.getByText('월간 수익률 비교')).toBeInTheDocument();
      expect(screen.getByText('Monthly Index Comparison')).toBeInTheDocument();
      expect(screen.getByText('2020-12')).toBeInTheDocument();
      expect(screen.getByLabelText('다음 페이지')).toBeInTheDocument();
    });
  });

  describe('6. type="comparison" & period="daily" (일간 지수 비교)', () => {
    it('일간 지수 비교 테이블 및 페이지네이션이 렌더링되어야 한다', () => {
      const largeData = generateDailyData(12);
      render(
        <MaskingProvider>
          <PerformanceTable type="comparison" period="daily" data={largeData} />
        </MaskingProvider>
      );

      expect(screen.getByText('일간 수익률 비교')).toBeInTheDocument();
      expect(screen.getByText('Daily Index Comparison')).toBeInTheDocument();
      expect(screen.getByText('2024-01-12')).toBeInTheDocument();
      expect(screen.getByLabelText('다음 페이지')).toBeInTheDocument();
    });
  });

  describe('7. 마스킹 모드 연동', () => {
    it('마스킹 활성화 시 자산 금액이 ***로 표시되어야 한다', () => {
      localStorage.setItem('isMasked', 'true');
      render(
        <MaskingProvider>
          <PerformanceTable type="status" period="yearly" data={yearlyStatusData} />
        </MaskingProvider>
      );

      expect(screen.getAllByText('***').length).toBeGreaterThan(0);
      expect(screen.getByText('20%')).toBeInTheDocument(); // ROI는 유지
    });
  });

  describe('8. 예외 및 빈 데이터 처리', () => {
    it('data가 비어있거나 null일 경우 아무것도 렌더링하지 않아야 한다', () => {
      const { container: c1 } = render(
        <MaskingProvider>
          <PerformanceTable type="status" period="yearly" data={[]} />
        </MaskingProvider>
      );
      expect(c1.firstChild).toBeNull();

      const { container: c2 } = render(
        <MaskingProvider>
          <PerformanceTable type="status" period="yearly" data={null} />
        </MaskingProvider>
      );
      expect(c2.firstChild).toBeNull();
    });
  });
});
