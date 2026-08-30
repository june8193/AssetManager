// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dashboardService } from './dashboardService';
import { apiClient } from './apiClient';

describe('dashboardService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getSummary: 요약 데이터를 정상적으로 조회한다', async () => {
    const mockSummary = { total_valuation_krw: 50000000, accounts: [] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockSummary);

    const result = await dashboardService.getSummary(true);

    expect(getSpy).toHaveBeenCalledWith('/api/dashboard/summary', { force_update: true });
    expect(result).toEqual(mockSummary);
  });

  it('getYearly: 연도별 통계 데이터를 정상적으로 조회한다', async () => {
    const mockYearly = [{ year: 2026, total_assets: 50000000 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockYearly);

    const result = await dashboardService.getYearly();

    expect(getSpy).toHaveBeenCalledWith('/api/dashboard/yearly');
    expect(result).toEqual(mockYearly);
  });

  it('getMonthly: 월별 통계 데이터를 정상적으로 조회한다', async () => {
    const mockMonthly = [{ month: '2026-08', total_assets: 50000000 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockMonthly);

    const result = await dashboardService.getMonthly();

    expect(getSpy).toHaveBeenCalledWith('/api/dashboard/monthly');
    expect(result).toEqual(mockMonthly);
  });

  it('getDaily: 일별 통계 데이터를 정상적으로 조회한다', async () => {
    const mockDaily = [{ date: '2026-08-17', total_assets: 50000000 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockDaily);

    const result = await dashboardService.getDaily({ all: true });

    expect(getSpy).toHaveBeenCalledWith('/api/dashboard/daily', { all: true });
    expect(result).toEqual(mockDaily);
  });

  it('getSnapshots: 스냅샷 데이터를 정상적으로 조회한다', async () => {
    const mockSnapshots = { dates: ['2026-08-17'], series: [] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockSnapshots);

    const result = await dashboardService.getSnapshots({ all: true });

    expect(getSpy).toHaveBeenCalledWith('/api/dashboard/snapshots', { all: true });
    expect(result).toEqual(mockSnapshots);
  });

  it('refresh: 대시보드 시세를 정상적으로 갱신 요청한다', async () => {
    const mockRefreshRes = { status: 'success', message: '최신화 완료' };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockRefreshRes);

    const result = await dashboardService.refresh();

    expect(postSpy).toHaveBeenCalledWith('/api/dashboard/refresh');
    expect(result).toEqual(mockRefreshRes);
  });
});
