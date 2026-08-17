/**
 * 시장 데이터 및 벤치마크 분석 도메인 서비스 모듈
 */
import { apiClient } from './apiClient';

export const marketService = {
  /**
   * 벤치마크 비교 대시보드 통합 데이터를 조회합니다.
   * @param {{ period?: string, force_update?: boolean }} [params] - 조회 옵션
   * @returns {Promise<any>}
   */
  getBenchmark(params) {
    return apiClient.get('/api/benchmark', params);
  },

  /**
   * 특정 종목의 과거 정규화 수익률 시계열을 조회합니다.
   * @param {string} ticker - 종목/지수 티커
   * @param {string} [period='YTD'] - 조회 기간
   * @returns {Promise<{ labels: string[], data: number[] }>}
   */
  getHistoricalBenchmark(ticker, period = 'YTD') {
    return apiClient.get('/api/benchmark/historical', { ticker, period });
  },

  /**
   * 환율 목록을 조회합니다.
   * @param {number} [limit=30] - 조회 건수
   * @returns {Promise<any[]>}
   */
  getExchangeRates(limit = 30) {
    return apiClient.get('/api/exchange/rates', { limit });
  },

  /**
   * 종목의 과거 시세 및 MDD 시계열 데이터를 조회합니다.
   * @param {{ ticker: string, period?: string, start_date?: string, end_date?: string }} params - 조회 파라미터
   * @returns {Promise<any>}
   */
  getMarketAnalysisHistorical(params) {
    return apiClient.get('/api/market/analysis/historical', params);
  },

  /**
   * 종목의 MDD, 변동성 등 통계 데이터를 조회합니다.
   * @param {{ ticker: string, period?: string, start_date?: string, end_date?: string }} params - 조회 파라미터
   * @returns {Promise<any>}
   */
  getMarketAnalysisStats(params) {
    return apiClient.get('/api/market/analysis/stats', params);
  },

  /**
   * 종목과 비교 지수의 수익률 비교 데이터를 조회합니다.
   * @param {{ ticker: string, compare_index: string, period?: string, start_date?: string, end_date?: string }} params - 조회 파라미터
   * @returns {Promise<any>}
   */
  getComparison(params) {
    return apiClient.get('/api/market/analysis/comparison', params);
  },

  /**
   * 종목/지수들의 과거 가격 히스토리를 조회합니다.
   * @param {{ tickers: string, start_date?: string, end_date?: string }} params - 조회 파라미터
   * @returns {Promise<Record<string, Array<{ date: string, close_price: number }>>>}
   */
  getMarketHistory(params) {
    return apiClient.get('/api/market/history', params);
  },

  /**
   * 주요 시장 지수 목록을 조회합니다.
   * @returns {Promise<any[]>}
   */
  getMarketIndices() {
    return apiClient.get('/api/market/indices');
  },
};
