import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileRatiosPage from './MobileRatiosPage';
import MobileHeader from '../../components/mobile/MobileHeader';
import { MaskingProvider } from '../../contexts/MaskingContext';
import { MobileHeaderProvider } from '../../contexts/MobileHeaderContext';
import * as useRatiosModule from '../../hooks/useRatios';

const mockHierarchy = [
  {
    category_name: '주식',
    current_value: 60000000,
    target_percentage: 50.0,
    children: [
      {
        category_name: '미국주식',
        current_value: 40000000,
        target_percentage: 60.0,
        children: [
          {
            name: '애플',
            ticker: 'AAPL',
            valuation_krw: 20000000,
            target_percentage: 50.0,
          },
        ],
      },
    ],
  },
  {
    category_name: '현금',
    current_value: 40000000,
    target_percentage: 50.0,
    children: [],
  },
];

const mockBalancedHierarchy = [
  {
    category_name: '주식',
    current_value: 50000000,
    target_percentage: 50.0,
    children: [],
  },
  {
    category_name: '현금',
    current_value: 50000000,
    target_percentage: 50.0,
    children: [],
  },
];

describe('MobileRatiosPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('로딩 중일 때 스켈레톤 로더가 렌더링되어야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: [],
      loading: true,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/비중 데이터를 불러오는 중/i)).toBeInTheDocument();
  });

  it('에러 발생 시 에러 메시지와 다시 시도 버튼이 노출되어야 한다', async () => {
    const mockRefresh = vi.fn();
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: [],
      loading: false,
      error: '네트워크 연결 오류',
      refreshHierarchy: mockRefresh,
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('네트워크 연결 오류')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('정상 데이터 로드 시 현재 총 자산 단일 금액 및 리밸런싱 규모가 렌더링되고 목표 총 자산 및 시뮬레이션 UI는 노출되지 않아야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    // 헤더 및 현재 총 자산 확인
    expect(screen.getByRole('heading', { name: '비중 점검' })).toBeInTheDocument();
    expect(screen.getByText('현재 총 자산')).toBeInTheDocument();
    expect(screen.getByText('100,000,000')).toBeInTheDocument();

    // 목표 총 자산 및 시뮬레이터 제거 확인
    expect(screen.queryByText('목표 총 자산')).not.toBeInTheDocument();
    expect(screen.queryByText(/추가 투자금/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /100만|500만|1,000만/i })).not.toBeInTheDocument();

    // 리밸런싱 규모 표시 확인 (1,000만 원)
    expect(screen.getByText(/리밸런싱 규모/i)).toBeInTheDocument();
    expect(screen.getByText('10,000,000')).toBeInTheDocument();

    // 대분류 카드 렌더링 확인
    expect(screen.getByText('주식')).toBeInTheDocument();
    expect(screen.getByText('현금')).toBeInTheDocument();
  });

  it('리밸런싱이 불필요한 경우(목표 비중과 현재 비중 일치) 리밸런싱 규모 안내가 노출되지 않아야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockBalancedHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText(/리밸런싱 규모/i)).not.toBeInTheDocument();
  });

  it('새로고침 버튼 클릭 시 refreshHierarchy가 호출되고 토스트 메시지가 노출되어야 한다', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(true);
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: mockRefresh,
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(mockRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/최신화되었습니다/i)).toBeInTheDocument();
    });
  });

  it('마스킹 활성화 시 총 자산 및 리밸런싱 금액이 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText('100,000,000')).not.toBeInTheDocument();
    expect(screen.queryByText('10,000,000')).not.toBeInTheDocument();
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(2);
  });

  it('순수 조회 전용(Read-Only)으로 비중 변경 입력 폼 및 저장 버튼이 노출되지 않아야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /저장/i })).not.toBeInTheDocument();
  });

  it('[비중 점검 | 리스크] 2단 서브탭이 렌더링되고 초기 마운트 시에는 리스크 API를 호출하지 않아야 한다', () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    const ratiosTab = screen.getByRole('tab', { name: '비중 점검' });
    const riskTab = screen.getByRole('tab', { name: '리스크' });

    expect(ratiosTab).toHaveAttribute('aria-selected', 'true');
    expect(riskTab).toHaveAttribute('aria-selected', 'false');
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/risk/volatility'));
  });

  it('리스크 탭 클릭 시 MobileRiskSection이 렌더링되고, 리스크 탭 활성 상태에서 새로고침 시 리스크 데이터만 재조회되어야 한다', async () => {
    const mockRefreshHierarchy = vi.fn();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            period: '1Y',
            as_of_date: '2026-11-22',
            total_valuation_krw: 100000000,
            portfolio: {
              annualized_volatility: 14.82,
              daily_volatility_pct: 0.93,
              daily_volatility_krw: 930000,
              sp500_ratio: 1.09,
              nasdaq_ratio: 0.77,
              kospi_ratio: 0.56,
            },
            benchmarks: {
              sp500: { ticker: '^GSPC', name: 'S&P 500', annualized_volatility: 13.61 },
              nasdaq: { ticker: '^IXIC', name: 'NASDAQ', annualized_volatility: 19.31 },
              kospi: { ticker: '^KS11', name: 'KOSPI', annualized_volatility: 26.4 },
            },
            assets: [],
            drawdown_comparison: { dates: [], benchmarks: {}, portfolio_current: [] },
          }),
      })
    );

    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: mockRefreshHierarchy,
    });

    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <MobileRatiosPage />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    const riskTab = screen.getByRole('tab', { name: '리스크' });
    fireEvent.click(riskTab);

    expect(riskTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => {
      expect(screen.getByText('14.82%')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/리스크 지표가 최신화되었습니다/i)).toBeInTheDocument();
    });
    expect(mockRefreshHierarchy).not.toHaveBeenCalled();
  });
});
