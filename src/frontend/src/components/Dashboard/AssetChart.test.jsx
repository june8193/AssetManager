import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AssetChart from './AssetChart';
import { MaskingProvider } from '../../contexts/MaskingContext';

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ children, width = 800, height = 400 }) => {
      const w = typeof width === 'number' ? width : 800;
      const h = typeof height === 'number' ? height : 400;
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
        <div data-testid="mock-area-chart-wrapper">
          <button
            type="button"
            data-testid="mock-hover-point-1"
            onClick={() => onMouseMove?.({ isTooltipActive: true, activeTooltipIndex: 1 })}
          >
            hover-1
          </button>
          <button
            type="button"
            data-testid="mock-hover-leave"
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
          data-testid="mock-tooltip-check"
          data-is-null={contentResult === null ? 'true' : 'false'}
        />
      );
    },
  };
});

describe('AssetChart 컴포넌트', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockData = {
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
    accounts: [{ id: 1, name: '테스트 계좌' }],
  };

  it('차트 제목, 탭 전환 버튼, 상시 요약 바(현재 평가액, 현재 DD, 역대 MDD) 및 미호버 안내 문구가 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    expect(screen.getByText('자산 추이')).toBeInTheDocument();
    expect(screen.getByText('총 자산 합계')).toBeInTheDocument();

    const assetTab = screen.getByRole('button', { name: '총자산 규모 (원)' });
    const indexTab = screen.getByRole('button', { name: '수익 지수 (Index)' });
    expect(assetTab).toHaveAttribute('aria-pressed', 'true');
    expect(indexTab).toHaveAttribute('aria-pressed', 'false');

    const summaryBar = screen.getByTestId('asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('현재 평가액');
    expect(summaryBar).toHaveTextContent('1,140,000 원');
    expect(summaryBar).toHaveTextContent('현재 낙폭 (DD)');
    expect(summaryBar).toHaveTextContent('-5.00%');
    expect(summaryBar).toHaveTextContent('역대 최대 낙폭 (MDD)');
    expect(summaryBar).toHaveTextContent('-20.00%');

    const hoverBar = screen.getByTestId('asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('차트에 마우스를 올리면 해당 시점의 상세 정보가 표시됩니다.');

    // 플로팅 툴팁은 null을 반환해야 함
    expect(screen.getByTestId('mock-tooltip-check')).toHaveAttribute('data-is-null', 'true');
  });

  it('데이터가 없을 때 안내 메시지를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={{ history: [], accounts: [] }} />
      </MaskingProvider>
    );
    expect(screen.getByText('표시할 자산 추이 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('계좌 필터 변경 시 상시 요약 바의 현재 평가액과 DD/MDD가 선택된 계좌 시계열 기준으로 재계산되어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'acc_1' } });

    expect(screen.getByText(/시간에 따른 자산 평가액 변화 \(테스트 계좌\)/)).toBeInTheDocument();
    const summaryBar = screen.getByTestId('asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('720,000 원');
    // acc_1: 600k -> 540k (-10.00%) -> 800k -> 720k (-10.00%)
    expect(summaryBar).toHaveTextContent('-10.00%');
    expect(summaryBar).not.toHaveTextContent('-20.00%');
  });

  it('총자산 규모 탭에서 차트 호버 시 하단 상세 바에 날짜, 평가액, 고점 대비 낙폭(DD)이 표시되고 마우스 이탈 시 복귀해야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    fireEvent.click(screen.getByTestId('mock-hover-point-1'));
    const hoverBar = screen.getByTestId('asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('2024.01.02');
    expect(hoverBar).toHaveTextContent('800,000 원');
    expect(hoverBar).toHaveTextContent('고점 대비 낙폭');
    expect(hoverBar).toHaveTextContent('-20.00%');

    fireEvent.click(screen.getByTestId('mock-hover-leave'));
    expect(hoverBar).toHaveTextContent('차트에 마우스를 올리면 해당 시점의 상세 정보가 표시됩니다.');
  });

  it('수익 지수 (Index) 탭 전환 시 상시 요약 바에 현재 지수·누적수익률·DD·MDD가 표시되고, 호버 시 직전 대비 등락률 없이 상세 정보가 표시되어야 한다', () => {
    const { container } = render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.getByText('기준일(1,000.00 pt) 대비 입출금을 제외한 순수 투자 성과 지수 추이')
    ).toBeInTheDocument();
    expect(container.querySelector('.recharts-reference-line')).toBeInTheDocument();

    const summaryBar = screen.getByTestId('asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('현재 수익 지수');
    expect(summaryBar).toHaveTextContent('1,140.00 pt');
    expect(summaryBar).toHaveTextContent('+14.00%');
    expect(summaryBar).toHaveTextContent('-5.00%');
    expect(summaryBar).toHaveTextContent('-20.00%');

    // 호버 시 하단 상세 바 확인 (직전 대비 등락률은 표시되지 않아야 함)
    fireEvent.click(screen.getByTestId('mock-hover-point-1'));
    const hoverBar = screen.getByTestId('asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('2024.01.02');
    expect(hoverBar).toHaveTextContent('내 자산 지수');
    expect(hoverBar).toHaveTextContent('800.00 pt');
    expect(hoverBar).toHaveTextContent('기준일(1,000pt) 대비');
    expect(hoverBar).toHaveTextContent('고점 대비 낙폭');
    expect(hoverBar).toHaveTextContent('-20.00%');
    expect(screen.queryByText(/직전 대비 등락률/)).not.toBeInTheDocument();
  });

  it('프라이버시 마스킹 활성화 시 총자산 금액만 *** 원으로 마스킹되고 DD/MDD(%) 및 수익 지수 탭은 마스킹 없이 노출되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    const summaryBar = screen.getByTestId('asset-chart-summary-bar');
    expect(summaryBar).toHaveTextContent('*** 원');
    expect(summaryBar).toHaveTextContent('-5.00%');
    expect(summaryBar).toHaveTextContent('-20.00%');

    fireEvent.click(screen.getByTestId('mock-hover-point-1'));
    const hoverBar = screen.getByTestId('asset-chart-hover-bar');
    expect(hoverBar).toHaveTextContent('*** 원');
    expect(hoverBar).toHaveTextContent('-20.00%');

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));
    expect(summaryBar).toHaveTextContent('1,140.00 pt');
    expect(summaryBar).toHaveTextContent('+14.00%');
    expect(summaryBar).not.toHaveTextContent('***');
  });
});
