import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratioService } from './ratioService';
import { apiClient } from './apiClient';

describe('ratioService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getTargets: 목표 비중 목록을 조회한다', async () => {
    const mockTargets = [{ category_name: '주식', target_percentage: 60 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTargets);

    const result = await ratioService.getTargets();

    expect(getSpy).toHaveBeenCalledWith('/api/ratios/targets');
    expect(result).toEqual(mockTargets);
  });

  it('saveTargets: 목표 비중 설정을 저장한다', async () => {
    const newTargets = [{ category_name: '주식', target_percentage: 70 }];
    const mockRes = { message: 'Successfully updated target ratios' };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockRes);

    const result = await ratioService.saveTargets(newTargets);

    expect(postSpy).toHaveBeenCalledWith('/api/ratios/targets', newTargets);
    expect(result).toEqual(mockRes);
  });

  it('getHierarchy: 계층형 자산 구조를 조회한다', async () => {
    const mockHierarchy = [{ name: '주식', value: 10000000 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockHierarchy);

    const result = await ratioService.getHierarchy();

    expect(getSpy).toHaveBeenCalledWith('/api/ratios/hierarchy');
    expect(result).toEqual(mockHierarchy);
  });

  it('getRebalancing: 추가 투자금을 포함한 리밸런싱 계산 결과를 조회한다', async () => {
    const mockRebalancing = { total_valuation: 1000000, additional_cash: 500000 };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockRebalancing);

    const result = await ratioService.getRebalancing(500000);

    expect(getSpy).toHaveBeenCalledWith('/api/ratios/rebalancing', { additional_cash: 500000 });
    expect(result).toEqual(mockRebalancing);
  });
});
