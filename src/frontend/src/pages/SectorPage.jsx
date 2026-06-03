import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Plus, Trash2, Calendar, ChevronRight, Info, 
  Settings, Award, RefreshCw, BarChart2, ArrowUpRight, ArrowDownRight, Users, Eye, EyeOff
} from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 섹터 분석 대시보드 페이지 컴포넌트
 */
const SectorPage = () => {
  const { isMasked } = useMasking();
  
  // 단일 쿼리 상태 정의 (중복 fetch 및 상태 동기화 문제 해결)
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
  
  // 모달 상태
  const [isEtfModalOpen, setIsEtfModalOpen] = useState(false);
  const [newEtfTicker, setNewEtfTicker] = useState('');
  const [newEtfName, setNewEtfName] = useState('');
  
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  
  const [activeSector, setActiveSector] = useState(null); // 종목 관리를 위한 활성 섹터
  const [newStockCode, setNewStockCode] = useState('');
  const [newStockName, setNewStockName] = useState('');
  const [newShares, setNewShares] = useState('');

  // 탭 변경 핸들러 (원자적 상태 변경)
  const handleCountryChange = (newCountry) => {
    setQuery(prev => ({
      ...prev,
      country: newCountry,
      compareIndex: newCountry === 'KR' ? '^KS11' : '^GSPC'
    }));
    setActiveSector(null);
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

  // 헬퍼 핸들러 정의
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

  // 대표 ETF 추가
  const handleAddEtf = async (e) => {
    e.preventDefault();
    if (!newEtfTicker) return;
    try {
      const response = await fetch(`/api/sector/etf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: newEtfTicker.trim(),
          name: newEtfName.trim() || null,
          country: country
        })
      });
      if (!response.ok) {
        throw new Error('ETF 등록에 실패했습니다. 올바른 티커인지 확인해 주세요.');
      }
      setNewEtfTicker('');
      setNewEtfName('');
      setIsEtfModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 대표 ETF 삭제
  const handleDeleteEtf = async (ticker) => {
    if (!window.confirm(`선택한 ETF(${ticker})를 삭제하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/sector/etf/${ticker}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('ETF 삭제에 실패했습니다.');
      }
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 커스텀 섹터 생성
  const handleCreateSector = async (e) => {
    e.preventDefault();
    if (!newSectorName) return;
    try {
      const response = await fetch(`/api/sector/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSectorName.trim(),
          country: country
        })
      });
      if (!response.ok) {
        throw new Error('섹터 생성에 실패했습니다.');
      }
      setNewSectorName('');
      setIsSectorModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 커스텀 섹터 삭제
  const handleDeleteSector = async (sectorId, sectorName) => {
    if (!window.confirm(`'${sectorName}' 섹터를 삭제하시겠습니까?\n소속된 종목들도 함께 삭제됩니다.`)) return;
    try {
      const response = await fetch(`/api/sector/custom/${sectorId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('섹터 삭제에 실패했습니다.');
      }
      if (activeSector && activeSector.id === sectorId) {
        setActiveSector(null);
      }
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 섹터 내 종목 추가
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!activeSector || !newStockCode) return;
    try {
      const response = await fetch(`/api/sector/custom/${activeSector.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: newStockCode.trim(),
          stock_name: newStockName.trim() || null,
          shares_outstanding: newShares ? parseFloat(newShares) : null
        })
      });
      if (!response.ok) {
        throw new Error('종목 등록에 실패했습니다.');
      }
      setNewStockCode('');
      setNewStockName('');
      setNewShares('');
      
      // 활성 섹터의 종목 목록 실시간 업데이트를 위해 다시 fetch 후 리프레시
      const updateRes = await fetch(`/api/sector/custom?country=${country}`);
      if (updateRes.ok) {
        const list = await updateRes.json();
        const updatedSec = list.find(s => s.id === activeSector.id);
        if (updatedSec) setActiveSector(updatedSec);
      }
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  // 섹터 내 종목 삭제
  const handleDeleteStock = async (stockCode) => {
    if (!activeSector) return;
    if (!window.confirm(`섹터에서 종목(${stockCode})을 제거하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/sector/custom/${activeSector.id}/stock/${stockCode}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('종목 제거에 실패했습니다.');
      }
      
      // 리프레시
      const updateRes = await fetch(`/api/sector/custom?country=${country}`);
      if (updateRes.ok) {
        const list = await updateRes.json();
        const updatedSec = list.find(s => s.id === activeSector.id);
        if (updatedSec) setActiveSector(updatedSec);
      }
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

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
            대표 ETF와 구성 종목 시가총액 가중 기반 커스텀 섹터의 성과를 지수와 비교 분석합니다.
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
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 대표 ETF 수익률 대시보드 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Award size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">대표 ETF 수익률 랭킹</h2>
                    <p className="text-xs text-slate-500">각 섹터를 대변하는 ETF의 성과입니다.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEtfModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <Plus size={14} /> 추가
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-3 px-2 w-12 text-center">순위</th>
                      <th className="py-3 px-2">대표 ETF</th>
                      <th className="py-3 px-2 text-right">수익률</th>
                      <th className="py-3 px-2 text-right">초과 성과 (알파)</th>
                      <th className="py-3 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.etfs && dashboardData.etfs.length > 0 ? (
                      dashboardData.etfs.map((etf) => (
                        <tr key={etf.ticker} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              etf.rank === 1 ? 'bg-amber-100 text-amber-700' :
                              etf.rank === 2 ? 'bg-slate-100 text-slate-700' :
                              etf.rank === 3 ? 'bg-amber-50 text-amber-600' : 'text-slate-500'
                            }`}>
                              {etf.rank}
                            </span>
                          </td>
                          <td className="py-4 px-2 font-medium">
                            <div className="font-semibold text-slate-900">{etf.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{etf.ticker}</div>
                          </td>
                          <td className={`py-4 px-2 text-right font-bold ${
                            etf.return_rate >= 0 ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {etf.return_rate >= 0 ? '+' : ''}{etf.return_rate}%
                          </td>
                          <td className="py-4 px-2 text-right">
                            <span className={`inline-block font-semibold px-2 py-0.5 rounded ${
                              etf.alpha >= 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {etf.alpha >= 0 ? '+' : ''}{etf.alpha}%p
                            </span>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button
                              onClick={() => handleDeleteEtf(etf.ticker)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">
                          등록된 대표 ETF가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 커스텀 섹터 수익률 대시보드 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <BarChart2 size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">커스텀 섹터 수익률 랭킹</h2>
                    <p className="text-xs text-slate-500">시가총액 가중 방식으로 산정된 커스텀 섹터입니다.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSectorModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <Plus size={14} /> 섹터 생성
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-3 px-2 w-12 text-center">순위</th>
                      <th className="py-3 px-2">섹터명</th>
                      <th className="py-3 px-2 text-right">수익률</th>
                      <th className="py-3 px-2 text-right">초과 성과 (알파)</th>
                      <th className="py-3 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.custom_sectors && dashboardData.custom_sectors.length > 0 ? (
                      dashboardData.custom_sectors.map((sec) => (
                        <tr 
                          key={sec.id} 
                          onClick={() => setActiveSector(sec)}
                          className={`border-b border-slate-50 hover:bg-blue-50/10 cursor-pointer transition-colors ${
                            activeSector?.id === sec.id ? 'bg-blue-50/20' : ''
                          }`}
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
                              <ChevronRight size={12} className="text-slate-400" />
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
                          <td className="py-4 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDeleteSector(sec.id, sec.name)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="섹터 삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">
                          생성된 커스텀 섹터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* 초과수익률(알파) 시각화 분석 패널 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 size={18} className="text-blue-600" />
              기준 지수 대비 초과 성과 (알파) 요약
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* ETF 알파 순위 차트 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500">대표 ETF 성과 차이</h4>
                <div className="space-y-2">
                  {dashboardData.etfs && dashboardData.etfs.length > 0 ? (
                    dashboardData.etfs.map((item) => (
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
            </div>
          </div>

          {/* 특정 섹터 소속 종목 상세 관리 패널 (드로어 형식) */}
          {activeSector && (
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-4 border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-slate-800 text-blue-400 rounded-xl">
                    <Settings size={20} />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">'{activeSector.name}' 섹터 소속 종목 관리</h3>
                    <p className="text-xs text-slate-400 mt-0.5">이 커스텀 섹터에 속한 주식 및 발행주식수를 수집/관리합니다.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSector(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  닫기
                </button>
              </div>

              {/* 종목 추가 폼 */}
              <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1">종목코드 / 티커</label>
                  <input
                    type="text"
                    required
                    placeholder={country === 'KR' ? '예: 005930' : '예: NVDA'}
                    value={newStockCode}
                    onChange={(e) => setNewStockCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1">공식 종목명 (선택)</label>
                  <input
                    type="text"
                    placeholder="누락 시 자동 수집"
                    value={newStockName}
                    onChange={(e) => setNewStockName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1">발행주식수 (선택)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="누락 시 API 자동 수집"
                    value={newShares}
                    onChange={(e) => setNewShares(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> 종목 추가
                  </button>
                </div>
              </form>

              {/* 종목 목록 */}
              <div className="overflow-x-auto bg-slate-950 rounded-2xl border border-slate-800 p-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold">
                      <th className="py-3 px-3">종목코드</th>
                      <th className="py-3 px-3">종목명</th>
                      <th className="py-3 px-3 text-right">상장주식수 (시총 가중치)</th>
                      <th className="py-3 px-3 w-16 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSector.stocks && activeSector.stocks.length > 0 ? (
                      activeSector.stocks.map((stock) => (
                        <tr key={stock.stock_code} className="border-b border-slate-900 hover:bg-slate-900/50">
                          <td className="py-3 px-3 font-semibold text-slate-300">{stock.stock_code}</td>
                          <td className="py-3 px-3 text-slate-400">{stock.stock_name}</td>
                          <td className={`py-3 px-3 text-right font-mono ${isMasked ? 'blur-sm select-none' : ''}`}>
                            {stock.shares_outstanding ? stock.shares_outstanding.toLocaleString() : '0'} 주
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleDeleteStock(stock.stock_code)}
                              className="text-slate-600 hover:text-red-400 transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-12 text-center text-slate-500 font-medium">
                          섹터 내에 구성된 종목이 없습니다. 위의 폼에서 종목을 추가해 주세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 모달 윈도우들 */}

      {/* ETF 추가 모달 */}
      {isEtfModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">대표 ETF 추가 ({country})</h3>
            <form onSubmit={handleAddEtf} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">종목코드 / 티커</label>
                <input
                  type="text"
                  required
                  placeholder={country === 'KR' ? '예: 069500' : '예: XLK'}
                  value={newEtfTicker}
                  onChange={(e) => setNewEtfTicker(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ETF 이름 (선택)</label>
                <input
                  type="text"
                  placeholder="누락 시 자동으로 조회합니다"
                  value={newEtfName}
                  onChange={(e) => setNewEtfName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEtfModalOpen(false)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 rounded-xl py-2.5 font-semibold text-slate-600 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold transition-colors"
                >
                  추가하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 섹터 생성 모달 */}
      {isSectorModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">새 커스텀 섹터 생성 ({country})</h3>
            <form onSubmit={handleCreateSector} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">섹터 이름</label>
                <input
                  type="text"
                  required
                  placeholder="예: 자동차 및 모빌리티"
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsSectorModalOpen(false)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 rounded-xl py-2.5 font-semibold text-slate-600 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold transition-colors"
                >
                  섹터 생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectorPage;
