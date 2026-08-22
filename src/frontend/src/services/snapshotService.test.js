// @vitest-environment node
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

  describe('스냅샷 위저드 전용 파사드 메서드', () => {
    it('fetchWizardInitData: 계좌 목록, 최근 스냅샷 일자, 환율 정보를 병렬 로드한다', async () => {
      const mockAccounts = [{ id: 1, name: '증권1', is_active: true, account_type: 'BROKERAGE' }];
      const mockLatestSnapshot = { latest_date: '2026-07-31' };
      const mockRates = [
        { date: '2026-08-17', rate: 1345.5 },
        { date: '2026-08-16', rate: 1340.0 },
      ];

      const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((path) => {
        if (path === '/api/db/accounts') return Promise.resolve(mockAccounts);
        if (path === '/api/db/snapshots/latest') return Promise.resolve(mockLatestSnapshot);
        if (path === '/api/exchange/rates') return Promise.resolve(mockRates);
        return Promise.reject(new Error('Unknown path'));
      });

      const data = await snapshotService.fetchWizardInitData('2026-08-17');

      expect(getSpy).toHaveBeenCalledWith('/api/db/accounts');
      expect(getSpy).toHaveBeenCalledWith('/api/db/snapshots/latest');
      expect(getSpy).toHaveBeenCalledWith('/api/exchange/rates', { limit: 100 });
      expect(data).toEqual({
        accounts: mockAccounts,
        latestSnapshotDate: '2026-07-31',
        exchangeRates: mockRates,
        exchangeRate: '1345.5',
      });
    });

    it('fetchWizardInitData: 해당 날짜 환율이 없으면 최신 환율 또는 기본값을 적용한다', async () => {
      const mockAccounts = [];
      const mockLatestSnapshot = { latest_date: null };
      const mockRates = [{ date: '2026-08-16', rate: 1340.0 }];

      vi.spyOn(apiClient, 'get').mockImplementation((path) => {
        if (path === '/api/db/accounts') return Promise.resolve(mockAccounts);
        if (path === '/api/db/snapshots/latest') return Promise.resolve(mockLatestSnapshot);
        if (path === '/api/exchange/rates') return Promise.resolve(mockRates);
        return Promise.reject(new Error('Unknown path'));
      });

      const data = await snapshotService.fetchWizardInitData('2026-08-20');
      expect(data.exchangeRate).toBe('1340');
      expect(data.latestSnapshotDate).toBeNull();
    });

    it('fetchAccountWizardData: 특정 계좌의 기간 내 거래 내역을 조회한다', async () => {
      const mockTxs = [{ id: 101, type: 'DEPOSIT', total_amount: 500000 }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTxs);

      const result = await snapshotService.fetchAccountWizardData(1, '2026-07-31', '2026-08-17');

      expect(getSpy).toHaveBeenCalledWith('/api/db/accounts/1/transactions/period', {
        start_date: '2026-07-31',
        end_date: '2026-08-17',
      });
      expect(result).toEqual(mockTxs);
    });

    it('saveWizardSnapshot: 완성된 위저드 스냅샷 DTO 페이로드를 통합 저장한다', async () => {
      const payload = { snapshot_date: '2026-08-17', exchange_rate: 1350, brokerage_accounts: [], bank_accounts: [] };
      const mockResponse = [{ id: 1 }];
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResponse);

      const result = await snapshotService.saveWizardSnapshot(payload);

      expect(postSpy).toHaveBeenCalledWith('/api/db/snapshots/unified/save', payload);
      expect(result).toEqual(mockResponse);
    });
  });
});
