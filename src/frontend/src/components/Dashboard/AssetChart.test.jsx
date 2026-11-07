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
    Tooltip: (props) => {
      const originalEl = original.Tooltip ? original.Tooltip(props) : null;
      return (
        <>
          {originalEl}
          {typeof props.content === 'function' ? (
            <div data-testid="mock-custom-tooltip">
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
            <div data-testid="mock-formatter-tooltip">
              {props.formatter(1284500)[0]}
            </div>
          ) : null}
        </>
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
    accounts: [
      { id: 1, name: '테스트 계좌' }
    ]
  };

  it('차트 제목과 필터, 탭 전환 버튼이 렌더링되며 기본 활성 탭은 총자산 규모 (원)이어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );
    expect(screen.getByText('자산 추이')).toBeInTheDocument();
    expect(screen.getByText('총 자산 합계')).toBeInTheDocument();

    const assetTab = screen.getByRole('button', { name: '총자산 규모 (원)' });
    const indexTab = screen.getByRole('button', { name: '수익 지수 (Index)' });
    expect(assetTab).toBeInTheDocument();
    expect(indexTab).toBeInTheDocument();
    expect(assetTab).toHaveAttribute('aria-pressed', 'true');
    expect(indexTab).toHaveAttribute('aria-pressed', 'false');
  });

  it('데이터가 없을 때 안내 메시지를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={{ history: [], accounts: [] }} />
      </MaskingProvider>
    );
    expect(screen.getByText('표시할 자산 추이 데이터가 없습니다.')).toBeInTheDocument();
  });

  it('필터를 변경하면 텍스트가 업데이트되어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );
    const select = screen.getByRole('combobox');
    
    fireEvent.change(select, { target: { value: 'acc_1' } });
    
    expect(screen.getByText(/시간에 따른 자산 평가액 변화 \(테스트 계좌\)/)).toBeInTheDocument();
  });

  it('수익 지수 (Index) 탭 클릭 시 계좌 선택 드롭다운이 숨겨지고 최신 지수 배지와 서브타이틀이 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();

    const indexTab = screen.getByRole('button', { name: '수익 지수 (Index)' });
    fireEvent.click(indexTab);

    expect(indexTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('1,284.50 pt (+28.45%)')).toBeInTheDocument();
    expect(
      screen.getByText('기준일(1,000.00 pt) 대비 입출금을 제외한 순수 투자 성과 지수 추이')
    ).toBeInTheDocument();
  });

  it('수익 지수 (Index) 탭에서 1,000 pt 기준선(ReferenceLine)과 3종 지표 상세 툴팁이 표시되어야 한다', () => {
    const { container } = render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    // 1,000 pt 기준선(ReferenceLine) 렌더링 확인
    const refLine = container.querySelector('.recharts-reference-line');
    expect(refLine).toBeInTheDocument();

    // 3종 지표 툴팁 확인
    expect(screen.getByText('내 자산 지수')).toBeInTheDocument();
    expect(screen.getByText('1,284.50 pt')).toBeInTheDocument();
    expect(screen.getByText('직전 대비 등락률')).toBeInTheDocument();
    expect(screen.getByText('기준일(1,000pt) 대비')).toBeInTheDocument();
    expect(screen.getAllByText('+28.45%').length).toBeGreaterThanOrEqual(2);
  });

  it('프라이버시 마스킹 활성화 시 총자산 규모 탭의 금액은 ***로 마스킹되지만 수익 지수 탭의 지수(pt)와 등락률(%)은 마스킹되지 않고 노출되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    const { container } = render(
      <MaskingProvider>
        <AssetChart data={mockData} />
      </MaskingProvider>
    );

    // 1. 기본 활성 탭(총자산 규모 (원)): 툴팁 및 Y축 금액이 ***로 마스킹됨
    expect(screen.getByTestId('mock-formatter-tooltip')).toHaveTextContent('*** 원');
    expect(container.textContent).toContain('***');

    // 2. 수익 지수 (Index) 탭으로 전환: Y축, 헤더 배지, 툴팁 모두 마스킹 없이 노출됨
    fireEvent.click(screen.getByRole('button', { name: '수익 지수 (Index)' }));

    expect(screen.getByText('1,284.50 pt (+28.45%)')).toBeInTheDocument();
    expect(screen.getByText('1,284.50 pt')).toBeInTheDocument();
    expect(screen.getAllByText('+28.45%').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain('***');
    expect(screen.queryByText('*** 원')).not.toBeInTheDocument();
  });
});
