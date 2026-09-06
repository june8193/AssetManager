import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, BarChart3, Calendar, AlertCircle, RefreshCw, 
  ChevronRight, LayoutGrid, Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 지수 정보 정의
const INDICES = [
  { ticker: '^GSPC', name: 'S&P 500', region: 'US', color: '#3b82f6', bgGradient: 'from-blue-500/10 to-transparent' },
  { ticker: '^IXIC', name: 'NASDAQ', region: 'US', color: '#8b5cf6', bgGradient: 'from-purple-500/10 to-transparent' },
  { ticker: '^KS11', name: 'KOSPI', region: 'KR', color: '#10b981', bgGradient: 'from-emerald-500/10 to-transparent' },
  { ticker: '^KQ11', name: 'KOSDAQ', region: 'KR', color: '#f59e0b', bgGradient: 'from-amber-500/10 to-transparent' }
];

// 기간 정의
const PERIODS = [
  { value: '1Y', label: '1년' },
  { value: '3Y', label: '3년' },
  { value: '5Y', label: '5년' },
  { value: '10Y', label: '10년' },
  { value: '20Y', label: '20년' },
  { value: '30Y', label: '30년' },
  { value: 'ALL', label: '전체' }
];

/**
 * VIX 지수 값에 따라 4단계 시장 리스크 상태(안정/주의/경고/위기) 정보를 반환합니다.
 * @param {number|null|undefined} vix 
 * @returns {{ level: string, label: string, color: string, bg: string, text: string, border: string } | null}
 */
export function getVixStatus(vix) {
  if (vix === null || vix === undefined || isNaN(vix)) return null;
  if (vix < 20) {
    return {
      level: 'stable',
      label: '안정',
      color: '#10B981',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200'
    };
  }
  if (vix < 30) {
    return {
      level: 'caution',
      label: '주의',
      color: '#F59E0B',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200'
    };
  }
  if (vix < 40) {
    return {
      level: 'warning',
      label: '경고',
      color: '#EF4444',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200'
    };
  }
  return {
    level: 'crisis',
    label: '위기',
    color: '#991B1B',
    bg: 'bg-red-100',
    text: 'text-[#991B1B]',
    border: 'border-red-300'
  };
}

/**
 * 3개 서브플롯(지수, MDD, VIX) 공통 통합 툴팁 컴포넌트입니다.
 */
