import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MobileDashboardPage from './MobileDashboardPage';
import { MaskingProvider } from '../../contexts/MaskingContext';
import * as useDashboardModule from '../../hooks/useDashboard';

describe('MobileDashboardPage', () => {
  const mockDashboardData = {
    total_valuation_krw: 125000000,
    total_contribution: 90000000,
    initial_base_asset: 10000000,
    total_profit: 25000000,
    cumulative_roi: 25.0,
    contribution_ratio: 80.0,
    profit_ratio: 20.0,
    exchange_rate: {
      rate: 1350.5,
      date: '2026-08-30',
      created_at: '2026-08-30T09:00:00Z',
    },
    categories: [
      {
        category: '국내주식',
        value_krw: 62500000,
        sub_categories: [],
      },
      {
        category: '해외주식',
        value_krw: 62500000,
        sub_categories: [],
      },
    ],
    yearly: [
      {
        year: '2026',
        contribution: 5000000,
        profit: 12000000,
        roi: 15.5,
        assets: 125000000,
        increase: 17000000,
      },
    ],
  };

  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로딩 중일 때 로딩 인디케이터/스켈레톤이 표시되어야 한다', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });

    render(
      <MaskingProvider>
        <MobileDashboardPage />
      </MaskingProvider>
    );

    expect(screen.getByText(/자산 데이터를 불러오는 중/i)).toBeInTheDocument();
  });

  it('에러 발생 시 에러 메시지와 다시 시도 버튼이 표시되고 재시도가 가능해야 한다', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: null,
      loading: false,
      error: '네트워크 연결에 실패했습니다.',
      refresh: mockRefresh,
    });

    render(
      <MaskingProvider>
        <MobileDashboardPage />
      </MaskingProvider>
    );

    expect(screen.getByText('네트워크 연결에 실패했습니다.')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('데이터 로드 완료 시 대시보드 3대 카드(총 자산, 비중, 성과)가 렌더링되어야 한다', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    render(
      <MaskingProvider>
        <MobileDashboardPage />
      </MaskingProvider>
    );

    // 총 자산 카드 확인
    expect(screen.getByText('125,000,000')).toBeInTheDocument();
    expect(screen.getByText(/총 평가 자산/i)).toBeInTheDocument();

    // 카테고리별 비중 카드 확인
    expect(screen.getByText('국내주식')).toBeInTheDocument();
    expect(screen.getByText('해외주식')).toBeInTheDocument();

    // 성과 요약 카드 확인
    expect(screen.getByText('성과 요약')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('실시간 시세 새로고침 버튼을 클릭하면 refresh(true)가 호출되어야 한다', async () => {
    mockRefresh.mockResolvedValueOnce({
      status: 'success',
      message: '시세가 최신화되었습니다.',
    });

    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    render(
      <MaskingProvider>
        <MobileDashboardPage />
      </MaskingProvider>
    );

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    fireEvent.click(refreshBtn);

    expect(mockRefresh).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(screen.getByText('시세가 최신화되었습니다.')).toBeInTheDocument();
    });
  });
});
