import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssetAllocationSimulationPage from './AssetAllocationSimulationPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// API Fetch 모킹
global.fetch = vi.fn();

const mockApiResponse = {
  chart: {
    labels: ['2026-01-01', '2026-01-02'],
    datasets: [
      { label: '주식 100%', data: [20000000.0, 20100000.0] },
      { label: '주식 60% / 현금 40%', data: [20000000.0, 20060000.0] }
    ]
  },
  summaries: [
    { name: '주식 100%', stock_ratio: 100.0, cagr: 12.5, mdd: -15.2, final_return: 25.4, final_valuation: 25400000.0, total_invested: 20000000.0, total_interest: 5400000.0 },
    { name: '주식 60% / 현금 40%', stock_ratio: 60.0, cagr: 8.2, mdd: -9.1, final_return: 15.6, final_valuation: 23120000.0, total_invested: 20000000.0, total_interest: 3120000.0 }
  ],
  yearly_stats: {
    '주식 100%': [
      { year: 2026, year_return: 25.4, cumulative_return: 25.4, mdd: -15.2, valuation: 25400000.0, invested: 20000000.0, interest: 5400000.0, annual_interest: 5400000.0 }
    ],
    '주식 60% / 현금 40%': [
      { year: 2026, year_return: 15.6, cumulative_return: 15.6, mdd: -9.1, valuation: 23120000.0, invested: 20000000.0, interest: 3120000.0, annual_interest: 3120000.0 }
    ]
  },
  monthly_stats: {
    '주식 100%': [
      { year: 2026, month: 1, month_return: 25.4, cumulative_return: 25.4, mdd: -15.2, valuation: 25400000.0, invested: 20000000.0, interest: 5400000.0, annual_interest: 5400000.0 }
    ],
    '주식 60% / 현금 40%': [
      { year: 2026, month: 1, month_return: 15.6, cumulative_return: 15.6, mdd: -9.1, valuation: 23120000.0, invested: 20000000.0, interest: 3120000.0, annual_interest: 3120000.0 }
    ]
  }
};

