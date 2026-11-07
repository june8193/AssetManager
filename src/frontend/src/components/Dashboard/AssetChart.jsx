import React, { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { TrendingUp, Filter } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

export const BASE_INDEX = 1000;

export const CHART_MODES = [
  { key: 'asset', label: '총자산 규모 (원)' },
  { key: 'index', label: '수익 지수 (Index)' },
];

const INDEX_TOOLTIP_THEMES = {
  light: {
    container: 'bg-white rounded-2xl shadow-lg p-3.5 border border-slate-100 text-xs space-y-2 min-w-[200px]',
    date: 'font-bold text-slate-700 pb-1.5 border-b border-slate-100',
    label: 'text-slate-500 font-medium',
    indexValue: 'font-extrabold text-blue-600',
    row: 'flex items-center justify-between gap-4',
    positive: 'text-emerald-600',
    negative: 'text-rose-600',
  },
  dark: {
    container: 'bg-slate-900/95 border border-slate-700 rounded-2xl shadow-xl p-3 text-xs space-y-1.5 min-w-[185px]',
    date: 'font-bold text-slate-200 pb-1 border-b border-slate-800',
    label: 'text-slate-400 font-medium',
    indexValue: 'font-extrabold text-sky-400',
    row: 'flex items-center justify-between gap-3',
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
  },
};

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
 * 자산 규모 탭 툴팁 값 포맷터 배열([포맷된 금액, 라벨])을 반환합니다.
 *
 * @param {number} value - 평가 금액
 * @param {string} filterName - 현재 필터 표시명
 * @param {Function} maskValue - 마스킹 함수
 * @returns {[string, string]}
 */
export const formatAssetTooltipEntry = (value, filterName, maskValue) => [
  `${maskValue(Math.round(value).toLocaleString())} 원`,
  filterName,
];

/**
 * 히스토리 시계열을 차트 모드('asset' | 'index')와 계좌 필터에 맞게 변환합니다.
 *
 * @param {Array} history - 스냅샷 시계열 배열
 * @param {'asset' | 'index'} chartMode - 차트 표시 모드
 * @param {string} filter - 계좌 필터 키 ('total' 또는 'acc_{id}')
 * @returns {Array} Recharts 렌더링용 데이터 배열
 */
export const buildChartDisplayData = (history, chartMode, filter) => {
  if (!history) return [];
  return history.map((item) => ({
    ...item,
    timestamp: new Date(item.date).getTime(),
    displayValue:
      chartMode === 'index'
        ? (item.index ?? BASE_INDEX)
        : filter === 'total'
          ? (item.total || 0)
          : (item[filter] || 0),
  }));
};

/**
 * 시계열의 최신 수익 지수 및 누적 등락률 요약 정보를 반환합니다.
 *
 * @param {Array} history - 스냅샷 시계열 배열
 * @returns {{ latestIndex: number, latestCumReturn: number, formattedBadgeText: string }}
 */
export const getLatestIndexSummary = (history) => {
  const latestItem = history && history.length > 0 ? history[history.length - 1] : null;
  const latestIndex = latestItem?.index ?? BASE_INDEX;
  const latestCumReturn = latestItem?.index_cum_return_pct ?? 0.0;
  return {
    latestIndex,
    latestCumReturn,
    formattedBadgeText: `${formatIndexPt(latestIndex)} (${formatSignedPercent(latestCumReturn)})`,
  };
};

/**
 * 테마('light' | 'dark')에 맞는 수익 지수 3종 지표 커스텀 툴팁 렌더러를 생성합니다.
 *
 * @param {'light' | 'dark'} [themeKey='light'] - 툴팁 테마 키
 * @returns {Function} Recharts Tooltip content 렌더 함수
 */
export const createIndexTooltipRenderer = (themeKey = 'light') => {
  const theme = INDEX_TOOLTIP_THEMES[themeKey] || INDEX_TOOLTIP_THEMES.light;

  return ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0]?.payload || {};
    const idxVal = Number(item.index ?? BASE_INDEX);
    const returnRows = [
      { label: '직전 대비 등락률', value: Number(item.index_change_pct ?? 0) },
      { label: '기준일(1,000pt) 대비', value: Number(item.index_cum_return_pct ?? 0) },
    ];

    return (
      <div className={theme.container}>
        <div className={theme.date}>{new Date(label).toLocaleDateString()}</div>
        <div className={theme.row}>
          <span className={theme.label}>내 자산 지수</span>
          <span className={theme.indexValue}>{formatIndexPt(idxVal)}</span>
        </div>
        {returnRows.map((row) => (
          <div key={row.label} className={theme.row}>
            <span className={theme.label}>{row.label}</span>
            <span className={`font-bold ${row.value >= 0 ? theme.positive : theme.negative}`}>
              {formatSignedPercent(row.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };
};

const renderDesktopIndexTooltip = createIndexTooltipRenderer('light');

/**
 * 자산 추이 시각화를 위한 라인 차트 컴포넌트입니다.
 * 
 * @param {Object} props
 * @param {Object} props.data - 시계열 자산 데이터
 * @param {Array} props.data.history - 일자별 자산 합계 및 계좌별 데이터 리스트
 * @param {Array} props.data.accounts - 계좌 정보 리스트 (필터링용)
 */
const AssetChart = ({ data }) => {
  const [chartMode, setChartMode] = useState('asset'); // 'asset' | 'index'
  const [filter, setFilter] = useState('total'); // 'total' or account_id string 'acc_1'
  const { maskValue } = useMasking();

  const { history, accounts } = data || {};

  const chartData = useMemo(
    () => buildChartDisplayData(history, chartMode, filter),
    [history, filter, chartMode]
  );

  const formatCurrency = (val) => formatShortCurrency(val, maskValue);
  const currentFilterName = getCurrentFilterName(filter, accounts);
  const { latestCumReturn, formattedBadgeText } = getLatestIndexSummary(history);

  if (!history || history.length === 0) {
    return (
      <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm mb-10 text-center">
        <TrendingUp className="mx-auto text-slate-200 mb-4" size={48} />
        <p className="text-slate-400 font-medium">표시할 자산 추이 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <TrendingUp className="text-blue-600" size={28} />
              자산 추이
            </h2>
            {chartMode === 'index' && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  latestCumReturn >= 0
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                }`}
              >
                {formattedBadgeText}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {chartMode === 'index'
              ? '기준일(1,000.00 pt) 대비 입출금을 제외한 순수 투자 성과 지수 추이'
              : `시간에 따른 자산 평가액 변화 (${currentFilterName})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            {CHART_MODES.map((tab) => {
              const isActive = chartMode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setChartMode(tab.key)}
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
                onChange={(e) => setFilter(e.target.value)}
                className="bg-slate-50 border-none text-slate-700 text-sm font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="total">총 자산 합계</option>
                {accounts?.map(acc => (
                  <option key={acc.id} value={`acc_${acc.id}`}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
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
              content={chartMode === 'index' ? renderDesktopIndexTooltip : undefined}
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px'
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
              stroke="#2563eb" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorVal)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AssetChart;
