import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MobileAssetTrendCard from './MobileAssetTrendCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ children, width = 360, height = 220 }) => {
      const w = typeof width === 'number' ? width : 360;
      const h = typeof height === 'number' ? height : 220;
      const childNode = typeof children === 'function'
        ? children({ width: w, height: h })
        : React.isValidElement(children)
          ? React.cloneElement(children, { width: w, height: h })
          : children;
      return (
        <div style={{ width: w, height: h }} className="recharts-responsive-container">
          {childNode}
        </div>
      );
    },
    AreaChart: ({ children, onMouseMove, onMouseLeave, ...props }) => {
      const OriginalAreaChart = original.AreaChart;
      return (
        <div data-testid="mock-mobile-area-chart-wrapper">
          <button
            type="button"
            data-testid="mock-mobile-hover-point-1"
            onClick={() => onMouseMove?.({ isTooltipActive: true, activeTooltipIndex: 1 })}
          >
            hover-1
          </button>
          <button
            type="button"
            data-testid="mock-mobile-hover-leave"
            onClick={() => onMouseLeave?.()}
          >
            leave
          </button>
          <OriginalAreaChart onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} {...props}>
            {children}
          </OriginalAreaChart>
        </div>
      );
    },
    Tooltip: (props) => {
      const contentResult = typeof props.content === 'function'
        ? props.content({ active: true, label: 0, payload: [] })
        : undefined;
      return (
        <div
          data-testid="mock-mobile-tooltip-check"
          data-is-null={contentResult === null ? 'true' : 'false'}
        />
      );
    },
  };
});

const mockSnapshots = {
  history: [
    {
      date: '2024-01-01',
      total: 1000000,
      acc_1: 600000,
      index: 1000.0,
      index_change_pct: 0.0,
      index_cum_return_pct: 0.0,
    },
    {
      date: '2024-01-02',
      total: 800000,
      acc_1: 540000,
      index: 800.0,
      index_change_pct: -20.0,
      index_cum_return_pct: -20.0,
    },
    {
      date: '2024-01-03',
      total: 1200000,
      acc_1: 800000,
      index: 1200.0,
      index_change_pct: 50.0,
      index_cum_return_pct: 20.0,
    },
    {
      date: '2024-01-04',
      total: 1140000,
      acc_1: 720000,
      index: 1140.0,
      index_change_pct: -5.0,
      index_cum_return_pct: 14.0,
    },
  ],
  accounts: [{ id: 1, name: '모바일 테스트 계좌' }],
};

const renderMobileTrendCard = (data = mockSnapshots) =>
  render(
    <MaskingProvider>
      <MobileAssetTrendCard data={data} />
    </MaskingProvider>
  );

describe('MobileAssetTrendCard 컴포넌트', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('다크 테마 카드, 상시 요약 바, 미호버 안내 문구가 렌더링되며 플로팅 툴팁은 비활성화되어야 한다', () => {
    const { container } = renderMobileTrendCard();

    const card = container.firstChild;
    expect(card).toHaveClass('bg-slate-900', 'border-slate-800', 'rounded-3xl');
    expect(screen.getByText('자산 추이')).toBeInTheDocument();

    const assetTab = screen.getByRole('button', { name: '총자산 규모 (원)' });
    const indexTab = screen.getByRole('button', { name: '수익 지수 (Index)' });
    expect(assetTab).toHaveAttribute('aria-pressed', 'true');
    expect(indexTab).toHaveAttribute('aria-pressed', 'false');

    const summaryBar = screen.getByTestId('mobile-asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('현재 평가액');
    expect(summaryBar).toHaveTextContent('1,140,000 원');
    expect(summaryBar).toHaveTextContent('현재 DD');
    expect(summaryBar).toHaveTextContent('-5.00%');
    expect(summaryBar).toHaveTextContent('역대 MDD');
    expect(summaryBar).toHaveTextContent('-20.00%');

    const hoverBar = screen.getByTestId('mobile-asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('차트를 터치하면 해당 시점의 상세 정보가 표시됩니다.');

    expect(screen.getByTestId('mock-mobile-tooltip-check')).toHaveAttribute('data-is-null', 'true');
  });

  it('데이터가 없을 때 다크 테마 카드 내에 안내 메시지를 표시해야 한다', () => {
    renderMobileTrendCard({ history: [], accounts: [] });
    expect(screen.getByText('표시할 자산 추이 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('계좌 필터 변경 시 상시 요약 바가 선택된 계좌 기준으로 재계산되어야 한다', () => {
    renderMobileTrendCard();

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'acc_1' } });

    const summaryBar = screen.getByTestId('mobile-asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('720,000 원');
    expect(summaryBar).toHaveTextContent('-10.00%');
    expect(summaryBar).not.toHaveTextContent('-20.00%');
  });

  it('총자산 규모 탭에서 차트 터치/호버 시 하단 상세 바에 날짜, 평가액, 낙폭이 표시되고 이탈 시 복귀해야 한다', () => {
    renderMobileTrendCard();

    fireEvent.click(screen.getByTestId('mock-mobile-hover-point-1'));
    const hoverBar = screen.getByTestId('mobile-asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('2024.01.02');
    expect(hoverBar).toHaveTextContent('800,000 원');
    expect(hoverBar).toHaveTextContent('고점 대비 -20.00%');

    fireEvent.click(screen.getByTestId('mock-mobile-hover-leave'));
    expect(hoverBar).toHaveTextContent('차트를 터치하면 해당 시점의 상세 정보가 표시됩니다.');
  });

  it('수익 지수 (Index) 탭으로 전환하면 1,000 pt 기준선, 상시 요약 바, 직전 대비 등락률 없는 하단 상세 바가 동작해야 한다', () => {
    const { container } = renderMobileTrendCard();

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(container.querySelector('.recharts-reference-line')).toBeInTheDocument();

    const summaryBar = screen.getByTestId('mobile-asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('현재 지수');
    expect(summaryBar).toHaveTextContent('1,140.00 pt');
    expect(summaryBar).toHaveTextContent('+14.00%');
    expect(summaryBar).toHaveTextContent('-5.00%');
    expect(summaryBar).toHaveTextContent('-20.00%');

    fireEvent.click(screen.getByTestId('mock-mobile-hover-point-1'));
    const hoverBar = screen.getByTestId('mobile-asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('2024.01.02');
    expect(hoverBar).toHaveTextContent('800.00 pt');
    expect(hoverBar).toHaveTextContent('기준일 대비 -20.00%');
    expect(hoverBar).toHaveTextContent('낙폭 -20.00%');
    expect(screen.queryByText(/직전 대비 등락률/)).not.toBeInTheDocument();
  });

  it('프라이버시 마스킹 활성화 시 총자산 금액만 *** 원으로 마스킹되고 DD/MDD(%)와 수익 지수 탭은 마스킹되지 않아야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    renderMobileTrendCard();

    const summaryBar = screen.getByTestId('mobile-asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('*** 원');
    expect(summaryBar).toHaveTextContent('-5.00%');
    expect(summaryBar).toHaveTextContent('-20.00%');

    fireEvent.click(screen.getByTestId('mock-mobile-hover-point-1'));
    const hoverBar = screen.getByTestId('mobile-asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('*** 원');
    expect(hoverBar).toHaveTextContent('고점 대비 -20.00%');

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));
    expect(summaryBar).toHaveTextContent('1,140.00 pt');
    expect(summaryBar).toHaveTextContent('+14.00%');
    expect(summaryBar).not.toHaveTextContent('***');
  });
});