function IntegratedChartTooltip({ active, payload, label, activeIndexInfo, chartData }) {
  if (!active || !label) return null;
  const currentPoint = chartData?.find(d => d.date === label) || {};
  const priceVal = currentPoint.value;
  const mddVal = currentPoint.mdd;
  const vixVal = currentPoint.vix;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-3.5 rounded-2xl shadow-xl text-white text-xs min-w-[210px] z-50">
      <div className="font-bold text-slate-400 mb-2 border-b border-slate-800/80 pb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-slate-500 font-normal">통합 동기화</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-blue-400 font-medium">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeIndexInfo?.color || '#3b82f6' }}></span>
            {activeIndexInfo?.name || '지수'}:
          </span>
          <span className="font-black text-white">
            {priceVal !== undefined && priceVal !== null ? `${priceVal.toLocaleString()} pt` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            MDD:
          </span>
          <span className="font-black text-rose-400">
            {mddVal !== undefined && mddVal !== null ? `${mddVal.toFixed(2)}%` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-purple-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            VIX:
          </span>
          <span className="font-black text-purple-300">
            {vixVal !== undefined && vixVal !== null ? `${vixVal.toFixed(2)} pt` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MarketAnalysisPage() {
  const [activeTab, setActiveTab] = useState('individual'); // 'individual' | 'comparison'
  const [selectedTicker, setSelectedTicker] = useState('^GSPC');
  const [selectedPeriod, setSelectedPeriod] = useState('3Y');
  
  // 데이터 상태
  const [historicalData, setHistoricalData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

  // 로딩 & 에러
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 하단 테이블 서브 탭 ('monthly' | 'yearly')
  const [tableSubTab, setTableSubTab] = useState('monthly');

  // VIX 안내 팝오버 상태 및 외부 클릭 Ref
  const [isVixInfoOpen, setIsVixInfoOpen] = useState(false);
  const vixInfoRef = useRef(null);
  const lastMouseEnterRef = useRef(0);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (vixInfoRef.current && !vixInfoRef.current.contains(event.target)) {
        setIsVixInfoOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 선택된 지수 정보
  const activeIndexInfo = useMemo(() => {
    return INDICES.find(idx => idx.ticker === selectedTicker) || INDICES[0];
  }, [selectedTicker]);

  // 기간에 따른 날짜 계산
  const dateRange = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    let startStr = '2020-01-01'; // Default

    if (selectedPeriod === '1Y') {
      today.setFullYear(today.getFullYear() - 1);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '3Y') {
      today.setFullYear(today.getFullYear() - 3);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '5Y') {
      today.setFullYear(today.getFullYear() - 5);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '10Y') {
      today.setFullYear(today.getFullYear() - 10);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '20Y') {
      today.setFullYear(today.getFullYear() - 20);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '30Y') {
      today.setFullYear(today.getFullYear() - 30);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === 'ALL') {
      startStr = '1989-01-01'; // DB 최하단 데이터까지 커버할 수 있도록 넓게 잡음
    }

    return { start_date: startStr, end_date: endStr };
  }, [selectedPeriod]);

  // 1. 지수별 역사적 데이터 및 통계 가져오기
  const fetchIndividualData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { start_date, end_date } = dateRange;
      
      const [histRes, statsRes] = await Promise.all([
        fetch(`/api/market/analysis/historical?ticker=${encodeURIComponent(selectedTicker)}&start_date=${start_date}&end_date=${end_date}`),
        fetch(`/api/market/analysis/stats?ticker=${encodeURIComponent(selectedTicker)}&start_date=${start_date}&end_date=${end_date}`)
      ]);

      if (!histRes.ok || !statsRes.ok) {
        throw new Error('데이터를 가져오는데 실패했습니다.');
      }

      const histData = await histRes.json();
      const statsData = await statsRes.json();

      setHistoricalData(histData);
      setStatsData(statsData);
    } catch (err) {
      console.error(err);
      setError(err.message || '데이터 로딩 오류');
    } finally {
      setLoading(false);
    }
  };

  // 2. 4대 지수 비교 테이블 가져오기
  const fetchComparisonData = async () => {
    try {
      const res = await fetch('/api/market/analysis/comparison');
      if (!res.ok) throw new Error('비교 테이블 데이터를 가져오는데 실패했습니다.');
      const data = await res.json();
      setComparisonData(data);
    } catch (err) {
      console.error(err);
    }
  };

  // 지수 선택이나 기간 선택 시 데이터 갱신
  useEffect(() => {
    if (activeTab === 'individual') {
      fetchIndividualData();
    } else {
      fetchComparisonData();
    }
  }, [selectedTicker, selectedPeriod, activeTab, dateRange]);

  // 최초 로드 시 전체 데이터 로드
  useEffect(() => {
    fetchComparisonData();
  }, []);

  // 차트 데이터셋 포맷팅
  const chartData = useMemo(() => {
    if (!historicalData || !historicalData.labels) return [];
    return historicalData.labels.map((label, idx) => ({
      date: label,
      value: historicalData.prices[idx],
      mdd: historicalData.mdd[idx],
      vix: historicalData.vix ? historicalData.vix[idx] : null
    }));
  }, [historicalData]);

  // 기간 내 최대 공포(VIX 최고치) 및 최대 낙폭(MDD 바닥) 상관관계 통계 계산
  const correlationStats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    let maxVixItem = null;
    let worstMddItem = null;

    for (const item of chartData) {
      if (item.vix !== null && item.vix !== undefined && !isNaN(item.vix)) {
        if (!maxVixItem || item.vix > maxVixItem.vix) {
          maxVixItem = item;
        }
      }
      if (item.mdd !== null && item.mdd !== undefined && !isNaN(item.mdd)) {
        if (!worstMddItem || item.mdd < worstMddItem.mdd) {
          worstMddItem = item;
        }
      }
    }

    return {
      maxVix: maxVixItem,
      worstMdd: worstMddItem
    };
  }, [chartData]);

  // 최근 VIX 수치
  const latestVix = useMemo(() => {
    if (!historicalData?.vix || historicalData.vix.length === 0) return null;
    return historicalData.vix[historicalData.vix.length - 1];
  }, [historicalData]);

  // VIX 위험도 상태 (안정/주의/경고/위기)
  const vixStatus = useMemo(() => getVixStatus(latestVix), [latestVix]);

  // 수익률 배지 스타일 헬퍼
  const renderReturnBadge = (val) => {
    if (val === undefined || val === null) return <span className="text-slate-400 font-bold">-</span>;
    const isPositive = val > 0;
    const isNegative = val < 0;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${
        isPositive 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
          : isNegative 
            ? 'bg-rose-50 text-rose-700 border-rose-100' 
            : 'bg-slate-50 text-slate-600 border-slate-100'
      }`}>
        {isPositive ? '+' : ''}{val.toFixed(2)}%
      </span>
    );
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* 1. 상단 타이틀 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={32} />
            지수분석
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">S&P500, NASDAQ, KOSPI, KOSDAQ의 역대 지수 시각화 및 기간별 통계를 조회합니다.</p>
        </div>

        {/* 메인 탭 전환 */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'individual' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            지수별 상세 분석
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'comparison' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            4대 지수 연간 수익률 비교
          </button>
        </div>
      </div>

      {/* 2. 에러 및 로딩 화면 */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <RefreshCw className="animate-spin text-blue-600" size={40} />
          <p className="text-slate-500 font-bold">금융 데이터를 분석 중입니다...</p>
        </div>
      )}

      {error && !loading && (
        <div className="max-w-xl mx-auto py-12 text-center">
          <div className="bg-red-50 border border-red-100 p-8 rounded-3xl inline-flex flex-col items-center">
            <AlertCircle className="text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-red-700 mb-6">{error}</p>
            <button
              onClick={fetchIndividualData}
              className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 3. 콘텐츠 영역 */}
      {!loading && !error && (
        <AnimatePresence mode="wait">
          {activeTab === 'individual' ? (
            <motion.div 
              key="individual-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* 상단 컨트롤바 (지수 필터 & 기간 필터) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* 지수 선택 */}
                <div className="flex flex-wrap gap-2.5">
                  {INDICES.map(idx => (
                    <button
                      key={idx.ticker}
                      onClick={() => setSelectedTicker(idx.ticker)}
                      className={`px-5 py-3 rounded-2xl text-xs font-black transition-all border ${
                        selectedTicker === idx.ticker
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {idx.name}
                      <span className="ml-1.5 text-[10px] opacity-60 font-medium">({idx.region})</span>
                    </button>
                  ))}
                </div>

                {/* 기간 필터 */}
                <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/40">
                  {PERIODS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setSelectedPeriod(p.value)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
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

              {/* 지수 추이, MDD, VIX 3단 통합 차트 카드 */}
              <div data-testid="integrated-market-chart" className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                {/* 1) 카드 상단 원스톱 헤더 & 요약 바 */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeIndexInfo.color }}></span>
                      {activeIndexInfo.name} 지수 종가 추이
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      지수 종가와 최대 낙폭(MDD), S&P 500 VIX 변동성을 시점별로 동기화하여 상관관계를 분석합니다.
                    </p>
                    {historicalData?.labels && historicalData.labels.length > 200 && (
                      <p className="text-[10px] text-slate-400 font-bold mt-1">※ 3년 초과 조회 시 차트 최적화를 위해 주간(Weekly) 종가 데이터를 표시합니다.</p>
                    )}
                  </div>

                  {/* 3대 지표 실시간 요약 배지 그룹 */}
                  {chartData.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                      {/* 최근 종가 */}
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">최근 종가</span>
                        <span className="text-sm font-black text-slate-800">
                          {chartData[chartData.length - 1].value.toLocaleString()}pt
                        </span>
                      </div>

                      {/* 최근 MDD */}
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">최근 MDD</span>
                        <span className="text-sm font-black text-rose-600">
                          {chartData[chartData.length - 1].mdd.toFixed(2)}%
                        </span>
                      </div>

                      {/* 최근 VIX & 팝오버 가이드 */}
                      <div 
                        className="relative px-3 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-xs flex items-center gap-2"
                        ref={vixInfoRef} 
                        data-testid="vix-info-container"
                        onMouseEnter={() => {
                          lastMouseEnterRef.current = Date.now();
                          setIsVixInfoOpen(true);
                        }}
                        onMouseLeave={() => setIsVixInfoOpen(false)}
                      >
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">최근 VIX</span>
                          <span className="text-sm font-black text-purple-600">
                            {latestVix !== null ? latestVix.toFixed(2) : '-'}
                          </span>
                        </div>
                        
                        {vixStatus && (
                          <span
                            data-testid="vix-status-badge"
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border shadow-xs ${vixStatus.bg} ${vixStatus.text} ${vixStatus.border}`}
                          >
                            {vixStatus.label}
                          </span>
                        )}

                        <button
                          type="button"
                          data-testid="vix-info-button"
                          aria-label="VIX 지표 안내"
                          aria-expanded={isVixInfoOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (Date.now() - lastMouseEnterRef.current < 400) {
                              setIsVixInfoOpen(true);
                            } else {
                              setIsVixInfoOpen((prev) => !prev);
                            }
                          }}
                          className="p-1 rounded-full text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors focus:outline-none"
                        >
                          <Info size={14} />
                        </button>

                        {/* VIX 설명 팝오버 */}
                        <AnimatePresence>
                          {isVixInfoOpen && (
                            <motion.div
                              data-testid="vix-info-popover"
                              role="tooltip"
                              initial={{ opacity: 0, y: 6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute z-50 right-0 top-full mt-2 w-80 sm:w-96 p-5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 text-left"
                            >
                              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                                    <Info size={14} />
                                  </div>
                                  <h3 className="text-sm font-black text-slate-800">VIX 지수 &amp; 시장 심리 가이드</h3>
                                </div>
                              </div>

                              <div className="mt-3 space-y-3">
                                <div>
                                  <h4 className="text-xs font-bold text-purple-700 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                    CBOE S&P 500 변동성 지수 (VIX)
                                  </h4>
                                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                                    향후 30일간 S&P 500 옵션 가격에 반영된 시장의 기대 변동성(내재 변동성)을 나타내며, 투자자들의 공포 수준을 측정하는 대표적인 공포 지수입니다.
                                  </p>
                                </div>

                                <div className="pt-2 border-t border-slate-100">
                                  <h4 className="text-[11px] font-black text-slate-700 mb-2">4단계 리스크 기준선 및 통계적 의미</h4>
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-white shrink-0 mt-0.5">안정 (20 미만)</span>
                                      <div className="text-[11px] text-slate-600">
                                        <span className="font-bold text-emerald-800">정상 및 안정 국면</span>
                                        <p className="text-[10px] text-slate-500">역사적 약 65~80% 분포. 시장 심리가 안정적이고 변동성이 낮은 일반적 환경.</p>
                                      </div>
                                    </div>

                                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-amber-50/70 border border-amber-100">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-white shrink-0 mt-0.5">주의 (20 ~ 30)</span>
                                      <div className="text-[11px] text-slate-600">
                                        <span className="font-bold text-amber-800">시장 불확실성 증가</span>
                                        <p className="text-[10px] text-slate-500">역사적 상위 약 20% 수준. 시장 조정 국면 및 단기 변동성 확대 주의 필요.</p>
                                      </div>
                                    </div>

                                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-red-50/70 border border-red-100">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-500 text-white shrink-0 mt-0.5">경고 (30 ~ 40)</span>
                                      <div className="text-[11px] text-slate-600">
                                        <span className="font-bold text-red-800">본격 패닉 및 투매</span>
                                        <p className="text-[10px] text-slate-500">역사적 상위 약 5% 수준. 과도한 공포 확대로 역발상 분할 매수 기회 고려 구간.</p>
                                      </div>
                                    </div>

                                    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-rose-50/70 border border-rose-100">
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-700 text-white shrink-0 mt-0.5">위기 (40 이상)</span>
                                      <div className="text-[11px] text-slate-600">
                                        <span className="font-bold text-rose-900">극단적 시스템 위기</span>
                                        <p className="text-[10px] text-slate-500">역사적 상위 1% 미만 (리먼·코로나급). 극단적 공포 국면이자 역사적 최적의 매수 기회.</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2) 기간 내 핵심 상관관계 요약 인사이트 칩 */}
                {correlationStats && (
                  <div data-testid="correlation-stats-container" className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    {/* 최대 공포 시점 */}
                    <div data-testid="max-vix-chip" className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0 mt-0.5">
                        <AlertCircle size={16} />
                      </div>
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800">기간 내 최대 공포 (VIX 최고치)</span>
                          {correlationStats.maxVix?.date && (
                            <span className="text-[11px] text-slate-400 font-bold">{correlationStats.maxVix.date}</span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 font-medium">
                          VIX <span className="font-black text-purple-600">{correlationStats.maxVix?.vix !== null && correlationStats.maxVix?.vix !== undefined ? correlationStats.maxVix.vix.toFixed(2) : '-'}pt</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          당시 낙폭(MDD): <span className="font-black text-rose-600">{correlationStats.maxVix?.mdd !== undefined ? correlationStats.maxVix.mdd.toFixed(2) : '-'}%</span>
                          <span className="text-slate-400 ml-1">({correlationStats.maxVix?.value ? correlationStats.maxVix.value.toLocaleString() + 'pt' : '-'})</span>
                        </p>
                      </div>
                    </div>

                    {/* 최대 낙폭 시점 */}
                    <div data-testid="worst-mdd-chip" className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                      <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0 mt-0.5">
                        <TrendingUp size={16} className="rotate-180" />
                      </div>
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800">기간 내 최대 낙폭 (MDD 바닥)</span>
                          {correlationStats.worstMdd?.date && (
                            <span className="text-[11px] text-slate-400 font-bold">{correlationStats.worstMdd.date}</span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 font-medium">
                          MDD <span className="font-black text-rose-600">{correlationStats.worstMdd?.mdd !== undefined ? correlationStats.worstMdd.mdd.toFixed(2) : '-'}%</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          당시 공포(VIX): <span className="font-black text-purple-600">{correlationStats.worstMdd?.vix !== null && correlationStats.worstMdd?.vix !== undefined ? correlationStats.worstMdd.vix.toFixed(2) + 'pt' : '-'}</span>
                          <span className="text-slate-400 ml-1">({correlationStats.worstMdd?.value ? correlationStats.worstMdd.value.toLocaleString() + 'pt' : '-'})</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3) 3단 밀착 서브플롯 차트 컨테이너 */}
                <div className="space-y-2 pt-2">
                  {/* [1단] 지수 종가 차트 */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeIndexInfo.color }}></span>
                        <span className="text-xs font-black text-slate-700">{activeIndexInfo.name} 종가</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">단위: pt</span>
                    </div>
                    
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} syncId="marketAnalysisCharts">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={false}
                            axisLine={false}
                            tickLine={false}
                            height={1}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false}
                            domain={['dataMin - 100', 'dataMax + 100']}
                            tickFormatter={(val) => Math.round(val).toLocaleString()}
                          />
                          <Tooltip 
                            content={<IntegratedChartTooltip activeIndexInfo={activeIndexInfo} chartData={chartData} />}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={activeIndexInfo.color} 
                            strokeWidth={2.5} 
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0, fill: activeIndexInfo.color }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* [2단] MDD 낙폭 차트 */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between px-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span className="text-xs font-black text-slate-700">최대 낙폭 (MDD)</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">단위: %</span>
                    </div>

                    <div className="h-[110px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} syncId="marketAnalysisCharts">
                          <defs>
                            <linearGradient id="colorMdd" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tick={false}
                            axisLine={false}
                            tickLine={false}
                            height={1}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false}
                            domain={['dataMin - 2', 0]}
                            tickFormatter={(val) => `${val}%`}
                          />
                          <Tooltip 
                            content={<IntegratedChartTooltip activeIndexInfo={activeIndexInfo} chartData={chartData} />}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="mdd" 
                            stroke="#f43f5e" 
                            fillOpacity={1} 
                            fill="url(#colorMdd)" 
                            strokeWidth={2} 
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* [3단] VIX 변동성 차트 (하단에 최종 날짜 X축 표시) */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between px-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span className="text-xs font-black text-slate-700">VIX 변동성 지수 (S&P 500)</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">단위: pt</span>
                    </div>

                    <div className="h-[150px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} syncId="marketAnalysisCharts">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false}
                            dy={10} 
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false}
                            domain={[0, (dataMax) => Math.max(45, Math.ceil(dataMax + 2))]}
                            tickFormatter={(val) => Math.round(val).toString()}
                          />
                          <Tooltip 
                            content={<IntegratedChartTooltip activeIndexInfo={activeIndexInfo} chartData={chartData} />}
                          />
                          <ReferenceLine 
                            y={20} 
                            stroke="#F59E0B" 
                            strokeDasharray="3 3" 
                            label={{ value: '주의 20', position: 'insideTopRight', fill: '#F59E0B', fontSize: 10, fontWeight: 'bold' }} 
                          />
                          <ReferenceLine 
                            y={30} 
                            stroke="#EF4444" 
                            strokeDasharray="3 3" 
                            label={{ value: '경고 30', position: 'insideTopRight', fill: '#EF4444', fontSize: 10, fontWeight: 'bold' }} 
                          />
                          <ReferenceLine 
                            y={40} 
                            stroke="#991B1B" 
                            strokeDasharray="3 3" 
                            label={{ value: '위기 40', position: 'insideTopRight', fill: '#991B1B', fontSize: 10, fontWeight: 'bold' }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="vix" 
                            stroke="#8b5cf6" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 0, fill: '#8b5cf6' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* 월별, 연도별 상세 데이터 테이블 */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">상세 성과 지표</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">선택한 기간 동안의 월별, 연도별 수익률과 MDD 테이블입니다.</p>
                    </div>
                  </div>

                  {/* 테이블 서브 탭 */}
                  <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
                    <button
                      onClick={() => setTableSubTab('monthly')}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                        tableSubTab === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      월별
                    </button>
                    <button
                      onClick={() => setTableSubTab('yearly')}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                        tableSubTab === 'yearly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      연도별
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {tableSubTab === 'monthly' ? (
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-100">
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">년/월</th>
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">기말 지수</th>
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">월간 수익률</th>
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">월간 MDD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {statsData?.monthly?.map((row, idx) => (
                          <tr key={`${row.year}-${row.month}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-center">
                              <span className="inline-block px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-black">
                                {row.year}년 {row.month}월
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-800">
                              {row.close_price.toLocaleString()} pt
                            </td>
                            <td className="px-6 py-4 text-center">
                              {renderReturnBadge(row.return_rate)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${row.mdd < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                                {row.mdd.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!statsData?.monthly || statsData.monthly.length === 0) && (
                          <tr>
                            <td colSpan="4" className="text-center py-8 text-slate-400 font-medium">데이터가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-100">
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">연도</th>
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">기말 지수</th>
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">연간 수익률</th>
                          <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">연간 MDD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {statsData?.yearly?.map((row, idx) => (
                          <tr key={`${row.year}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-center">
                              <span className="inline-block px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-black">
                                {row.year}년
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-800">
                              {row.close_price.toLocaleString()} pt
                            </td>
                            <td className="px-6 py-4 text-center">
                              {renderReturnBadge(row.return_rate)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${row.mdd < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                                {row.mdd.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!statsData?.yearly || statsData.yearly.length === 0) && (
                          <tr>
                            <td colSpan="4" className="text-center py-8 text-slate-400 font-medium">데이터가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="comparison-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* 4대 지수 연간 수익률 비교 표 */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">연도별 지수 수익률 비교</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">S&P500, NASDAQ, KOSPI, KOSDAQ의 달력 기준 연간 수익률을 한 눈에 비교합니다.</p>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider hidden sm:block">
                    Market Return Table
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100">
                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">연도</th>
                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSPI</th>
                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSDAQ</th>
                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">S&P 500</th>
                        <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">NASDAQ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {comparisonData?.map((row) => (
                        <tr key={row.year} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-5 text-center">
                            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 font-black text-sm shadow-inner">
                              {row.year}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {renderReturnBadge(row.kospi)}
                          </td>
                          <td className="px-6 py-5 text-center">
                            {renderReturnBadge(row.kosdaq)}
                          </td>
                          <td className="px-6 py-5 text-center">
                            {renderReturnBadge(row.sp500)}
                          </td>
                          <td className="px-6 py-5 text-center">
                            {renderReturnBadge(row.nasdaq)}
                          </td>
                        </tr>
                      ))}
                      {(!comparisonData || comparisonData.length === 0) && (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-slate-400 font-medium">데이터가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                      <Info size={14} />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      지수 수익률은 해당 연도 첫 영업일(또는 직전 연도 말일 종가) 대비 마지막 영업일 종가 변동률로 독립 계산되었습니다. 단, 진행 중인 올해는 연초 대비 현재 시점까지의 누적(YTD) 수익률을 적용합니다. 2020년 이전의 데이터는 제공 범위 및 지수 상호 비교의 유효성을 고려하여 이 테이블에서는 2020년부터 표시합니다.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </main>
  );
}
