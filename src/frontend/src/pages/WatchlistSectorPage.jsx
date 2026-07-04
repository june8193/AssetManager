import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Trash2, Edit3, Globe, FolderPlus, 
  Loader2, Check, X, ShieldAlert, ArrowRight, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WatchlistSectorPage = () => {
  const [country, setCountry] = useState('KR'); // 'KR' | 'US'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 데이터 목록 상태
  const [watchlist, setWatchlist] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);

  // 모달 및 팝업 상태
  const [selectedStockForSector, setSelectedStockForSector] = useState(null); // { stock_code, stock_name }
  const [selectedTargetSectorId, setSelectedTargetSectorId] = useState('');
  const [isAddingStockToSector, setIsAddingStockToSector] = useState(false);
  
  // 섹터 생성 & 수정 상태
  const [newSectorName, setNewSectorName] = useState('');
  const [isCreatingSector, setIsCreatingSector] = useState(false);
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [editingSectorName, setEditingSectorName] = useState('');
  const [isUpdatingSector, setIsUpdatingSector] = useState(false);

  // 피드백 메시지
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const showAlert = (text, type = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 4000);
  };

  // 1. 관심종목 목록 가져오기
  const fetchWatchlist = async () => {
    setLoadingWatchlist(true);
    try {
      const res = await fetch(`/api/watchlist?country=${country}`);
      if (!res.ok) throw new Error('관심종목을 가져오는 데 실패했습니다.');
      const data = await res.json();
      setWatchlist(data);
    } catch (err) {
      console.error(err);
      showAlert(err.message, 'error');
    } finally {
      setLoadingWatchlist(false);
    }
  };

  // 2. 커스텀 섹터 목록 가져오기
  const fetchSectors = async () => {
    setLoadingSectors(true);
    try {
      const res = await fetch(`/api/sector/custom?country=${country}`);
      if (!res.ok) throw new Error('커스텀 섹터 목록을 가져오는 데 실패했습니다.');
      const data = await res.json();
      setSectors(data);
    } catch (err) {
      console.error(err);
      showAlert(err.message, 'error');
    } finally {
      setLoadingSectors(false);
    }
  };

  // 데이터 로드
  useEffect(() => {
    fetchWatchlist();
    fetchSectors();
    setSearchResults([]);
    setSearchQuery('');
  }, [country]);

  // 3. 종목 검색 수행
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery.trim())}&country=${country}`);
      if (!res.ok) throw new Error('종목 검색에 실패했습니다.');
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) {
        setSearchError('검색 결과가 없습니다.');
      }
    } catch (err) {
      console.error(err);
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // 4. 관심종목 추가
  const handleAddToWatchlist = async (stock) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: stock.stock_code,
          stock_name: stock.stock_name,
          country: country
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || '관심종목 등록에 실패했습니다.');
      }

      showAlert(`${stock.stock_name} 종목이 관심종목에 등록되었습니다.`);
      fetchWatchlist();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // 5. 관심종목 삭제
  const handleRemoveFromWatchlist = async (stockCode, stockName) => {
    if (!window.confirm(`[${stockName}] 종목을 관심종목에서 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/watchlist/${stockCode}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('관심종목 삭제에 실패했습니다.');
      showAlert(`${stockName} 종목이 삭제되었습니다.`);
      fetchWatchlist();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // 6. 커스텀 섹터 생성
  const handleCreateSector = async (e) => {
    e.preventDefault();
    if (!newSectorName.trim()) return;

    setIsCreatingSector(true);
    try {
      const res = await fetch('/api/sector/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSectorName.trim(),
          country: country
        })
      });

      if (!res.ok) throw new Error('커스텀 섹터 생성에 실패했습니다.');
      showAlert('새로운 커스텀 섹터가 생성되었습니다.');
      setNewSectorName('');
      fetchSectors();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setIsCreatingSector(false);
    }
  };

  // 7. 커스텀 섹터 삭제
  const handleRemoveSector = async (sectorId, sectorName) => {
    if (!window.confirm(`[${sectorName}] 섹터를 정말 삭제하시겠습니까?\n섹터 삭제 시 소속 종목들도 모두 함께 제거됩니다.`)) return;

    try {
      const res = await fetch(`/api/sector/custom/${sectorId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('섹터 삭제에 실패했습니다.');
      showAlert('섹터가 정상적으로 삭제되었습니다.');
      fetchSectors();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // 8. 커스텀 섹터 이름 수정 실행
  const handleUpdateSectorName = async (e) => {
    e.preventDefault();
    if (!editingSectorName.trim() || !editingSectorId) return;

    setIsUpdatingSector(true);
    try {
      const res = await fetch(`/api/sector/custom/${editingSectorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingSectorName.trim()
        })
      });

      if (!res.ok) throw new Error('섹터명 수정에 실패했습니다.');
      showAlert('섹터 이름이 변경되었습니다.');
      setEditingSectorId(null);
      setEditingSectorName('');
      fetchSectors();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setIsUpdatingSector(false);
    }
  };

  // 9. 섹터 내 종목 추가 실행 (발행주식수 자동 수집 적용)
  const handleAddStockToSector = async (e) => {
    e.preventDefault();
    if (!selectedStockForSector || !selectedTargetSectorId) return;

    setIsAddingStockToSector(true);
    try {
      const res = await fetch(`/api/sector/custom/${selectedTargetSectorId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: selectedStockForSector.stock_code,
          stock_name: selectedStockForSector.stock_name,
          shares_outstanding: null // 자동 수집 하도록 null 지정
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || '섹터 종목 추가에 실패했습니다.');
      }

      showAlert(`${selectedStockForSector.stock_name} 종목이 섹터에 추가되었습니다.\n(발행주식수는 백엔드에서 자동으로 수집합니다.)`);
      setSelectedStockForSector(null);
      setSelectedTargetSectorId('');
      fetchSectors();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setIsAddingStockToSector(false);
    }
  };

  // 10. 섹터 내 소속 종목 삭제
  const handleRemoveStockFromSector = async (sectorId, stockCode, stockName) => {
    if (!window.confirm(`해당 섹터에서 [${stockName}] 종목을 제거하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/sector/custom/${sectorId}/stock/${stockCode}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('섹터 종목 삭제에 실패했습니다.');
      showAlert(`${stockName} 종목이 섹터에서 제거되었습니다.`);
      fetchSectors();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* 알림 메시지 배너 */}
      <AnimatePresence>
        {alertMsg.text && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl shadow-xl z-[9999] border text-sm font-bold flex items-center gap-3 backdrop-blur-md ${
              alertMsg.type === 'error' 
                ? 'bg-rose-50/90 text-rose-800 border-rose-200' 
                : 'bg-emerald-50/90 text-emerald-800 border-emerald-200'
            }`}
          >
            {alertMsg.type === 'error' ? <ShieldAlert size={18} /> : <Check size={18} />}
            <span className="whitespace-pre-line">{alertMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 섹션 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3 font-headline">
            <FolderPlus className="text-blue-600" size={32} />
            관심종목/섹터 관리
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            관심 종목을 등록하고 커스텀 섹터를 구성하여 포트폴리오 벤치마크 및 성과 비교 지표를 직접 정의합니다.
          </p>
        </div>

        {/* 국가 탭 */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setCountry('KR')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              country === 'KR' 
                ? 'bg-white text-blue-700 shadow-md border border-slate-200/20' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe size={14} />
            국내 주식
          </button>
          <button
            onClick={() => setCountry('US')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              country === 'US' 
                ? 'bg-white text-blue-700 shadow-md border border-slate-200/20' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe size={14} />
            미국 주식
          </button>
        </div>
      </div>

      {/* 1. 검색 및 검색결과 레이아웃 */}
      <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Search size={18} className="text-blue-500" />
          신규 종목 검색 및 추가
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={country === 'KR' ? "종목명 또는 6자리 종목코드를 입력하세요 (예: 삼성전자, 005930)" : "종목명 또는 티커를 입력하세요 (예: Apple, AAPL)"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-semibold"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-8 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            {isSearching ? <Loader2 className="animate-spin" size={16} /> : null}
            검색
          </button>
        </form>

        {country === 'US' && (
          <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            💡 미국 주식은 실시간 야후 파이낸스(yfinance) 검색을 사용하여 다소 시간이 걸릴 수 있습니다.
          </p>
        )}

        {/* 검색 결과 리스트 */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/50"
            >
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-150">
                {searchResults.map((stock) => (
                  <div key={stock.stock_code} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-slate-200/60 text-slate-700 font-bold rounded-lg text-xs tracking-wide">
                        {stock.stock_code}
                      </span>
                      <span className="font-bold text-sm text-slate-800">{stock.stock_name}</span>
                      <span className="text-xs text-slate-400 font-semibold">({stock.market})</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddToWatchlist(stock)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 rounded-xl text-xs font-black transition-colors flex items-center gap-1.5"
                      >
                        <Plus size={12} />
                        관심종목 등록
                      </button>
                      <button
                        onClick={() => setSelectedStockForSector(stock)}
                        className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 rounded-xl text-xs font-black transition-colors flex items-center gap-1.5"
                      >
                        <Plus size={12} />
                        섹터 추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {searchError && (
          <p className="text-xs font-semibold text-rose-500 mt-2 pl-2">{searchError}</p>
        )}
      </section>

      {/* 2. 관심종목 & 커스텀 섹터 목록 2컬럼 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 왼쪽: 관심종목 관리 (col-span-5) */}
        <section className="lg:col-span-5 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BookOpen size={18} className="text-rose-500" />
              관심종목 ({watchlist.length})
            </h2>
          </div>

          <div className="flex-1 overflow-x-auto">
            {loadingWatchlist ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={32} />
              </div>
            ) : watchlist.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-100 rounded-2xl">
                <span className="text-xs font-bold">등록된 관심종목이 없습니다.</span>
                <span className="text-[10px]">상단 검색창에서 종목을 찾아 등록하세요.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">코드/티커</th>
                    <th className="pb-3">종목명</th>
                    <th className="pb-3 text-right pr-2">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {watchlist.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 pl-2">
                        <span className="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.stock_code}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-slate-800">{item.stock_name}</td>
                      <td className="py-3 text-right pr-2">
                        <button
                          onClick={() => handleRemoveFromWatchlist(item.stock_code, item.stock_name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* 오른쪽: 커스텀 섹터 관리 (col-span-7) */}
        <section className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FolderPlus size={18} className="text-blue-500" />
              커스텀 섹터 ({sectors.length})
            </h2>
            
            {/* 섹터 신규 생성 폼 */}
            <form onSubmit={handleCreateSector} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="새 섹터명 입력"
                required
                value={newSectorName}
                onChange={(e) => setNewSectorName(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 w-full sm:w-36 bg-slate-50 focus:bg-white"
              />
              <button
                type="submit"
                disabled={isCreatingSector || !newSectorName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1"
              >
                <Plus size={12} />
                추가
              </button>
            </form>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-1">
            {loadingSectors ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={32} />
              </div>
            ) : sectors.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-100 rounded-2xl">
                <span className="text-xs font-bold">생성된 커스텀 섹터가 없습니다.</span>
                <span className="text-[10px]">새 섹터를 생성하고 종목을 채워보세요.</span>
              </div>
            ) : (
              sectors.map((sector) => (
                <div 
                  key={sector.id}
                  className="border border-slate-100 hover:border-slate-200 rounded-2xl p-4 bg-slate-50/30 hover:bg-slate-50/70 transition-all space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    {editingSectorId === sector.id ? (
                      <form onSubmit={handleUpdateSectorName} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingSectorName}
                          onChange={(e) => setEditingSectorName(e.target.value)}
                          className="border border-slate-350 bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
                        />
                        <button
                          type="submit"
                          disabled={isUpdatingSector}
                          className="p-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingSectorId(null); setEditingSectorName(''); }}
                          className="p-1 bg-slate-150 text-slate-800 hover:bg-slate-200 rounded"
                        >
                          <X size={12} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-800">{sector.name}</h3>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                          {sector.stocks.length} 종목
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingSectorId(sector.id);
                          setEditingSectorName(sector.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition-colors"
                        title="이름 수정"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => handleRemoveSector(sector.id, sector.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                        title="섹터 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 소속 종목 칩 리스트 */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sector.stocks.length === 0 ? (
                      <span className="text-[10px] text-slate-400 font-bold italic pl-1">소속된 종목이 없습니다.</span>
                    ) : (
                      sector.stocks.map((stock) => (
                        <div 
                          key={stock.stock_code}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 bg-white border border-slate-150 rounded-xl text-[11px] font-bold text-slate-700 group shadow-sm hover:border-slate-200"
                        >
                          <span>{stock.stock_name}</span>
                          <span className="text-[9px] text-slate-400">({stock.stock_code})</span>
                          <button
                            onClick={() => handleRemoveStockFromSector(sector.id, stock.stock_code, stock.stock_name)}
                            className="p-0.5 text-slate-355 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                            title="섹터에서 삭제"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 섹터 추가 대상 선택 및 확인 모달 */}
      {selectedStockForSector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-slate-900">커스텀 섹터에 종목 추가</h3>
              <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                선택한 종목을 아래 커스텀 섹터로 추가합니다.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>{selectedStockForSector.stock_name}</span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">{selectedStockForSector.stock_code}</span>
            </div>

            <form onSubmit={handleAddStockToSector} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 pl-1">추가할 대상 커스텀 섹터</label>
                <select
                  required
                  value={selectedTargetSectorId}
                  onChange={(e) => setSelectedTargetSectorId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">-- 섹터 선택 --</option>
                  {sectors.map((sec) => (
                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                  ))}
                </select>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed pl-1 font-semibold">
                💡 커스텀 섹터 가중치 계산을 위한 **발행주식수**는 백엔드 서버에서 자동으로 수집하므로 추가 입력을 하실 필요가 없습니다.
              </p>

              <div className="flex gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setSelectedStockForSector(null); setSelectedTargetSectorId(''); }}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 rounded-xl py-3 text-slate-600 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isAddingStockToSector || !selectedTargetSectorId}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-355 text-white rounded-xl py-3 transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-100"
                >
                  {isAddingStockToSector ? <Loader2 className="animate-spin" size={12} /> : null}
                  섹터에 추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default WatchlistSectorPage;
