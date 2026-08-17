/**
 * 스냅샷 정산, 계산 및 통합 저장 도메인 서비스 모듈
 */
import { apiClient } from './apiClient';

export const snapshotService = {
  /**
   * 입력받은 환율을 적용하여 저장될 스냅샷 데이터를 미리 계산합니다.
   * @param {{ snapshot_date: string, exchange_rate: number }} data - 미리보기 요청 정보
   * @returns {Promise<any[]>}
   */
  preview(data) {
    return apiClient.post('/api/db/snapshots/preview', data);
  },

  /**
   * 확인된 미리보기 데이터를 바탕으로 스냅샷을 실제 DB에 저장합니다.
   * @param {any[]} previews - 스냅샷 미리보기 리스트
   * @returns {Promise<any[]>}
   */
  save(previews) {
    return apiClient.post('/api/db/snapshots/save', previews);
  },

  /**
   * 증권 계좌의 이론상 현금 잔액을 계산하고 입력값과의 차액을 산출합니다.
   * @param {any} data - 증권 정산 요청 데이터
   * @returns {Promise<any>}
   */
  calculateBrokerage(data) {
    return apiClient.post('/api/db/snapshots/brokerage/calculate', data);
  },

  /**
   * 증권 계좌의 입출금, 차액을 저장하고 최종 스냅샷을 생성합니다.
   * @param {any} data - 증권 스냅샷 저장 데이터
   * @returns {Promise<any[]>}
   */
  saveBrokerage(data) {
    return apiClient.post('/api/db/snapshots/brokerage/save', data);
  },

  /**
   * 은행 계좌의 예상 잔액 및 거래 유형별 합계를 계산합니다.
   * @param {any} data - 은행 정산 요청 데이터
   * @returns {Promise<any>}
   */
  calculateBank(data) {
    return apiClient.post('/api/db/snapshots/bank/calculate', data);
  },

  /**
   * 은행 계좌의 입출금, 이자, 세금을 저장하고 최종 스냅샷을 생성합니다.
   * @param {any} data - 은행 스냅샷 저장 데이터
   * @returns {Promise<any[]>}
   */
  saveBank(data) {
    return apiClient.post('/api/db/snapshots/bank/save', data);
  },

  /**
   * 증권 계좌와 은행 계좌의 데이터를 통합하여 단일 트랜잭션으로 저장합니다.
   * @param {any} data - 통합 저장 요청 데이터
   * @returns {Promise<any[]>}
   */
  saveUnified(data) {
    return apiClient.post('/api/db/snapshots/unified/save', data);
  },

  /**
   * 스냅샷 위저드 초기화 데이터(계좌 목록, 최신 스냅샷 일자, 환율 목록)를 병렬 로드합니다.
   * @param {string} [targetDate] - 환율 매칭 대상 기준 일자 (YYYY-MM-DD)
   * @returns {Promise<{ accounts: any[], latestSnapshotDate: string|null, exchangeRates: any[], exchangeRate: string }>}
   */
  async fetchWizardInitData(targetDate) {
    const [accounts, latestSnapshot, exchangeRates] = await Promise.all([
      apiClient.get('/api/db/accounts'),
      apiClient.get('/api/db/snapshots/latest'),
      apiClient.get('/api/exchange/rates', { limit: 100 }),
    ]);

    const latestSnapshotDate = latestSnapshot?.latest_date || null;
    const rates = Array.isArray(exchangeRates) ? exchangeRates : [];

    let exchangeRate = '1300.00';
    if (rates.length > 0) {
      const matched = targetDate ? rates.find((r) => r.date === targetDate) : null;
      if (matched) {
        exchangeRate = matched.rate.toString();
      } else {
        exchangeRate = rates[0].rate.toString();
      }
    }

    return {
      accounts: Array.isArray(accounts) ? accounts : [],
      latestSnapshotDate,
      exchangeRates: rates,
      exchangeRate,
    };
  },

  /**
   * 특정 계좌의 직전 스냅샷 이후 기간 내 거래 내역을 조회합니다.
   * @param {number|string} accountId - 계좌 ID
   * @param {string} startDate - 시작 일자 (직전 스냅샷 일자 등)
   * @param {string} endDate - 종료 일자 (스냅샷 기준 일자)
   * @returns {Promise<any[]>}
   */
  fetchAccountWizardData(accountId, startDate = '1970-01-01', endDate) {
    return apiClient.get(`/api/db/accounts/${accountId}/transactions/period`, {
      start_date: startDate || '1970-01-01',
      end_date: endDate,
    });
  },

  /**
   * 완성된 스냅샷 위저드 DTO 페이로드를 통합 저장합니다.
   * @param {object} payload - buildSnapshotPayload로 조립된 DTO
   * @returns {Promise<any>}
   */
  saveWizardSnapshot(payload) {
    return this.saveUnified(payload);
  },
};
