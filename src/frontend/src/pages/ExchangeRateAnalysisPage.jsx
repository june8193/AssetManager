import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { DollarSign, AlertCircle, RefreshCw } from 'lucide-react';

// 조회 기간 정의 (MarketAnalysisPage 패턴 통일 + 단기 1개월/3개월 포함)
const PERIODS = [
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '1Y', label: '1년' },
  { value: '3Y', label: '3년' },
  { value: '5Y', label: '5년' },
  { value: '10Y', label: '10년' },
  { value: '20Y', label: '20년' },
  { value: 'ALL', label: '전체' },
];

/**
 * 원/달러 환율 금액을 소수점 둘째 자리까지 한국어 천단위 포맷('원')으로 변환합니다.
 */
function formatKrw(value, signed = false) {
  if (value === undefined || value === null || isNaN(value)) return '-';
  const prefix = signed && value >= 0 ? '+' : '';
  return `${prefix}${value.toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}원`;
}

/**
 * 등락률을 부호 포함 소수점 둘째 자리 퍼센트 문자열로 변환합니다.
 */
function formatSignedPct(value) {
  if (value === undefined || value === null || isNaN(value)) return '-';
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

/**
 * 등락률 부호에 따른 Tailwind 텍스트 색상 클래스를 반환합니다.
 */
function getChangeColorClass(value) {
  if (value > 0) return 'text-rose-600';
  if (value < 0) return 'text-emerald-600';
  return 'text-slate-500';
}

/**
 * USD/KRW & DXY 2단 동기화 차트 공통 커스텀 툴팁 컴포넌트입니다.
 */
function ExchangeRateSyncTooltip({ active, payload, label, summary }) {
  if (!active || !payload || payload.length === 0 || !label) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const rateVal = point.rate;
  const dxyVal = point.dxy;
  const sourceLabel = point.source === 'kiwoom' ? '키움 API' : '과거 백필';

  const highRate = summary?.high_rate;
  const lowRate = summary?.low_rate;
  const fromHighWon = highRate ? rateVal - highRate : null;
  const fromHighPct = highRate ? (fromHighWon / highRate) * 100 : null;
  const fromLowWon = lowRate ? rateVal - lowRate : null;
  const fromLowPct = lowRate ? (fromLowWon / lowRate) * 100 : null;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-3.5 rounded-2xl shadow-xl text-white text-xs min-w-[235px] z-50">
      <div className="font-bold text-slate-300 mb-2 border-b border-slate-800/80 pb-1.5 flex items-center justify-between gap-3">
        <span className="tabular-nums">{label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
          {sourceLabel}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-blue-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            USD/KRW
          </span>
          <span className="font-black text-white tabular-nums">
            {formatKrw(rateVal)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-purple-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            DXY
          </span>
          <span className="font-black text-purple-300 tabular-nums">
            {dxyVal !== undefined && dxyVal !== null ? `${dxyVal.toFixed(2)} pt` : '-'}
          </span>
        </div>

        {fromHighWon !== null && fromLowWon !== null && (
          <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">기간 고점 대비</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {formatKrw(fromHighWon, true)} ({formatSignedPct(fromHighPct)})
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">기간 저점 대비</span>
              <span className="font-bold text-rose-400 tabular-nums">
                {formatKrw(fromLowWon, true)} ({formatSignedPct(fromLowPct)})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 데스크탑 시장분석 > 환율분석 페이지 컴포넌트입니다.
 *
 * 원/달러(USD/KRW) 환율과 미국 달러인덱스(DXY)의 시점 동기화 추이 및
 * 선택 기간 기준 고점 대비 하락/저점 대비 상승 위치를 제공합니다.
 */
export default function ExchangeRateAnalysisPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('3Y');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 기간에 따른 시작일/종료일 계산
  const dateRange = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    const start = new Date(today);

    if (selectedPeriod === '1M') {
      start.setMonth(start.getMonth() - 1);
    } else if (selectedPeriod === '3M') {
      start.setMonth(start.getMonth() - 3);
    } else if (selectedPeriod === '1Y') {
      start.setFullYear(start.getFullYear() - 1);
    } else if (selectedPeriod === '3Y') {
      start.setFullYear(start.getFullYear() - 3);
    } else if (selectedPeriod === '5Y') {
      start.setFullYear(start.getFullYear() - 5);
    } else if (selectedPeriod === '10Y') {
      start.setFullYear(start.getFullYear() - 10);
    } else if (selectedPeriod === '20Y') {
      start.setFullYear(start.getFullYear() - 20);
    } else if (selectedPeriod === 'ALL') {
      return { start_date: '1995-01-01', end_date: endStr };
    }

    return { start_date: start.toISOString().split('T')[0], end_date: endStr };
  }, [selectedPeriod]);

  const fetchExchangeRateData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start_date, end_date } = dateRange;
      const res = await fetch(
        `/api/market/analysis/exchange-rate?start_date=${start_date}&end_date=${end_date}`
      );
      if (!res.ok) {
        throw new Error('환율 분석 데이터를 가져오는데 실패했습니다.');
      }
      const json = await res.json();
      setAnalysisData(json);
    } catch (err) {
      setError(err.message || '데이터 로딩 오류');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchExchangeRateData();
  }, [fetchExchangeRateData]);

  // 차트 데이터셋 변환
  const chartData = useMemo(() => {
    if (!analysisData?.labels) return [];
    return analysisData.labels.map((label, idx) => ({
      date: label,
      rate: analysisData.rates?.[idx] ?? null,
      dxy: analysisData.dxy?.[idx] ?? null,
      source: analysisData.sources?.[idx] ?? 'backfill',
    }));
  }, [analysisData]);

  // 차트 데이터 내 최고/최저 포인트 (주간 다운샘플링 시에도 ReferenceDot이 정확히 매칭되도록 계산)
  const chartExtrema = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    let highPoint = chartData[0];
    let lowPoint = chartData[0];
    for (const item of chartData) {
      if (item.rate !== null && item.rate > highPoint.rate) highPoint = item;
      if (item.rate !== null && item.rate < lowPoint.rate) lowPoint = item;
    }
    return { highPoint, lowPoint };
  }, [chartData]);

  const summary = analysisData?.summary;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* 1. 상단 타이틀 & 데이터 출처 배지 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <DollarSign className="text-blue-600" size={30} />
              환율분석
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
              USD/KRW · DXY
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-1">
            원/달러(USD/KRW) 환율과 미국 달러인덱스(DXY) 추이 및 기간 고점·저점 대비 위치를 조회합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            원/달러: 키움 API 일원화
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            DXY: 일일 동기화 DB
          </span>
        </div>
      </div>

      {/* 2. 상단 컨트롤바 (조회 기간 필터) */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="font-black text-slate-700">조회 기간</span>
          <span className="tabular-nums">
            {chartData.length > 0
              ? `${chartData[0].date} ~ ${chartData[chartData.length - 1].date}`
              : `${dateRange.start_date} ~ ${dateRange.end_date}`}
          </span>
        </div>

        <div className="flex flex-wrap bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/40 gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setSelectedPeriod(p.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                selectedPeriod === p.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 로딩 / 에러 상태 */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[45vh] gap-4">
          <RefreshCw className="animate-spin text-blue-600" size={40} />
          <p className="text-slate-500 font-bold">환율 데이터를 분석 중입니다...</p>
        </div>
      )}

      {error && !loading && (
        <div className="max-w-xl mx-auto py-12 text-center">
          <div className="bg-red-50 border border-red-100 p-8 rounded-3xl inline-flex flex-col items-center">
            <AlertCircle className="text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-red-700 mb-6">{error}</p>
            <button
              type="button"
              onClick={fetchExchangeRateData}
              className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 4. 메인 콘텐츠 */}
      {!loading && !error && summary && chartData.length > 0 && (
        <div className="space-y-6">
          {/* 4-1. 선택 기간 고점·저점 대비 현재 위치 패널 (USD/KRW) */}
          <section
            data-testid="exchange-rate-position-panel"
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-800">
                  선택 기간 고점 · 저점 대비 현재 위치
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/60">
                  USD/KRW 기준
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                현재 환율{' '}
                <strong className="text-slate-800 font-black tabular-nums">
                  {formatKrw(summary.latest_rate)}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 기간 고점 대비 */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>기간 고점 대비</span>
                  <span className="tabular-nums">{summary.high_date}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black text-emerald-600 tabular-nums">
                    {formatKrw(summary.from_high_amount, true)}
                  </span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700 tabular-nums">
                    {formatSignedPct(summary.from_high_rate)}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  기간 최고:{' '}
                  <span className="font-bold text-slate-700 tabular-nums">
                    {formatKrw(summary.high_rate)}
                  </span>
                </div>
              </div>

              {/* 기간 저점 대비 */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>기간 저점 대비</span>
                  <span className="tabular-nums">{summary.low_date}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black text-rose-600 tabular-nums">
                    {formatKrw(summary.from_low_amount, true)}
                  </span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700 tabular-nums">
                    {formatSignedPct(summary.from_low_rate)}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  기간 최저:{' '}
                  <span className="font-bold text-slate-700 tabular-nums">
                    {formatKrw(summary.low_rate)}
                  </span>
                </div>
              </div>

              {/* 기간 레인지 위치 바 */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">기간 레인지 내 위치</span>
                  <span className="font-black text-blue-600 tabular-nums">
                    {summary.range_position_pct.toFixed(1)}%
                  </span>
                </div>

                <div className="relative py-1">
                  <div className="w-full h-2.5 rounded-full bg-white border border-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${summary.range_position_pct}%` }}
                    />
                  </div>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-600 shadow-sm transition-all duration-300"
                    style={{ left: `${summary.range_position_pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums font-medium">
                  <span>저점 {Math.round(summary.low_rate).toLocaleString('ko-KR')}원 (0%)</span>
                  <span>고점 {Math.round(summary.high_rate).toLocaleString('ko-KR')}원 (100%)</span>
                </div>
              </div>
            </div>
          </section>

          {/* 4-2. 통합 동기화 2단 차트 카드 */}
          <section
            data-testid="integrated-exchange-rate-chart"
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
          >
            {/* 상단 헤더 & KPI 배지 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  원/달러(USD/KRW) &amp; 달러인덱스(DXY) 추이
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  차트 위에 마우스를 올리면 동일 날짜의 원/달러 환율, 달러인덱스, 고점/저점 대비 위치를 함께 확인합니다.
                </p>
                {analysisData?.is_weekly && (
                  <p className="text-[11px] text-slate-400 font-bold mt-1">
                    ※ 3년 초과 조회 시 차트 최적화를 위해 주간(Weekly) 종가 데이터를 표시합니다.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">최근 USD/KRW</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-black text-slate-800 tabular-nums">
                      {formatKrw(summary.latest_rate)}
                    </span>
                    <span className={`text-xs font-bold tabular-nums ${getChangeColorClass(summary.daily_change_rate)}`}>
                      {formatSignedPct(summary.daily_change_rate)}
                    </span>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">최근 DXY</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-black text-purple-600 tabular-nums">
                      {summary.latest_dxy !== null && summary.latest_dxy !== undefined
                        ? `${summary.latest_dxy.toFixed(2)} pt`
                        : '-'}
                    </span>
                    {summary.latest_dxy !== null && summary.latest_dxy !== undefined && (
                      <span className={`text-xs font-bold tabular-nums ${getChangeColorClass(summary.dxy_change_rate)}`}>
                        {formatSignedPct(summary.dxy_change_rate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 차트 1: USD/KRW */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  USD/KRW 원/달러 환율 (원)
                </span>
                <span className="text-slate-400 font-medium">
                  기간 최고/최저 점선 &amp; 마커 표시
                  {summary.kiwoom_start_date ? ` · ${summary.kiwoom_start_date}~ 키움 API` : ''}
                </span>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    syncId="exchangeRateSync"
                    margin={{ top: 14, right: 16, left: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="krwGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => Math.round(val).toLocaleString('ko-KR')}
                      width={52}
                    />
                    <Tooltip
                      content={<ExchangeRateSyncTooltip summary={summary} />}
                      cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                    />
                    {summary.high_rate && (
                      <ReferenceLine
                        y={summary.high_rate}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                      />
                    )}
                    {summary.low_rate && (
                      <ReferenceLine
                        y={summary.low_rate}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#krwGradient)"
                      isAnimationActive={false}
                    />
                    {chartExtrema?.highPoint && (
                      <ReferenceDot
                        x={chartExtrema.highPoint.date}
                        y={chartExtrema.highPoint.rate}
                        r={4.5}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    )}
                    {chartExtrema?.lowPoint && (
                      <ReferenceDot
                        x={chartExtrema.lowPoint.date}
                        y={chartExtrema.lowPoint.rate}
                        r={4.5}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* 차트 2: DXY */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  DXY 미국 달러인덱스 (pt)
                </span>
                <span className="text-slate-400 font-medium">기준선: 100 pt (달러 강세/약세 기준)</span>
              </div>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    syncId="exchangeRateSync"
                    margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="dxyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => val.toFixed(1)}
                      width={52}
                    />
                    <Tooltip
                      content={<ExchangeRateSyncTooltip summary={summary} />}
                      cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                    />
                    <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Area
                      type="monotone"
                      dataKey="dxy"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#dxyGradient)"
                      connectNulls
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      )}

      {!loading && !error && (!analysisData || chartData.length === 0) && (
        <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center text-slate-500 font-bold">
          조회된 환율 데이터가 없습니다.
        </div>
      )}
    </main>
  );
}
