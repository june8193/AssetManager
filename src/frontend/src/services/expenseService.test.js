import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expenseService } from './expenseService';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('expenseService 단위 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('결제수단 API', () => {
    it('getPaymentMethods 호출 시 올바른 엔드포인트와 파라미터를 전달한다', async () => {
      const mockResult = [{ id: 1, owner: '장준' }];
      apiClient.get.mockResolvedValue(mockResult);

      const params = { owner: '장준' };
      const res = await expenseService.getPaymentMethods(params);

      expect(apiClient.get).toHaveBeenCalledWith('/api/expenses/payment-methods', params);
      expect(res).toBe(mockResult);
    });

    it('createPaymentMethod 호출 시 POST 요청을 전달한다', async () => {
      const payload = { owner: '장준', institution: '카카오뱅크' };
      apiClient.post.mockResolvedValue({ id: 1, ...payload });

      const res = await expenseService.createPaymentMethod(payload);

      expect(apiClient.post).toHaveBeenCalledWith('/api/expenses/payment-methods', payload);
      expect(res.id).toBe(1);
    });

    it('updatePaymentMethod 호출 시 PUT 요청을 전달한다', async () => {
      const payload = { alias: '새 별칭' };
      apiClient.put.mockResolvedValue({ id: 1, ...payload });

      const res = await expenseService.updatePaymentMethod(1, payload);

      expect(apiClient.put).toHaveBeenCalledWith('/api/expenses/payment-methods/1', payload);
      expect(res.alias).toBe('새 별칭');
    });

    it('deletePaymentMethod 호출 시 DELETE 요청을 전달한다', async () => {
      apiClient.delete.mockResolvedValue(null);

      await expenseService.deletePaymentMethod(1);

      expect(apiClient.delete).toHaveBeenCalledWith('/api/expenses/payment-methods/1');
    });
  });

  describe('지출 카테고리 API', () => {
    it('getCategories 호출 시 올바른 엔드포인트를 호출한다', async () => {
      const mockCategories = [{ id: 1, name: '식비' }];
      apiClient.get.mockResolvedValue(mockCategories);

      const res = await expenseService.getCategories();

      expect(apiClient.get).toHaveBeenCalledWith('/api/expenses/categories');
      expect(res).toBe(mockCategories);
    });

    it('createCategory 호출 시 POST 요청을 전달한다', async () => {
      const payload = { name: '여행', color: '#E056FD' };
      apiClient.post.mockResolvedValue({ id: 3, ...payload });

      const res = await expenseService.createCategory(payload);

      expect(apiClient.post).toHaveBeenCalledWith('/api/expenses/categories', payload);
      expect(res.name).toBe('여행');
    });

    it('updateCategory 호출 시 PUT 요청을 전달한다', async () => {
      const payload = { name: '국내여행' };
      apiClient.put.mockResolvedValue({ id: 3, ...payload });

      const res = await expenseService.updateCategory(3, payload);

      expect(apiClient.put).toHaveBeenCalledWith('/api/expenses/categories/3', payload);
      expect(res.name).toBe('국내여행');
    });

    it('deleteCategory 호출 시 DELETE 요청을 전달한다', async () => {
      apiClient.delete.mockResolvedValue(null);

      await expenseService.deleteCategory(3);

      expect(apiClient.delete).toHaveBeenCalledWith('/api/expenses/categories/3');
    });
  });
});
