import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRatios } from './useRatios';
import { ratioService } from '../services';

vi.mock('../services', () => ({
  ratioService: {
    getTargets: vi.fn(),
    saveTargets: vi.fn(),
    getHierarchy: vi.fn(),
    getRebalancing: vi.fn(),
  },
}));

describe('useRatios 훅 테스트', () => {
  const mockTargets = [{ category_name: '주식', target_percentage: 60 }];
  const mockHierarchy = [{ name: '주식', value: 10000000 }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ratioService.getTargets).mockResolvedValue(mockTargets);
    vi.mocked(ratioService.getHierarchy).mockResolvedValue(mockHierarchy);
    vi.mocked(ratioService.saveTargets).mockResolvedValue({ message: '성공' });
    vi.mocked(ratioService.getRebalancing).mockResolvedValue({ total_valuation: 1000000 });
  });

  it('마운트 시 목표 비중 및 계층 구조를 조회하여 상태를 설정한다', async () => {
    const { result } = renderHook(() => useRatios());

    await waitFor(() => {
      expect(result.current.targets).toEqual(mockTargets);
      expect(result.current.hierarchy).toEqual(mockHierarchy);
    });

    expect(ratioService.getTargets).toHaveBeenCalledTimes(1);
    expect(ratioService.getHierarchy).toHaveBeenCalledTimes(1);
  });

  it('updateTargets 호출 시 ratioService.saveTargets를 실행하고 목록을 재조회한다', async () => {
    const { result } = renderHook(() => useRatios());

    await waitFor(() => {
      expect(result.current.targets).toEqual(mockTargets);
    });

    const newTargets = [{ category_name: '주식', target_percentage: 70 }];
    await act(async () => {
      await result.current.updateTargets(newTargets);
    });

    expect(ratioService.saveTargets).toHaveBeenCalledWith(newTargets);
    expect(ratioService.getTargets).toHaveBeenCalledTimes(2);
  });

  it('calculateRebalancing 호출 시 ratioService.getRebalancing을 실행하고 결과를 설정한다', async () => {
    const { result } = renderHook(() => useRatios());

    await waitFor(() => {
      expect(result.current.targets).toEqual(mockTargets);
    });

    await act(async () => {
      await result.current.calculateRebalancing(500000);
    });

    expect(ratioService.getRebalancing).toHaveBeenCalledWith(500000);
    expect(result.current.rebalancing).toEqual({ total_valuation: 1000000 });
  });
});
