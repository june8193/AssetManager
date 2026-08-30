import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileCategoryBreakdownCard from './MobileCategoryBreakdownCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileCategoryBreakdownCard', () => {
  const mockCategories = [
    {
      category: '국내주식',
      value_krw: 50000000,
      sub_categories: [
        { category: '대형주', value_krw: 35000000 },
        { category: '중소형주', value_krw: 15000000 },
      ],
    },
    {
      category: '해외주식',
      value_krw: 40000000,
      sub_categories: [
        { category: '미국 빅테크', value_krw: 40000000 },
      ],
    },
    {
      category: '현금',
      value_krw: 10000000,
      sub_categories: [],
    },
  ];

  const totalValuation = 100000000;

  it('카테고리 목록과 비중, 평가액이 올바르게 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileCategoryBreakdownCard
          categories={mockCategories}
          totalValuation={totalValuation}
        />
      </MaskingProvider>
    );

    // 주요 카테고리 표시 확인
    expect(screen.getByText('국내주식')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('50,000,000 원')).toBeInTheDocument();

    expect(screen.getByText('해외주식')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();

    expect(screen.getByText('현금')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
  });

  it('카테고리 항목 클릭 시 하위 카테고리(중분류)가 아코디언 형태로 토글되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileCategoryBreakdownCard
          categories={mockCategories}
          totalValuation={totalValuation}
        />
      </MaskingProvider>
    );

    // 초기 상태에서는 하위 카테고리가 렌더링되지 않음
    expect(screen.queryByText('대형주')).not.toBeInTheDocument();

    // 국내주식 카테고리 클릭
    fireEvent.click(screen.getByText('국내주식'));

    // 하위 카테고리 노출 확인
    expect(screen.getByText('대형주')).toBeInTheDocument();
    expect(screen.getByText('중소형주')).toBeInTheDocument();

    // 다시 클릭 시 접힘 확인
    fireEvent.click(screen.getByText('국내주식'));
    expect(screen.queryByText('대형주')).not.toBeInTheDocument();
  });

  it('마스킹 활성화 시 금액이 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <MobileCategoryBreakdownCard
          categories={mockCategories}
          totalValuation={totalValuation}
        />
      </MaskingProvider>
    );

    expect(screen.getAllByText('*** 원').length).toBe(3);

    localStorage.removeItem('isMasked');
  });
});
