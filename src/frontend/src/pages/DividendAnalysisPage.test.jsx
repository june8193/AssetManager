// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DividendAnalysisPage from './DividendAnalysisPage';

const mockSummary = {
  total_krw: 1000000,
  ytd_krw: 500000,
  avg_yield: 3.5,
  monthly_avg: 40000,
  monthly_data: []
};

const mockStocks = [
  { id: 1, name: '삼성전자우', ticker: '005935', major_category: '주식', sub_category: '배당주', currency: 'KRW', current_price: 58000, buy_price: 55000, ytd_amount: 140000, annual_estimate: 140000, yield_current: 2.41, yield_cost: 2.54, cumulative: 200000 },
  { id: 2, name: '미국채10년', ticker: 'TLT', major_category: '채권', sub_category: '미국장기채', currency: 'USD', current_price: 90, buy_price: 95, ytd_amount: 4, annual_estimate: 4, yield_current: 4.44, yield_cost: 4.21, cumulative: 8 },
  { id: 3, name: '테슬라', ticker: 'TSLA', major_category: '주식', sub_category: '알파(성장)', currency: 'USD', current_price: 200, buy_price: 180, ytd_amount: 0, annual_estimate: 0, yield_current: 0, yield_cost: 0, cumulative: 0 }
];

describe('DividendAnalysisPage - 카테고리 탭 필터링', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/api/dividend/summary') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSummary)
        });
      }
      if (url === '/api/dividend/stocks') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStocks)
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    }));
  });

  it('기본 상태에서는 [배당주] 탭이 선택되어 배당주 자산만 표에 노출된다', async () => {
    render(<DividendAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('종목별 연간 배당률 & 가상 주가 시뮬레이터')).toBeDefined();
    });

    // 기본 활성 탭: 배당주
    const dividendTab = screen.getByRole('button', { name: /배당주/i });
    expect(dividendTab).toBeDefined();

    // 삼성전자우(배당주)는 노출
    expect(screen.getByText('삼성전자우')).toBeDefined();
    // 미국채10년(채권), 테슬라(일반주식)는 표에 미노출
    expect(screen.queryByText('미국채10년')).toBeNull();
    expect(screen.queryByText('테슬라')).toBeNull();
  });

  it('[채권] 탭 클릭 시 채권 자산만 표에 노출된다', async () => {
    render(<DividendAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('삼성전자우')).toBeDefined();
    });

    const bondTab = screen.getByRole('button', { name: /채권/i });
    fireEvent.click(bondTab);

    // 미국채10년(채권) 노출
    expect(screen.getByText('미국채10년')).toBeDefined();
    // 삼성전자우, 테슬라 미노출
    expect(screen.queryByText('삼성전자우')).toBeNull();
    expect(screen.queryByText('테슬라')).toBeNull();
  });

  it('[전체 자산] 탭 클릭 시 모든 자산이 표에 노출된다', async () => {
    render(<DividendAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('삼성전자우')).toBeDefined();
    });

    const allTab = screen.getByRole('button', { name: /전체 자산/i });
    fireEvent.click(allTab);

    // 삼성전자우, 미국채10년, 테슬라 모두 노출
    expect(screen.getByText('삼성전자우')).toBeDefined();
    expect(screen.getByText('미국채10년')).toBeDefined();
    expect(screen.getByText('테슬라')).toBeDefined();
  });
});
