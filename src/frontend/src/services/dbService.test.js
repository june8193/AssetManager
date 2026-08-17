import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbService } from './dbService';
import { apiClient } from './apiClient';

describe('dbService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('계좌(Accounts) 및 사용자(Users) 관리', () => {
    it('getUsers: 사용자 목록을 조회한다', async () => {
      const mockUsers = [{ id: 1, name: '홍길동' }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockUsers);

      const result = await dbService.getUsers();

      expect(getSpy).toHaveBeenCalledWith('/api/db/users');
      expect(result).toEqual(mockUsers);
    });

    it('getAccounts: 계좌 목록을 조회한다', async () => {
      const mockAccounts = [{ id: 1, name: '메인 계좌' }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockAccounts);

      const result = await dbService.getAccounts();

      expect(getSpy).toHaveBeenCalledWith('/api/db/accounts');
      expect(result).toEqual(mockAccounts);
    });

    it('createAccount: 새 계좌를 생성한다', async () => {
      const newAcc = { name: '새 계좌', provider: '신한' };
      const mockCreated = { id: 2, ...newAcc };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockCreated);

      const result = await dbService.createAccount(newAcc);

      expect(postSpy).toHaveBeenCalledWith('/api/db/accounts', newAcc);
      expect(result).toEqual(mockCreated);
    });

    it('updateAccount: 계좌 정보를 수정한다', async () => {
      const updateData = { name: '수정 계좌' };
      const mockUpdated = { id: 1, ...updateData };
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce(mockUpdated);

      const result = await dbService.updateAccount(1, updateData);

      expect(putSpy).toHaveBeenCalledWith('/api/db/accounts/1', updateData);
      expect(result).toEqual(mockUpdated);
    });

    it('deleteAccount: 계좌를 삭제한다', async () => {
      const mockRes = { message: '삭제되었습니다.' };
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce(mockRes);

      const result = await dbService.deleteAccount(1);

      expect(delSpy).toHaveBeenCalledWith('/api/db/accounts/1');
      expect(result).toEqual(mockRes);
    });
  });

  describe('자산 마스터(Assets) 관리', () => {
    it('getAssets: 자산 목록을 조회한다', async () => {
      const mockAssets = [{ id: 1, ticker: '005930', name: '삼성전자' }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockAssets);

      const result = await dbService.getAssets();

      expect(getSpy).toHaveBeenCalledWith('/api/db/assets');
      expect(result).toEqual(mockAssets);
    });

    it('getCategories: 자산 카테고리 목록을 조회한다', async () => {
      const mockCats = { 주식: ['국내주식', '해외주식'] };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockCats);

      const result = await dbService.getCategories();

      expect(getSpy).toHaveBeenCalledWith('/api/db/assets/categories');
      expect(result).toEqual(mockCats);
    });

    it('verifyAsset: 종목 존재 여부 및 공식명을 검증한다', async () => {
      const mockVerify = { name: '삼성전자' };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockVerify);

      const result = await dbService.verifyAsset({ ticker: '005930', country: 'KR', major_category: '주식' });

      expect(getSpy).toHaveBeenCalledWith('/api/db/assets/verify', {
        ticker: '005930',
        country: 'KR',
        major_category: '주식',
      });
      expect(result).toEqual(mockVerify);
    });

    it('createAsset: 새 자산을 생성한다', async () => {
      const newAsset = { ticker: '005930', name: '삼성전자' };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(newAsset);

      const result = await dbService.createAsset(newAsset);

      expect(postSpy).toHaveBeenCalledWith('/api/db/assets', newAsset);
      expect(result).toEqual(newAsset);
    });

    it('updateAsset: 자산 정보를 수정한다', async () => {
      const updateData = { name: '삼성전자우' };
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce(updateData);

      const result = await dbService.updateAsset(1, updateData);

      expect(putSpy).toHaveBeenCalledWith('/api/db/assets/1', updateData);
      expect(result).toEqual(updateData);
    });

    it('deleteAsset: 자산을 삭제한다', async () => {
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ message: '삭제되었습니다.' });

      const result = await dbService.deleteAsset(1);

      expect(delSpy).toHaveBeenCalledWith('/api/db/assets/1');
      expect(result).toEqual({ message: '삭제되었습니다.' });
    });
  });

  describe('거래 내역(Transactions) 관리', () => {
    it('getTransactions: 거래 내역을 조회한다', async () => {
      const mockTx = [{ id: 1, type: 'BUY' }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTx);

      const result = await dbService.getTransactions({ start_date: '2026-01-01' });

      expect(getSpy).toHaveBeenCalledWith('/api/db/transactions', { start_date: '2026-01-01' });
      expect(result).toEqual(mockTx);
    });

    it('createTransaction: 거래를 생성한다', async () => {
      const newTx = { type: 'BUY', amount: 100000 };
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(newTx);

      const result = await dbService.createTransaction(newTx);

      expect(postSpy).toHaveBeenCalledWith('/api/db/transactions', newTx);
      expect(result).toEqual(newTx);
    });

    it('transfer: 계좌 간 이체를 등록한다', async () => {
      const transferReq = { from_account_id: 1, to_account_id: 2, amount: 50000 };
      const mockResult = [{ id: 10 }, { id: 11 }];
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResult);

      const result = await dbService.transfer(transferReq);

      expect(postSpy).toHaveBeenCalledWith('/api/db/transactions/transfer', transferReq);
      expect(result).toEqual(mockResult);
    });

    it('updateTransaction: 거래를 수정한다', async () => {
      const updateData = { amount: 120000 };
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce(updateData);

      const result = await dbService.updateTransaction(1, updateData);

      expect(putSpy).toHaveBeenCalledWith('/api/db/transactions/1', updateData);
      expect(result).toEqual(updateData);
    });

    it('deleteTransaction: 거래를 삭제한다', async () => {
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ message: '삭제되었습니다.' });

      const result = await dbService.deleteTransaction(1);

      expect(delSpy).toHaveBeenCalledWith('/api/db/transactions/1');
      expect(result).toEqual({ message: '삭제되었습니다.' });
    });
  });

  describe('스냅샷(Snapshots) 관리', () => {
    it('getSnapshots: 스냅샷 목록을 조회한다', async () => {
      const mockSnaps = [{ snapshot_date: '2026-08-17' }];
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockSnaps);

      const result = await dbService.getSnapshots();

      expect(getSpy).toHaveBeenCalledWith('/api/db/snapshots');
      expect(result).toEqual(mockSnaps);
    });

    it('getLatestSnapshotDate: 최신 스냅샷 일자를 조회한다', async () => {
      const mockLatest = { latest_date: '2026-08-17' };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockLatest);

      const result = await dbService.getLatestSnapshotDate();

      expect(getSpy).toHaveBeenCalledWith('/api/db/snapshots/latest');
      expect(result).toEqual(mockLatest);
    });

    it('deleteSnapshotByDate: 지정 날짜의 스냅샷을 삭제한다', async () => {
      const delSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ message: '삭제' });

      const result = await dbService.deleteSnapshotByDate('2026-08-17');

      expect(delSpy).toHaveBeenCalledWith('/api/db/snapshots/2026-08-17');
      expect(result).toEqual({ message: '삭제' });
    });
  });
});
