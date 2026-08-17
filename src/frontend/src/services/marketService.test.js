import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketService } from './marketService';
import { apiClient } from './apiClient';

describe('marketService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getBenchmark: 벤치마크 통합 데이터를 조회한다', async () => {
    const mockBenchmark = { portfolio: { ytd_return: 10.5 }, indices: {} };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockBenchmark);

    const result = await marketService.getBenchmark({ period: 'YTD', force_update: false });

    expect(getSpy).toHaveBeenCalledWith('/api/benchmark', { period: 'YTD', force_update: false });
    expect(result).toEqual(mockBenchmark);
  });

  it('getHistoricalBenchmark: 특정 종목의 과거 정규화 수익률 시계열을 조회한다', async () => {
    const mockHistorical = { labels: ['2026-01-01'], data: [0.0] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockHistorical);

    const result = await marketService.getHistoricalBenchmark('005930', '1M');

    expect(getSpy).toHaveBeenCalledWith('/api/benchmark/historical', { ticker: '005930', period: '1M' });
    expect(result).toEqual(mockHistorical);
  });

  it('getExchangeRates: 환율 히스토리를 조회한다', async () => {
    const mockRates = [{ currency: 'USD', rate: 1350 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockRates);

    const result = await marketService.getExchangeRates(30);

    expect(getSpy).toHaveBeenCalledWith('/api/exchange/rates', { limit: 30 });
    expect(result).toEqual(mockRates);
  });

  it('getMarketAnalysisHistorical: 종목 시세 히스토리를 조회한다', async () => {
    const mockAnalysisHist = { dates: ['2026-08-01'], prices: [70000] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockAnalysisHist);

    const result = await marketService.getMarketAnalysisHistorical({ ticker: '005930', period: '1Y' });

    expect(getSpy).toHaveBeenCalledWith('/api/market/analysis/historical', { ticker: '005930', period: '1Y' });
    expect(result).toEqual(mockAnalysisHist);
  });

  it('getMarketAnalysisStats: 종목 MDD 및 통계를 조회한다', async () => {
    const mockStats = { mdd: -15.2, cagr: 12.4 };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockStats);

    const result = await marketService.getMarketAnalysisStats({ ticker: '005930', period: '1Y' });

    expect(getSpy).toHaveBeenCalledWith('/api/market/analysis/stats', { ticker: '005930', period: '1Y' });
    expect(result).toEqual(mockStats);
  });

  it('getComparison: 종목과 비교 지수의 수익률 비교 데이터를 조회한다', async () => {
    const mockComp = { dates: ['2026-08-01'], stock_returns: [5.2], index_returns: [3.1] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockComp);

    const result = await marketService.getComparison({ ticker: '005930', compare_index: '^KS11', period: '1Y' });

    expect(getSpy).toHaveBeenCalledWith('/api/market/analysis/comparison', {
      ticker: '005930',
      compare_index: '^KS11',
      period: '1Y',
    });
    expect(result).toEqual(mockComp);
  });

  it('getMarketHistory: 지정한 티커들의 과거 시세 히스토리를 조회한다', async () => {
    const mockHist = { '^KS11': [{ date: '2026-08-01', close_price: 2600 }] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockHist);

    const result = await marketService.getMarketHistory({ tickers: '^KS11', start_date: '2026-01-01', end_date: '2026-08-17' });

    expect(getSpy).toHaveBeenCalledWith('/api/market/history', {
      tickers: '^KS11',
      start_date: '2026-01-01',
      end_date: '2026-08-17',
    });
    expect(result).toEqual(mockHist);
  });
});
