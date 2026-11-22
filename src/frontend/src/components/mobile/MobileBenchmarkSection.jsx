import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { RefreshCw, AlertCircle } from 'lucide-react';
import MobileMddSummaryCard from './MobileMddSummaryCard';
import MobileAlphaCardList from './MobileAlphaCardList';

export const BENCHMARK_PERIODS = [
  { value: 'YTD', label: 'YTD', testId: 'benchmark-period-ytd' },
  { value: '1M', label: '1M', testId: 'benchmark-period-1m' },
  { value: '3M', label: '3M', testId: 'benchmark-period-3m' },
  { value: '1Y', label: '1Y', testId: 'benchmark-period-1y' },
];

export const SERIES_META = [
  { key: '내 포트폴리오', label: '내 포트폴리오', color: '#3182F6', strokeWidth: 2.5, isPortfolio: true },
  { key: 'S&P 500', label: 'S&P 500', color: '#00A870', strokeWidth: 1.5 },
  { key: 'NASDAQ', label: 'NASDAQ', color: '#6366F1', strokeWidth: 1.5 },
  { key: 'KOSPI', label: 'KOSPI', color: '#F04452', strokeWidth: 1.5 },
  { key: 'KOSDAQ', label: 'KOSDAQ', color: '#F59E0B', strokeWidth: 1.5 },
];

function calculateMddFromReturns(returns) {
  if (!returns || !Array.isArray(returns) || returns.length === 0) return 0.0;
  let peak = 100.0;
  let maxMdd = 0.0;

  for (const r of returns) {
    if (r === null || r === undefined || isNaN(r)) continue;
    const price = 100.0 + Number(r);
    if (price > peak) {
      peak = price;
    }
    const dd = peak > 0 ? ((price - peak) / peak) * 100.0 : 0.0;
    if (dd < maxMdd) {
      maxMdd = dd;
    }
  }
  return Math.round(maxMdd * 100) / 100;
}

/**
 * 모바일 포트폴리오 비교 섹션 컴포넌트 (클린 라이트 톤)
 */
