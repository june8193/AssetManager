import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import StockAnalysisPage from './StockAnalysisPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// fetch API 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockWatchlistData = [
  { id: 1, stock_code: "005930", stock_name: "삼성전자", country: "KR" }
];

const mockCustomSectorData = [
  {
    id: 1,
    name: "반도체",
    country: "KR",
    stocks: [
      { stock_code: "000660", stock_name: "SK하이닉스", shares_outstanding: 728000000 }
    ]
  }
];

const mockStockPrices = {
  ticker: "005930",
  name: "삼성전자",
  market: "KOSPI",
  prices: [
    { date: "2026-06-01", close_price: 70000 },
    { date: "2026-06-02", close_price: 71000 },
    { date: "2026-06-03", close_price: 69000 }
  ]
};

const mockIndexHistory = {
  "^KS11": [
    { date: "2026-06-01", close_price: 2500 },
    { date: "2026-06-02", close_price: 2550 },
    { date: "2026-06-03", close_price: 2480 }
  ]
};

describe('StockAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/watchlist')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockWatchlistData),
        });
      }
      if (url.includes('/api/sector/custom')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCustomSectorData),
        });
      }
      if (url.includes('/api/stocks/prices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStockPrices),
        });
      }
      if (url.includes('/api/market/history')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIndexHistory),
        });
      }
      return Promise.reject(new Error('Unknown API endpoint'));
    });
  });

  it('기본적으로 종목분석 페이지 타이틀이 뜨고 관심종목 및 커스텀 섹터 목록이 정상적으로 표시되는지 확인한다', async () => {
    render(
      <MaskingProvider>
        <StockAnalysisPage />
      </MaskingProvider>
    );

    // 타이틀 확인
    expect(screen.getByText('종목분석')).toBeDefined();

    // 관심종목 칩 존재 확인
    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeDefined();
    });

    // 커스텀 섹터 타이틀 및 속한 주식 존재 확인
    await waitFor(() => {
      expect(screen.getByText('반도체')).toBeDefined();
      expect(screen.getByText('SK하이닉스')).toBeDefined();
    });
  });

  it('관심종목 칩(삼성전자)을 클릭하면 해당 종목의 주가 및 MDD 차트 데이터를 로드하고 표시한다', async () => {
    render(
      <MaskingProvider>
        <StockAnalysisPage />
      </MaskingProvider>
    );

    // 관심종목 칩 로딩 대기
    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeDefined();
    });

    // 삼성전자 클릭
    const samsungChip = screen.getByText('삼성전자');
    fireEvent.click(samsungChip);

    // 로딩 및 주가 API 호출 확인
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/stocks/prices'));
      expect(screen.getByText('삼성전자 (005930) 분석')).toBeDefined();
    });
  });

  it('지수 비교 토글을 활성화하면 비교 지수 히스토리 API가 호출된다', async () => {
    render(
      <MaskingProvider>
        <StockAnalysisPage />
      </MaskingProvider>
    );

    // 종목 선택 선행
    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeDefined();
    });
    fireEvent.click(screen.getByText('삼성전자'));

    await waitFor(() => {
      expect(screen.getByText('지수 비교')).toBeDefined();
    });

    // 지수 비교 토글 활성화
    const compareToggle = screen.getByLabelText('지수 비교');
    fireEvent.click(compareToggle);

    // KOSPI 지수 데이터 호출 확인
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/market/history'));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tickers=%5EKS11')); // ^KS11
    });
  });
});
