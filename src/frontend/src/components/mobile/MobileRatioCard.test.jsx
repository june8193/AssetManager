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

const mockUnderItem = {
  category_name: '채권',
  current_value: 20000000,
  target_percentage: 30.0,
  target_amt: 30000000,
  diff_amt: 10000000, // 1000만원 부족 (매수 필요)
  current_ratio: 20.0,
  diff_ratio: -10.0,
};

const mockBalancedItem = {
  category_name: '현금',
  current_value: 30000000,
  target_percentage: 30.0,
  target_amt: 30000000,
  diff_amt: 0,
  current_ratio: 30.0,
  diff_ratio: 0.0,
};

const mockUntargetedItem = {
  name: '삼성전자',
  ticker: '005930',
  current_value: 5000000,
  target_percentage: 0,
  diff_amt: -5000000, // 계산상 0% 대비 500만원 초과로 들어왔더라도 미설정 자산이어야 함
  current_ratio: 5.0,
  diff_ratio: 5.0,
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

  it('목표 초과 자산에 대해 "매도 필요" 배지와 편차, "매도 필요 -X원" 텍스트를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    // 편차 표시 (+10.0%p) 및 상단 배지와 하단 리밸런싱 텍스트 ("매도 필요") 2곳 노출 확인
    expect(screen.getByText('+10.0%p')).toBeInTheDocument();
    const sellBadges = screen.getAllByText('매도 필요');
    expect(sellBadges.length).toBe(2);
    // 하단 리밸런싱 필요 금액 텍스트
    expect(screen.getByText(/10,000,000/)).toBeInTheDocument();
  });

  it('목표 미달 자산에 대해 "매수 필요" 배지와 편차, "매수 필요 +X원" 텍스트를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockUnderItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    // 편차 표시 (-10.0%p) 및 상단 배지와 하단 리밸런싱 텍스트 ("매수 필요") 2곳 노출 확인
    expect(screen.getByText('-10.0%p')).toBeInTheDocument();
    const buyBadges = screen.getAllByText('매수 필요');
    expect(buyBadges.length).toBe(2);
    // 하단 리밸런싱 필요 금액 텍스트
    expect(screen.getByText(/10,000,000/)).toBeInTheDocument();
  });

  it('목표와 일치하는 자산에 대해 "적정" 배지를 표시해야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockBalancedItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    expect(screen.getByText('적정')).toBeInTheDocument();
    expect(screen.getByText('0.0%p')).toBeInTheDocument();
  });

  it('목표 비중이 0%이거나 미설정된 자산은 상태 배지, 편차, 리밸런싱 필요 금액이 숨겨지고 목표 비중은 "-"로 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileRatioCard item={mockUntargetedItem} totalValuation={100000000} />
      </MaskingProvider>
    );

    // 종목명 노출 확인
    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.getByText('(005930)')).toBeInTheDocument();

    // 상태 배지('매도 필요', '매수 필요', '적정', '초과')가 없어야 함
    expect(screen.queryByText('매도 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('매수 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('적정')).not.toBeInTheDocument();
    expect(screen.queryByText('초과')).not.toBeInTheDocument();

    // 편차(%p)가 없어야 함
    expect(screen.queryByText(/%p/)).not.toBeInTheDocument();

    // 리밸런싱 조정 금액 영역이 없어야 함
    expect(screen.queryByText('매도 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('매수 필요')).not.toBeInTheDocument();

    // 목표 비중 영역에 '-' 표시
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('주식 레벨 종목명과 티커 표기 규칙이 올바르게 적용되어야 한다', () => {
    // 1. 종목명과 티커가 다른 경우: 애플 (AAPL)
    const { unmount } = render(
      <MaskingProvider>
        <MobileRatioCard
          item={{ name: '애플', ticker: 'AAPL', current_value: 10000000, target_percentage: 10 }}
          totalValuation={100000000}
        />
      </MaskingProvider>
    );
    expect(screen.getByText('애플')).toBeInTheDocument();
    expect(screen.getByText('(AAPL)')).toBeInTheDocument();
    unmount();

    // 2. 종목명과 티커가 동일한 경우: AAPL 단일 표시
    render(
      <MaskingProvider>
        <MobileRatioCard
          item={{ name: 'AAPL', ticker: 'AAPL', current_value: 10000000, target_percentage: 10 }}
          totalValuation={100000000}
        />
      </MaskingProvider>
    );
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('(AAPL)')).not.toBeInTheDocument();
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

