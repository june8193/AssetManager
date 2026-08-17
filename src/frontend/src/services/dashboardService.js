/**
 * 대시보드 도메인 서비스 모듈
 */
import { apiClient } from './apiClient';

export const dashboardService = {
  /**
   * 대시보드 요약 정보를 조회합니다.
   * @param {boolean} [forceUpdate=false] - 외부 시세 강제 갱신 여부
   * @returns {Promise<any>}
   */
  getSummary(forceUpdate = false) {
    const params = forceUpdate ? { force_update: true } : undefined;
    return apiClient.get('/api/dashboard/summary', params);
  },

  /**
   * 연도별 자산 통계를 조회합니다.
   * @returns {Promise<any[]>}
   */
  getYearly() {
    return apiClient.get('/api/dashboard/yearly');
  },

  /**
   * 일별 자산 통계를 조회합니다.
   * @param {{ start_date?: string, end_date?: string, all?: boolean }} [params] - 조회 필터
   * @returns {Promise<any[]>}
   */
  getDaily(params) {
    return apiClient.get('/api/dashboard/daily', params);
  },

  /**
   * 자산 추이 스냅샷 데이터를 조회합니다.
   * @param {{ start_date?: string, end_date?: string, all?: boolean }} [params] - 조회 필터
   * @returns {Promise<any>}
   */
  getSnapshots(params) {
    return apiClient.get('/api/dashboard/snapshots', params);
  },

  /**
   * 대시보드 시세 정보를 즉시 갱신합니다.
   * @returns {Promise<{ status: string, message: string }>}
   */
  refresh() {
    return apiClient.post('/api/dashboard/refresh');
  },
};
