import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { AlertCircle, RefreshCw } from 'lucide-react';
import MobileMarketExtremeStatsCards from './MobileMarketExtremeStatsCards';

// 4대 대표 시장 지수 정의
export const INDICES = [
  { ticker: '^GSPC', name: 'S&P 500', region: 'US', color: '#3182F6' },
  { ticker: '^IXIC', name: 'NASDAQ', region: 'US', color: '#6366F1' },
  { ticker: '^KS11', name: 'KOSPI', region: 'KR', color: '#00A870' },
  { ticker: '^KQ11', name: 'KOSDAQ', region: 'KR', color: '#F59E0B' },
];

// 기간 필터 정의
export const PERIODS = [
  { value: '1Y', label: '1년' },
  { value: '3Y', label: '3년' },
  { value: '5Y', label: '5년' },
  { value: '10Y', label: '10년' },
  { value: 'ALL', label: '전체' },
];

// 단독 차트 서브탭 정의 (이모지 제거)
export const CHART_TABS = [
  {
    id: 'price',
    label: '지수 종가',
    title: (indexName) => `${indexName} 종가 추이`,
    unit: '단위: pt',
    bulletColor: (indexColor) => indexColor,
  },
  {
    id: 'mdd',
    label: '낙폭 (MDD)',
    title: (indexName) => `${indexName} 최대 낙폭 (MDD)`,
    unit: '단위: % (0% 고점 기준)',
    bulletColor: () => '#3182F6',
  },
  {
    id: 'vix',
    label: 'VIX 변동성',
    title: () => 'VIX 공포지수 변동성 (S&P 500)',
    unit: '단위: pt',
    bulletColor: () => '#6366F1',
  },
];

/**
 * VIX 지수 수치에 따라 4단계 리스크 상태를 산출합니다.
 * (안정 <20, 주의 20~25, 경고 25~30, 위기 >=30)
 */
export function getVixStatus(vix) {
  if (vix === null || vix === undefined || isNaN(vix)) return null;

  if (vix < 20) {
    return {
      level: 'stable',
      label: '안정',
      badgeClass: 'bg-[#E8F8F2] text-[#00A870]',
      color: '#00A870',
      description: '시장 심리 안정 국면',
    };
  }
  if (vix < 25) {
    return {
      level: 'caution',
      label: '주의',
      badgeClass: 'bg-[#FFF8E6] text-[#D97706]',
      color: '#D97706',
      description: '단기 변동성 확대 주의',
    };
  }
  if (vix < 30) {
    return {
      level: 'warning',
      label: '경고',
      badgeClass: 'bg-[#FFF4ED] text-[#EA580C]',
      color: '#EA580C',
      description: '시장 불안 및 경고 국면',
    };
  }
  return {
    level: 'crisis',
    label: '위기',
    badgeClass: 'bg-[#FFF0F1] text-[#F04452]',
    color: '#F04452',
    description: '극단적 공포/위기 국면',
  };
}

/**
 * 선택된 기간 문자열을 바탕으로 시작일과 종료일을 계산합니다.
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
 * 모바일 차트 상단 고정 통합 초슬림 인스펙터 바 (클린 라이트 톤)
 */
