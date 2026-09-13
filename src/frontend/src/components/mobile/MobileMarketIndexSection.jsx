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

// 단독 차트 서브탭 정의
export const CHART_TABS = [
  {
    id: 'price',
    label: '📈 지수 종가',
    activeColor: 'bg-sky-600',
    title: (indexName) => `${indexName} 종가 추이`,
    unit: '단위: pt',
    bulletColor: (indexColor) => indexColor,
  },
  {
    id: 'mdd',
    label: '📉 낙폭 (MDD)',
    activeColor: 'bg-rose-600',
    title: (indexName) => `${indexName} 최대 낙폭 (MDD)`,
    unit: '단위: % (0% 고점 기준)',
    bulletColor: () => '#f43f5e',
  },
  {
    id: 'vix',
    label: '⚡ VIX 변동성',
    activeColor: 'bg-purple-600',
    title: () => 'VIX 공포지수 변동성 (S&P 500)',
    unit: '단위: pt',
    bulletColor: () => '#c084fc',
  },
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
 * 모바일 차트 상단 고정 통합 초슬림 인스펙터 바 (Slim Inspector Bar)
 *
 * 터치/호버 시 날짜와 [지수 종가 | MDD | VIX] 3대 수치를 차트 상단에 한눈에 노출하며,
 * 활성 탭에 해당하는 수치를 시각적으로 하이라이트합니다.
 * 터치 종료 시 즉시 소멸하여 차트 곡선을 일체 가리지 않습니다.
 */
export function MobileSlimInspectorBar({ hoveredData, activeChartTab }) {
  return (
    <div
      data-testid="slim-inspector-bar"
      className="bg-slate-950/70 border border-slate-800/80 px-3 py-1.5 rounded-xl min-h-[36px] flex items-center justify-between text-xs transition-colors"
    >
      {hoveredData ? (
        <div data-testid="inspector-values" className="flex items-center justify-between w-full">
          {/* 날짜 */}
          <span
            data-testid="inspector-date"
            className="text-slate-400 font-mono text-[10px] font-semibold"
          >
            {hoveredData.date}
          </span>

          {/* 3대 지표 수치 */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            {/* 1. 지수 종가 */}
            <div
              data-testid="inspector-price-group"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                activeChartTab === 'price'
                  ? 'bg-sky-500/20 text-white font-black ring-1 ring-sky-500/40'
                  : 'text-slate-300 opacity-70'
              }`}
            >
              <span className="text-[9px] text-slate-400">지수</span>
              <span data-testid="inspector-price-value" className="font-bold">
                {hoveredData.value !== undefined && hoveredData.value !== null
                  ? `${Number(hoveredData.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} pt`
                  : '-'}
              </span>
            </div>

            <span className="text-slate-700">|</span>

            {/* 2. MDD */}
            <div
              data-testid="inspector-mdd-group"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                activeChartTab === 'mdd'
                  ? 'bg-rose-500/20 text-rose-300 font-black ring-1 ring-rose-500/40'
                  : 'text-rose-400 opacity-70'
              }`}
            >
              <span className="text-[9px] text-rose-400/80">MDD</span>
              <span data-testid="inspector-mdd-value" className="font-bold">
                {hoveredData.mdd !== undefined && hoveredData.mdd !== null
                  ? `${Number(hoveredData.mdd).toFixed(2)}%`
                  : '-'}
              </span>
            </div>

            <span className="text-slate-700">|</span>

            {/* 3. VIX */}
            <div
              data-testid="inspector-vix-group"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                activeChartTab === 'vix'
                  ? 'bg-purple-500/20 text-purple-200 font-black ring-1 ring-purple-500/40'
                  : 'text-purple-400 opacity-70'
              }`}
            >
              <span className="text-[9px] text-purple-400/80">VIX</span>
              <span data-testid="inspector-vix-value" className="font-bold">
                {hoveredData.vix !== undefined && hoveredData.vix !== null
                  ? `${Number(hoveredData.vix).toFixed(2)} pt`
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          data-testid="inspector-placeholder"
          className="flex items-center justify-between w-full text-[10px] text-slate-500"
        >
          <span className="flex items-center gap-1">
            <span>💡</span> 차트를 터치하여 날짜별 지표 탐색
          </span>
          <span className="font-mono text-[9px] text-slate-600">지수 · MDD · VIX 동시 탐색</span>
        </div>
      )}
    </div>
  );
}

/**
 * Recharts Tooltip과 React 상단 인스펙터 바 상태를 동기화하는 브릿지 컴포넌트
 * (곡선을 가리는 기본 170px 팝업 박스를 렌더링하지 않고 null을 반환)
 */
function ChartTooltipSync({ active, payload, onSync }) {
  useEffect(() => {
    if (active && payload && payload.length > 0 && payload[0]?.payload) {
      const nextPoint = payload[0].payload;
      onSync((prev) => (prev?.date === nextPoint.date ? prev : nextPoint));
    }
  }, [active, payload, onSync]);
  return null;
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
  const [activeChartTab, setActiveChartTab] = useState('price'); // 'price' | 'mdd' | 'vix'
  const [hoveredData, setHoveredData] = useState(null);
  const [historicalData, setHistoricalData] = useState(null);
  const [indicesPrices, setIndicesPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInteractionEnd = useCallback(() => {
    setHoveredData(null);
  }, []);

  const handleChartMove = useCallback((state) => {
    if (state && state.activePayload && state.activePayload.length > 0 && state.activePayload[0]?.payload) {
      const nextPoint = state.activePayload[0].payload;
      setHoveredData((prev) => (prev?.date === nextPoint.date ? prev : nextPoint));
    }
  }, []);

  useEffect(() => {
    setHoveredData(null);
  }, [activeChartTab, selectedTicker, selectedPeriod]);

  const activeIndexInfo = useMemo(() => {
    return INDICES.find((idx) => idx.ticker === selectedTicker) || INDICES[0];
  }, [selectedTicker]);

  const currentTabConfig = useMemo(() => {
    return CHART_TABS.find((tab) => tab.id === activeChartTab) || CHART_TABS[0];
  }, [activeChartTab]);

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

      {/* 3. 1화면 1차트 서브탭 스위처 및 대형 단독 뷰 (260px) */}
      <div
        data-testid="mobile-stacked-chart-card"
        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-3 relative"
      >
        {loading && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm rounded-3xl z-20 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
            <span className="text-xs text-slate-300 font-medium">차트 갱신 중...</span>
          </div>
        )}

        {/* 서브탭 스위처: [📈 지수 종가] | [📉 낙폭 (MDD)] | [⚡ VIX 변동성] */}
        <div className="flex bg-slate-950/60 border border-slate-800/80 p-1 rounded-2xl shadow-inner gap-1">
          {CHART_TABS.map((tab) => {
            const isSelected = activeChartTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`chart-tab-${tab.id}`}
                aria-pressed={isSelected}
                onClick={() => setActiveChartTab(tab.id)}
                className={`flex-1 py-1.5 text-xs rounded-xl transition-all flex items-center justify-center gap-1 ${
                  isSelected
                    ? `${tab.activeColor} text-white shadow-sm font-extrabold`
                    : 'text-slate-400 hover:text-slate-200 font-bold'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 차트 헤더: 선택된 서브탭에 따른 동적 타이틀 및 안내 */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: currentTabConfig.bulletColor(activeIndexInfo.color),
              }}
            />
            <h2 className="text-xs font-extrabold text-white">
              {currentTabConfig.title(activeIndexInfo.name)}
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">
              {currentTabConfig.unit}
            </span>
          </div>
          {activeChartTab === 'vix' ? (
            <div data-testid="vix-legend-badges" className="flex items-center gap-1.5">
              <span
                data-testid="vix-legend-badge-caution"
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10 flex items-center gap-1"
              >
                <span className="w-2 h-0.5 bg-amber-400 inline-block border-b border-dashed border-amber-400" />
                주의 20
              </span>
              <span
                data-testid="vix-legend-badge-warning"
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-500/40 text-rose-400 bg-rose-500/10 flex items-center gap-1"
              >
                <span className="w-2 h-0.5 bg-rose-500 inline-block border-b border-dashed border-rose-500" />
                경고 30
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 font-medium">단독 260px 뷰</span>
          )}
        </div>

        {/* [개선된 통합 툴팁: 지수·MDD·VIX 통합 초슬림 인스펙터 바, 손 떼면 즉시 소멸] */}
        <MobileSlimInspectorBar
          hoveredData={hoveredData}
          activeChartTab={activeChartTab}
        />

        {/* [1단] 지수 종가 (Price pt, Area/Line, 높이 260px 대형 단독 뷰) */}
        {activeChartTab === 'price' && (
          <div data-testid="chart-tier-price" className="space-y-1">
            <div
              data-testid="mobile-chart-canvas-container"
              className="h-[260px] w-full touch-none select-none"
              onMouseLeave={handleInteractionEnd}
              onTouchEnd={handleInteractionEnd}
              onTouchCancel={handleInteractionEnd}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  syncId="mobileMarketChart"
                  onMouseMove={handleChartMove}
                  onTouchStart={handleChartMove}
                  onTouchMove={handleChartMove}
                  onMouseLeave={handleInteractionEnd}
                >
                  <defs>
                    <linearGradient id="mobilePriceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeIndexInfo.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={activeIndexInfo.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
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
                    domain={['dataMin - 10', 'dataMax + 10']}
                    tickFormatter={(val) => Math.round(val).toLocaleString()}
                  />
                  <Tooltip
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={<ChartTooltipSync onSync={setHoveredData} />}
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
        )}

        {/* [2단] 최대 낙폭 (MDD %, Area Underwater, 높이 260px 대형 단독 뷰) */}
        {activeChartTab === 'mdd' && (
          <div data-testid="chart-tier-mdd" className="space-y-1">
            <div
              data-testid="mobile-chart-canvas-container"
              className="h-[260px] w-full touch-none select-none"
              onMouseLeave={handleInteractionEnd}
              onTouchEnd={handleInteractionEnd}
              onTouchCancel={handleInteractionEnd}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  syncId="mobileMarketChart"
                  onMouseMove={handleChartMove}
                  onTouchStart={handleChartMove}
                  onTouchMove={handleChartMove}
                  onMouseLeave={handleInteractionEnd}
                >
                  <defs>
                    <linearGradient id="mobileMddGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
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
                    domain={['dataMin - 2', 0]}
                    tickFormatter={(val) => `${Math.round(val)}%`}
                  />
                  <Tooltip
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={<ChartTooltipSync onSync={setHoveredData} />}
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
        )}

        {/* [3단] VIX 변동성 (pt, Line, 높이 260px 대형 단독 뷰) */}
        {activeChartTab === 'vix' && (
          <div data-testid="chart-tier-vix" className="space-y-1">
            <div
              data-testid="mobile-chart-canvas-container"
              className="h-[260px] w-full touch-none select-none"
              onMouseLeave={handleInteractionEnd}
              onTouchEnd={handleInteractionEnd}
              onTouchCancel={handleInteractionEnd}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  syncId="mobileMarketChart"
                  onMouseMove={handleChartMove}
                  onTouchStart={handleChartMove}
                  onTouchMove={handleChartMove}
                  onMouseLeave={handleInteractionEnd}
                >
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
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={<ChartTooltipSync onSync={setHoveredData} />}
                  />
                  {/* VIX 주의(20) 및 경고(30) 기준선 (내부 텍스트 라벨 제거, 깔끔한 파선) */}
                  <ReferenceLine
                    y={20}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    strokeWidth={1.2}
                  />
                  <ReferenceLine
                    y={30}
                    stroke="#ef4444"
                    strokeDasharray="4 3"
                    strokeWidth={1.2}
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
        )}
      </div>

      {/* 4. 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 분석 카드 */}
      <MobileMarketExtremeStatsCards chartData={chartData} />
    </div>
  );
}
