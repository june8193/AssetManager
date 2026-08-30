import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BenchmarkPage from './BenchmarkPage';
import { useBenchmark } from '../hooks/useBenchmark';
import { MaskingProvider } from '../contexts/MaskingContext';

// useBenchmark 훅 모킹
vi.mock('../hooks/useBenchmark');

const mockBenchmarkData = {
  portfolio: {
    total_valuation: 124500000,
    actual_latest_valuation: 160000000,
    actual_latest_date: "2026-06-06",
    ytd_return: 15.2
  },
  indices: {
    "^KS11": {
      name: "KOSPI",
      value: 2650.42,
      return: 5.4,
      alpha: 9.8,
      judgment: "시장 상회"
    },
    "^GSPC": {
      name: "S&P 500",
      value: 5210.3,
      return: 12.1,
      alpha: 3.1,
      judgment: "시장 상회"
    },
    "^IXIC": {
      name: "NASDAQ",
      value: 16840.15,
      return: 18.5,
      alpha: -3.3,
      judgment: "시장 하회"
    }
  },
  chart: {
    labels: ["2026-05-01", "2026-05-04", "2026-05-05"],
    datasets: [
      {
        label: "내 포트폴리오",
        data: [0.0, 5.0, 7.0]
      },
      {
        label: "KOSPI",
        data: [0.0, 2.0, 4.0]
      }
    ]
  },
  alpha_analysis: [
    {
      benchmark: "KOSPI",
      ticker: "^KS11",
      benchmark_return: 5.4,
      portfolio_return: 15.2,
      alpha: 9.8,
      judgment: "시장 상회"
    }
  ],
  watchlist: [
    {
      id: 1,
      stock_code: "005930",
      stock_name: "삼성전자",
      country: "KR",
      current_price: 78200.0,
      ytd_return: 2.1,
      period_return: 2.1
    }
  ],
  yearly_comparison: [
    {
      year: 2026,
      assets: 150000000,
      roi: 15.2,
      kospi: 5.4,
      kosdaq: 3.2,
      sp500: 12.1,
      nasdaq: 18.5
    }
  ],
  monthly_comparison: [
    {
      month: "2026-05",
      assets: 150000000,
      roi: 5.2,
      kospi: 3.1,
      kosdaq: 2.5,
      sp500: 4.0,
      nasdaq: 6.2
    }
  ],
  daily_comparison: [
    {
      date: "2026-05-05",
      assets: 150000000,
      roi: 15.2,
      kospi: 5.4,
      kosdaq: 3.2,
      sp500: 12.1,
      nasdaq: 18.5
    }
  ]
};

describe('BenchmarkPage', () => {
  it('로딩 중일 때 로딩 스피너와 메시지를 렌더링한다', () => {
    vi.mocked(useBenchmark).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      period: "YTD",
      setPeriod: vi.fn(),
      toggleWatchlistStock: vi.fn(),
      activeWatchlistDataset: {}
    });

    render(
      <MaskingProvider>
        <BenchmarkPage />
      </MaskingProvider>
    );

    expect(screen.getByText(/성과 데이터를 분석 중입니다/i)).toBeDefined();
  });

  it('에러 발생 시 에러 메시지와 재시도 버튼을 렌더링한다', () => {
    const refreshMock = vi.fn();
    vi.mocked(useBenchmark).mockReturnValue({
      data: null,
      loading: false,
      error: "API 연결 실패",
      period: "YTD",
      setPeriod: vi.fn(),
      refresh: refreshMock,
      toggleWatchlistStock: vi.fn(),
      activeWatchlistDataset: {}
    });

    render(
      <MaskingProvider>
        <BenchmarkPage />
      </MaskingProvider>
    );

    expect(screen.getByText(/API 연결 실패/i)).toBeDefined();
    const retryButton = screen.getByRole('button', { name: /다시 시도/i });
    expect(retryButton).toBeDefined();

    fireEvent.click(retryButton);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('정상 데이터 로드 시 요약 카드, 차트, 초과수익률 및 관심종목 테이블을 렌더링한다', () => {
    vi.mocked(useBenchmark).mockReturnValue({
      data: mockBenchmarkData,
      loading: false,
      error: null,
      period: "YTD",
      setPeriod: vi.fn(),
      toggleWatchlistStock: vi.fn(),
      activeWatchlistDataset: {}
    });

    render(
      <MaskingProvider>
        <BenchmarkPage />
      </MaskingProvider>
    );

    // 내 총자산 카드 렌더링 확인
    expect(screen.getByText('내 총자산')).toBeDefined();
    expect(screen.getByText('₩ 160,000,000')).toBeDefined();
    expect(screen.getByText('YTD +15.2%')).toBeDefined();
    expect(screen.getByText(/최신 스냅샷 2026-06-06 기준/i)).toBeDefined();
    expect(screen.getByText(/수익률 비교 기준일: 2026-05-05/i)).toBeDefined();

    // 코스피 지수 카드 렌더링 확인
    expect(screen.getAllByText(/KOSPI/i)[0]).toBeDefined();
    expect(screen.getByText('2,650.42')).toBeDefined();
    expect(screen.getByText('YTD +5.4%')).toBeDefined();

    // 벤치마크 초과수익률 테이블 확인
    expect(screen.getByText('vs KOSPI')).toBeDefined();
    expect(screen.getByText('+9.8%p')).toBeDefined();
  });

  it('[연도별 | 월별 | 일별] 탭 전환에 따라 해당 비교 테이블이 올바르게 전환 렌더링된다', () => {
    vi.mocked(useBenchmark).mockReturnValue({
      data: mockBenchmarkData,
      loading: false,
      error: null,
      period: "YTD",
      setPeriod: vi.fn(),
      toggleWatchlistStock: vi.fn(),
      activeWatchlistDataset: {}
    });

    render(
      <MaskingProvider>
        <BenchmarkPage />
      </MaskingProvider>
    );

    // 기본값: 연도별 탭이 활성화되어 '연간 수익률 비교' 렌더링
    expect(screen.getByText('연간 수익률 비교')).toBeDefined();
    expect(screen.queryByText('월간 수익률 비교')).toBeNull();
    expect(screen.queryByText('일간 수익률 비교')).toBeNull();

    // '월별' 탭 클릭 시 '월간 수익률 비교' 표로 전환
    const monthlyTab = screen.getByRole('button', { name: '월별' });
    fireEvent.click(monthlyTab);
    expect(screen.getByText('월간 수익률 비교')).toBeDefined();
    expect(screen.getByText('2026-05')).toBeDefined();
    expect(screen.queryByText('연간 수익률 비교')).toBeNull();
    expect(screen.queryByText('일간 수익률 비교')).toBeNull();

    // '일별' 탭 클릭 시 '일간 수익률 비교' 표로 전환
    const dailyTab = screen.getByRole('button', { name: '일별' });
    fireEvent.click(dailyTab);
    expect(screen.getByText('일간 수익률 비교')).toBeDefined();
    expect(screen.getByText('2026-05-05')).toBeDefined();
    expect(screen.queryByText('연간 수익률 비교')).toBeNull();
    expect(screen.queryByText('월간 수익률 비교')).toBeNull();
  });
});
