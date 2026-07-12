import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Activity, Star, Layers, Calendar, AlertCircle, RefreshCw, 
  ChevronDown, ChevronUp, Info, Check, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 국가별 대표 지수 티커
const INDEX_OPTIONS = {
  KR: [
    { ticker: '^KS11', name: 'KOSPI' },
    { ticker: '^KQ11', name: 'KOSDAQ' }
  ],
  US: [
    { ticker: '^GSPC', name: 'S&P 500' },
    { ticker: '^IXIC', name: 'NASDAQ' }
  ]
};

// 기간 정의
const PERIODS = [
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '1Y', label: '1년' },
  { value: '3Y', label: '3년' },
  { value: '5Y', label: '5년' },
  { value: '10Y', label: '10년' },
  { value: 'ALL', label: '전체' },
  { value: 'CUSTOM', label: '직접설정' }
];

export default function StockAnalysisPage() {
  const [selectedCountry, setSelectedCountry] = useState('KR');
  const [watchlist, setWatchlist] = useState([]);
  const [customSectors, setCustomSectors] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null); // { stock_code, stock_name }
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  
  // 사용자 직접 설정 날짜 상태
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 지수 비교 상태
  const [compareIndex, setCompareIndex] = useState(false);
  const [indexTicker, setIndexTicker] = useState('^KS11');

  // 데이터 로딩 상태
  const [stockPrices, setStockPrices] = useState([]);
  const [indexPrices, setIndexPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 아코디언 상태 (커스텀 섹터 열림 여부)
  const [expandedSectors, setExpandedSectors] = useState({});

  // 1. 관심종목 및 커스텀 섹터 목록 가져오기
  const fetchLists = async () => {
    try {
      const [watchlistRes, sectorRes] = await Promise.all([
        fetch(`/api/watchlist?country=${selectedCountry}`),
        fetch(`/api/sector/custom?country=${selectedCountry}`)
      ]);
      
      if (watchlistRes.ok) {
        const data = await watchlistRes.json();
        setWatchlist(data);
      }
      if (sectorRes.ok) {
        const data = await sectorRes.json();
        setCustomSectors(data);
        // 기본적으로 첫번째 섹터는 펼쳐둔 상태로 초기화
        if (data.length > 0) {
          setExpandedSectors(prev => ({ [data[0].id]: true }));
        }
      }
    } catch (err) {
      console.error("목록 로드 실패:", err);
    }
  };

  useEffect(() => {
    fetchLists();
    // 국가 변경 시 선택된 종목 초기화 및 지수 티커 기본값 세팅
    setSelectedStock(null);
    setStockPrices([]);
    setIndexPrices([]);
    setCompareIndex(false);
    if (selectedCountry === 'KR') {
      setIndexTicker('^KS11');
    } else {
      setIndexTicker('^GSPC');
    }
  }, [selectedCountry]);

  // 기간에 따른 날짜 계산
  const dateRange = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    let startStr = '2020-01-01'; // Default

    if (selectedPeriod === '1M') {
      today.setMonth(today.getMonth() - 1);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '3M') {
      today.setMonth(today.getMonth() - 3);
      startStr = today.toISOString().split('T')[0];
    } else if (selectedPeriod === '1Y') {
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
    } else if (selectedPeriod === 'ALL') {
      startStr = '2000-01-01'; // 넓은 기간 범위
    } else if (selectedPeriod === 'CUSTOM') {
      return { start_date: customStartDate, end_date: customEndDate };
    }

    return { start_date: startStr, end_date: endStr };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // 2. 개별 종목 주가 정보 로드
  const fetchStockData = async () => {
    if (!selectedStock) return;
    setLoading(true);
    setError(null);
    try {
      const { start_date, end_date } = dateRange;
      const res = await fetch(`/api/stocks/prices?ticker=${encodeURIComponent(selectedStock.stock_code)}&start_date=${start_date}&end_date=${end_date}`);
      if (!res.ok) throw new Error("종목 가격 데이터를 가져오는데 실패했습니다.");
      const data = await res.json();
      // 가격이 0보다 큰 정상 데이터만 필터링
      const validPrices = (data.prices || []).filter(p => p.close_price > 0);
      setStockPrices(validPrices);
    } catch (err) {
      console.error(err);
      setError(err.message || "데이터 로딩 오류");
    } finally {
      setLoading(false);
    }
  };

  // 3. 지수 주가 정보 로드 (비교 모드 활성화 시)
  const fetchIndexData = async () => {
    if (!compareIndex || !selectedStock) {
      setIndexPrices([]);
      return;
    }
    try {
      const { start_date, end_date } = dateRange;
      const res = await fetch(`/api/market/history?tickers=${encodeURIComponent(indexTicker)}&start_date=${start_date}&end_date=${end_date}`);
      if (!res.ok) throw new Error("지수 가격 데이터를 가져오는데 실패했습니다.");
      const data = await res.json();
      // 가격이 0보다 큰 정상 데이터만 필터링
      const validPrices = (data[indexTicker] || []).filter(p => p.close_price > 0);
      setIndexPrices(validPrices);
    } catch (err) {
      console.error("지수 로드 실패:", err);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [selectedStock, selectedPeriod]);

  useEffect(() => {
    fetchIndexData();
  }, [compareIndex, indexTicker, selectedStock, selectedPeriod]);

  // 아코디언 토글 헬퍼
  const toggleSector = (id) => {
    setExpandedSectors(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 차트 가공 데이터 (MDD 계산 및 누적 수익률 계산)
  const processedData = useMemo(() => {
    if (stockPrices.length === 0) return [];

    // 1. 주가 기준 MDD 계산
    let peak = -Infinity;
    const stockWithMdd = stockPrices.map(p => {
      if (p.close_price > peak) {
        peak = p.close_price;
      }
      const mdd = peak > 0 ? ((p.close_price - peak) / peak) * 100 : 0;
      return {
        date: p.date,
        close_price: p.close_price,
        mdd: parseFloat(mdd.toFixed(2))
      };
    });

    // 2. 지수 비교 모드 시, 상대 수익률 정규화
    if (compareIndex && indexPrices.length > 0) {
      const stockStart = stockPrices[0]?.close_price || 1;
      const indexStart = indexPrices[0]?.close_price || 1;

      // 날짜별 지수 종가 매핑 맵
      const indexMap = {};
      indexPrices.forEach(p => {
        indexMap[p.date] = p.close_price;
      });

      // 지수의 누적 최고점 및 MDD를 위한 변수
      let indexPeak = -Infinity;

      return stockWithMdd.map(s => {
        const stockReturn = ((s.close_price - stockStart) / stockStart) * 100;
        
        const idxPrice = indexMap[s.date];
        let indexReturn = 0;
        if (idxPrice) {
          indexReturn = ((idxPrice - indexStart) / indexStart) * 100;
          if (idxPrice > indexPeak) indexPeak = idxPrice;
        }

        return {
          date: s.date,
          stockReturn: parseFloat(stockReturn.toFixed(2)),
          indexReturn: parseFloat(indexReturn.toFixed(2)),
          close_price: s.close_price,
          mdd: s.mdd
        };
      });
    }

    // 지수 비교 비활성화 시 단순 종가와 MDD 반환
    return stockWithMdd;
  }, [stockPrices, indexPrices, compareIndex]);

  // 최근 정보 요약 데이터
  const summaryStats = useMemo(() => {
    if (processedData.length === 0) return null;
    const latest = processedData[processedData.length - 1];
    
    // 기간 내 최고/최저 주가 찾기
    let maxPrice = -Infinity;
    let minPrice = Infinity;
    stockPrices.forEach(p => {
      if (p.close_price > maxPrice) maxPrice = p.close_price;
      if (p.close_price < minPrice) minPrice = p.close_price;
    });

    // 기간 내 최대 낙폭(MDD 중 가장 작은 값)
    let minMdd = 0;
    processedData.forEach(d => {
      if (d.mdd < minMdd) minMdd = d.mdd;
    });

    // 기간 내 총 수익률
    const stockStart = stockPrices[0]?.close_price || 1;
    const stockEnd = latest.close_price || 1;
    const periodReturn = ((stockEnd - stockStart) / stockStart) * 100;

    return {
      currentPrice: latest.close_price,
      periodReturn: periodReturn,
      maxPrice,
      minPrice,
      maxMdd: minMdd
    };
  }, [processedData, stockPrices]);

  const currencySymbol = selectedCountry === 'KR' ? '원' : '$';

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* 1. 상단 타이틀 및 국가 필터 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Activity className="text-blue-600" size={32} />
            종목분석
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            관심종목 및 커스텀 섹터 내 종목들의 주가 추이와 최대 낙폭(MDD)을 시장 지수와 비교 분석합니다.
          </p>
        </div>

        {/* 국가 탭 */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setSelectedCountry('KR')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              selectedCountry === 'KR' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            대한민국 (KR)
          </button>
          <button
            onClick={() => setSelectedCountry('US')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              selectedCountry === 'US' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            미국 (US)
          </button>
        </div>
      </div>

      {/* 2. 메인 콘텐츠 그리드 레이아웃 (퀵 셀렉터 vs 차트 화면) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 좌측 사이드바: 퀵 셀렉터 (3/12 너비) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 관심종목 카드 */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Star className="text-amber-500 fill-amber-500" size={18} />
              관심종목 퀵 선택
            </h2>
            {watchlist.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-2">등록된 관심종목이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {watchlist.map(stock => {
                  const isSelected = selectedStock?.stock_code === stock.stock_code;
                  return (
                    <button
                      key={stock.stock_code}
                      onClick={() => setSelectedStock({ stock_code: stock.stock_code, stock_name: stock.stock_name })}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {stock.stock_name}
                      <span className={`ml-1 text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'} font-normal`}>
                        ({stock.stock_code})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 커스텀 섹터 카드 */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
              <Layers className="text-blue-600" size={18} />
              커스텀 섹터별 선택
            </h2>
            {customSectors.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-2">등록된 커스텀 섹터가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {customSectors.map(sector => {
                  const isOpen = expandedSectors[sector.id];
                  return (
                    <div key={sector.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleSector(sector.id)}
                        className="w-full px-4 py-3 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between transition-colors text-left"
                      >
                        <span className="text-xs font-bold text-slate-800">{sector.name}</span>
                        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden bg-white px-4 py-3 border-t border-slate-50"
                          >
                            {sector.stocks.length === 0 ? (
                              <p className="text-[11px] text-slate-400 font-medium">소속된 종목이 없습니다.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {sector.stocks.map(stock => {
                                  const isSelected = selectedStock?.stock_code === stock.stock_code;
                                  return (
                                    <button
                                      key={stock.stock_code}
                                      onClick={() => setSelectedStock({ stock_code: stock.stock_code, stock_name: stock.stock_name })}
                                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                                        isSelected
                                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                                          : 'bg-slate-50 text-slate-600 border-slate-200/50 hover:bg-slate-100 hover:text-slate-800'
                                      }`}
                                    >
                                      {stock.stock_name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* 우측 메인 대시보드 영역: 차트 및 비교 툴 (9/12 너비) */}
        <div className="lg:col-span-8 space-y-6">
          
          {!selectedStock ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <Search size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">분석할 종목 선택</h3>
              <p className="text-slate-400 text-xs font-semibold max-w-sm">
                좌측 관심종목 목록이나 커스텀 섹터에서 분석하고 싶은 종목을 선택하시면 주가 추이와 MDD 비교 차트가 생성됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* 종목별 컨트롤 패널 */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      {selectedStock.stock_name} ({selectedStock.stock_code}) 분석
                    </h2>
                    <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase">Stock Analysis Overview</p>
                  </div>

                  {/* 기간 필터 */}
                  <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center flex-wrap gap-1">
                    {PERIODS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setSelectedPeriod(p.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${
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

                {selectedPeriod === 'CUSTOM' && (
                  <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/40 self-start sm:self-end">
                    <span className="text-xs font-black text-slate-500">기간 설정:</span>
                    <input 
                      type="date" 
                      value={customStartDate} 
                      onChange={(e) => setCustomStartDate(e.target.value)} 
                      className="text-xs font-bold text-slate-700 bg-white border border-slate-200/60 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                      aria-label="시작일"
                    />
                    <span className="text-xs text-slate-400">~</span>
                    <input 
                      type="date" 
                      value={customEndDate} 
                      onChange={(e) => setCustomEndDate(e.target.value)} 
                      className="text-xs font-bold text-slate-700 bg-white border border-slate-200/60 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
                      aria-label="종료일"
                    />
                  </div>
                )}
              </div>

              {/* 지수 비교 컨트롤바 */}
              <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      id="compare-toggle"
                      aria-label="지수 비교"
                      checked={compareIndex} 
                      onChange={(e) => setCompareIndex(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-xs font-black text-slate-700">지수 비교</span>
                  </label>
                </div>

                {compareIndex && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">비교 지수 선택:</span>
                    <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200/50">
                      {INDEX_OPTIONS[selectedCountry].map(opt => (
                        <button
                          key={opt.ticker}
                          onClick={() => setIndexTicker(opt.ticker)}
                          className={`px-2.5 py-1.5 rounded-md text-[10px] font-black transition-all ${
                            indexTicker === opt.ticker
                              ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 로딩 / 에러 / 차트 렌더링 */}
              {loading ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px] gap-4">
                  <RefreshCw className="animate-spin text-blue-600" size={32} />
                  <p className="text-slate-500 font-bold text-sm">데이터를 조회하고 있습니다...</p>
                </div>
              ) : error ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <AlertCircle className="text-rose-500 mb-2" size={40} />
                  <h3 className="text-base font-bold text-slate-800">에러가 발생했습니다</h3>
                  <p className="text-xs text-rose-600 mt-1">{error}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* 주요 지표 퀵 카드 요약 */}
                  {summaryStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">현재가 / 종가</span>
                        <span className="text-base font-black text-slate-800">
                          {summaryStats.currentPrice.toLocaleString()}{currencySymbol}
                        </span>
                      </div>
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">기간 내 수익률</span>
                        <span className={`text-base font-black ${
                          summaryStats.periodReturn > 0 ? 'text-emerald-600' : summaryStats.periodReturn < 0 ? 'text-rose-600' : 'text-slate-600'
                        }`}>
                          {summaryStats.periodReturn > 0 ? '+' : ''}{summaryStats.periodReturn.toFixed(2)}%
                        </span>
                      </div>
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">기간 내 고가</span>
                        <span className="text-base font-black text-slate-800">
                          {summaryStats.maxPrice.toLocaleString()}{currencySymbol}
                        </span>
                      </div>
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">기간 내 MDD</span>
                        <span className="text-base font-black text-rose-600">
                          {summaryStats.maxMdd.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 1) 주가 / 누적 수익률 차트 카드 */}
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <div>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          {compareIndex ? '누적 수익률 비교' : '주가 종가 추이'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">
                          {compareIndex 
                            ? '조회 시작일 기준의 누적 수익률(%) 비교 차트입니다.' 
                            : `조회 기간 동안의 종가(${currencySymbol}) 시계열 차트입니다.`}
                        </p>
                      </div>
                    </div>

                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={processedData} syncId="stockAnalysisCharts">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            dy={10} 
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(val) => compareIndex ? `${val}%` : val.toLocaleString()}
                          />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                            labelStyle={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}
                          />
                          {compareIndex ? (
                            <>
                              <Line 
                                type="monotone" 
                                dataKey="stockReturn" 
                                name={selectedStock.stock_name}
                                stroke="#3b82f6" 
                                strokeWidth={2.5} 
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="indexReturn" 
                                name={INDEX_OPTIONS[selectedCountry].find(o => o.ticker === indexTicker)?.name || '지수'}
                                stroke="#8b5cf6" 
                                strokeWidth={2} 
                                strokeDasharray="4 4"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: '#8b5cf6' }}
                              />
                            </>
                          ) : (
                            <Line 
                              type="monotone" 
                              dataKey="close_price" 
                              name="종가"
                              stroke="#3b82f6" 
                              strokeWidth={2.5} 
                              dot={false}
                              activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 2) MDD 차트 카드 */}
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <div>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                          최대 낙폭 (MDD) 추이
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">고점 대비 현재 종가의 하락률 추이를 나타냅니다.</p>
                      </div>
                      {processedData.length > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">최근 MDD</span>
                          <span className="text-sm font-black text-rose-600">
                            {processedData[processedData.length - 1].mdd.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="h-[150px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={processedData} syncId="stockAnalysisCharts">
                          <defs>
                            <linearGradient id="colorMddStock" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            dy={10} 
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            domain={['dataMin - 1', 0]}
                            tickFormatter={(val) => `${val}%`}
                          />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                            labelStyle={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}
                            formatter={(value) => [`${parseFloat(value).toFixed(2)}%`, 'MDD']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="mdd" 
                            stroke="#f43f5e" 
                            fillOpacity={1} 
                            fill="url(#colorMddStock)" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>

      </div>
    </main>
  );
}
