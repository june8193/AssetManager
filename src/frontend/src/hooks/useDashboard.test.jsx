import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboard } from './useDashboard';
import { dashboardService } from '../services';

vi.mock('../services', () => ({
  dashboardService: {
    getSummary: vi.fn(),
    getYearly: vi.fn(),
    getMonthly: vi.fn(),
    getDaily: vi.fn(),
    getSnapshots: vi.fn(),
    refresh: vi.fn(),
  },
}));

describe('useDashboard 훅 테스트', () => {
  const mockSummary = {
    total_valuation_krw: 11000000,
    pending_deposits_krw: 500000,
    accounts: [{ id: 1, name: '계좌1', total_valuation_krw: 11000000 }],
  };
  const mockYearly = [{ year: 2026, total_assets: 10000000 }];
  const mockMonthly = [{ month: '2026-08', total_assets: 10000000 }];
  const mockDaily = [{ date: '2026-08-17', total_assets: 10000000 }];
  const mockSnapshots = {
    history: [
      {
        date: '2020-01-01',
        total: 10000000,
        period_deposit: 10000000,
        index: 1000.0,
        index_change_pct: 0.0,
        index_cum_return_pct: 0.0,
        acc_1: 10000000,
      },
    ],
    accounts: [{ id: 1, name: '계좌1' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardService.getSummary).mockResolvedValue(mockSummary);
    vi.mocked(dashboardService.getYearly).mockResolvedValue(mockYearly);
    vi.mocked(dashboardService.getMonthly).mockResolvedValue(mockMonthly);
    vi.mocked(dashboardService.getDaily).mockResolvedValue(mockDaily);
    vi.mocked(dashboardService.getSnapshots).mockResolvedValue(mockSnapshots);
    vi.mocked(dashboardService.refresh).mockResolvedValue({ status: 'success', message: '성공' });
  });

  it('마운트 시 dashboardService를 통해 대시보드 데이터를 병렬 조회하여 상태를 설정한다', async () => {
    const { result } = renderHook(() => useDashboard());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(dashboardService.getSummary).toHaveBeenCalledTimes(1);
    expect(dashboardService.getYearly).toHaveBeenCalledTimes(1);
    expect(dashboardService.getMonthly).toHaveBeenCalledTimes(1);
    expect(dashboardService.getDaily).toHaveBeenCalledWith({ all: true });
    expect(dashboardService.getSnapshots).toHaveBeenCalledWith({ all: true });

    expect(result.current.data.yearly).toEqual(mockYearly);
    expect(result.current.data.monthly).toEqual(mockMonthly);
    expect(result.current.data.daily).toEqual(mockDaily);
    expect(result.current.data.snapshots.history).toHaveLength(2);
    expect(result.current.data.snapshots.history[1]).toMatchObject({
      total: 11000000,
      period_deposit: 500000,
      index: 1047.62,
      index_change_pct: 4.76,
      index_cum_return_pct: 4.76,
      acc_1: 11000000,
      is_live: true,
    });
    expect(result.current.error).toBeNull();
  });

  it('refresh(true) 호출 시 dashboardService.refresh()를 먼저 호출한 후 데이터를 다시 조회한다', async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const res = await result.current.refresh(true);
      expect(res).toEqual({ status: 'success', message: '성공' });
    });

    expect(dashboardService.refresh).toHaveBeenCalledTimes(1);
    expect(dashboardService.getSummary).toHaveBeenCalledTimes(2);
  });

  it('조회 실패 시 에러 상태를 설정하고 예외를 throw한다', async () => {
    vi.mocked(dashboardService.getSummary).mockRejectedValueOnce(new Error('서버 통신 장애'));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('서버 통신 장애');
  });
});
