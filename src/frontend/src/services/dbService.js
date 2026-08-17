/**
 * 원장 데이터베이스 관리(계좌, 사용자, 자산, 거래, 스냅샷) 도메인 서비스 모듈
 */
import { apiClient } from './apiClient';

export const dbService = {
  // --- 사용자(Users) 관리 ---
  /**
   * 전체 사용자 목록을 조회합니다.
   * @returns {Promise<any[]>}
   */
  getUsers() {
    return apiClient.get('/api/db/users');
  },

  // --- 계좌(Accounts) 관리 ---
  /**
   * 전체 계좌 목록을 조회합니다.
   * @returns {Promise<any[]>}
   */
  getAccounts() {
    return apiClient.get('/api/db/accounts');
  },

  /**
   * 새 계좌를 생성합니다.
   * @param {any} data - 계좌 생성 데이터
   * @returns {Promise<any>}
   */
  createAccount(data) {
    return apiClient.post('/api/db/accounts', data);
  },

  /**
   * 기존 계좌 정보를 수정합니다.
   * @param {number|string} accountId - 계좌 ID
   * @param {any} data - 계좌 수정 데이터
   * @returns {Promise<any>}
   */
  updateAccount(accountId, data) {
    return apiClient.put(`/api/db/accounts/${accountId}`, data);
  },

  /**
   * 계좌를 삭제합니다.
   * @param {number|string} accountId - 계좌 ID
   * @returns {Promise<any>}
   */
  deleteAccount(accountId) {
    return apiClient.delete(`/api/db/accounts/${accountId}`);
  },

  // --- 자산 마스터(Assets) 관리 ---
  /**
   * 전체 자산 마스터 목록을 조회합니다.
   * @returns {Promise<any[]>}
   */
  getAssets() {
    return apiClient.get('/api/db/assets');
  },

  /**
   * 자산 대분류 및 중분류 카테고리 목록을 조회합니다.
   * @returns {Promise<Record<string, string[]>>}
   */
  getCategories() {
    return apiClient.get('/api/db/assets/categories');
  },

  /**
   * 티커와 국가를 기반으로 종목 존재 여부를 검증하고 공식명을 반환합니다.
   * @param {{ ticker: string, country: string, major_category: string }} params - 검증 파라미터
   * @returns {Promise<{ name: string }>}
   */
  verifyAsset(params) {
    return apiClient.get('/api/db/assets/verify', params);
  },

  /**
   * 새 자산 마스터를 생성합니다.
   * @param {any} data - 자산 정보
   * @returns {Promise<any>}
   */
  createAsset(data) {
    return apiClient.post('/api/db/assets', data);
  },

  /**
   * 자산 마스터 정보를 수정합니다.
   * @param {number|string} assetId - 자산 ID
   * @param {any} data - 수정 정보
   * @returns {Promise<any>}
   */
  updateAsset(assetId, data) {
    return apiClient.put(`/api/db/assets/${assetId}`, data);
  },

  /**
   * 자산 마스터를 삭제합니다.
   * @param {number|string} assetId - 자산 ID
   * @returns {Promise<any>}
   */
  deleteAsset(assetId) {
    return apiClient.delete(`/api/db/assets/${assetId}`);
  },

  // --- 거래 내역(Transactions) 관리 ---
  /**
   * 거래 내역 목록을 조회합니다.
   * @param {{ start_date?: string, end_date?: string }} [params] - 기간 필터
   * @returns {Promise<any[]>}
   */
  getTransactions(params) {
    return apiClient.get('/api/db/transactions', params);
  },

  /**
   * 특정 계좌의 기간 내 거래 내역 목록을 조회합니다.
   * @param {number|string} accountId - 계좌 ID
   * @param {{ start_date?: string, end_date?: string }} [params] - 기간 필터
   * @returns {Promise<any[]>}
   */
  getPeriodTransactions(accountId, params) {
    return apiClient.get(`/api/db/accounts/${accountId}/transactions/period`, params);
  },

  /**
   * 새 거래 내역을 생성합니다.
   * @param {any} data - 거래 데이터
   * @returns {Promise<any>}
   */
  createTransaction(data) {
    return apiClient.post('/api/db/transactions', data);
  },

  /**
   * 계좌 간 이체 거래(출금/입금 쌍)를 생성합니다.
   * @param {any} data - 이체 요청 데이터
   * @returns {Promise<any[]>}
   */
  transfer(data) {
    return apiClient.post('/api/db/transactions/transfer', data);
  },

  /**
   * 거래 내역을 수정합니다.
   * @param {number|string} transactionId - 거래 ID
   * @param {any} data - 수정 데이터
   * @returns {Promise<any>}
   */
  updateTransaction(transactionId, data) {
    return apiClient.put(`/api/db/transactions/${transactionId}`, data);
  },

  /**
   * 거래 내역을 삭제합니다.
   * @param {number|string} transactionId - 거래 ID
   * @returns {Promise<any>}
   */
  deleteTransaction(transactionId) {
    return apiClient.delete(`/api/db/transactions/${transactionId}`);
  },

  // --- 스냅샷(Snapshots) 관리 ---
  /**
   * 전체 스냅샷 목록을 조회합니다.
   * @returns {Promise<any[]>}
   */
  getSnapshots() {
    return apiClient.get('/api/db/snapshots');
  },

  /**
   * 가장 최근 스냅샷 일자를 조회합니다.
   * @returns {Promise<{ latest_date: string | null }>}
   */
  getLatestSnapshotDate() {
    return apiClient.get('/api/db/snapshots/latest');
  },

  /**
   * 지정 날짜의 모든 스냅샷을 삭제합니다.
   * @param {string} date - 삭제할 기준일자 (YYYY-MM-DD)
   * @returns {Promise<{ message: string }>}
   */
  deleteSnapshotByDate(date) {
    return apiClient.delete(`/api/db/snapshots/${date}`);
  },
};
