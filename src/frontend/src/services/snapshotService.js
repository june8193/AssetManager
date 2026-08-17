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
};
