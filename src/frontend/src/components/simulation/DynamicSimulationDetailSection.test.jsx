import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DynamicSimulationDetailSection, { STRATEGY_NAMES } from './DynamicSimulationDetailSection';

describe('DynamicSimulationDetailSection - Component Test', () => {
  const mockApiData = {
    rebalancing_events: [
      {
        date: '2025-01-03',
        event_type: '공포 단계 발동 (티어 1)',
        event_code: 'PANIC_BUY',
        tier: 1,
        sp500_price: 5800.0,
        drawdown: -12.5,
        vix: 26.5,
        old_stock_ratio: 56.9,
        new_stock_ratio: 75.0,
      },
      {
        date: '2025-01-31',
        event_type: '정기 복귀',
        event_code: 'RECOVERY',
        tier: null,
        sp500_price: 6000.0,
        drawdown: -4.2,
        vix: 17.5,
        old_stock_ratio: 78.0,
        new_stock_ratio: 60.0,
      },
    ],
    yearly_stats: {
      [STRATEGY_NAMES.DYNAMIC]: [
        { year: 2025, year_return: 20.0, cumulative_return: 20.0, mdd: -10.0, valuation: 120000000.0 },
      ],
      [STRATEGY_NAMES.REGULAR]: [
        { year: 2025, year_return: 15.0, cumulative_return: 15.0, mdd: -12.0, valuation: 115000000.0 },
      ],
      [STRATEGY_NAMES.BUY_AND_HOLD]: [
        { year: 2025, year_return: 18.0, cumulative_return: 18.0, mdd: -18.0, valuation: 118000000.0 },
      ],
    },
    monthly_stats: {
      [STRATEGY_NAMES.DYNAMIC]: [
        { year: 2025, month: 1, month_return: 5.0, cumulative_return: 5.0, mdd: -5.0, valuation: 105000000.0 },
      ],
      [STRATEGY_NAMES.REGULAR]: [
        { year: 2025, month: 1, month_return: 3.0, cumulative_return: 3.0, mdd: -6.0, valuation: 103000000.0 },
      ],
      [STRATEGY_NAMES.BUY_AND_HOLD]: [
        { year: 2025, month: 1, month_return: 4.0, cumulative_return: 4.0, mdd: -8.0, valuation: 104000000.0 },
      ],
    },
  };

  const dummyFormatKRW = (v) => `${(v || 0).toLocaleString()} 원`;

  it('기본 [이벤트 로그] 탭에서 이벤트 배지와 수치들이 정상 렌더링된다', () => {
    render(
      <DynamicSimulationDetailSection
        apiData={mockApiData}
        dynamicMode="recurring"
        formatKRW={dummyFormatKRW}
      />
    );

    // 이벤트 로그 확인
    expect(screen.getByText('공포 단계 발동 (티어 1)')).toBeDefined();
    expect(screen.getByText('정기 복귀')).toBeDefined();
    expect(screen.getByText('-12.5%')).toBeDefined();
    expect(screen.getByText('26.5')).toBeDefined();
    expect(screen.getByText('56.9%')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('[연도별 현황] 탭 클릭 시 3개 벤치마크의 연도별 성과가 표시된다', () => {
    render(
      <DynamicSimulationDetailSection
        apiData={mockApiData}
        dynamicMode="recurring"
        formatKRW={dummyFormatKRW}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '연도별 현황' }));

    expect(screen.getByText('2025년')).toBeDefined();
    expect(screen.getByText('+20%')).toBeDefined();
    expect(screen.getByText('+15%')).toBeDefined();
    expect(screen.getByText('+18%')).toBeDefined();
  });

  it('[월별 현황] 탭 클릭 시 3개 벤치마크의 월별 성과가 표시된다', () => {
    render(
      <DynamicSimulationDetailSection
        apiData={mockApiData}
        dynamicMode="lump_sum"
        formatKRW={dummyFormatKRW}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '월별 현황' }));

    expect(screen.getByText('2025년 1월')).toBeDefined();
    expect(screen.getAllByText('+5%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+3%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+4%').length).toBeGreaterThan(0);
  });

  it('이벤트가 없는 경우 안내 메시지를 노출한다', () => {
    render(
      <DynamicSimulationDetailSection
        apiData={{ rebalancing_events: [] }}
        dynamicMode="recurring"
        formatKRW={dummyFormatKRW}
      />
    );

    expect(screen.getByText('시뮬레이션 기간 동안 발생한 리밸런싱 이벤트가 없습니다.')).toBeDefined();
  });
});
