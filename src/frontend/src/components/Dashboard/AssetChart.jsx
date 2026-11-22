import React, { useState, useMemo, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { TrendingUp, Filter } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

export const BASE_INDEX = 1000;
const DRAWDOWN_ZERO_EPSILON = 0.005;

export const CHART_MODES = [
  { key: 'asset', label: '총자산 규모 (원)' },
  { key: 'index', label: '수익 지수 (Index)' },
];

/**
 * 지수 값을 소수점 둘째 자리까지 포맷팅하여 'pt' 단위를 붙여 반환합니다.
 *
 * @param {number} val - 지수 수치
 * @returns {string} 포맷팅된 지수 문자열 (예: '1,284.50 pt')
 */
export const formatIndexPt = (val) => {
  const num = Number(val ?? BASE_INDEX);
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pt`;
};

/**
 * 등락률 수치를 부호(+/-)와 함께 소수점 둘째 자리 퍼센트 문자열로 반환합니다.
 *
 * @param {number} val - 등락률 수치
 * @returns {string} 포맷팅된 등락률 문자열 (예: '+28.45%')
 */
export const formatSignedPercent = (val) => {
  const num = Number(val ?? 0);
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

/**
 * 낙폭 수치가 0보다 유의미하게 작은 음수인지 판별합니다.
 *
 * @param {number|null|undefined} val - 낙폭 퍼센트 수치
 * @returns {boolean} 음수 낙폭 여부
 */
export const isNegativeDrawdown = (val) => {
  const num = Number(val);
  return val !== null && val !== undefined && !Number.isNaN(num) && num <= -DRAWDOWN_ZERO_EPSILON;
};

/**
 * 낙폭(DD / MDD) 수치를 소수점 둘째 자리 퍼센트 문자열로 포맷팅합니다.
 * 0에 근접한 값은 '-0.00%' 방지를 위해 '0.00%'로 반환합니다.
 *
 * @param {number|null|undefined} val - 낙폭 퍼센트 수치 (<= 0)
 * @returns {string} 포맷팅된 낙폭 문자열 (예: '-12.34%', '0.00%')
 */
export const formatDrawdown = (val) => {
  const num = Number(val);
  if (val === null || val === undefined || Number.isNaN(num) || Math.abs(num) < DRAWDOWN_ZERO_EPSILON) {
    return '0.00%';
  }
  return `${num.toFixed(2)}%`;
};

/**
 * 금액 수치를 전체 원화 표기 문자열로 포맷팅합니다 (프라이버시 마스킹 연동).
 *
 * @param {number} val - 평가 금액
 * @param {Function} maskValue - 마스킹 함수
 * @returns {string} 포맷팅된 원화 금액 문자열 (예: '143,864,000 원' 또는 '*** 원')
 */
export const formatFullCurrency = (val, maskValue) => {
  const formatted = Math.round(Number(val || 0)).toLocaleString();
  return `${typeof maskValue === 'function' ? maskValue(formatted) : formatted} 원`;
};

/**
 * 'YYYY-MM-DD' 날짜 문자열을 표시용 'YYYY.MM.DD' 형식으로 변환합니다.
 *
 * @param {string} dateStr - ISO 날짜 문자열
 * @returns {string} 변환된 날짜 문자열
 */
export const formatDisplayDate = (dateStr) => {
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr.replace(/-/g, '.');
  }
  return dateStr ? new Date(dateStr).toLocaleDateString() : '-';
};

/**
 * 수익 지수 차트 Y축 눈금 포맷터입니다.
 *
 * @param {number} val - Y축 눈금 값
 * @returns {string} 포맷팅된 Y축 눈금 문자열
 */
export const formatIndexAxis = (val) => {
  if (val === null || val === undefined) return '0 pt';
  return `${Number(val).toLocaleString()} pt`;
};

/**
 * 자산 규모(원) 차트 Y축 눈금 포맷터입니다 (프라이버시 마스킹 연동).
 *
 * @param {number} val - 금액 수치
 * @param {Function} maskValue - 마스킹 함수
 * @returns {string} 축약 포맷팅 또는 마스킹된 금액 문자열
 */
export const formatShortCurrency = (val, maskValue) => {
  if (val === null || val === undefined) return '0';

  if (typeof maskValue === 'function' && maskValue(null) === '***') {
    return '***';
  }

  if (val >= 100000000) return `${(val / 100000000).toFixed(1)} 억`;
  if (val >= 10000) return `${(val / 10000).toFixed(0)} 만`;
  return val.toLocaleString();
};

/**
 * X축 타임스탬프를 'YY/M/D' 단축 날짜 문자열로 포맷팅합니다.
 *
 * @param {number} ts - 밀리초 타임스탬프
 * @returns {string} 'YY/M/D' 형식 문자열
 */
export const formatShortDateTick = (ts) => {
  const date = new Date(ts);
  const year = date.getFullYear().toString().slice(-2);
  return `${year}/${date.getMonth() + 1}/${date.getDate()}`;
};

/**
 * 선택된 계좌 필터 키에 해당하는 표시 이름을 반환합니다.
 *
 * @param {string} filter - 'total' 또는 'acc_{id}'
 * @param {Array} accounts - 계좌 목록
 * @returns {string} 필터 표시명
 */
export const getCurrentFilterName = (filter, accounts) => {
  if (filter === 'total') return '총 자산';
  return accounts?.find((a) => `acc_${a.id}` === filter)?.name || '계좌';
};

/**
 * 히스토리 시계열을 차트 모드('asset' | 'index')와 계좌 필터에 맞게 변환하고,
 * 현재 표시 중인 displayValue 시계열 기준 고점 대비 낙폭(drawdown)을 함께 계산합니다.
 *
 * @param {Array} history - 스냅샷 시계열 배열
 * @param {'asset' | 'index'} chartMode - 차트 표시 모드
 * @param {string} filter - 계좌 필터 키 ('total' 또는 'acc_{id}')
 * @returns {Array} Recharts 렌더링용 데이터 배열 (displayValue, drawdown 포함)
 */
export const buildChartDisplayData = (history, chartMode, filter) => {
  if (!history || history.length === 0) return [];

  let runningPeak = -Infinity;

  return history.map((item) => {
    const displayValue =
      chartMode === 'index'
        ? Number(item.index ?? BASE_INDEX)
        : filter === 'total'
          ? Number(item.total || 0)
          : Number(item[filter] || 0);

    if (displayValue > runningPeak) {
      runningPeak = displayValue;
    }

    const drawdown =
      runningPeak > 0 ? ((displayValue - runningPeak) / runningPeak) * 100 : 0;

    return {
      ...item,
      timestamp: new Date(item.date).getTime(),
      displayValue,
      drawdown,
    };
  });
};

/**
 * 변환된 차트 시계열에서 상시 요약 바용 최신 지표 및 역대 최대 낙폭(MDD)을 추출합니다.
 *
 * @param {Array} chartData - buildChartDisplayData가 반환한 시계열 배열
 * @returns {{
 *   latest: Object|null,
 *   latestValue: number,
 *   latestIndex: number,
 *   latestCumReturn: number,
 *   currentDrawdown: number,
 *   maxDrawdown: number,
 * }} 상시 요약 지표 객체
 */
export const getChartSummaryMetrics = (chartData) => {
  if (!chartData || chartData.length === 0) {
    return {
      latest: null,
      latestValue: 0,
      latestIndex: BASE_INDEX,
      latestCumReturn: 0,
      currentDrawdown: 0,
      maxDrawdown: 0,
    };
  }

  const latest = chartData[chartData.length - 1];
  const maxDrawdown = chartData.reduce(
    (minDd, item) => Math.min(minDd, Number(item.drawdown ?? 0)),
    0
  );

  return {
    latest,
    latestValue: Number(latest.displayValue ?? 0),
    latestIndex: Number(latest.index ?? BASE_INDEX),
    latestCumReturn: Number(latest.index_cum_return_pct ?? 0),
    currentDrawdown: Number(latest.drawdown ?? 0),
    maxDrawdown,
  };
};

/**
 * Recharts AreaChart의 onMouseMove 상태 객체에서 호버 중인 데이터 포인트를 안전하게 추출합니다.
 *
 * @param {Object} chartState - Recharts 차트 이벤트 상태 객체
 * @param {Array} chartData - 현재 차트 시계열 배열
 * @returns {Object|null} 호버 중인 데이터 포인트 또는 null
 */
export const resolveHoveredChartPoint = (chartState, chartData) => {
  if (!chartState || chartState.isTooltipActive === false || !Array.isArray(chartData)) {
    return null;
  }

  if (chartState.activeTooltipIndex !== undefined && chartState.activeTooltipIndex !== null) {
    const idx = Number(chartState.activeTooltipIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < chartData.length) {
      return chartData[idx];
    }
  }

  return chartState.activePayload?.[0]?.payload || null;
};

/**
 * 차트 영역을 가리는 플로팅 툴팁을 렌더링하지 않기 위한 빈 툴팁 렌더러입니다.
 * Recharts의 세로 가이드라인(cursor)과 activeDot 추적은 유지됩니다.
 *
 * @returns {null}
 */
export const renderNullTooltip = () => null;

/**
 * 데스크탑 및 모바일 자산 추이 차트에서 공통으로 사용하는 상태 및 파생 지표 훅입니다.
 *
 * @param {Object} params
 * @param {Array} [params.history] - 스냅샷 시계열 배열
 * @param {Array} [params.accounts] - 계좌 목록 배열
 * @returns {Object} 차트 모드, 필터, 호버 포인트, 파생 시계열/요약 지표 및 이벤트 핸들러
 */
export const useAssetChartState = ({ history, accounts }) => {
  const [chartMode, setChartMode] = useState('asset');
  const [filter, setFilter] = useState('total');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const chartData = useMemo(
    () => buildChartDisplayData(history, chartMode, filter),
    [history, filter, chartMode]
  );

  const summary = useMemo(() => getChartSummaryMetrics(chartData), [chartData]);
  const currentFilterName = getCurrentFilterName(filter, accounts);

  const handleModeChange = useCallback((nextMode) => {
    setChartMode(nextMode);
    setHoveredPoint(null);
  }, []);

  const handleFilterChange = useCallback((nextFilter) => {
    setFilter(nextFilter);
    setHoveredPoint(null);
  }, []);

  const handleChartMouseMove = useCallback(
    (chartState) => {
      setHoveredPoint(resolveHoveredChartPoint(chartState, chartData));
    },
    [chartData]
  );

  const clearHoveredPoint = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  return {
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
  };
};

/**
 * 자산 추이 시각화를 위한 데스크탑 라인 차트 컴포넌트입니다.
 *
 * @param {Object} props
 * @param {Object} props.data - 시계열 자산 데이터
 * @param {Array} props.data.history - 일자별 자산 합계 및 계좌별 데이터 리스트
 * @param {Array} props.data.accounts - 계좌 정보 리스트 (필터링용)
 * @param {string} [props.className='mb-10'] - 외부 컨테이너 추가 클래스
 */
const AssetChart = ({ data, className = 'mb-10' }) => {
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

  const formatCurrency = (val) => formatShortCurrency(val, maskValue);

  if (!history || history.length === 0) {
    return (
      <div className={`bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center ${className}`}>
        <TrendingUp className="mx-auto text-slate-200 mb-4" size={48} />
        <p className="text-slate-400 font-medium">표시할 자산 추이 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col ${className}`}>
      <div className="flex flex-col gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={28} />
            자산 추이
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {chartMode === 'index'
              ? '기준일(1,000.00 pt) 대비 입출금을 제외한 순수 투자 성과 지수 추이'
              : `시간에 따른 자산 평가액 변화 (${currentFilterName})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            {CHART_MODES.map((tab) => {
              const isActive = chartMode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleModeChange(tab.key)}
                  aria-pressed={isActive}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {chartMode === 'asset' && (
            <div className="flex items-center gap-2">
              <Filter className="text-slate-400" size={18} />
              <select
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="bg-slate-50 border-none text-slate-700 text-sm font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="total">총 자산 합계</option>
                {accounts?.map((acc) => (
                  <option key={acc.id} value={`acc_${acc.id}`}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 차트 위: 상시 요약 바 (항상 표시) */}
      <div
        data-testid="asset-chart-summary-bar"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 mb-4 rounded-2xl bg-slate-50 border border-slate-100"
      >
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-400">
            {chartMode === 'index' ? '현재 수익 지수' : '현재 평가액'}
          </span>
          {chartMode === 'index' ? (
            <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
              <span className="text-lg font-extrabold text-blue-600 tabular-nums">
                {formatIndexPt(summary.latestIndex)}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
                  summary.latestCumReturn >= 0
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                }`}
              >
                {formatSignedPercent(summary.latestCumReturn)}
              </span>
            </div>
          ) : (
            <span className="mt-0.5 text-lg font-extrabold text-slate-800 tabular-nums">
              {formatFullCurrency(summary.latestValue, maskValue)}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:border-l sm:border-slate-200/80 sm:pl-3">
          <span className="text-xs font-semibold text-slate-400">현재 낙폭 (DD)</span>
          <span
            className={`mt-0.5 text-lg font-extrabold tabular-nums ${
              isNegativeDrawdown(summary.currentDrawdown) ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {formatDrawdown(summary.currentDrawdown)}
          </span>
        </div>

        <div className="flex flex-col sm:border-l sm:border-slate-200/80 sm:pl-3">
          <span className="text-xs font-semibold text-slate-400">역대 최대 낙폭 (MDD)</span>
          <span className="mt-0.5 text-lg font-extrabold text-rose-600 tabular-nums">
            {formatDrawdown(summary.maxDrawdown)}
          </span>
        </div>
      </div>

      {/* 차트 영역 (플로팅 툴팁 제거, 세로 가이드선 및 포인트 강조 유지) */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={clearHoveredPoint}
          >
            <defs>
              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              dy={10}
              tickFormatter={formatShortDateTick}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickFormatter={chartMode === 'index' ? formatIndexAxis : formatCurrency}
              domain={chartMode === 'index' ? ['auto', 'auto'] : [0, 'auto']}
              width={chartMode === 'index' ? 70 : 60}
            />
            {chartMode === 'index' && (
              <ReferenceLine
                y={BASE_INDEX}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            <Tooltip
              content={renderNullTooltip}
              cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3', strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="displayValue"
              stroke="#2563eb"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorVal)"
              activeDot={{ r: 5.5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2.5 }}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 차트 아래: 고정 높이 호버 상세 바 (직전 대비 등락률 제외) */}
      <div
        data-testid="asset-chart-hover-bar"
        className={`mt-4 min-h-[54px] px-4 py-3 rounded-2xl border flex flex-wrap items-center gap-x-6 gap-y-2 transition-colors ${
          hoveredPoint
            ? 'bg-blue-50/60 border-blue-100 justify-between'
            : 'bg-slate-50/90 border-slate-100 justify-center'
        }`}
      >
        {!hoveredPoint ? (
          <span className="text-xs font-medium text-slate-400">
            차트에 마우스를 올리면 해당 시점의 상세 정보가 표시됩니다.
          </span>
        ) : chartMode === 'asset' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {formatDisplayDate(hoveredPoint.date)}
              </span>
              <span className="text-xs text-slate-400 font-medium">({currentFilterName})</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">평가액</span>
                <span className="text-sm font-extrabold text-slate-800 tabular-nums">
                  {formatFullCurrency(hoveredPoint.displayValue, maskValue)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">고점 대비 낙폭</span>
                <span
                  className={`text-sm font-extrabold tabular-nums ${
                    isNegativeDrawdown(hoveredPoint.drawdown) ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {formatDrawdown(hoveredPoint.drawdown)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {formatDisplayDate(hoveredPoint.date)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">내 자산 지수</span>
                <span className="text-sm font-extrabold text-blue-600 tabular-nums">
                  {formatIndexPt(hoveredPoint.index)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">기준일(1,000pt) 대비</span>
                <span
                  className={`text-sm font-extrabold tabular-nums ${
                    Number(hoveredPoint.index_cum_return_pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatSignedPercent(hoveredPoint.index_cum_return_pct)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">고점 대비 낙폭</span>
                <span
                  className={`text-sm font-extrabold tabular-nums ${
                    isNegativeDrawdown(hoveredPoint.drawdown) ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {formatDrawdown(hoveredPoint.drawdown)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetChart;