export default function MobileBenchmarkSection({ isMasked, refreshTrigger = 0 }) {
  const [period, setPeriod] = useState('YTD');
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [portfolioPerf, setPortfolioPerf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeSeries, setActiveSeries] = useState({
    '내 포트폴리오': true,
    'S&P 500': true,
    'NASDAQ': true,
    'KOSPI': true,
    'KOSDAQ': true,
  });

  const fetchData = useCallback(
    async (isCancelledCheck = () => false) => {
      setLoading(true);
      setError(null);

      try {
        const fetchBenchmark = async () => {
          try {
            const res = await fetch(`/api/market/benchmark?period=${period}`);
            if (res.ok) return await res.json();
          } catch {
            // fallback
          }
          const resFallback = await fetch(`/api/benchmark?period=${period}`);
          if (!resFallback.ok) {
            throw new Error('벤치마크 데이터를 가져오는데 실패했습니다.');
          }
          return await resFallback.json();
        };

        const fetchPortfolioPerf = async () => {
          try {
            const res = await fetch(`/api/v1/performance/portfolio?period=${period}`);
            if (res.ok) return await res.json();
          } catch {
            // 실패 시 null 반환
          }
          return null;
        };

        const [benchRes, portPerfRes] = await Promise.all([
          fetchBenchmark(),
          fetchPortfolioPerf(),
        ]);

        if (!isCancelledCheck()) {
          setBenchmarkData(benchRes);
          setPortfolioPerf(portPerfRes);
        }
      } catch (err) {
        if (!isCancelledCheck()) {
          setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!isCancelledCheck()) {
          setLoading(false);
        }
      }
    },
    [period]
  );

  useEffect(() => {
    let isCancelled = false;
    fetchData(() => isCancelled);
    return () => {
      isCancelled = true;
    };
  }, [fetchData, refreshTrigger]);

  const handleToggleSeries = (seriesKey) => {
    setActiveSeries((prev) => ({
      ...prev,
      [seriesKey]: !prev[seriesKey],
    }));
  };

  const chartData = useMemo(() => {
    if (!benchmarkData?.chart?.labels || !benchmarkData?.chart?.datasets) {
      return [];
    }

    const { labels, datasets } = benchmarkData.chart;
    return labels.map((label, idx) => {
      const row = { date: label };
      datasets.forEach((ds) => {
        if (ds && ds.label) {
          row[ds.label] = ds.data?.[idx] !== undefined ? ds.data[idx] : null;
        }
      });
      return row;
    });
  }, [benchmarkData]);

  const indicesMdd = useMemo(() => {
    const result = {
      'S&P 500': null,
      'NASDAQ': null,
      'KOSPI': null,
      'KOSDAQ': null,
    };

    if (!benchmarkData) return result;

    if (benchmarkData.indices) {
      Object.values(benchmarkData.indices).forEach((idxItem) => {
        if (idxItem && idxItem.name && idxItem.mdd !== undefined) {
          result[idxItem.name] = idxItem.mdd;
        }
      });
    }

    if (benchmarkData.chart?.datasets) {
      benchmarkData.chart.datasets.forEach((ds) => {
        if (ds && ds.label && ds.label !== '내 포트폴리오') {
          const matchedKey = Object.keys(result).find(
            (k) => k.toLowerCase() === ds.label.toLowerCase()
          );
          if (matchedKey && result[matchedKey] === null && Array.isArray(ds.data)) {
            result[matchedKey] = calculateMddFromReturns(ds.data);
          }
        }
      });
    }

    return result;
  }, [benchmarkData]);

  const portfolioReturn = useMemo(() => {
    if (benchmarkData?.portfolio?.ytd_return !== undefined) {
      return benchmarkData.portfolio.ytd_return;
    }
    return null;
  }, [benchmarkData]);

  const portfolioMdd = useMemo(() => {
    if (portfolioPerf?.mdd !== undefined && portfolioPerf?.mdd !== null) {
      return portfolioPerf.mdd;
    }
    if (portfolioPerf?.max_mdd !== undefined && portfolioPerf?.max_mdd !== null) {
      return portfolioPerf.max_mdd;
    }
    const portfolioDs = benchmarkData?.chart?.datasets?.find(
      (ds) => ds.label === '내 포트폴리오'
    );
    if (portfolioDs?.data) {
      return calculateMddFromReturns(portfolioDs.data);
    }
    return null;
  }, [portfolioPerf, benchmarkData]);

  return (
    <div className="space-y-3">
      {/* 1. 기간 선택기 (YTD, 1M, 3M, 1Y) */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-[#6B7684]">비교 기간</span>
        <div
          role="group"
          aria-label="벤치마크 조회 기간"
          className="inline-flex p-1 bg-[#E5E8EB]/70 rounded-xl gap-0.5"
        >
          {BENCHMARK_PERIODS.map((p) => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                type="button"
                data-testid={p.testId}
                aria-pressed={isActive}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-[#191F28] font-semibold shadow-xs'
                    : 'text-[#6B7684] hover:text-[#191F28] font-medium'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 로딩 표시 */}
      {loading && (
        <div className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 text-[#8B95A1]">
          <RefreshCw className="w-5 h-5 animate-spin text-[#3182F6]" />
          <span className="text-xs font-medium">벤치마크 데이터를 분석하는 중...</span>
        </div>
      )}

      {/* 에러 표시 */}
      {!loading && error && (
        <div className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 text-center space-y-2.5">
          <AlertCircle className="w-5 h-5 text-[#F04452] mx-auto" />
          <p className="text-xs font-semibold text-[#F04452]">{error}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#3182F6] hover:bg-[#1B64DA] text-white text-xs font-semibold rounded-xl transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 정상 렌더링 영역 */}
      {!loading && !error && (
        <>
          {/* 2. 상단 포트폴리오 & 4대 지수 MDD 요약 카드 */}
          <MobileMddSummaryCard
            portfolioReturn={portfolioReturn}
            portfolioMdd={portfolioMdd}
            indicesMdd={indicesMdd}
            isMasked={isMasked}
          />

          {/* 3. 누적 수익률(%) 비교 선 차트 카드 */}
          <section
            data-testid="benchmark-chart-container"
            className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#191F28]">누적 수익률 비교</h2>
              <span className="text-[11px] text-[#8B95A1] font-medium">기준일 0% 정규화</span>
            </div>

            {/* 범례 칩 목록 (클릭 시 토글) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {SERIES_META.map((series) => {
                const isActive = !!activeSeries[series.key];
                return (
                  <button
                    key={series.key}
                    type="button"
                    data-testid={`legend-chip-${series.key}`}
                    aria-pressed={isActive}
                    onClick={() => handleToggleSeries(series.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                      isActive
                        ? 'bg-[#F9FAFB] text-[#191F28] border-[#E5E8EB]'
                        : 'bg-white text-[#8B95A1] border-[#F2F4F6] line-through opacity-50'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isActive ? series.color : '#CBD5E1',
                      }}
                    />
                    <span>{series.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Recharts LineChart */}
            <div className="h-56 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#8B95A1"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (!val) return '';
                      const parts = String(val).split('-');
                      return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : val;
                    }}
                  />
                  <YAxis
                    stroke="#8B95A1"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Number(val).toFixed(0)}%`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#E5E8EB',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#191F28',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    }}
                    formatter={(val, name) => [
                      `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`,
                      name,
                    ]}
                    labelFormatter={(label) => `일자: ${label}`}
                  />
                  {SERIES_META.map((series) => {
                    if (!activeSeries[series.key]) return null;
                    return (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        stroke={series.color}
                        strokeWidth={series.strokeWidth}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls={true}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 4. 알파 초과수익률 리스트 및 상세 표 토글 */}
          <MobileAlphaCardList
            alphaAnalysis={benchmarkData?.alpha_analysis}
            indices={benchmarkData?.indices}
            indicesMdd={indicesMdd}
            portfolioReturn={portfolioReturn}
            isMasked={isMasked}
          />
        </>
      )}
    </div>
  );
}
