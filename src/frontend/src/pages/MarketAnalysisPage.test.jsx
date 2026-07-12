import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketAnalysisPage from './MarketAnalysisPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// fetch API 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockHistoricalData = {
  labels: ["2026-06-01", "2026-06-02", "2026-06-03"],
  prices: [5100.0, 5150.0, 5120.0],
  mdd: [0.0, 0.0, -0.58]
};

const mockStatsData = {
  yearly: [
    {
      year: 2026,
      close_price: 5120.0,
      return_rate: 8.5,
      mdd: -3.5
    }
  ],
  monthly: [
    {
      year: 2026,
      month: 6,
      close_price: 5120.0,
      return_rate: 1.2,
      mdd: -1.5
    }
  ]
};

const mockComparisonData = [
  {
    year: 2026,
    kospi: 5.4,
    kosdaq: 3.2,
    sp500: 8.5,
    nasdaq: 12.1
  },
  {
    year: 2025,
    kospi: -2.1,
    kosdaq: 1.5,
    sp500: 15.2,
    nasdaq: 22.0
  }
];

describe('MarketAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 기본 API 호출 응답 모킹
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/market/analysis/historical')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockHistoricalData),
        });
      }
      if (url.includes('/api/market/analysis/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatsData),
        });
      }
      if (url.includes('/api/market/analysis/comparison')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockComparisonData),
        });
      }
      return Promise.reject(new Error('Unknown API endpoint'));
    });
  });

  it('기본적으로 "지수별 상세 분석" 탭과 기본 차트/테이블이 정상적으로 로드되는지 확인한다', async () => {
    render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    // 타이틀 확인
    expect(screen.getByText('지수분석')).toBeDefined();

    // 탭 이름 확인
    expect(screen.getByText('지수별 상세 분석')).toBeDefined();
    expect(screen.getByText('4대 지수 연간 수익률 비교')).toBeDefined();

    // 로딩이 끝날 때까지 대기
    await waitFor(() => {
      expect(screen.queryByText(/금융 데이터를 분석 중입니다/)).toBeNull();
    });

    // 기본 지수 KOSPI, KOSDAQ, S&P 500, NASDAQ 버튼이 있는지 확인
    expect(screen.getByRole('button', { name: /S&P 500/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /KOSPI/i })).toBeDefined();

    // 지수 데이터 테이블 렌더링 검증 (기본 월별 탭 상태 검증)
    expect(screen.getByText(/2026년 6월/)).toBeDefined();
    expect(screen.getByText('+1.20%')).toBeDefined();
    expect(screen.getByText('-1.50%')).toBeDefined();
  });

  it('탭을 클릭하면 "4대 지수 연간 수익률 비교" 화면으로 전환된다', async () => {
    render(
      <MaskingProvider>
        <MarketAnalysisPage />
      </MaskingProvider>
    );

    const compTab = screen.getByText('4대 지수 연간 수익률 비교');
    fireEvent.click(compTab);

    // 테이블 헤더 및 데이터 렌더링 검증
    await waitFor(() => {
      expect(screen.getByText('연도별 지수 수익률 비교')).toBeDefined();
      expect(screen.getByText('2025')).toBeDefined();
      // KOSPI 2025년 수익률 -2.10% 확인
      expect(screen.getByText('-2.10%')).toBeDefined();
      // S&P 500 2025년 수익률 +15.20% 확인
      expect(screen.getByText('+15.20%')).toBeDefined();
    });
  });
});
