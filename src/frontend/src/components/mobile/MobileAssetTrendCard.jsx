import React, { useState, useMemo } from 'react';
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
  formatIndexAxis,
  formatShortCurrency,
  formatShortDateTick,
  getCurrentFilterName,
  formatAssetTooltipEntry,
  buildChartDisplayData,
  getLatestIndexSummary,
  createIndexTooltipRenderer,
} from '../Dashboard/AssetChart';

const renderMobileIndexTooltip = createIndexTooltipRenderer('dark');

/**
 * 모바일 자산 추이 및 수익 지수(Index) 시계열 차트 카드 컴포넌트입니다.
 * - [총자산 규모 (원) | 수익 지수 (Index)] 세그먼트 탭 전환
 * - 총자산 탭: 계좌 선택 필터 및 프라이버시 마스킹(***) 연동
 * - 수익 지수 탭: 최신 지수 요약 배지, 1,000 pt 기준선, 3종 지표 툴팁 (마스킹 예외)
 *
 * @param {Object} props
 * @param {Object} props.data - 시계열 스냅샷 데이터 ({ history: Array, accounts: Array })
 */
export default function MobileAssetTrendCard({ data }) {
  const [chartMode, setChartMode] = useState('asset');
  const [filter, setFilter] = useState('total');
  const { maskValue } = useMasking();

  const { history, accounts } = data || {};

  const chartData = useMemo(
    () => buildChartDisplayData(history, chartMode, filter),
    [history, filter, chartMode]
  );

  const currentFilterName = getCurrentFilterName(filter, accounts);
  const { latestCumReturn, formattedBadgeText } = getLatestIndexSummary(history);

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
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">자산 추이</h3>
            <span className="text-[10px] text-slate-400 font-medium">
              {chartMode === 'index'
                ? '기준일(1,000.00 pt) 대비 순수 성과'
                : `시간별 평가액 흐름 (${currentFilterName})`}
            </span>
          </div>
        </div>

        {chartMode === 'index' && (
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${
              latestCumReturn >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {formattedBadgeText}
          </span>
        )}
      </div>

      {/* 세그먼트 탭 컨트롤 */}
      <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 mb-3 gap-1">
        {CHART_MODES.map((tab) => {
          const isActive = chartMode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setChartMode(tab.key)}
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
            onChange={(e) => setFilter(e.target.value)}
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

      {/* 차트 영역 */}
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -4, bottom: 0 }}>
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
              content={chartMode === 'index' ? renderMobileIndexTooltip : undefined}
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '14px',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontSize: '12px',
                padding: '10px',
              }}
              formatter={
                chartMode === 'asset'
                  ? (value) => formatAssetTooltipEntry(value, currentFilterName, maskValue)
                  : undefined
              }
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Area
              type="monotone"
              dataKey="displayValue"
              stroke="#38bdf8"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#mobileColorVal)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
