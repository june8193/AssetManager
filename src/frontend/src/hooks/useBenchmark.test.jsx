import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBenchmark } from './useBenchmark';
import { marketService } from '../services';

vi.mock('../services', () => ({
  marketService: {
    getBenchmark: vi.fn(),
    getHistoricalBenchmark: vi.fn(),
  },
}));

describe('useBenchmark 훅 테스트', () => {
  const mockBenchmarkData = {
    portfolio: { ytd_return: 5.5 },
    indices: {},
    chart: { labels: [], datasets: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketService.getBenchmark).mockResolvedValue(mockBenchmarkData);
    vi.mocked(marketService.getHistoricalBenchmark).mockResolvedValue({ labels: [], data: [1.2] });
  });

  it('마운트 시 marketService.getBenchmark를 호출하여 벤치마크 데이터를 로드한다', async () => {
    const { result } = renderHook(() => useBenchmark());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(marketService.getBenchmark).toHaveBeenCalledWith({ period: 'YTD' });
    expect(result.current.data).toEqual(mockBenchmarkData);
  });

  it('toggleWatchlistStock 호출 시 종목의 과거 시계열 데이터를 로드하여 데이터셋에 추가/삭제한다', async () => {
    const { result } = renderHook(() => useBenchmark());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 토글 추가
    await act(async () => {
      await result.current.toggleWatchlistStock('005930');
    });

    expect(marketService.getHistoricalBenchmark).toHaveBeenCalledWith('005930', 'YTD');
    expect(result.current.activeWatchlistDataset['005930']).toEqual({ labels: [], data: [1.2] });

    // 토글 해제
    await act(async () => {
      await result.current.toggleWatchlistStock('005930');
    });

    expect(result.current.activeWatchlistDataset['005930']).toBeUndefined();
  });
});
