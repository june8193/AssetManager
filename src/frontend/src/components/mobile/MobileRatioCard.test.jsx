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

    // 종목명 노출 확인 및 괄호 티커 미노출 확인
    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.queryByText('(005930)')).not.toBeInTheDocument();

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

  it('주식 레벨 종목명 단독 표기 규칙이 올바르게 적용되어야 한다', () => {
    // 1. 종목명과 티커가 모두 있는 경우 (백엔드 구조: category_name='AAPL', name='애플', ticker='AAPL'): 종목명('애플')만 단독 표시
    const { unmount } = render(
      <MaskingProvider>
        <MobileRatioCard
          item={{ name: '애플', category_name: 'AAPL', ticker: 'AAPL', current_value: 10000000, target_percentage: 10 }}
          totalValuation={100000000}
        />
      </MaskingProvider>
    );
    expect(screen.getByText('애플')).toBeInTheDocument();
    expect(screen.queryByText('(AAPL)')).not.toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    unmount();

    // 2. 종목명이 없고 티커만 있는 경우: 티커('TSLA') 단독 표시
    render(
      <MaskingProvider>
        <MobileRatioCard
          item={{ name: '', category_name: 'TSLA', ticker: 'TSLA', current_value: 10000000, target_percentage: 10 }}
          totalValuation={100000000}
        />
      </MaskingProvider>
    );
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.queryByText('(TSLA)')).not.toBeInTheDocument();
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

  describe('상태 배지 판별 기준 단일화 및 상호 배타성 검증', () => {
    it('계층형 엣지 케이스: 내부 비중은 초과(+%p)이나 전체 기준 리밸런싱 금액은 부족(+원)할 때 "매수 필요"만 표시되고 "매도 필요"는 절대 없어야 한다', () => {
      // 상위 카테고리 대비 비중 편차는 +2.0%p로 초과 상태이나, 전체 포트폴리오 기준으로는 3,000,000원 부족하여 매수 필요
      const conflictingItem = {
        category_name: '미국 장기채',
        current_value: 12000000,
        target_percentage: 10.0,
        current_ratio: 12.0,
        diff_ratio: 2.0, // 비중 편차 기준 초과 (> 0.5)
        diff_amt: 3000000, // 리밸런싱 필요 금액 기준 부족 (+3,000,000원 > 1000) -> 매수 필요
      };

      render(
        <MaskingProvider>
          <MobileRatioCard item={conflictingItem} totalValuation={100000000} />
        </MaskingProvider>
      );

      // 상단 배지 및 하단 리밸런싱 안내에 '매수 필요' 노출 확인
      const buyTexts = screen.getAllByText('매수 필요');
      expect(buyTexts.length).toBe(2);

      // 화면 전체에서 '매도 필요' 텍스트는 절대 존재하지 않아야 함 (Negative Assertion)
      expect(screen.queryByText('매도 필요')).not.toBeInTheDocument();
      expect(screen.queryByText('적정')).not.toBeInTheDocument();
    });

    it('계층형 엣지 케이스: 내부 비중은 부족(-%p)이나 전체 기준 리밸런싱 금액은 초과(-원)할 때 "매도 필요"만 표시되고 "매수 필요"는 절대 없어야 한다', () => {
      // 상위 카테고리 대비 비중 편차는 -2.0%p로 부족 상태이나, 전체 포트폴리오 기준으로는 3,000,000원 초과하여 매도 필요
      const conflictingItem = {
        category_name: '단기채',
        current_value: 8000000,
        target_percentage: 10.0,
        current_ratio: 8.0,
        diff_ratio: -2.0, // 비중 편차 기준 부족 (< -0.5)
        diff_amt: -3000000, // 리밸런싱 필요 금액 기준 초과 (-3,000,000원 < -1000) -> 매도 필요
      };

      render(
        <MaskingProvider>
          <MobileRatioCard item={conflictingItem} totalValuation={100000000} />
        </MaskingProvider>
      );

      // 상단 배지 및 하단 리밸런싱 안내에 '매도 필요' 노출 확인
      const sellTexts = screen.getAllByText('매도 필요');
      expect(sellTexts.length).toBe(2);

      // 화면 전체에서 '매수 필요' 텍스트는 절대 존재하지 않아야 함 (Negative Assertion)
      expect(screen.queryByText('매수 필요')).not.toBeInTheDocument();
      expect(screen.queryByText('적정')).not.toBeInTheDocument();
    });

    it('리밸런싱 필요 금액이 절댓값 1,000원 이내인 경우 "적정" 배지가 노출되어야 한다', () => {
      // +500원 차이
      const { unmount } = render(
        <MaskingProvider>
          <MobileRatioCard
            item={{
              category_name: '채권A',
              current_value: 10000000,
              target_percentage: 10.0,
              diff_ratio: 0.8, // 비중 편차는 0.5보다 크더라도
              diff_amt: 500, // 리밸런싱 금액이 500원 이내이므로 적정
            }}
            totalValuation={100000000}
          />
        </MaskingProvider>
      );

      expect(screen.getByText('적정')).toBeInTheDocument();
      expect(screen.queryByText('매수 필요')).not.toBeInTheDocument();
      expect(screen.queryByText('매도 필요')).not.toBeInTheDocument();
      unmount();

      // -500원 차이
      render(
        <MaskingProvider>
          <MobileRatioCard
            item={{
              category_name: '채권B',
              current_value: 10000000,
              target_percentage: 10.0,
              diff_ratio: -0.8, // 비중 편차는 -0.5보다 작더라도
              diff_amt: -500, // 리밸런싱 금액이 -500원 이내이므로 적정
            }}
            totalValuation={100000000}
          />
        </MaskingProvider>
      );

      expect(screen.getByText('적정')).toBeInTheDocument();
      expect(screen.queryByText('매수 필요')).not.toBeInTheDocument();
      expect(screen.queryByText('매도 필요')).not.toBeInTheDocument();
    });

    it('진행률 게이지 바(Progress Bar) 색상이 단일화된 상태(초과/부족/적정/미설정)와 일치해야 한다', () => {
      // 1. 매수 필요: bg-sky-400 (diff_amt > 1000)
      const { container: underContainer, unmount: unmountUnder } = render(
        <MaskingProvider>
          <MobileRatioCard item={mockUnderItem} totalValuation={100000000} />
        </MaskingProvider>
      );
      const underBar = underContainer.querySelector('.overflow-hidden > div');
      expect(underBar).toHaveClass('bg-sky-400');
      unmountUnder();

      // 2. 매도 필요: bg-amber-400 (diff_amt < -1000)
      const { container: overContainer, unmount: unmountOver } = render(
        <MaskingProvider>
          <MobileRatioCard item={mockMajorItem} totalValuation={100000000} />
        </MaskingProvider>
      );
      const overBar = overContainer.querySelector('.overflow-hidden > div');
      expect(overBar).toHaveClass('bg-amber-400');
      unmountOver();

      // 3. 적정: bg-emerald-400 (|diff_amt| <= 1000)
      const { container: balancedContainer, unmount: unmountBalanced } = render(
        <MaskingProvider>
          <MobileRatioCard item={mockBalancedItem} totalValuation={100000000} />
        </MaskingProvider>
      );
      const balancedBar = balancedContainer.querySelector('.overflow-hidden > div');
      expect(balancedBar).toHaveClass('bg-emerald-400');
      unmountBalanced();

      // 4. 목표 미설정: bg-slate-600 (!hasTarget)
      const { container: untargetedContainer } = render(
        <MaskingProvider>
          <MobileRatioCard item={mockUntargetedItem} totalValuation={100000000} />
        </MaskingProvider>
      );
      const untargetedBar = untargetedContainer.querySelector('.overflow-hidden > div');
      expect(untargetedBar).toHaveClass('bg-slate-600');
    });
  });
});

