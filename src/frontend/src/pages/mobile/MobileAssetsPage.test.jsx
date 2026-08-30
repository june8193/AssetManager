import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MobileAssetsPage from './MobileAssetsPage';
import { MaskingProvider } from '../../contexts/MaskingContext';
import * as useDashboardModule from '../../hooks/useDashboard';
import { dbService } from '../../services';

describe('MobileAssetsPage', () => {
  const mockDashboardData = {
    total_valuation_krw: 100000000,
    accounts: [
      {
        id: 1,
        name: '5526-9093',
        provider: 'KB증권',
        alias: '국내주식',
        total_valuation_krw: 60000000,
        assets: [
          {
            id: 101,
            ticker: '005930',
            name: '삼성전자',
            category: '국내주식',
            country: 'KR',
            quantity: 500,
            price: 70000,
            valuation_krw: 35000000,
          },
          {
            id: 102,
            ticker: 'KRW',
            name: '원화예수금',
            category: 'CASH',
            country: 'KR',
            quantity: 25000000,
            price: 1,
            valuation_krw: 25000000,
          },
        ],
      },
      {
        id: 2,
        name: '9876-5432',
        provider: '토스증권',
        alias: '해외주식',
        total_valuation_krw: 40000000,
        assets: [
          {
            id: 103,
            ticker: 'AAPL',
            name: 'Apple Inc.',
            category: '해외주식',
            country: 'US',
            quantity: 100,
            price: 220,
            valuation_krw: 40000000,
          },
        ],
      },
    ],
  };

  const mockTransactions = [
    {
      id: 1,
      account_id: 1,
      asset_id: 101,
      transaction_date: '2026-08-25',
      type: 'BUY',
      quantity: 10,
      price: 70000,
      total_amount: 700000,
      currency: 'KRW',
      memo: '삼성전자 추가매수',
    },
  ];

  const mockAssets = [
    { id: 101, ticker: '005930', name: '삼성전자', category: '국내주식' },
    { id: 102, ticker: 'KRW', name: '원화예수금', category: 'CASH' },
    { id: 103, ticker: 'AAPL', name: 'Apple Inc.', category: '해외주식' },
  ];

  const mockRefresh = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(dbService, 'getTransactions').mockResolvedValue(mockTransactions);
    vi.spyOn(dbService, 'getAssets').mockResolvedValue(mockAssets);
  });

  it('로딩 중일 때 로딩 인디케이터/스켈레톤이 표시되어야 한다', async () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    expect(screen.getByText(/자산 데이터를 불러오는 중/i)).toBeInTheDocument();
  });

  it('에러 발생 시 에러 메시지와 다시 시도 버튼이 표시되어야 한다', async () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: null,
      loading: false,
      error: '자산 정보 로드 실패',
      refresh: mockRefresh,
    });

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    expect(screen.getByText('자산 정보 로드 실패')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    fireEvent.click(retryBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('기본 [계좌별 자산] 탭에서 계좌 목록 카드들이 정상 렌더링되어야 한다', async () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    expect(screen.getByText('KB증권')).toBeInTheDocument();
    expect(screen.getByText('토스증권')).toBeInTheDocument();
    expect(screen.getByText('5526-9093')).toBeInTheDocument();
    expect(screen.getByText('9876-5432')).toBeInTheDocument();
  });

  it('[거래내역] 서브탭을 클릭하면 거래내역 목록이 표시되어야 한다', async () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    const txTabButton = screen.getByRole('button', { name: /거래내역/i });
    await act(async () => {
      fireEvent.click(txTabButton);
    });

    await waitFor(() => {
      expect(screen.getByText('삼성전자 추가매수')).toBeInTheDocument();
    });
  });

  it('마스킹 활성화 시 상단 전체 자산 및 계좌 잔고가 마스킹(***)되어야 한다', async () => {
    localStorage.setItem('isMasked', 'true');

    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    expect(screen.queryByText('100,000,000')).not.toBeInTheDocument();
    expect(screen.queryByText('60,000,000')).not.toBeInTheDocument();
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('새로고침 버튼 클릭 시 시세 및 거래내역을 다시 조회해야 한다', async () => {
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

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(mockRefresh).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(screen.getByText('시세가 최신화되었습니다.')).toBeInTheDocument();
    });
  });

  it('읽기 전용 페이지로 CUD(추가, 수정, 삭제) 버튼이 없어야 한다', async () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      data: mockDashboardData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    await act(async () => {
      render(
        <MaskingProvider>
          <MobileAssetsPage />
        </MaskingProvider>
      );
    });

    expect(screen.queryByRole('button', { name: /새 계좌 추가/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /거래 추가/i })).not.toBeInTheDocument();
  });
});
