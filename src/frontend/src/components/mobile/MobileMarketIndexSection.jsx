import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, AlertCircle, RefreshCw, Activity, ShieldAlert } from 'lucide-react';
import MobileMarketExtremeStatsCards from './MobileMarketExtremeStatsCards';

// 4대 대표 시장 지수 정의
export const INDICES = [
  { ticker: '^GSPC', name: 'S&P 500', region: 'US', color: '#3b82f6' },
  { ticker: '^IXIC', name: 'NASDAQ', region: 'US', color: '#8b5cf6' },
  { ticker: '^KS11', name: 'KOSPI', region: 'KR', color: '#10b981' },
  { ticker: '^KQ11', name: 'KOSDAQ', region: 'KR', color: '#f59e0b' },
];

// 기간 필터 정의
export const PERIODS = [
  { value: '1Y', label: '1년' },
  { value: '3Y', label: '3년' },
  { value: '5Y', label: '5년' },
  { value: '10Y', label: '10년' },
  { value: 'ALL', label: '전체' },
];

/**
 * VIX 지수 수치에 따라 4단계 리스크 상태를 산출합니다.
 * (안정 <20, 주의 20~25, 경고 25~30, 위기 >=30)
 *
 * @param {number|null|undefined} vix - VIX 변동성 지수 값
 * @returns {{ level: string, label: string, badgeClass: string, color: string, description: string } | null}
 */
export function getVixStatus(vix) {
  if (vix === null || vix === undefined || isNaN(vix)) return null;

  if (vix < 20) {
    return {
      level: 'stable',
      label: '안정',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      color: '#10b981',
      description: '시장 심리 안정 국면',
    };
  }
  if (vix < 25) {
    return {
      level: 'caution',
      label: '주의',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      color: '#f59e0b',
      description: '단기 변동성 확대 주의',
    };
  }
  if (vix < 30) {
    return {
      level: 'warning',
      label: '경고',
      badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      color: '#f97316',
      description: '시장 불안 및 경고 국면',
    };
  }
  return {
    level: 'crisis',
    label: '위기',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    color: '#ef4444',
    description: '극단적 공포/위기 국면',
  };
}

/**
 * 선택된 기간 문자열을 바탕으로 시작일과 종료일을 계산합니다.
 *
 * @param {string} period - 1Y | 3Y | 5Y | 10Y | ALL
 * @returns {{ start_date: string, end_date: string }}
 */
export function calculateDateRange(period) {
  const today = new Date();
  const endStr = today.toISOString().split('T')[0];
  let startStr = '2020-01-01';

  if (period === '1Y') {
    today.setFullYear(today.getFullYear() - 1);
    startStr = today.toISOString().split('T')[0];
  } else if (period === '3Y') {
    today.setFullYear(today.getFullYear() - 3);
    startStr = today.toISOString().split('T')[0];
  } else if (period === '5Y') {
    today.setFullYear(today.getFullYear() - 5);
    startStr = today.toISOString().split('T')[0];
  } else if (period === '10Y') {
    today.setFullYear(today.getFullYear() - 10);
    startStr = today.toISOString().split('T')[0];
  } else if (period === 'ALL') {
    startStr = '1989-01-01';
  }

  return { start_date: startStr, end_date: endStr };
}

/**
 * 모바일 최적화 통합 동기화 툴팁
 */