describe('AssetAllocationSimulationPage - Unit Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기본 UI 레이아웃과 프리셋 버튼이 정상적으로 렌더링된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 제목 렌더링 확인
    await waitFor(() => {
      expect(screen.getByText('자산배분 시뮬레이션')).toBeDefined();
      expect(screen.getByText(/S&P500 지수와 현금을 활용한 과거 성과 백테스트/i)).toBeDefined();
    });

    // 탭 렌더링 확인
    expect(screen.getByText('적립식 시뮬레이션')).toBeDefined();
    expect(screen.getByText('거치식 백테스트')).toBeDefined();

    // 기간 프리셋 버튼들이 렌더링되는지 확인
    expect(screen.getByText('최근 5년')).toBeDefined();
    expect(screen.getByText('최근 10년')).toBeDefined();
    expect(screen.getByText('최근 20년')).toBeDefined();
    expect(screen.getByText('최근 30년')).toBeDefined();
    expect(screen.getByText('전체 기간')).toBeDefined();

    // 리밸런싱 주기 선택 라디오가 표시되는지 확인
    expect(screen.getByLabelText('매월')).toBeDefined();
    expect(screen.getByLabelText('매년')).toBeDefined();
    expect(screen.getByLabelText('안함')).toBeDefined();
  });

  it('새로운 비중 조합을 추가하고 계산을 수행한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 조합 이름 및 주식 비중 입력 폼 확인
    const nameInput = screen.getByPlaceholderText('예: 70/30 포트폴리오');
    const ratioInput = screen.getByPlaceholderText('주식 비중 (0-100)');
    const addButton = screen.getByRole('button', { name: /조합 추가/i });

    expect(nameInput).toBeDefined();
    expect(ratioInput).toBeDefined();
    expect(addButton).toBeDefined();

    // 새 비중 조합 정보 입력
    fireEvent.change(nameInput, { target: { value: '주식 50% / 현금 50%' } });
    fireEvent.change(ratioInput, { target: { value: '50' } });
    fireEvent.click(addButton);

    // 추가된 조합이 화면 리스트에 노출되는지 확인
    await waitFor(() => {
      expect(screen.getAllByText('주식 50% / 현금 50%').length).toBeGreaterThan(0);
    });
  });

  it('적립식 탭과 거치식 탭을 전환할 수 있으며, 추가금 입력 필드가 탭에 따라 노출/비노출된다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 1. 초기 탭은 적립식이므로 '매년 추가 적립금' 영역이 노출됨
    await waitFor(() => {
      expect(screen.getByText('매년 추가 적립금')).toBeDefined();
    });

    // 2. 거치식 백테스트 탭 클릭
    const lumpTab = screen.getByText('거치식 백테스트');
    fireEvent.click(lumpTab);

    // 3. 거치식 탭에서는 '매년 추가 적립금' 입력 필드가 비노출됨
    await waitFor(() => {
      expect(screen.queryByText('매년 추가 적립금')).toBeNull();
    });
  });

  it('동적 리밸런싱 (MDD/VIX) 탭으로 전환하고 3개 벤치마크 결과를 렌더링한다', async () => {
    const dynamicMockResponse = {
      chart: {
        labels: ['2026-01-01', '2026-01-02'],
        datasets: [
          { label: '동적 리밸런싱 전략', data: [20000000.0, 20200000.0] },
          { label: '일반 정기 리밸런싱', data: [20000000.0, 20060000.0] },
          { label: 'S&P 500 단순 보유', data: [20000000.0, 20100000.0] }
        ]
      },
      summaries: [
        { name: '동적 리밸런싱 전략', stock_ratio: 60.0, cagr: 14.2, mdd: -11.5, final_return: 28.5, final_valuation: 25700000.0, total_invested: 20000000.0, total_interest: 5700000.0 },
        { name: '일반 정기 리밸런싱', stock_ratio: 60.0, cagr: 8.2, mdd: -9.1, final_return: 15.6, final_valuation: 23120000.0, total_invested: 20000000.0, total_interest: 3120000.0 },
        { name: 'S&P 500 단순 보유', stock_ratio: 100.0, cagr: 12.5, mdd: -15.2, final_return: 25.4, final_valuation: 25400000.0, total_invested: 20000000.0, total_interest: 5400000.0 }
      ],
      yearly_stats: {},
      monthly_stats: {},
      rebalancing_events: [
        { date: '2025-01-03', event_type: 'PANIC_BUY', tier: 1, sp500_price: 5800.0, drawdown: -12.0, vix: 26.0, old_stock_ratio: 60.0, new_stock_ratio: 75.0 }
      ]
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => dynamicMockResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 1. '동적 리밸런싱 (MDD/VIX)' 탭 버튼 확인 및 클릭
    const dynamicTab = screen.getByText('동적 리밸런싱 (MDD/VIX)');
    expect(dynamicTab).toBeDefined();
    fireEvent.click(dynamicTab);

    // 2. 동적 리밸런싱 설정 컨트롤 렌더링 확인 (기본 비중 등)
    await waitFor(() => {
      expect(screen.getByText(/기본 주식 비중/i)).toBeDefined();
    });

    // 3. 3개 벤치마크 요약 카드 렌더링 확인
    await waitFor(() => {
      expect(screen.getAllByText('동적 리밸런싱 전략').length).toBeGreaterThan(0);
      expect(screen.getAllByText('일반 정기 리밸런싱').length).toBeGreaterThan(0);
      expect(screen.getAllByText('S&P 500 단순 보유').length).toBeGreaterThan(0);
    });
  });

  it('동적 리밸런싱 탭에서 상세 영역 탭([이벤트 로그], [연도별 현황], [월별 현황]) 전환 및 이벤트 로그 테이블이 올바르게 렌더링된다', async () => {
    const dynamicMockResponse = {
      chart: {
        labels: ['2025-01-02', '2025-01-03', '2025-01-31'],
        datasets: [
          { label: '동적 리밸런싱 전략', data: [100.0, 102.0, 105.0] },
          { label: '일반 정기 리밸런싱', data: [100.0, 101.0, 103.0] },
          { label: 'S&P 500 단순 보유', data: [100.0, 99.0, 104.0] }
        ]
      },
      summaries: [
        { name: '동적 리밸런싱 전략', stock_ratio: 60.0, cagr: 15.0, mdd: -10.0, final_return: 20.0, final_valuation: 120.0, total_invested: 100.0, total_interest: 20.0 },
        { name: '일반 정기 리밸런싱', stock_ratio: 60.0, cagr: 10.0, mdd: -12.0, final_return: 15.0, final_valuation: 115.0, total_invested: 100.0, total_interest: 15.0 },
        { name: 'S&P 500 단순 보유', stock_ratio: 100.0, cagr: 12.0, mdd: -18.0, final_return: 18.0, final_valuation: 118.0, total_invested: 100.0, total_interest: 18.0 }
      ],
      yearly_stats: {
        '동적 리밸런싱 전략': [{ year: 2025, year_return: 20.0, cumulative_return: 20.0, mdd: -10.0, valuation: 120.0, invested: 100.0, interest: 20.0, annual_interest: 20.0 }],
        '일반 정기 리밸런싱': [{ year: 2025, year_return: 15.0, cumulative_return: 15.0, mdd: -12.0, valuation: 115.0, invested: 100.0, interest: 15.0, annual_interest: 15.0 }],
        'S&P 500 단순 보유': [{ year: 2025, year_return: 18.0, cumulative_return: 18.0, mdd: -18.0, valuation: 118.0, invested: 100.0, interest: 18.0, annual_interest: 18.0 }]
      },
      monthly_stats: {
        '동적 리밸런싱 전략': [{ year: 2025, month: 1, month_return: 5.0, cumulative_return: 5.0, mdd: -5.0, valuation: 105.0, invested: 100.0, interest: 5.0, annual_interest: 5.0 }],
        '일반 정기 리밸런싱': [{ year: 2025, month: 1, month_return: 3.0, cumulative_return: 3.0, mdd: -6.0, valuation: 103.0, invested: 100.0, interest: 3.0, annual_interest: 3.0 }],
        'S&P 500 단순 보유': [{ year: 2025, month: 1, month_return: 4.0, cumulative_return: 4.0, mdd: -8.0, valuation: 104.0, invested: 100.0, interest: 4.0, annual_interest: 4.0 }]
      },
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
          new_stock_ratio: 75.0
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
          new_stock_ratio: 60.0
        }
      ]
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => dynamicMockResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 1. '동적 리밸런싱 (MDD/VIX)' 탭 클릭
    const dynamicTab = screen.getByText('동적 리밸런싱 (MDD/VIX)');
    fireEvent.click(dynamicTab);

    // 2. 탭형 상세 컨테이너 버튼 렌더링 확인 ([이벤트 로그], [연도별 현황], [월별 현황])
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이벤트 로그' })).toBeDefined();
      expect(screen.getByRole('button', { name: '연도별 현황' })).toBeDefined();
      expect(screen.getByRole('button', { name: '월별 현황' })).toBeDefined();
    });

    // 3. [이벤트 로그] 테이블 항목 확인 (날짜, 이벤트명 배지, 가격, 낙폭, VIX, 비중)
    expect(screen.getByText('2025-01-03')).toBeDefined();
    expect(screen.getByText('공포 단계 발동 (티어 1)')).toBeDefined();
    expect(screen.getByText('-12.5%')).toBeDefined();
    expect(screen.getByText('26.5')).toBeDefined();
    expect(screen.getByText('56.9%')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();

    expect(screen.getByText('2025-01-31')).toBeDefined();
    expect(screen.getByText('정기 복귀')).toBeDefined();
    expect(screen.getByText('78%')).toBeDefined();
    expect(screen.getByText('60%')).toBeDefined();

    // 4. [연도별 현황] 탭 클릭 시 3개 벤치마크 연도별 통계 테이블 노출 확인
    const yearlyTabBtn = screen.getByRole('button', { name: '연도별 현황' });
    fireEvent.click(yearlyTabBtn);
    await waitFor(() => {
      expect(screen.getByText('2025년')).toBeDefined();
    });

    // 5. [월별 현황] 탭 클릭 시 3개 벤치마크 월별 통계 테이블 노출 확인
    const monthlyTabBtn = screen.getByRole('button', { name: '월별 현황' });
    fireEvent.click(monthlyTabBtn);
    await waitFor(() => {
      expect(screen.getByText('2025년 1월')).toBeDefined();
    });
  });
});

