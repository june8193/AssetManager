/**
 * 지출 모니터링 결제수단 및 카테고리 관리 API 서비스
 */
import { apiClient } from './apiClient';

export const expenseService = {
  /**
   * 결제수단 목록을 조회합니다.
   * @param {Object} [params] - 조회 필터 파라미터 ({ owner?: string, is_active?: boolean })
   * @returns {Promise<Array>} 결제수단 배열
   */
  async getPaymentMethods(params) {
    return apiClient.get('/api/expenses/payment-methods', params);
  },

  /**
   * 신규 결제수단을 등록합니다.
   * @param {Object} data - 등록할 결제수단 정보
   * @returns {Promise<Object>} 생성된 결제수단 객체
   */
  async createPaymentMethod(data) {
    return apiClient.post('/api/expenses/payment-methods', data);
  },

  /**
   * 기존 결제수단 정보를 수정합니다.
   * @param {number} id - 결제수단 ID
   * @param {Object} data - 수정할 결제수단 정보
   * @returns {Promise<Object>} 수정된 결제수단 객체
   */
  async updatePaymentMethod(id, data) {
    return apiClient.put(`/api/expenses/payment-methods/${id}`, data);
  },

  /**
   * 결제수단을 삭제합니다.
   * @param {number} id - 결제수단 ID
   * @returns {Promise<null>}
   */
  async deletePaymentMethod(id) {
    return apiClient.delete(`/api/expenses/payment-methods/${id}`);
  },

  /**
   * 지출 카테고리 목록을 조회합니다.
   * @returns {Promise<Array>} 카테고리 배열
   */
  async getCategories() {
    return apiClient.get('/api/expenses/categories');
  },

  /**
   * 신규 지출 카테고리를 등록합니다.
   * @param {Object} data - 등록할 카테고리 정보 ({ name: string, color: string })
   * @returns {Promise<Object>} 생성된 카테고리 객체
   */
  async createCategory(data) {
    return apiClient.post('/api/expenses/categories', data);
  },

  /**
   * 기존 지출 카테고리를 수정합니다.
   * @param {number} id - 카테고리 ID
   * @param {Object} data - 수정할 카테고리 정보
   * @returns {Promise<Object>} 수정된 카테고리 객체
   */
  async updateCategory(id, data) {
    return apiClient.put(`/api/expenses/categories/${id}`, data);
  },

  /**
   * 지출 카테고리를 삭제합니다.
   * @param {number} id - 카테고리 ID
   * @returns {Promise<null>}
   */
  async deleteCategory(id) {
    return apiClient.delete(`/api/expenses/categories/${id}`);
  },

  /**
   * 2차 카테고리(특성/태그) 목록을 조회합니다. (2차 카테고리 폐지에 따른 호환용)
   * @deprecated 단일 카테고리 마스터로 통합됨
   * @returns {Promise<Array>} 빈 배열
   */
  async getSubCategories() {
    return [];
  },

  /**
   * 명세서 파일을 업로드하여 거래 미리보기 데이터를 조회합니다.
   * @param {File} file - 업로드할 명세서 파일
   * @param {string} [password] - 복호화 비밀번호
   * @param {number} [paymentMethodId] - 결제수단 ID
   * @returns {Promise<Object>} 파싱된 거래 및 결제수단 미리보기 정보
   */
  async uploadPreview(file, password, paymentMethodId) {
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }
    if (paymentMethodId !== undefined && paymentMethodId !== null) {
      formData.append('payment_method_id', String(paymentMethodId));
    }
    return apiClient.post('/api/expenses/upload-preview', formData);
  },

  /**
   * 검토 완료된 지출 거래 목록을 확정 적재(덮어쓰기)합니다.
   * @param {Object} data - 확정 적재 페이로드 ({ payment_method_id, year_month, source_file, items })
   * @returns {Promise<Object>} 커밋 결과 정보
   */
  async commitExpenses(data) {
    return apiClient.post('/api/expenses/commit', data);
  },

  /**
   * 지출 거래 목록을 조회합니다.
   * @param {Object} [params] - 필터 파라미터 ({ year_month, owner, category_id, institution, is_excluded, search })
   * @returns {Promise<Array>} 지출 내역 목록
   */
  async getExpenses(params) {
    return apiClient.get('/api/expenses', params);
  },

  /**
   * 지출 대시보드 통계(당월 총액, MoM, 추이, 카테고리/결제수단 비중)를 조회합니다.
   * @param {Object} [params] - 필터 파라미터 ({ year_month, owner })
   * @returns {Promise<Object>} 지출 통계 객체
   */
  async getStats(params) {
    return apiClient.get('/api/expenses/stats', params);
  },

  /**
   * 단일 지출 내역을 수정합니다.
   * @param {number} id - 지출 거래 ID
   * @param {Object} data - 수정할 필드 객체
   * @returns {Promise<Object>} 수정된 거래 객체
   */
  async updateExpense(id, data) {
    return apiClient.patch(`/api/expenses/${id}`, data);
  },

  /**
   * 단일 지출 내역을 삭제합니다.
   * @param {number} id - 지출 거래 ID
   * @returns {Promise<null>}
   */
  async deleteExpense(id) {
    return apiClient.delete(`/api/expenses/${id}`);
  },
};

