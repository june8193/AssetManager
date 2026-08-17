/**
 * 자산 배분 비중 및 리밸런싱 도메인 서비스 모듈
 */
import { apiClient } from './apiClient';

export const ratioService = {
  /**
   * 설정된 목표 비중 목록을 조회합니다.
   * @returns {Promise<any[]>}
   */
  getTargets() {
    return apiClient.get('/api/ratios/targets');
  },

  /**
   * 목표 비중 설정을 업데이트합니다.
   * @param {any[]} targets - 업데이트할 목표 비중 목록
   * @returns {Promise<{ message: string }>}
   */
  saveTargets(targets) {
    return apiClient.post('/api/ratios/targets', targets);
  },

  /**
   * 계층형 자산 구조 데이터를 조회합니다.
   * @returns {Promise<any[]>}
   */
  getHierarchy() {
    return apiClient.get('/api/ratios/hierarchy');
  },

  /**
   * 추가 투자금을 반영한 리밸런싱 계산 결과를 조회합니다.
   * @param {number} [additionalCash=0] - 추가 투자금액
   * @returns {Promise<any>}
   */
  getRebalancing(additionalCash = 0) {
    return apiClient.get('/api/ratios/rebalancing', { additional_cash: additionalCash });
  },
};