function MobileIntegratedTooltip({ active, payload, label, activeIndexInfo, chartData }) {
  if (!active || !label) return null;
  // payload[0]?.payload에서 $O(1)로 호버된 데이터 포인트 우선 획득
  const currentPoint = payload?.[0]?.payload || chartData?.find((d) => d.date === label) || {};
  const priceVal = currentPoint.value;
  const mddVal = currentPoint.mdd;
  const vixVal = currentPoint.vix;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-xl text-white text-[11px] min-w-[170px] z-50">
      <div className="font-bold text-slate-400 mb-1.5 border-b border-slate-800 pb-1 flex items-center justify-between text-[10px]">
        <span>{label}</span>
        <span className="text-slate-500">동기화</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300 font-medium truncate">{activeIndexInfo?.name || '지수'}:</span>
          <span className="font-bold text-white font-mono">
            {priceVal !== undefined && priceVal !== null ? `${Number(priceVal).toLocaleString()} pt` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-rose-400 font-medium">MDD:</span>
          <span className="font-bold text-rose-400 font-mono">
            {mddVal !== undefined && mddVal !== null ? `${Number(mddVal).toFixed(2)}%` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-purple-400 font-medium">VIX:</span>
          <span className="font-bold text-purple-300 font-mono">
            {vixVal !== undefined && vixVal !== null ? `${Number(vixVal).toFixed(2)} pt` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 모바일 시장 지수 분석 섹션 컴포넌트
 *
 * 1. 상단 4대 지수 칩 (S&P 500, NASDAQ, KOSPI, KOSDAQ) 가로 스크롤/선택기 (현재가 & 전일 대비 등락률)
 * 2. 기간 필터 (1Y, 3Y, 5Y, 10Y, ALL)
 * 3. VIX 상태 요약 카드 (현재 VIX 수치 및 4단계 리스크 배지)
 * 4. 단일 카드 내 3단 밀착 동기화 차트 (1단 종가 pt, 2단 MDD %, 3단 VIX 및 주의 20 / 경고 30 기준선)
 * 5. 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 분석 카드
 */
export default function MobileMarketIndexSection() {
  const [selectedTicker, setSelectedTicker] = useState('^GSPC');
  const [selectedPeriod, setSelectedPeriod] = useState('3Y');
  const [historicalData, setHistoricalData] = useState(null);
  const [indicesPrices, setIndicesPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeIndexInfo = useMemo(() => {
    return INDICES.find((idx) => idx.ticker === selectedTicker) || INDICES[0];
  }, [selectedTicker]);

  // 1. 4대 지수 실시간/최근 시세 요약 로드
  const fetchIndicesPrices = useCallback(async () => {
    try {
      const [krResult, usResult] = await Promise.allSettled([
        fetch('/api/market/indices?country=KR'),
        fetch('/api/market/indices?country=US'),
      ]);

      const priceMap = {};
      if (krResult.status === 'fulfilled' && krResult.value?.ok) {
        const krData = await krResult.value.json();
        (Array.isArray(krData) ? krData : []).forEach((item) => {
          if (item && item.index_name) {
            priceMap[item.index_name] = {
              current_price: item.current_price,
              change_rate: item.change_rate,
            };
          }
        });
      }

      if (usResult.status === 'fulfilled' && usResult.value?.ok) {
        const usData = await usResult.value.json();
        (Array.isArray(usData) ? usData : []).forEach((item) => {
          if (item && item.index_name) {
            priceMap[item.index_name] = {
              current_price: item.current_price,
              change_rate: item.change_rate,
            };
          }
        });
      }

      setIndicesPrices(priceMap);
    } catch (err) {
      console.warn('지수 시세 요약 패칭 실패:', err);
    }
  }, []);

  // 2. 선택된 지수 및 기간의 역사적 시계열 데이터 로드
  const fetchHistoricalData = useCallback(async (isCancelledCheck = () => false) => {
    setLoading(true);
    setError(null);
    try {
      const { start_date, end_date } = calculateDateRange(selectedPeriod);
      const res = await fetch(
        `/api/market/analysis/historical?ticker=${encodeURIComponent(selectedTicker)}&start_date=${start_date}&end_date=${end_date}`
      );

      if (!res.ok) {
        throw new Error('지수 시계열 데이터를 가져오는데 실패했습니다.');
      }

      const data = await res.json();
      if (!isCancelledCheck()) {
        setHistoricalData(data);
      }
    } catch (err) {
      if (!isCancelledCheck()) {
        console.error(err);
        setError(err.message || '데이터 로딩 오류가 발생했습니다.');
      }
    } finally {
      if (!isCancelledCheck()) {
        setLoading(false);
      }
    }
  }, [selectedTicker, selectedPeriod]);

  useEffect(() => {
    fetchIndicesPrices();
  }, [fetchIndicesPrices]);

  useEffect(() => {
    let cancelled = false;
    fetchHistoricalData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchHistoricalData]);

  // 차트 데이터셋 가공
  const chartData = useMemo(() => {
    if (!historicalData || !historicalData.labels) return [];
    return historicalData.labels.map((label, idx) => ({
      date: label,
      value: historicalData.prices ? historicalData.prices[idx] : null,
      mdd: historicalData.mdd ? historicalData.mdd[idx] : null,
      vix: historicalData.vix ? historicalData.vix[idx] : null,
    }));
  }, [historicalData]);

  // 최근 VIX 값 계산
  const latestVix = useMemo(() => {
    if (!historicalData?.vix || historicalData.vix.length === 0) return null;
    const valid = historicalData.vix.filter((v) => v !== null && v !== undefined && !isNaN(v));
    return valid.length > 0 ? valid[valid.length - 1] : null;
  }, [historicalData]);

  const vixStatus = useMemo(() => getVixStatus(latestVix), [latestVix]);

  // 에러 발생 시 UI
  if (error && !loading) {
    return (
      <div
        data-testid="market-index-error"
        className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 text-center space-y-3 my-2"
      >
        <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-white">데이터 로드 실패</h3>
        <p className="text-xs text-rose-400 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={fetchHistoricalData}
          className="mt-2 py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. 4대 지수 가로 스크롤 칩 선택기 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
        {INDICES.map((idx) => {
          const isSelected = selectedTicker === idx.ticker;
          const priceInfo = indicesPrices[idx.name] || (
            isSelected && chartData.length > 0
              ? {
                  current_price: chartData[chartData.length - 1].value,
                  change_rate:
                    chartData.length > 1
                      ? ((chartData[chartData.length - 1].value - chartData[chartData.length - 2].value) /
                          chartData[chartData.length - 2].value) *
                        100
                      : 0,
                }
              : null
          );

          const changeRate = priceInfo?.change_rate;
          const isUp = changeRate > 0;
          const isDown = changeRate < 0;

          return (
            <button
              key={idx.ticker}
              type="button"
              data-testid={`index-chip-${idx.ticker}`}
              aria-pressed={isSelected}
              aria-label={`${idx.name} 지수 선택, 현재가 ${priceInfo?.current_price ?? '정보 없음'}`}
              onClick={() => setSelectedTicker(idx.ticker)}
              className={`flex-shrink-0 px-3 py-2 rounded-2xl text-left transition-all border min-w-[115px] ${
                isSelected
                  ? 'bg-slate-800 border-sky-500 shadow-md shadow-sky-500/10'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-xs font-bold text-slate-200 truncate">{idx.name}</span>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: idx.color }}
                />
              </div>

              <div className="flex items-baseline justify-between gap-1.5 mt-1">
                <span className="text-xs font-extrabold text-white font-mono">
                  {priceInfo?.current_price !== undefined && priceInfo?.current_price !== null
                    ? Number(priceInfo.current_price).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : '-'}
                </span>

                <span
                  className={`text-[10px] font-bold font-mono ${
                    isUp ? 'text-rose-400' : isDown ? 'text-sky-400' : 'text-slate-400'
                  }`}
                >
                  {changeRate !== undefined && changeRate !== null
                    ? `${isUp ? '+' : ''}${Number(changeRate).toFixed(2)}%`
                    : '-'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. 상단 VIX 상태 요약 카드 & 기간 필터 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* VIX 상태 카드 */}
        <div
          data-testid="vix-summary-card"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">VIX 공포지수</span>
                {vixStatus && (
                  <span
                    data-testid="vix-risk-badge"
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${vixStatus.badgeClass}`}
                  >
                    {vixStatus.label}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {vixStatus?.description || '변동성 데이터 산출 중'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span
              data-testid="vix-latest-value"
              className="text-base font-black text-purple-300 font-mono tracking-tight"
            >
              {latestVix !== null && latestVix !== undefined ? Number(latestVix).toFixed(2) : '-'}
            </span>
            <span className="text-[10px] text-slate-500 ml-0.5">pt</span>
          </div>
        </div>

        {/* 기간 필터 버튼 그룹 */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-inner items-center justify-between">
          {PERIODS.map((p) => {
            const isSelected = selectedPeriod === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedPeriod(p.value)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all text-center ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 단일 카드 내 데스크탑형 3단 밀착 동기화 차트 */}
      <div
        data-testid="mobile-stacked-chart-card"
        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-2 relative"
      >
        {loading && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm rounded-3xl z-20 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
            <span className="text-xs text-slate-300 font-medium">차트 갱신 중...</span>
          </div>
        )}

        {/* 차트 헤더 */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: activeIndexInfo.color }}
            />
            <h2 className="text-xs font-extrabold text-white">
              {activeIndexInfo.name} <span className="text-slate-400 font-normal">3단 분석</span>
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">동기화 연동</span>
        </div>

        {/* [1단] 지수 종가 (Price pt, Area/Line, 높이 약 96px, Y축 분리) */}
        <div data-testid="chart-tier-price" className="space-y-1">
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-300">지수 종가</span>
            <span className="font-mono">단위: pt</span>
          </div>
          <div className="h-[96px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} syncId="mobileMarketChart">
                <defs>
                  <linearGradient id="mobilePriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeIndexInfo.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={activeIndexInfo.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} height={1} />
                <YAxis
                  orientation="right"
                  stroke="#64748b"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  domain={['dataMin - 10', 'dataMax + 10']}
                  tickFormatter={(val) => Math.round(val).toLocaleString()}
                />
                <Tooltip
                  content={
                    <MobileIntegratedTooltip
                      activeIndexInfo={activeIndexInfo}
                      chartData={chartData}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={activeIndexInfo.color}
                  strokeWidth={2}
                  fill="url(#mobilePriceGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: activeIndexInfo.color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* [2단] 최대 낙폭 (MDD %, Area Underwater 0% 하향, 높이 약 56px, Y축 분리) */}
        <div data-testid="chart-tier-mdd" className="space-y-1 pt-1 border-t border-slate-800/60">
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
            <span className="font-semibold text-rose-400">최대 낙폭 (MDD)</span>
            <span className="font-mono">단위: %</span>
          </div>
          <div className="h-[56px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} syncId="mobileMarketChart">
                <defs>
                  <linearGradient id="mobileMddGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} height={1} />
                <YAxis
                  orientation="right"
                  stroke="#64748b"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  domain={['dataMin - 2', 0]}
                  tickFormatter={(val) => `${Math.round(val)}%`}
                />
                <Tooltip
                  content={
                    <MobileIntegratedTooltip
                      activeIndexInfo={activeIndexInfo}
                      chartData={chartData}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="mdd"
                  stroke="#f43f5e"
                  strokeWidth={1.8}
                  fill="url(#mobileMddGradient)"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: '#f43f5e' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* [3단] VIX 변동성 (pt, Line, 높이 약 50px, Y축 분리, 하단 공통 X축) */}
        <div data-testid="chart-tier-vix" className="space-y-1 pt-1 border-t border-slate-800/60">
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
            <span className="font-semibold text-purple-400">VIX 변동성 (S&amp;P 500)</span>
            <span className="font-mono">단위: pt</span>
          </div>
          <div className="h-[68px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} syncId="mobileMarketChart">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  dy={4}
                  tickFormatter={(str) => (str ? str.slice(2, 7) : '')}
                />
                <YAxis
                  orientation="right"
                  stroke="#64748b"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  domain={[0, (max) => Math.max(45, Math.ceil(max + 2))]}
                  tickFormatter={(val) => Math.round(val).toString()}
                />
                <Tooltip
                  content={
                    <MobileIntegratedTooltip
                      activeIndexInfo={activeIndexInfo}
                      chartData={chartData}
                    />
                  }
                />
                {/* VIX 주의(20) 및 경고(30) 기준선 */}
                <ReferenceLine
                  y={20}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{
                    value: '주의 20',
                    position: 'insideTopRight',
                    fill: '#f59e0b',
                    fontSize: 9,
                    fontWeight: 'bold',
                  }}
                />
                <ReferenceLine
                  y={30}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{
                    value: '경고 30',
                    position: 'insideTopRight',
                    fill: '#ef4444',
                    fontSize: 9,
                    fontWeight: 'bold',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="vix"
                  stroke="#c084fc"
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: '#c084fc' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 분석 카드 */}
      <MobileMarketExtremeStatsCards chartData={chartData} />
    </div>
  );
}
