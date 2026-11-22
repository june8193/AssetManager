import React, { useState, useMemo } from 'react';
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

/**
 * 리스크 시각화 2종 차트 탭(자체 변동성 vs 기여도, 벤치마크 대비 MDD 방어력) 섹션입니다.
 *
 * @param {object} props
 * @param {Array} props.assets - 자산별 변동성 및 기여도 목록(시뮬레이션 반영)
 * @param {object} props.benchmarks - 벤치마크(sp500, nasdaq, kospi) 통계 객체
 * @param {object} props.drawdownComparison - 일별 낙폭 비교 시계열 데이터
 * @param {Array<number>|null} props.simDrawdownSeries - 시뮬레이션 조정 후 낙폭 시계열
 * @param {boolean} props.isModified - 시뮬레이션 변경 여부
 */
export default function RiskChartsSection({
  assets,
  benchmarks,
  drawdownComparison,
  simDrawdownSeries = null,
  isModified = false,
}) {
  const [activeTab, setActiveTab] = useState('bar');
  const [collapsed, setCollapsed] = useState(false);

  const barData = useMemo(() => {
    if (!assets) return [];
    return assets
      .filter((a) => !a.is_cash && (a.weight > 0 || a.is_added))
      .map((a) => ({
        name: a.name.length > 10 ? `${a.name.slice(0, 10)}…` : a.name,
        fullName: a.name,
        ticker: a.ticker,
        annualized_volatility: Number((a.annualized_volatility ?? 0).toFixed(2)),
        volatility_share: Number((a.volatility_share ?? 0).toFixed(2)),
      }));
  }, [assets]);

  const mddData = useMemo(() => {
    if (!drawdownComparison?.dates?.length) return [];
    const { dates, benchmarks: bmSeries, portfolio_current } = drawdownComparison;
    return dates.map((date, idx) => ({
      date,
      sp500: bmSeries?.sp500?.[idx] ?? 0,
      nasdaq: bmSeries?.nasdaq?.[idx] ?? 0,
      kospi: bmSeries?.kospi?.[idx] ?? 0,
      current: portfolio_current?.[idx] ?? 0,
      ...(isModified && simDrawdownSeries ? { simulated: simDrawdownSeries[idx] ?? 0 } : {}),
    }));
  }, [drawdownComparison, simDrawdownSeries, isModified]);

  const sp500Vol = benchmarks?.sp500?.annualized_volatility ?? 0;
  const nasdaqVol = benchmarks?.nasdaq?.annualized_volatility ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
          <button
            type="button"
            onClick={() => {
              setActiveTab('bar');
              if (collapsed) setCollapsed(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
              activeTab === 'bar'
                ? 'bg-white text-blue-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>종목별 자체 변동성 vs 기여도</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('mdd');
              if (collapsed) setCollapsed(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
              activeTab === 'mdd'
                ? 'bg-white text-blue-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>벤치마크 대비 낙폭(MDD) 방어력</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
        >
          {collapsed ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>차트 펼치기</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>차트 접기</span>
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="p-6" data-testid="risk-chart-panel">
          {activeTab === 'bar' ? (
            <div data-testid="volatility-bar-chart">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs text-slate-500">
                  각 종목의 연율화 자체 변동성(%)과 전체 흔들림 기여도 점유율(%)을 S&amp;P 500·NASDAQ 기준선과 비교합니다.
                </p>
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                    S&amp;P 500 ({sp500Vol.toFixed(1)}%)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                    NASDAQ ({nasdaqVol.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.fullName || ''
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {sp500Vol > 0 && (
                      <ReferenceLine
                        y={sp500Vol}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{
                          value: `S&P 500 ${sp500Vol.toFixed(1)}%`,
                          position: 'insideTopRight',
                          fill: '#059669',
                          fontSize: 10,
                        }}
                      />
                    )}
                    {nasdaqVol > 0 && (
                      <ReferenceLine
                        y={nasdaqVol}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{
                          value: `NASDAQ ${nasdaqVol.toFixed(1)}%`,
                          position: 'insideTopRight',
                          fill: '#d97706',
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Bar
                      dataKey="annualized_volatility"
                      name="자체 변동성 (%)"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="volatility_share"
                      name="흔들림 기여도 (%)"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div data-testid="mdd-line-chart">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs text-slate-500">
                  고점 대비 누적 낙폭(Drawdown %) 추이를 3대 시장 지수와 비교해 포트폴리오 방어력을 확인합니다.
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mddData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => `${v}%`}
                      domain={['auto', 0]}
                    />
                    <Tooltip
                      formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="sp500"
                      name="S&P 500"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="nasdaq"
                      name="NASDAQ"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="kospi"
                      name="KOSPI"
                      stroke="#ec4899"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="current"
                      name="현재 포트폴리오"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    {isModified && simDrawdownSeries && (
                      <Line
                        type="monotone"
                        dataKey="simulated"
                        name="조정 후 포트폴리오"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
