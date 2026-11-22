import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { BarChart3, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';

const MAX_DEFAULT_BAR_ITEMS = 8;

/**
 * 모바일 리스크 시각화 2종 차트 카드(변동성 vs 기여도, 벤치마크 대비 MDD 방어력) 컴포넌트입니다.
 *
 * @param {object} props - 컴포넌트 속성
 * @param {Array} props.assets - 자산별 변동성 및 기여도 목록
 * @param {object} props.benchmarks - 벤치마크(sp500, nasdaq, kospi) 통계 객체
 * @param {object} props.drawdownComparison - 일별 낙폭 비교 시계열 데이터
 */
export default function MobileRiskChartsCard({
  assets = [],
  benchmarks = {},
  drawdownComparison = null,
}) {
  const [activeTab, setActiveTab] = useState('bar');
  const [collapsed, setCollapsed] = useState(false);
  const [showAllBars, setShowAllBars] = useState(false);

  const sortedBarData = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    return [...assets]
      .filter((a) => !a.is_cash && (a.weight > 0 || a.is_added))
      .sort((a, b) => (b.volatility_share ?? 0) - (a.volatility_share ?? 0))
      .map((a) => ({
        name: a.name.length > 9 ? `${a.name.slice(0, 9)}…` : a.name,
        fullName: a.name,
        ticker: a.ticker,
        annualized_volatility: Number((a.annualized_volatility ?? 0).toFixed(2)),
        volatility_share: Number((a.volatility_share ?? 0).toFixed(2)),
      }));
  }, [assets]);

  const hasMoreThanLimit = sortedBarData.length > MAX_DEFAULT_BAR_ITEMS;
  const visibleBarData = useMemo(() => {
    if (!hasMoreThanLimit || showAllBars) return sortedBarData;
    return sortedBarData.slice(0, MAX_DEFAULT_BAR_ITEMS);
  }, [sortedBarData, hasMoreThanLimit, showAllBars]);

  const mddData = useMemo(() => {
    if (!drawdownComparison?.dates?.length) return [];
    const { dates, benchmarks: bmSeries, portfolio_current } = drawdownComparison;
    return dates.map((date, idx) => ({
      date,
      sp500: bmSeries?.sp500?.[idx] ?? 0,
      nasdaq: bmSeries?.nasdaq?.[idx] ?? 0,
      kospi: bmSeries?.kospi?.[idx] ?? 0,
      current: portfolio_current?.[idx] ?? 0,
    }));
  }, [drawdownComparison]);

  const sp500Vol = benchmarks?.sp500?.annualized_volatility ?? 0;
  const nasdaqVol = benchmarks?.nasdaq?.annualized_volatility ?? 0;
  const barChartHeight = Math.max(220, visibleBarData.length * 36 + 44);

  return (
    <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl overflow-hidden">
      {/* 상단 탭 및 접기/펼치기 헤더 */}
      <div className="px-4 py-3 border-b border-[#F2F4F6] flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="리스크 차트 유형"
          className="flex items-center gap-1 bg-[#F2F4F6] p-1 rounded-xl flex-1 min-w-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bar'}
            onClick={() => {
              setActiveTab('bar');
              if (collapsed) setCollapsed(false);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'bar'
                ? 'bg-white text-[#191F28] shadow-xs font-semibold'
                : 'text-[#6B7684] hover:text-[#191F28] font-medium'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>변동성 vs 기여도</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mdd'}
            onClick={() => {
              setActiveTab('mdd');
              if (collapsed) setCollapsed(false);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'mdd'
                ? 'bg-white text-[#191F28] shadow-xs font-semibold'
                : 'text-[#6B7684] hover:text-[#191F28] font-medium'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            <span>MDD 방어력</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? '차트 펼치기' : '차트 접기'}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-[#E5E8EB] transition-colors shrink-0"
        >
          {collapsed ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>펼치기</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>접기</span>
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4" data-testid="mobile-risk-chart-panel">
          {activeTab === 'bar' ? (
            <div
              data-testid="mobile-volatility-bar-chart"
              data-visible-count={visibleBarData.length}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B7684]">
                <span>자체 변동성(%) 및 흔들림 기여도(%)</span>
                <div className="flex items-center gap-2.5 text-[10px] font-medium tabular-nums">
                  {sp500Vol > 0 && (
                    <span className="text-[#00A870]">S&amp;P {sp500Vol.toFixed(1)}%</span>
                  )}
                  {nasdaqVol > 0 && (
                    <span className="text-[#D97706]">NDX {nasdaqVol.toFixed(1)}%</span>
                  )}
                </div>
              </div>

              {visibleBarData.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8B95A1]">
                  표시할 보유 종목 변동성 데이터가 없습니다.
                </div>
              ) : (
                <div style={{ height: `${barChartHeight}px` }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={visibleBarData}
                      margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EB" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#8B95A1' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={76}
                        tick={{ fontSize: 11, fill: '#191F28' }}
                      />
                      <Tooltip
                        formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {sp500Vol > 0 && (
                        <ReferenceLine
                          x={sp500Vol}
                          stroke="#00A870"
                          strokeDasharray="4 4"
                        />
                      )}
                      {nasdaqVol > 0 && (
                        <ReferenceLine
                          x={nasdaqVol}
                          stroke="#D97706"
                          strokeDasharray="4 4"
                        />
                      )}
                      <Bar
                        dataKey="annualized_volatility"
                        name="자체 변동성 (%)"
                        fill="#6366F1"
                        barSize={8}
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="volatility_share"
                        name="흔들림 기여도 (%)"
                        fill="#3182F6"
                        barSize={8}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {hasMoreThanLimit && (
                <button
                  type="button"
                  data-testid="risk-bar-toggle-all"
                  onClick={() => setShowAllBars((prev) => !prev)}
                  className="w-full py-2 px-3 rounded-xl bg-[#F2F4F6] hover:bg-[#E5E8EB] text-[11px] font-semibold text-[#4E5968] transition-colors"
                >
                  {showAllBars
                    ? '상위 8개만 보기'
                    : `전체 보기 (총 ${sortedBarData.length}개)`}
                </button>
              )}
            </div>
          ) : (
            <div data-testid="mobile-mdd-line-chart" className="space-y-3">
              <p className="text-[11px] text-[#6B7684]">
                고점 대비 누적 낙폭(Drawdown %) 추이를 3대 시장 지수와 비교합니다.
              </p>

              {mddData.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8B95A1]">
                  낙폭 비교 시계열 데이터가 없습니다.
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mddData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E8EB" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#8B95A1' }}
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#8B95A1' }}
                        tickFormatter={(v) => `${v}%`}
                        domain={['auto', 0]}
                      />
                      <Tooltip
                        formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="sp500"
                        name="S&P 500"
                        stroke="#94A3B8"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="nasdaq"
                        name="NASDAQ"
                        stroke="#F59E0B"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="kospi"
                        name="KOSPI"
                        stroke="#EC4899"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="current"
                        name="내 포트폴리오"
                        stroke="#3182F6"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
