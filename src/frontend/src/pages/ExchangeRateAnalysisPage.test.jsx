import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExchangeRateAnalysisPage from './ExchangeRateAnalysisPage';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockExchangeRateResponse = {
  labels: ['2026-04-18', '2026-04-19', '2026-04-20'],
  rates: [1289.1, 1442.5, 1334.79],
  dxy: [101.2, 105.4, 103.81],
  sources: ['backfill', 'kiwoom', 'kiwoom'],
  is_weekly: false,
  summary: {
    latest_date: '2026-04-20',
    latest_rate: 1334.79,
    daily_change: -107.71,
    daily_change_rate: -7.47,
    latest_dxy: 103.81,
    dxy_change_rate: -1.51,
    high_rate: 1442.5,
    high_date: '2026-04-19',
    from_high_amount: -107.71,
    from_high_rate: -7.47,
    low_rate: 1289.1,
    low_date: '2026-04-18',
    from_low_amount: 45.69,
    from_low_rate: 3.54,
    range_position_pct: 29.8,
    kiwoom_start_date: '2026-04-19',
  },
};

describe('ExchangeRateAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExchangeRateResponse),
    });
  });

  it('기본 3년 기간으로 환율 분석 데이터를 조회하고 요약 KPI 및 고점/저점 대비 패널을 렌더링한다', async () => {
    render(<ExchangeRateAnalysisPage />);

    expect(screen.getByText('환율분석')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/환율 데이터를 분석 중입니다/)).toBeNull();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/market/analysis/exchange-rate');

    // 데이터 소스 배지 확인
    expect(screen.getByText(/원\/달러: 키움 API 일원화/)).toBeInTheDocument();
    expect(screen.getByText(/DXY: 일일 동기화 DB/)).toBeInTheDocument();

    // 고점·저점 대비 패널 수치 및 발생일 확인
    const panel = screen.getByTestId('exchange-rate-position-panel');
    expect(within(panel).getByText('-107.71원')).toBeInTheDocument();
    expect(within(panel).getByText('-7.47%')).toBeInTheDocument();
    expect(within(panel).getByText('2026-04-19')).toBeInTheDocument();

    expect(within(panel).getByText('+45.69원')).toBeInTheDocument();
    expect(within(panel).getByText('+3.54%')).toBeInTheDocument();
    expect(within(panel).getByText('2026-04-18')).toBeInTheDocument();

    expect(within(panel).getByText('29.8%')).toBeInTheDocument();
    expect(screen.getByText('103.81 pt')).toBeInTheDocument();
  });

  it('기간 버튼(1개월, 5년) 클릭 시 새로운 날짜 범위로 재조회하고 3년 초과 시 주간 안내 문구를 표시한다', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExchangeRateResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockExchangeRateResponse, is_weekly: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockExchangeRateResponse, is_weekly: true }),
      });

    render(<ExchangeRateAnalysisPage />);

    await waitFor(() => {
      expect(screen.queryByText(/환율 데이터를 분석 중입니다/)).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: '1개월' }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: '5년' }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/3년 초과 조회 시 차트 최적화를 위해 주간\(Weekly\) 종가 데이터를 표시합니다/)).toBeInTheDocument();
    });
  });

  it('API 호출 실패 시 오류 메시지와 다시 시도 버튼을 렌더링하고 재시도가 동작한다', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExchangeRateResponse),
      });

    render(<ExchangeRateAnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(screen.getByText('29.8%')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
