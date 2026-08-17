import { describe, it, expect, vi, beforeEach } from 'vitest';
import { snapshotService } from './snapshotService';
import { apiClient } from './apiClient';

describe('snapshotService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preview: 스냅샷 미리보기를 계산한다', async () => {
    const previewReq = { snapshot_date: '2026-08-17', exchange_rate: 1350 };
    const mockPreview = [{ account_id: 1, total_valuation: 1000000 }];
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockPreview);

    const result = await snapshotService.preview(previewReq);

    expect(postSpy).toHaveBeenCalledWith('/api/db/snapshots/preview', previewReq);
    expect(result).toEqual(mockPreview);
  });

  it('save: 미리보기 데이터를 기반으로 스냅샷을 저장한다', async () => {
    const previews = [{ account_id: 1, total_valuation: 1000000 }];
    const mockSaved = [{ id: 1, snapshot_date: '2026-08-17' }];
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockSaved);

    const result = await snapshotService.save(previews);

    expect(postSpy).toHaveBeenCalledWith('/api/db/snapshots/save', previews);
    expect(result).toEqual(mockSaved);
  });

  it('calculateBrokerage: 증권 계좌 정산액을 계산한다', async () => {
    const calcReq = { account_id: 1, snapshot_date: '2026-08-17' };
    const mockCalc = { theoretical_cash: 50000, difference: 0 };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockCalc);

    const result = await snapshotService.calculateBrokerage(calcReq);

    expect(postSpy).toHaveBeenCalledWith('/api/db/snapshots/brokerage/calculate', calcReq);
    expect(result).toEqual(mockCalc);
  });

  it('calculateBank: 은행 계좌 정산액을 계산한다', async () => {
    const calcReq = { account_id: 2, snapshot_date: '2026-08-17' };
    const mockCalc = { expected_balance: 100000 };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockCalc);

    const result = await snapshotService.calculateBank(calcReq);

    expect(postSpy).toHaveBeenCalledWith('/api/db/snapshots/bank/calculate', calcReq);
    expect(result).toEqual(mockCalc);
  });

  it('saveUnified: 증권/은행 통합 스냅샷을 단일 트랜잭션으로 저장한다', async () => {
    const unifiedReq = { snapshot_date: '2026-08-17', exchange_rate: 1350, brokerage: [], bank: [] };
    const mockSaved = [{ id: 1 }, { id: 2 }];
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockSaved);

    const result = await snapshotService.saveUnified(unifiedReq);

    expect(postSpy).toHaveBeenCalledWith('/api/db/snapshots/unified/save', unifiedReq);
    expect(result).toEqual(mockSaved);
  });
});
