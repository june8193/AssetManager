import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, BarChart2, Calendar, Info, RefreshCw, 
  ArrowUpRight, ArrowDownRight, ChevronRight, ChevronDown, Users, ChevronUp
} from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

const SectorPage = () => {
  const { isMasked } = useMasking();
  
  // 쿼리 파라미터 상태
  const [query, setQuery] = useState({
    country: 'KR',
    period: 'YTD',
    compareIndex: '^KS11',
    startDate: '',
    endDate: ''
  });
  
  const { country, period, compareIndex, startDate, endDate } = query;
  
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 아코디언 상태
  const [expandedSectorId, setExpandedSectorId] = useState(null); 
  const [isSectorExpanded, setIsSectorExpanded] = useState(false);
  const [isStockExpanded, setIsStockExpanded] = useState(false);

  // 탭 변경 핸들러
  const handleCountryChange = (newCountry) => {
    setQuery(prev => ({
      ...prev,
      country: newCountry,
      compareIndex: newCountry === 'KR' ? '^KS11' : '^GSPC'
    }));
  };

  // 대시보드 데이터 조회
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/sector/dashboard?country=${country}&period=${period}&compare_index=${encodeURIComponent(compareIndex)}`;
      
      if (period === 'Custom') {
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('대시보드 데이터를 가져오는 데 실패했습니다.');
      }
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setQuery(prev => ({ ...prev, period: newPeriod }));
  };

  const handleCompareIndexChange = (newIndex) => {
    setQuery(prev => ({ ...prev, compareIndex: newIndex }));
  };

  const handleStartDateChange = (val) => {
    setQuery(prev => ({ ...prev, startDate: val }));
  };

  const handleEndDateChange = (val) => {
    setQuery(prev => ({ ...prev, endDate: val }));
  };

  useEffect(() => {
    fetchDashboardData();
  }, [query]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 상단 타이틀 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={32} />
            섹터 분석 대시보드
          </h1>
          <p className="text-slate-500 mt-1">
            구성 종목 시가총액 가중 기반 커스텀 섹터의 성과와 관심종목 성과를 비교 분석합니다.
          </p>
        </div>
        
        {/* 국적 탭 전환 */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-center">
          <button
            onClick={() => handleCountryChange('KR')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              country === 'KR' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            한국 주식 (KRW)
          </button>
          <button
            onClick={() => handleCountryChange('US')}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              country === 'US' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            미국 주식 (USD)
          </button>
        </div>
      </div>

      {/* 컨트롤 영역: 기간 및 비교 지수 설정 */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* 기간 선택 바 */}
        <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
          {['YTD', '1W', '1M', '3M', '6M', 'Custom'].map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                period === p 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p === 'Custom' ? '사용자 지정' : p === 'YTD' ? '올해 누적' : p}
            </button>
          ))}
        </div>

        {/* 사용자 지정 날짜 입력창 */}
        {period === 'Custom' && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-xs">
            <span className="text-slate-500 font-medium px-2 flex items-center gap-1">
              <Calendar size={14} /> 기간:
            </span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => handleStartDateChange(e.target.value)} 
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none"
            />
            <span className="text-slate-400">~</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => handleEndDateChange(e.target.value)} 
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none"
            />
          </div>
        )}

        {/* 비교 지수 및 리프레시 */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">기준 지수:</span>
            <select
              value={compareIndex}
              onChange={(e) => handleCompareIndexChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
            >
              {country === 'KR' ? (
                <>
                  <option value="^KS11">KOSPI</option>
                  <option value="^KQ11">KOSDAQ</option>
                </>
              ) : (
                <>
                  <option value="^GSPC">S&P 500</option>
                  <option value="^IXIC">NASDAQ</option>
                </>
              )}
            </select>
          </div>
          
          <button 
            onClick={fetchDashboardData}
            className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors text-slate-600"
            title="새로고침"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-500 text-sm font-medium">데이터를 분석 및 계산하는 중입니다...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 space-y-2">
          <Info className="mx-auto" size={32} />
          <h3 className="font-semibold text-lg">오류가 발생했습니다</h3>
          <p className="text-sm">{error}</p>
          <button onClick={fetchDashboardData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
            다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 주요 지수 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(dashboardData.index_returns || {}).map(([ticker, data]) => {
              const name = ticker === '^KS11' ? 'KOSPI' : ticker === '^KQ11' ? 'KOSDAQ' : ticker === '^GSPC' ? 'S&P 500' : 'NASDAQ';
              const isPositive = data.return_rate >= 0;
              const isBaseIndex = ticker === dashboardData.compare_index;

              return (
                <div 
                  key={ticker} 
                  className={`p-5 rounded-2xl border transition-all ${
                    isBaseIndex 
                      ? 'bg-blue-50/50 border-blue-200 shadow-sm ring-1 ring-blue-500/20' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 tracking-wider">주요 지수</span>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        {name}
                        {isBaseIndex && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">비교 기준</span>}
                      </h3>
                    </div>
                    <span className={`flex items-center gap-0.5 text-sm font-bold px-2 py-1 rounded-lg ${
                      isPositive ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {isPositive ? '+' : ''}{data.return_rate}%
                    </span>
                  </div>
                  
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950 font-headline">
                      {data.current ? data.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </span>
                    <span className="text-xs text-slate-400">포인트</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 메인 대시보드 컨텐츠 */}
          <div className="flex flex-col gap-6">
            
            {/* 커스텀 섹터 수익률 대시보드 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <BarChart2 size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">커스텀 섹터 수익률 랭킹</h2>
                    <p className="text-xs text-slate-500">시가총액 가중 방식으로 산정된 커스텀 섹터입니다. 행을 클릭하면 하위 종목의 개별 성과를 볼 수 있습니다.</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-3 px-2 w-12 text-center">순위</th>
                      <th className="py-3 px-2">섹터명</th>
                      <th className="py-3 px-2 text-right">수익률</th>
                      <th className="py-3 px-2 text-right">초과 성과 (알파)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.custom_sectors && dashboardData.custom_sectors.length > 0 ? (
                      (isSectorExpanded ? dashboardData.custom_sectors : dashboardData.custom_sectors.slice(0, 5)).map((sec) => (
                        <React.Fragment key={sec.id}>
                          <tr 
                            onClick={() => setExpandedSectorId(prev => prev === sec.id ? null : sec.id)}
                            className="border-b border-slate-50 hover:bg-blue-50/10 cursor-pointer transition-colors"
                          >
                            <td className="py-4 px-2 text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                                sec.rank === 1 ? 'bg-amber-100 text-amber-700' :
                                sec.rank === 2 ? 'bg-slate-100 text-slate-700' :
                                sec.rank === 3 ? 'bg-amber-50 text-amber-600' : 'text-slate-500'
                              }`}>
                                {sec.rank}
                              </span>
                            </td>
                            <td className="py-4 px-2 font-medium">
                              <div className="font-semibold text-slate-900 flex items-center gap-1">
                                {sec.name}
                                {expandedSectorId === sec.id ? (
                                  <ChevronDown size={12} className="text-blue-600 animate-in fade-in" />
                                ) : (
                                  <ChevronRight size={12} className="text-slate-400" />
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Users size={10} /> 구성종목 {sec.stock_count}개
                              </div>
                            </td>
                            <td className={`py-4 px-2 text-right font-bold ${
                              sec.return_rate >= 0 ? 'text-red-600' : 'text-blue-600'
                            }`}>
                              {sec.return_rate >= 0 ? '+' : ''}{sec.return_rate}%
                            </td>
                            <td className="py-4 px-2 text-right">
                              <span className={`inline-block font-semibold px-2 py-0.5 rounded ${
                                sec.alpha >= 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {sec.alpha >= 0 ? '+' : ''}{sec.alpha}%p
                              </span>
                            </td>
                          </tr>
                          {expandedSectorId === sec.id && (
                            <tr className="bg-slate-50/50">
                              <td colSpan="4" className="p-4 border-b border-slate-100">
                                <div className="bg-white rounded-2xl border border-slate-150 shadow-sm p-4 space-y-3">
                                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                    <Users size={12} className="text-blue-500" />
                                    구성 종목 개별 성과
                                  </h4>
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                                        <th className="py-2 px-2">종목명 (코드)</th>
                                        <th className="py-2 px-2 text-right">수익률</th>
                                        <th className="py-2 px-2 text-right">초과 성과 (알파)</th>
                                        <th className="py-2 px-2 text-right">상장주식수</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sec.stocks && sec.stocks.length > 0 ? (
                                        sec.stocks.map((stock) => {
                                          const isStockPositive = stock.return_rate >= 0;
                                          return (
                                            <tr key={stock.stock_code} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                                              <td className="py-2.5 px-2 font-medium">
                                                <span className="font-semibold text-slate-800">{stock.stock_name}</span>
                                                <span className="text-[10px] text-slate-400 ml-1.5">{stock.stock_code}</span>
                                              </td>
                                              <td className={`py-2.5 px-2 text-right font-bold ${isStockPositive ? 'text-red-600' : 'text-blue-600'}`}>
                                                {isStockPositive ? '+' : ''}{stock.return_rate}%
                                              </td>
                                              <td className="py-2.5 px-2 text-right">
                                                <span className={`inline-block font-semibold px-2 py-0.5 rounded ${stock.alpha >= 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                                  {stock.alpha >= 0 ? '+' : ''}{stock.alpha}%p
                                                </span>
                                              </td>
                                              <td className={`py-2.5 px-2 text-right text-slate-500 font-mono ${isMasked ? 'blur-sm select-none' : ''}`}>
                                                {stock.shares_outstanding ? stock.shares_outstanding.toLocaleString() : '0'} 주
                                              </td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr>
                                          <td colSpan="4" className="py-4 text-center text-slate-400 font-medium">
                                            소속된 종목이 없습니다.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-400 font-medium">
                          생성된 커스텀 섹터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {dashboardData.custom_sectors && dashboardData.custom_sectors.length > 5 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setIsSectorExpanded(!isSectorExpanded)}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition-all"
                  >
                    {isSectorExpanded ? (
                      <>접기 <ChevronUp size={14} /></>
                    ) : (
                      <>더 보기 (전체 {dashboardData.custom_sectors.length}개) <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 개별종목 수익률 대시보드 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <TrendingUp size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">개별종목 수익률 랭킹</h2>
                    <p className="text-xs text-slate-500">관심종목 및 커스텀섹터 소속 개별 종목들의 단순 종가 수익률입니다.</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-3 px-2 w-12 text-center">순위</th>
                      <th className="py-3 px-2">종목</th>
                      <th className="py-3 px-2 text-right">수익률</th>
                      <th className="py-3 px-2 text-right">초과 성과 (알파)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.individual_stocks && dashboardData.individual_stocks.length > 0 ? (
                      (isStockExpanded ? dashboardData.individual_stocks : dashboardData.individual_stocks.slice(0, 5)).map((item) => (
                        <tr key={item.ticker} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              item.rank === 1 ? 'bg-amber-100 text-amber-700' :
                              item.rank === 2 ? 'bg-slate-100 text-slate-700' :
                              item.rank === 3 ? 'bg-amber-50 text-amber-600' : 'text-slate-500'
                            }`}>
                              {item.rank}
                            </span>
                          </td>
                          <td className="py-4 px-2 font-medium">
                            <div className="flex items-center flex-wrap gap-y-1">
                              <span className="font-semibold text-slate-900">{item.name}</span>
                              {item.sources && item.sources.map((src) => {
                                const isWatchlist = src === '관심종목';
                                return (
                                  <span 
                                    key={src} 
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ml-1.5 ${
                                      isWatchlist 
                                        ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                    }`}
                                  >
                                    {src}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.ticker}</div>
                          </td>
                          <td className={`py-4 px-2 text-right font-bold ${
                            item.return_rate >= 0 ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {item.return_rate >= 0 ? '+' : ''}{item.return_rate}%
                          </td>
                          <td className="py-4 px-2 text-right">
                            <span className={`inline-block font-semibold px-2 py-0.5 rounded ${
                              item.alpha >= 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {item.alpha >= 0 ? '+' : ''}{item.alpha}%p
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-400 font-medium">
                          등록된 개별종목이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {dashboardData.individual_stocks && dashboardData.individual_stocks.length > 5 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setIsStockExpanded(!isStockExpanded)}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 shadow-sm transition-all"
                  >
                    {isStockExpanded ? (
                      <>접기 <ChevronUp size={14} /></>
                    ) : (
                      <>더 보기 (전체 {dashboardData.individual_stocks.length}개) <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* 초과수익률(알파) 시각화 분석 패널 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 size={18} className="text-blue-600" />
              기준 지수 대비 초과 성과 (알파) 요약
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* 섹터 알파 순위 차트 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500">커스텀 섹터 성과 차이</h4>
                <div className="space-y-2">
                  {dashboardData.custom_sectors && dashboardData.custom_sectors.length > 0 ? (
                    dashboardData.custom_sectors.map((item) => (
                      <div key={item.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700">{item.name}</span>
                          <span className={item.alpha >= 0 ? 'text-red-600' : 'text-blue-600'}>
                            {item.alpha >= 0 ? '+' : ''}{item.alpha}%p
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                          {item.alpha >= 0 ? (
                            <>
                              <div className="w-1/2"></div>
                              <div 
                                className="bg-red-500 h-full rounded-r-full transition-all"
                                style={{ width: `${Math.min(item.alpha * 3, 50)}%` }}
                              ></div>
                            </>
                          ) : (
                            <>
                              <div className="w-1/2 flex justify-end">
                                <div 
                                  className="bg-blue-500 h-full rounded-l-full transition-all"
                                  style={{ width: `${Math.min(Math.abs(item.alpha) * 3, 50)}%` }}
                                ></div>
                              </div>
                              <div className="w-1/2"></div>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">데이터가 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 개별종목 알파 순위 차트 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500">개별종목 성과 차이</h4>
                <div className="space-y-2">
                  {dashboardData.individual_stocks && dashboardData.individual_stocks.length > 0 ? (
                    dashboardData.individual_stocks.map((item) => (
                      <div key={item.ticker} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700">{item.name}</span>
                          <span className={item.alpha >= 0 ? 'text-red-600' : 'text-blue-600'}>
                            {item.alpha >= 0 ? '+' : ''}{item.alpha}%p
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                          {item.alpha >= 0 ? (
                            <>
                              <div className="w-1/2"></div>
                              <div 
                                className="bg-red-500 h-full rounded-r-full transition-all"
                                style={{ width: `${Math.min(item.alpha * 3, 50)}%` }}
                              ></div>
                            </>
                          ) : (
                            <>
                              <div className="w-1/2 flex justify-end">
                                <div 
                                  className="bg-blue-500 h-full rounded-l-full transition-all"
                                  style={{ width: `${Math.min(Math.abs(item.alpha) * 3, 50)}%` }}
                                ></div>
                              </div>
                              <div className="w-1/2"></div>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default SectorPage;