export function MobileSlimInspectorBar({ hoveredData, activeChartTab }) {
  return (
    <div
      data-testid="slim-inspector-bar"
      className="bg-[#F9FAFB] px-3 py-2 rounded-xl min-h-[36px] flex items-center justify-between text-xs transition-colors"
    >
      {hoveredData ? (
        <div data-testid="inspector-values" className="flex items-center justify-between w-full tabular-nums">
          <span
            data-testid="inspector-date"
            className="text-[#6B7684] text-[10px] font-semibold"
          >
            {hoveredData.date}
          </span>

          <div className="flex items-center gap-1.5 text-[11px]">
            {/* 1. 지수 종가 */}
            <div
              data-testid="inspector-price-group"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all ${
                activeChartTab === 'price'
                  ? 'bg-white text-[#191F28] font-bold shadow-xs'
                  : 'text-[#6B7684] opacity-70'
              }`}
            >
              <span className="text-[9px] text-[#8B95A1]">지수</span>
              <span data-testid="inspector-price-value" className="font-semibold">
                {hoveredData.value !== undefined && hoveredData.value !== null
                  ? `${Number(hoveredData.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} pt`
                  : '-'}
              </span>
            </div>

            <span className="text-[#CBD5E1]">·</span>

            {/* 2. MDD */}
            <div
              data-testid="inspector-mdd-group"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all ${
                activeChartTab === 'mdd'
                  ? 'bg-[#E8F3FF] text-[#3182F6] font-bold'
                  : 'text-[#3182F6] opacity-70'
              }`}
            >
              <span className="text-[9px] opacity-80">MDD</span>
              <span data-testid="inspector-mdd-value" className="font-semibold">
                {hoveredData.mdd !== undefined && hoveredData.mdd !== null
                  ? `${Number(hoveredData.mdd).toFixed(2)}%`
                  : '-'}
              </span>
            </div>

            <span className="text-[#CBD5E1]">·</span>

            {/* 3. VIX */}
            <div
              data-testid="inspector-vix-group"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all ${
                activeChartTab === 'vix'
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-bold'
                  : 'text-[#6366F1] opacity-70'
              }`}
            >
              <span className="text-[9px] opacity-80">VIX</span>
              <span data-testid="inspector-vix-value" className="font-semibold">
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
          className="flex items-center justify-between w-full text-[11px] text-[#8B95A1]"
        >
          <span>차트를 터치하여 날짜별 지표 탐색</span>
          <span className="text-[10px] text-[#B0B8C1]">지수 · MDD · VIX</span>
        </div>
      )}
    </div>
  );
}

function ChartTooltipSync({ active, payload, onSync }) {
  useEffect(() => {
    if (active && payload && payload.length > 0 && payload[0]?.payload) {
      const nextPoint = payload[0].payload;
      onSync(nextPoint);
    } else if (!active) {
      onSync(null);
    }
  }, [active, payload, onSync]);
  return null;
}

/**
 * 모바일 시장 지수 분석 섹션 컴포넌트 (클린 라이트 톤)
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

  useEffect(() => {
    setHoveredData(null);
  }, [activeChartTab, selectedTicker, selectedPeriod]);

  const activeIndexInfo = useMemo(() => {
    return INDICES.find((idx) => idx.ticker === selectedTicker) || INDICES[0];
  }, [selectedTicker]);

  const currentTabConfig = useMemo(() => {
    return CHART_TABS.find((tab) => tab.id === activeChartTab) || CHART_TABS[0];
  }, [activeChartTab]);

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

  const chartData = useMemo(() => {
    if (!historicalData || !historicalData.labels) return [];
    return historicalData.labels.map((label, idx) => ({
      date: label,
      value: historicalData.prices ? historicalData.prices[idx] : null,
      mdd: historicalData.mdd ? historicalData.mdd[idx] : null,
      vix: historicalData.vix ? historicalData.vix[idx] : null,
    }));
  }, [historicalData]);

  const latestVix = useMemo(() => {
    if (!historicalData?.vix || historicalData.vix.length === 0) return null;
    const valid = historicalData.vix.filter((v) => v !== null && v !== undefined && !isNaN(v));
    return valid.length > 0 ? valid[valid.length - 1] : null;
  }, [historicalData]);

  const vixStatus = useMemo(() => getVixStatus(latestVix), [latestVix]);

  const containerRef = useRef(null);
  const isInteractingRef = useRef(false);

  const handleInteractionEnd = useCallback(() => {
    isInteractingRef.current = false;
    setHoveredData(null);
  }, []);

  const handleTooltipSync = useCallback((nextPoint) => {
    if (!isInteractingRef.current) {
      setHoveredData(null);
      return;
    }
    setHoveredData(nextPoint);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onEnd = handleInteractionEnd;
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    el.addEventListener('pointerup', onEnd, { passive: true });
    el.addEventListener('pointercancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
    };
  }, [activeChartTab, handleInteractionEnd]);

  const getDataPointFromTouch = useCallback(
    (event) => {
      if (!chartData || chartData.length === 0) return null;
      const touch = event.touches?.[0] || event.changedTouches?.[0] || event;
      if (!touch || typeof touch.clientX !== 'number') return null;

      const container = containerRef.current;
      if (!container) return null;

      const rect = container.getBoundingClientRect();
      const chartLeft = rect.left + 5;
      const chartWidth = rect.width - 38 - 10;
      if (chartWidth <= 0) return null;

      const relX = touch.clientX - chartLeft;
      const ratio = Math.max(0, Math.min(1, relX / chartWidth));
      const index = Math.round(ratio * (chartData.length - 1));
      return chartData[index] || null;
    },
    [chartData]
  );

  const handleChartMove = useCallback(
    (state, event) => {
      isInteractingRef.current = true;
      if (state && state.activePayload && state.activePayload.length > 0 && state.activePayload[0]?.payload) {
        const nextPoint = state.activePayload[0].payload;
        setHoveredData((prev) => (prev?.date === nextPoint.date ? prev : nextPoint));
        return;
      }
      if (
        state &&
        state.activeTooltipIndex !== null &&
        state.activeTooltipIndex !== undefined &&
        chartData &&
        chartData[state.activeTooltipIndex]
      ) {
        const nextPoint = chartData[state.activeTooltipIndex];
        setHoveredData((prev) => (prev?.date === nextPoint.date ? prev : nextPoint));
        return;
      }
      if (event) {
        const point = getDataPointFromTouch(event);
        if (point) {
          setHoveredData((prev) => (prev?.date === point.date ? prev : point));
        }
      }
    },
    [chartData, getDataPointFromTouch]
  );

  const handleTouchStartDirect = useCallback(
    (e) => {
      isInteractingRef.current = true;
      const point = getDataPointFromTouch(e);
      if (point) {
        setHoveredData(point);
      }
    },
    [getDataPointFromTouch]
  );

  if (error && !loading) {
    return (
      <div
        data-testid="market-index-error"
        className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-6 text-center space-y-3 my-2"
      >
        <div className="w-10 h-10 rounded-full bg-[#FFF0F1] flex items-center justify-center text-[#F04452] mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-[#191F28]">데이터 로드 실패</h3>
        <p className="text-xs text-[#6B7684] leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={() => fetchHistoricalData()}
          className="mt-2 py-2.5 px-4 bg-[#3182F6] hover:bg-[#1B64DA] text-white rounded-xl text-xs font-semibold transition-all"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 1. 4대 지수 가로 스크롤 칩 선택기 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
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
              className={`shrink-0 px-3.5 py-2.5 rounded-2xl text-left transition-all border min-w-[122px] bg-white ${
                isSelected
                  ? 'border-[#3182F6] ring-1 ring-[#3182F6]/20'
                  : 'border-[#E5E8EB]/60 hover:border-[#CBD5E1]'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[11px] font-semibold text-[#6B7684] truncate">{idx.name}</span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: idx.color }}
                />
              </div>

              <div className="flex items-baseline justify-between gap-1.5 mt-1 tabular-nums">
                <span className="text-xs font-bold text-[#191F28]">
                  {priceInfo?.current_price !== undefined && priceInfo?.current_price !== null
                    ? Number(priceInfo.current_price).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })
                    : '-'}
                </span>

                <span
                  className={`text-[11px] font-semibold ${
                    isUp ? 'text-[#F04452]' : isDown ? 'text-[#3182F6]' : 'text-[#8B95A1]'
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

      {/* 2. VIX 상태 요약 카드 & 기간 필터 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* VIX 상태 카드 */}
        <div
          data-testid="vix-summary-card"
          className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-3.5 flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#191F28]">VIX 공포지수</span>
              {vixStatus && (
                <span
                  data-testid="vix-risk-badge"
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${vixStatus.badgeClass}`}
                >
                  {vixStatus.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8B95A1] font-medium mt-0.5">
              {vixStatus?.description || '변동성 데이터 산출 중'}
            </p>
          </div>

          <div className="text-right tabular-nums">
            <span
              data-testid="vix-latest-value"
              className="text-base font-bold text-[#191F28] tracking-tight"
            >
              {latestVix !== null && latestVix !== undefined ? Number(latestVix).toFixed(2) : '-'}
            </span>
            <span className="text-[11px] text-[#8B95A1] ml-0.5">pt</span>
          </div>
        </div>

        {/* 기간 필터 버튼 그룹 */}
        <div className="flex bg-[#E5E8EB]/70 p-1 rounded-xl items-center justify-between gap-0.5">
          {PERIODS.map((p) => {
            const isSelected = selectedPeriod === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedPeriod(p.value)}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-all text-center ${
                  isSelected
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

      {/* 3. 1화면 1차트 서브탭 스위처 및 대형 단독 뷰 */}
      <section
        data-testid="mobile-stacked-chart-card"
        className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-4 space-y-3 relative"
      >
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs rounded-2xl z-20 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#3182F6] animate-spin" />
            <span className="text-xs text-[#4E5968] font-medium">차트 갱신 중...</span>
          </div>
        )}

        {/* 서브탭 스위처: [지수 종가 | 낙폭 (MDD) | VIX 변동성] */}
        <div className="flex bg-[#F2F4F6] p-1 rounded-xl gap-1">
          {CHART_TABS.map((tab) => {
            const isSelected = activeChartTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`chart-tab-${tab.id}`}
                aria-pressed={isSelected}
                onClick={() => setActiveChartTab(tab.id)}
                className={`flex-1 py-1.5 text-xs rounded-lg transition-all flex items-center justify-center ${
                  isSelected
                    ? 'bg-white text-[#191F28] shadow-xs font-semibold'
                    : 'text-[#6B7684] hover:text-[#191F28] font-medium'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 차트 헤더 */}
        <div className="flex items-center justify-between pb-1.5 border-b border-[#F2F4F6]">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: currentTabConfig.bulletColor(activeIndexInfo.color),
              }}
            />
            <h2 className="text-xs font-bold text-[#191F28]">
              {currentTabConfig.title(activeIndexInfo.name)}
            </h2>
            <span className="text-[10px] text-[#8B95A1]">
              {currentTabConfig.unit}
            </span>
          </div>
          {activeChartTab === 'vix' && (
            <div data-testid="vix-legend-badges" className="flex items-center gap-1.5">
              <span
                data-testid="vix-legend-badge-caution"
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#D97706] bg-[#FFF8E6] flex items-center gap-1"
              >
                주의 20
              </span>
              <span
                data-testid="vix-legend-badge-warning"
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#F04452] bg-[#FFF0F1] flex items-center gap-1"
              >
                경고 30
              </span>
            </div>
          )}
        </div>

        {/* 상단 초슬림 인스펙터 바 */}
        <MobileSlimInspectorBar
          hoveredData={hoveredData}
          activeChartTab={activeChartTab}
        />

        {/* [1단] 지수 종가 */}
        {activeChartTab === 'price' && (
          <div data-testid="chart-tier-price" className="space-y-1">
            <div
              ref={containerRef}
              data-testid="mobile-chart-canvas-container"
              className="h-[260px] w-full touch-none select-none"
              onTouchStart={handleTouchStartDirect}
              onPointerDown={handleTouchStartDirect}
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
                  onTouchEnd={handleInteractionEnd}
                  onTouchCancel={handleInteractionEnd}
                  onMouseLeave={handleInteractionEnd}
                >
                  <defs>
                    <linearGradient id="mobilePriceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeIndexInfo.color} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={activeIndexInfo.color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#8B95A1"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                    tickFormatter={(str) => (str ? str.slice(2, 7) : '')}
                  />
                  <YAxis
                    orientation="right"
                    stroke="#8B95A1"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    domain={['dataMin - 10', 'dataMax + 10']}
                    tickFormatter={(val) => Math.round(val).toLocaleString()}
                  />
                  <Tooltip
                    cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={<ChartTooltipSync onSync={handleTooltipSync} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={activeIndexInfo.color}
                    strokeWidth={2}
                    fill="url(#mobilePriceGradient)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: activeIndexInfo.color }}
                    className="pointer-events-none"
                    style={{ pointerEvents: 'none' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* [2단] 최대 낙폭 (MDD %) */}
        {activeChartTab === 'mdd' && (
          <div data-testid="chart-tier-mdd" className="space-y-1">
            <div
              ref={containerRef}
              data-testid="mobile-chart-canvas-container"
              className="h-[260px] w-full touch-none select-none"
              onTouchStart={handleTouchStartDirect}
              onPointerDown={handleTouchStartDirect}
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
                  onTouchEnd={handleInteractionEnd}
                  onTouchCancel={handleInteractionEnd}
                  onMouseLeave={handleInteractionEnd}
                >
                  <defs>
                    <linearGradient id="mobileMddGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3182F6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3182F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#8B95A1"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                    tickFormatter={(str) => (str ? str.slice(2, 7) : '')}
                  />
                  <YAxis
                    orientation="right"
                    stroke="#8B95A1"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    domain={['dataMin - 2', 0]}
                    tickFormatter={(val) => `${Math.round(val)}%`}
                  />
                  <Tooltip
                    cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={<ChartTooltipSync onSync={handleTooltipSync} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="mdd"
                    stroke="#3182F6"
                    strokeWidth={1.8}
                    fill="url(#mobileMddGradient)"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: '#3182F6' }}
                    className="pointer-events-none"
                    style={{ pointerEvents: 'none' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* [3단] VIX 변동성 */}
        {activeChartTab === 'vix' && (
          <div data-testid="chart-tier-vix" className="space-y-1">
            <div
              ref={containerRef}
              data-testid="mobile-chart-canvas-container"
              className="h-[260px] w-full touch-none select-none"
              onTouchStart={handleTouchStartDirect}
              onPointerDown={handleTouchStartDirect}
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
                  onTouchEnd={handleInteractionEnd}
                  onTouchCancel={handleInteractionEnd}
                  onMouseLeave={handleInteractionEnd}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#8B95A1"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                    tickFormatter={(str) => (str ? str.slice(2, 7) : '')}
                  />
                  <YAxis
                    orientation="right"
                    stroke="#8B95A1"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    domain={[0, (max) => Math.max(45, Math.ceil(max + 2))]}
                    tickFormatter={(val) => Math.round(val).toString()}
                  />
                  <Tooltip
                    cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={<ChartTooltipSync onSync={handleTooltipSync} />}
                  />
                  <ReferenceLine
                    y={20}
                    stroke="#F59E0B"
                    strokeDasharray="4 3"
                    strokeWidth={1.2}
                  />
                  <ReferenceLine
                    y={30}
                    stroke="#F04452"
                    strokeDasharray="4 3"
                    strokeWidth={1.2}
                  />
                  <Line
                    type="monotone"
                    dataKey="vix"
                    stroke="#6366F1"
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: '#6366F1' }}
                    className="pointer-events-none"
                    style={{ pointerEvents: 'none' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* 4. 기간 내 2대 극단값 분석 카드 */}
      <MobileMarketExtremeStatsCards chartData={chartData} />
    </div>
  );
}
