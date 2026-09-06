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
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import MobileMddSummaryCard from './MobileMddSummaryCard';

/**
 * 벤치마크 조회 기간 옵션 정의
 */
export const BENCHMARK_PERIODS = [
  { value: 'YTD', label: 'YTD', testId: 'benchmark-period-ytd' },
  { value: '1M', label: '1M', testId: 'benchmark-period-1m' },
  { value: '3M', label: '3M', testId: 'benchmark-period-3m' },
  { value: '1Y', label: '1Y', testId: 'benchmark-period-1y' },
];

/**
 * 비교 차트 시리즈 메타 정보 (이름, 색상, 두께)
 */
export const SERIES_META = [
  { key: '내 포트폴리오', label: '내 포트폴리오', color: '#38bdf8', strokeWidth: 2.5, isPortfolio: true },
  { key: 'S&P 500', label: 'S&P 500', color: '#34d399', strokeWidth: 1.5 },
  { key: 'NASDAQ', label: 'NASDAQ', color: '#a78bfa', strokeWidth: 1.5 },
  { key: 'KOSPI', label: 'KOSPI', color: '#fb7185', strokeWidth: 1.5 },
  { key: 'KOSDAQ', label: 'KOSDAQ', color: '#f472b6', strokeWidth: 1.5 },
];

/**
 * 누적 수익률(%) 시계열로부터 MDD(최대 낙폭 %)를 계산합니다.
 *
 * @param {number[]} returns - 기준일 0% 기준 누적 수익률(%) 시계열
 * @returns {number} MDD (%)
 */
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
 * 모바일 포트폴리오 비교 섹션 컴포넌트
 *
 * 1. 기간 선택기: YTD, 1M, 3M, 1Y
 * 2. 상단 포트폴리오 & 4대 지수 MDD 요약 카드 (`MobileMddSummaryCard`)
 * 3. 기준일(0%) 정규화 누적 수익률(%) 비교 선 차트 (Recharts)
 * 4. 범례 칩 토글: 시리즈별 라인 표시/숨김
 *
 * @param {object} props
 * @param {boolean} [props.isMasked] - 상단 마스킹 상태
 * @param {number} [props.refreshTrigger] - 부모 새로고침 트리거 키
 * @returns {JSX.Element}
 */
export default function MobileBenchmarkSection({ isMasked, refreshTrigger = 0 }) {
  const [period, setPeriod] = useState('YTD');
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [portfolioPerf, setPortfolioPerf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 차트 시리즈 활성/비활성 토글 상태 (기본값 모두 true)
  const [activeSeries, setActiveSeries] = useState({
    '내 포트폴리오': true,
    'S&P 500': true,
    'NASDAQ': true,
    'KOSPI': true,
    'KOSDAQ': true,
  });

  // 데이터 로드 (벤치마크 통합 API + 포트폴리오 성과 API 병렬 조회)
  const fetchData = useCallback(
    async (isCancelledCheck = () => false) => {
      setLoading(true);
      setError(null);

      try {
        // 1. 벤치마크 데이터 로드 (/api/market/benchmark 우선 시도, 실패 시 /api/benchmark fallback)
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

        // 2. 포트폴리오 성과 데이터 로드 (/api/v1/performance/portfolio)
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

  // 범례 칩 토글 핸들러
  const handleToggleSeries = (seriesKey) => {
    setActiveSeries((prev) => ({
      ...prev,
      [seriesKey]: !prev[seriesKey],
    }));
  };

  // Recharts 형식으로 차트 데이터 가공
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

  // 4대 지수 MDD 맵 추출 (indices 객체 또는 datasets 시계열 직접 연산)
  const indicesMdd = useMemo(() => {
    const result = {
      'S&P 500': null,
      'NASDAQ': null,
      'KOSPI': null,
      'KOSDAQ': null,
    };

    if (!benchmarkData) return result;

    // 1. benchmarkData.indices 객체에서 추출 시도
    if (benchmarkData.indices) {
      Object.values(benchmarkData.indices).forEach((idxItem) => {
        if (idxItem && idxItem.name && idxItem.mdd !== undefined) {
          result[idxItem.name] = idxItem.mdd;
        }
      });
    }

    // 2. 누락된 지수가 있으면 datasets 시계열로부터 MDD 산출
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

  // 포트폴리오 기간 수익률 추출
  const portfolioReturn = useMemo(() => {
    if (benchmarkData?.portfolio?.ytd_return !== undefined) {
      return benchmarkData.portfolio.ytd_return;
    }
    return null;
  }, [benchmarkData]);

  // 포트폴리오 기간 MDD 추출
  const portfolioMdd = useMemo(() => {
    if (portfolioPerf?.mdd !== undefined && portfolioPerf?.mdd !== null) {
      return portfolioPerf.mdd;
    }
    if (portfolioPerf?.max_mdd !== undefined && portfolioPerf?.max_mdd !== null) {
      return portfolioPerf.max_mdd;
    }
    // 포트폴리오 datasets 시계열로부터 직접 계산 fallback
    const portfolioDs = benchmarkData?.chart?.datasets?.find(
      (ds) => ds.label === '내 포트폴리오'
    );
    if (portfolioDs?.data) {
      return calculateMddFromReturns(portfolioDs.data);
    }
    return null;
  }, [portfolioPerf, benchmarkData]);

  return (
    <div className="space-y-4">
      {/* 1. 기간 선택기 (YTD, 1M, 3M, 1Y) */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-300">비교 기간 선택</span>
        <div
          role="group"
          aria-label="벤치마크 조회 기간"
          className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-inner"
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
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                    : 'text-slate-400 hover:text-slate-200'
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
          <span className="text-xs font-medium">벤치마크 데이터를 분석하는 중...</span>
        </div>
      )}

      {/* 에러 표시 */}
      {!loading && error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 text-center space-y-2">
          <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
          <p className="text-xs font-semibold text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors"
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
          <div
            data-testid="benchmark-chart-container"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
          >
            {/* 차트 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold text-slate-200">누적 수익률 비교 추이</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">기준일 0% 정규화</span>
            </div>

            {/* 범례 칩 목록 (클릭 시 토글) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {SERIES_META.map((series) => {
                const isActive = !!activeSeries[series.key];
                return (
                  <button
                    key={series.key}
                    type="button"
                    data-testid={`legend-chip-${series.key}`}
                    aria-pressed={isActive}
                    onClick={() => handleToggleSeries(series.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                      isActive
                        ? 'bg-slate-800 text-slate-100 border-slate-600 shadow-sm'
                        : 'bg-slate-950/40 text-slate-500 border-slate-800 line-through opacity-50'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isActive ? series.color : '#64748b',
                      }}
                    />
                    <span>{series.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Recharts LineChart */}
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
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
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Number(val).toFixed(0)}%`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                      color: '#f8fafc',
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
          </div>
        </>
      )}
    </div>
  );
}
