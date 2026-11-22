import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';
import {
  BASE_INDEX,
  CHART_MODES,
  formatIndexPt,
  formatSignedPercent,
  formatDrawdown,
  isNegativeDrawdown,
  formatFullCurrency,
  formatDisplayDate,
  formatIndexAxis,
  formatShortCurrency,
  formatShortDateTick,
  renderNullTooltip,
  useAssetChartState,
} from '../Dashboard/AssetChart';

/**
 * 모바일 자산 추이 및 수익 지수(Index) 시계열 차트 카드 컴포넌트입니다.
 * - [총자산 규모 (원) | 수익 지수 (Index)] 세그먼트 탭 전환
 * - 차트 위 상시 요약 바: 현재 평가액(또는 지수 + 누적 수익률), 현재 DD, 역대 MDD 표시
 * - 차트 아래 고정 높이 호버/터치 상세 바: 플로팅 툴팁 없이 날짜, 평가액/지수, DD 표시
 *
 * @param {Object} props
 * @param {Object} props.data - 시계열 스냅샷 데이터 ({ history: Array, accounts: Array })
 */
export default function MobileAssetTrendCard({ data }) {
  const { maskValue } = useMasking();
  const { history, accounts } = data || {};
  const {
    chartMode,
    filter,
    hoveredPoint,
    chartData,
    summary,
    currentFilterName,
    handleModeChange,
    handleFilterChange,
    handleChartMouseMove,
    clearHoveredPoint,
  } = useAssetChartState({ history, accounts });

  if (!history || history.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg text-center">
        <TrendingUp className="mx-auto text-slate-600 mb-2 w-6 h-6" />
        <p className="text-xs text-slate-400 font-medium">표시할 자산 추이 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white leading-tight">자산 추이</h3>
          <span className="text-[11px] text-slate-400 font-medium">
            {chartMode === 'index'
              ? '기준일(1,000.00 pt) 대비 순수 성과'
              : `시간별 평가액 흐름 (${currentFilterName})`}
          </span>
        </div>
      </div>

      {/* 세그먼트 탭 컨트롤 */}
      <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 mb-3 gap-1">
        {CHART_MODES.map((tab) => {
          const isActive = chartMode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleModeChange(tab.key)}
              aria-pressed={isActive}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center ${
                isActive
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 계좌 선택 드롭다운 (총자산 규모 탭 전용) */}
      {chartMode === 'asset' && (
        <div className="mb-3">
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            aria-label="계좌 필터"
            className="w-full bg-slate-800/80 border border-slate-700/60 text-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
          >
            <option value="total">총 자산 합계</option>
            {accounts?.map((acc) => (
              <option key={acc.id} value={`acc_${acc.id}`}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 차트 위: 상시 요약 바 (항상 표시) */}
      <div
        data-testid="mobile-asset-chart-summary-bar"
        className="p-3 mb-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-2"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-700/50">
          <span className="text-xs font-medium text-slate-400">
            {chartMode === 'index' ? '현재 지수' : '현재 평가액'}
          </span>
          {chartMode === 'index' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-sky-400 tabular-nums">
                {formatIndexPt(summary.latestIndex)}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                  summary.latestCumReturn >= 0
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                }`}
              >
                {formatSignedPercent(summary.latestCumReturn)}
              </span>
            </div>
          ) : (
            <span className="text-sm font-extrabold text-white tabular-nums">
              {formatFullCurrency(summary.latestValue, maskValue)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs text-slate-400">현재 DD</span>
            <span
              className={`text-xs font-extrabold tabular-nums ${
                isNegativeDrawdown(summary.currentDrawdown) ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {formatDrawdown(summary.currentDrawdown)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 pl-2 border-l border-slate-700/50">
            <span className="text-xs text-slate-400">역대 MDD</span>
            <span className="text-xs font-extrabold text-rose-400 tabular-nums">
              {formatDrawdown(summary.maxDrawdown)}
            </span>
          </div>
        </div>
      </div>

      {/* 차트 영역 (플로팅 툴팁 제거) */}
      <div
        className="h-48 w-full"
        onTouchEnd={clearHoveredPoint}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 6, left: -4, bottom: 0 }}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={clearHoveredPoint}
          >
            <defs>
              <linearGradient id="mobileColorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              dy={6}
              tickFormatter={formatShortDateTick}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              tickFormatter={
                chartMode === 'index'
                  ? formatIndexAxis
                  : (val) => formatShortCurrency(val, maskValue)
              }
              domain={chartMode === 'index' ? ['auto', 'auto'] : [0, 'auto']}
              width={chartMode === 'index' ? 62 : 52}
            />
            {chartMode === 'index' && (
              <ReferenceLine
                y={BASE_INDEX}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            <Tooltip
              content={renderNullTooltip}
              cursor={{ stroke: '#475569', strokeDasharray: '3 3', strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="displayValue"
              stroke="#38bdf8"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#mobileColorVal)"
              activeDot={{ r: 4.5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 차트 아래: 고정 높이 호버/터치 상세 바 (직전 대비 등락률 제외) */}
      <div
        data-testid="mobile-asset-chart-hover-bar"
        className={`mt-3 min-h-[64px] px-3 py-2.5 rounded-2xl border flex flex-col justify-center gap-1.5 transition-colors ${
          hoveredPoint
            ? 'bg-slate-800/90 border-sky-500/30'
            : 'bg-slate-800/60 border-slate-700/60 items-center'
        }`}
      >
        {!hoveredPoint ? (
          <span className="text-xs font-medium text-slate-400 text-center">
            차트를 터치하면 해당 시점의 상세 정보가 표시됩니다.
          </span>
        ) : chartMode === 'asset' ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 tabular-nums">
                {formatDisplayDate(hoveredPoint.date)}
              </span>
              <span className="text-xs font-extrabold text-white tabular-nums">
                {formatFullCurrency(hoveredPoint.displayValue, maskValue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{currentFilterName}</span>
              <span
                className={`text-xs font-bold tabular-nums ${
                  isNegativeDrawdown(hoveredPoint.drawdown) ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                고점 대비 {formatDrawdown(hoveredPoint.drawdown)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 tabular-nums">
                {formatDisplayDate(hoveredPoint.date)}
              </span>
              <span className="text-xs font-extrabold text-sky-400 tabular-nums">
                {formatIndexPt(hoveredPoint.index)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-bold tabular-nums ${
                  Number(hoveredPoint.index_cum_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                기준일 대비 {formatSignedPercent(hoveredPoint.index_cum_return_pct)}
              </span>
              <span
                className={`text-xs font-bold tabular-nums ${
                  isNegativeDrawdown(hoveredPoint.drawdown) ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                낙폭 {formatDrawdown(hoveredPoint.drawdown)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
