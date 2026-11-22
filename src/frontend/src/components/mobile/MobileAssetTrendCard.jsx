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
 * 모바일 자산 추이 및 수익 지수(Index) 시계열 차트 카드 컴포넌트 (클린 라이트 톤)
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
      <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-6 text-center">
        <p className="text-xs text-[#8B95A1] font-medium">표시할 자산 추이 데이터가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3.5">
      {/* 카드 헤더 */}
      <div>
        <h2 className="text-[15px] font-bold text-[#191F28] leading-tight">자산 추이</h2>
        <p className="text-xs text-[#8B95A1] font-medium mt-0.5">
          {chartMode === 'index'
            ? '기준일(1,000.00 pt) 대비 순수 성과'
            : `시간별 평가액 흐름 (${currentFilterName})`}
        </p>
      </div>

      {/* 세그먼트 탭 컨트롤 */}
      <div className="flex bg-[#F2F4F6] p-1 rounded-xl gap-1">
        {CHART_MODES.map((tab) => {
          const isActive = chartMode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleModeChange(tab.key)}
              aria-pressed={isActive}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-all text-center ${
                isActive
                  ? 'bg-white text-[#191F28] font-semibold shadow-xs'
                  : 'text-[#6B7684] hover:text-[#191F28] font-medium'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 계좌 선택 드롭다운 (총자산 규모 탭 전용) */}
      {chartMode === 'asset' && (
        <div>
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            aria-label="계좌 필터"
            className="w-full bg-[#F2F4F6] border border-transparent focus:border-[#3182F6] text-[#191F28] text-xs font-semibold rounded-xl px-3 py-2.5 outline-none transition-colors"
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
        className="px-3.5 py-3 rounded-xl bg-[#F9FAFB] space-y-2"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E8EB]/80">
          <span className="text-xs font-medium text-[#6B7684]">
            {chartMode === 'index' ? '현재 지수' : '현재 평가액'}
          </span>
          {chartMode === 'index' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#191F28] tabular-nums">
                {formatIndexPt(summary.latestIndex)}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                  summary.latestCumReturn >= 0
                    ? 'bg-[#FFF0F1] text-[#F04452]'
                    : 'bg-[#E8F3FF] text-[#3182F6]'
                }`}
              >
                {formatSignedPercent(summary.latestCumReturn)}
              </span>
            </div>
          ) : (
            <span className="text-sm font-bold text-[#191F28] tabular-nums">
              {formatFullCurrency(summary.latestValue, maskValue)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs text-[#8B95A1]">현재 DD</span>
            <span
              className={`text-xs font-bold tabular-nums ${
                isNegativeDrawdown(summary.currentDrawdown) ? 'text-[#3182F6]' : 'text-[#F04452]'
              }`}
            >
              {formatDrawdown(summary.currentDrawdown)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 pl-2 border-l border-[#E5E8EB]">
            <span className="text-xs text-[#8B95A1]">역대 MDD</span>
            <span className="text-xs font-bold text-[#3182F6] tabular-nums">
              {formatDrawdown(summary.maxDrawdown)}
            </span>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="h-48 w-full" onTouchEnd={clearHoveredPoint}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 6, left: -4, bottom: 0 }}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={clearHoveredPoint}
          >
            <defs>
              <linearGradient id="mobileColorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3182F6" stopOpacity={0.16} />
                <stop offset="95%" stopColor="#3182F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F4F6" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B95A1', fontSize: 10, fontWeight: 500 }}
              dy={6}
              tickFormatter={formatShortDateTick}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B95A1', fontSize: 10, fontWeight: 500 }}
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
                stroke="#CBD5E1"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            <Tooltip
              content={renderNullTooltip}
              cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3', strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="displayValue"
              stroke="#3182F6"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#mobileColorVal)"
              activeDot={{ r: 4.5, fill: '#3182F6', stroke: '#ffffff', strokeWidth: 2 }}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 차트 아래: 고정 높이 호버/터치 상세 바 */}
      <div
        data-testid="mobile-asset-chart-hover-bar"
        className={`min-h-[60px] px-3.5 py-2.5 rounded-xl flex flex-col justify-center gap-1 transition-colors ${
          hoveredPoint
            ? 'bg-[#E8F3FF]/60 border border-[#3182F6]/20'
            : 'bg-[#F9FAFB] items-center'
        }`}
      >
        {!hoveredPoint ? (
          <span className="text-xs font-medium text-[#8B95A1] text-center">
            차트를 터치하면 해당 시점의 상세 정보가 표시됩니다.
          </span>
        ) : chartMode === 'asset' ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#4E5968] tabular-nums">
                {formatDisplayDate(hoveredPoint.date)}
              </span>
              <span className="text-xs font-bold text-[#191F28] tabular-nums">
                {formatFullCurrency(hoveredPoint.displayValue, maskValue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#8B95A1]">{currentFilterName}</span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  isNegativeDrawdown(hoveredPoint.drawdown) ? 'text-[#3182F6]' : 'text-[#F04452]'
                }`}
              >
                고점 대비 {formatDrawdown(hoveredPoint.drawdown)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#4E5968] tabular-nums">
                {formatDisplayDate(hoveredPoint.date)}
              </span>
              <span className="text-xs font-bold text-[#191F28] tabular-nums">
                {formatIndexPt(hoveredPoint.index)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold tabular-nums ${
                  Number(hoveredPoint.index_cum_return_pct ?? 0) >= 0
                    ? 'text-[#F04452]'
                    : 'text-[#3182F6]'
                }`}
              >
                기준일 대비 {formatSignedPercent(hoveredPoint.index_cum_return_pct)}
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  isNegativeDrawdown(hoveredPoint.drawdown) ? 'text-[#3182F6]' : 'text-[#F04452]'
                }`}
              >
                낙폭 {formatDrawdown(hoveredPoint.drawdown)}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
