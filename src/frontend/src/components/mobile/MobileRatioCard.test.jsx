import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileRatioCard from './MobileRatioCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

const mockMajorItem = {
  category_name: '주식',
  current_value: 50000000,
  target_percentage: 40.0,
  target_amt: 40000000,
  diff_amt: -10000000, // 1000만원 초과 (매도 필요)
  current_ratio: 50.0,
  diff_ratio: 10.0,
  children: [
    {
      category_name: '미국주식',
      current_value: 30000000,
      target_percentage: 60.0,
      target_amt: 24000000,
      diff_amt: -6000000,
      current_ratio: 60.0,
      diff_ratio: 0.0,
      children: [
        {
          name: '애플',
          ticker: 'AAPL',
          valuation_krw: 15000000,
          target_percentage: 50.0,
          target_amt: 12000000,
          diff_amt: -3000000,
          current_ratio: 50.0,
          diff_ratio: 0.0,
        },
      ],
    },
  ],
};

describe('MobileRatioCard Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('자산군 이름, 현재 비중, 목표 비중, 현재 평가액을 올바르게 렌더링해야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    expect(screen.getByText('주식')).toBeInTheDocument();
    expect(screen.getByText(/50\.0%/)).toBeInTheDocument(); // 현재 비중
    expect(screen.getByText(/40\.0%/)).toBeInTheDocument(); // 목표 비중
    expect(screen.getByText(/50,000,000/)).toBeInTheDocument(); // 현재 평가액
  });

  it('비중 편차와 리밸런싱 필요 금액 및 상태 배지(초과/부족)를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    // 편차 표시 (+10.0%p) 및 초과 배지
    expect(screen.getByText('+10.0%p')).toBeInTheDocument();
    expect(screen.getByText('초과')).toBeInTheDocument();
    // 리밸런싱 필요 금액 표시
    expect(screen.getByText(/10,000,000/)).toBeInTheDocument();
  });

  it('하위 카테고리가 있는 경우 클릭 시 아코디언이 펼쳐져 하위 항목이 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    // 처음에는 하위 '미국주식'이 보이지 않는 상태
    expect(screen.queryByText('미국주식')).not.toBeInTheDocument();

    // 카드 또는 아코디언 토글 버튼 클릭
    const toggleButton = screen.getByRole('button', { name: /주식/i });
    fireEvent.click(toggleButton);

    // 하위 '미국주식' 노출 확인
    expect(screen.getByText('미국주식')).toBeInTheDocument();
  });

  it('마스킹 활성화 시 평가액 및 리밸런싱 금액이 마스킹(***) 처리되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    expect(screen.queryByText('50,000,000')).not.toBeInTheDocument();
    expect(screen.getAllByText('***').length).toBeGreaterThanOrEqual(1);
  });

  it('읽기 전용 컴포넌트로서 입력 인풋(input)이나 저장 버튼이 없어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /저장|수정/i })).not.toBeInTheDocument();
  });
});
