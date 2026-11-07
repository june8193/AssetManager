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
    Tooltip: (props) => {
      const originalEl = original.Tooltip ? original.Tooltip(props) : null;
      return (
        <>
          {originalEl}
          {typeof props.content === 'function' ? (
            <div data-testid="mock-mobile-custom-tooltip">
              {props.content({
                active: true,
                label: new Date('2024-01-02').getTime(),
                payload: [
                  {
                    value: 1284.5,
                    payload: {
                      date: '2024-01-02',
                      total: 1284500,
                      acc_1: 1284500,
                      index: 1284.5,
                      index_change_pct: 28.45,
                      index_cum_return_pct: 28.45,
                    },
                  },
                ],
              })}
            </div>
          ) : props.formatter ? (
            <div data-testid="mock-mobile-formatter-tooltip">
              {props.formatter(1284500)[0]}
            </div>
          ) : null}
        </>
      );
    },
  };
});

const mockSnapshots = {
  history: [
    {
      date: '2024-01-01',
      total: 1000000,
      acc_1: 1000000,
      index: 1000.0,
      index_change_pct: 0.0,
      index_cum_return_pct: 0.0,
    },
    {
      date: '2024-01-02',
      total: 1284500,
      acc_1: 1284500,
      index: 1284.5,
      index_change_pct: 28.45,
      index_cum_return_pct: 28.45,
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

  it('다크 테마 카드와 세그먼트 탭 컨트롤이 렌더링되며 기본 활성 탭은 총자산 규모 (원)이고 계좌 필터가 표시되어야 한다', () => {
    const { container } = renderMobileTrendCard();

    const card = container.firstChild;
    expect(card).toHaveClass('bg-slate-900', 'border-slate-800', 'rounded-3xl');
    expect(screen.getByText('자산 추이')).toBeInTheDocument();

    const assetTab = screen.getByRole('button', { name: '총자산 규모 (원)' });
    const indexTab = screen.getByRole('button', { name: '수익 지수 (Index)' });
    expect(assetTab).toHaveAttribute('aria-pressed', 'true');
    expect(indexTab).toHaveAttribute('aria-pressed', 'false');

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('총 자산 합계')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'acc_1' } });
    expect(select.value).toBe('acc_1');
  });

  it('데이터가 없을 때 다크 테마 카드 내에 안내 메시지를 표시해야 한다', () => {
    renderMobileTrendCard({ history: [], accounts: [] });
    expect(screen.getByText('표시할 자산 추이 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('수익 지수 (Index) 탭으로 전환하면 계좌 선택 드롭다운이 숨겨지고 헤더 우측에 최신 수익 지수(pt) 및 누적 등락률(%)이 표시되어야 한다', () => {
    renderMobileTrendCard();

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('1,284.50 pt (+28.45%)')).toBeInTheDocument();
  });

  it('수익 지수 (Index) 탭에서 1,000 pt 기준 점선과 3종 지표 툴팁이 렌더링되어야 한다', () => {
    const { container } = renderMobileTrendCard();

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    expect(container.querySelector('.recharts-reference-line')).toBeInTheDocument();
    expect(screen.getByText('내 자산 지수')).toBeInTheDocument();
    expect(screen.getByText('1,284.50 pt')).toBeInTheDocument();
    expect(screen.getByText('직전 대비 등락률')).toBeInTheDocument();
    expect(screen.getByText('기준일(1,000pt) 대비')).toBeInTheDocument();
    expect(screen.getAllByText('+28.45%').length).toBeGreaterThanOrEqual(2);
  });

  it('프라이버시 마스킹 활성화 시 총자산 규모 탭 금액은 ***로 마스킹되지만 수익 지수 탭의 Y축, 헤더 배지, 툴팁 지수(pt)와 등락률(%)은 마스킹되지 않아야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    const { container } = renderMobileTrendCard();

    expect(screen.getByTestId('mock-mobile-formatter-tooltip')).toHaveTextContent('*** 원');
    expect(container.textContent).toContain('***');

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    expect(screen.getByText('1,284.50 pt (+28.45%)')).toBeInTheDocument();
    expect(screen.getByText('1,284.50 pt')).toBeInTheDocument();
    expect(screen.getAllByText('+28.45%').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain('***');
    expect(screen.queryByText('*** 원')).not.toBeInTheDocument();
  });
});
