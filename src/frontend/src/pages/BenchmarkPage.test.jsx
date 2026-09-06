import { render, screen, fireEvent } from '@testing-library/react';
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

  it('정상 데이터 로드 시 요약 카드가 제거되고 초과수익률 분석 표와 차트가 순서대로 렌더링된다', () => {
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

    // 요약 카드 영역 제거 확인 ('내 총자산' 및 지수 요약 카드 미노출)
    expect(screen.queryByText('내 총자산')).not.toBeInTheDocument();
    expect(screen.queryByText('₩ 160,000,000')).not.toBeInTheDocument();
    expect(screen.queryByText('2,650.42')).not.toBeInTheDocument();

    // 벤치마크 초과수익률 테이블 정상 렌더링 확인
    const alphaHeading = screen.getByRole('heading', { level: 3, name: '벤치마크 초과수익률 (Alpha) 분석' });
    expect(alphaHeading).toBeInTheDocument();
    expect(screen.getByText('vs KOSPI')).toBeInTheDocument();
    expect(screen.getByText('+9.8%p')).toBeInTheDocument();
    expect(screen.getByText('+15.2%')).toBeInTheDocument();

    // 누적 수익률 비교 추이 차트 정상 렌더링 확인
    const chartHeading = screen.getByRole('heading', { level: 2, name: '누적 수익률 비교 추이 (%)' });
    expect(chartHeading).toBeInTheDocument();

    // 초과수익률 분석 표가 차트보다 상단(DOM 앞 순서)에 렌더링되는지 확인
    expect(alphaHeading.compareDocumentPosition(chartHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 하단 연간 수익률 비교 테이블 정상 유지 확인
    expect(screen.getByText('연간 수익률 비교')).toBeInTheDocument();
  });

  it('초과수익률 분석 표에서 포트폴리오 수익률이 음수일 때 마이너스 부호가 올바르게 렌더링된다', () => {
    const negativeBenchmarkData = {
      ...mockBenchmarkData,
      alpha_analysis: [
        {
          benchmark: "KOSPI",
          ticker: "^KS11",
          benchmark_return: -1.2,
          portfolio_return: -4.5,
          alpha: -3.3,
          judgment: "시장 하회"
        }
      ]
    };

    vi.mocked(useBenchmark).mockReturnValue({
      data: negativeBenchmarkData,
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

    // 음수일 때 '+-4.5%'가 아니라 '-4.5%'로 렌더링되는지 확인
    expect(screen.getByText('-4.5%')).toBeInTheDocument();
    expect(screen.queryByText('+-4.5%')).not.toBeInTheDocument();
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

  it('헤더에 벤치마크 비교 타이틀과 설명 부제목이 올바르게 렌더링된다', () => {
    vi.mocked(useBenchmark).mockReturnValue({
      data: mockBenchmarkData,
      loading: false,
      error: null,
      period: "YTD",
      setPeriod: vi.fn(),
      refresh: vi.fn(),
      toggleWatchlistStock: vi.fn(),
      activeWatchlistDataset: {}
    });

    render(
      <MaskingProvider>
        <BenchmarkPage />
      </MaskingProvider>
    );

    // 제목 및 부제목 텍스트 확인
    expect(screen.getByRole('heading', { level: 1, name: /벤치마크 비교/i })).toBeDefined();
    expect(screen.getByText('주요 시장 지수 대비 포트폴리오 성과 및 초과수익률(Alpha)을 비교 분석합니다.')).toBeDefined();
  });

  it('헤더 우측에 기간 탭 버튼 그룹이 렌더링되고 클릭 시 setPeriod가 호출된다', () => {
    const setPeriodMock = vi.fn();
    const refreshMock = vi.fn();

    vi.mocked(useBenchmark).mockReturnValue({
      data: mockBenchmarkData,
      loading: false,
      error: null,
      period: "YTD",
      setPeriod: setPeriodMock,
      refresh: refreshMock,
      toggleWatchlistStock: vi.fn(),
      activeWatchlistDataset: {}
    });

    render(
      <MaskingProvider>
        <BenchmarkPage />
      </MaskingProvider>
    );

    // 기존 select 요소는 존재하지 않아야 함
    expect(screen.queryByRole('combobox')).toBeNull();

    // 4개 기간 탭 버튼 존재 확인
    const ytdTab = screen.getByRole('button', { name: '올해 누적 (YTD)' });
    const oneMonthTab = screen.getByRole('button', { name: '1개월' });
    const threeMonthTab = screen.getByRole('button', { name: '3개월' });
    const oneYearTab = screen.getByRole('button', { name: '1년' });

    expect(ytdTab).toBeDefined();
    expect(oneMonthTab).toBeDefined();
    expect(threeMonthTab).toBeDefined();
    expect(oneYearTab).toBeDefined();

    // 활성/비활성 접근성 상태 확인 (기본값: YTD)
    expect(ytdTab.getAttribute('aria-pressed')).toBe('true');
    expect(oneMonthTab.getAttribute('aria-pressed')).toBe('false');

    // 탭 클릭 인터랙션 검증
    fireEvent.click(oneMonthTab);
    expect(setPeriodMock).toHaveBeenCalledWith('1M');

    fireEvent.click(threeMonthTab);
    expect(setPeriodMock).toHaveBeenCalledWith('3M');

    fireEvent.click(oneYearTab);
    expect(setPeriodMock).toHaveBeenCalledWith('1Y');

    fireEvent.click(ytdTab);
    expect(setPeriodMock).toHaveBeenCalledWith('YTD');

    // 새로고침 버튼 유지 및 클릭 동작 검증
    const refreshButton = screen.getByRole('button', { name: '새로고침' });
    expect(refreshButton).toBeDefined();
    fireEvent.click(refreshButton);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
