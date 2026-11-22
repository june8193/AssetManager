import React, { useState, useEffect } from 'react';
import { X, Search, Star, Plus } from 'lucide-react';

/**
 * 미보유/관심종목 편입 테스트를 위한 종목 선택 모달 컴포넌트입니다.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - 모달 열림 여부
 * @param {Function} props.onClose - 모달 닫기 콜백
 * @param {Function} props.onSelectTicker - 종목 선택 콜백 (ticker: string)
 * @param {Set<string>} props.existingTickers - 이미 보유 또는 편입된 티커 집합
 */
export default function AddTickerModal({
  isOpen,
  onClose,
  onSelectTicker,
  existingTickers = new Set(),
}) {
  const [watchlist, setWatchlist] = useState([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [country, setCountry] = useState('US');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      setLoadingWatchlist(true);
      Promise.all([
        fetch('/api/watchlist?country=KR').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/watchlist?country=US').then((r) => (r.ok ? r.json() : [])),
      ])
        .then(([krList, usList]) => {
          if (!active) return;
          const merged = [
            ...(Array.isArray(krList) ? krList : []),
            ...(Array.isArray(usList) ? usList : []),
          ];
          setWatchlist(merged);
        })
        .catch(() => {
          if (active) setWatchlist([]);
        })
        .finally(() => {
          if (active) setLoadingWatchlist(false);
        });
    });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(trimmed)}&country=${country}`
      );
      if (res.ok) {
        const rows = await res.json();
        setSearchResults(Array.isArray(rows) ? rows : []);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePick = (ticker) => {
    if (!ticker || existingTickers.has(ticker)) return;
    onSelectTicker(ticker);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">미보유/관심종목 편입 테스트</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              관심종목이나 검색된 국내·미국 종목을 시뮬레이터에 추가해 변동성 효과를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* 국내/미국 종목 검색 */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">국내·미국 종목 검색</div>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <select
                aria-label="검색 시장"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-2.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="US">미국 (US)</option>
                <option value="KR">국내 (KR)</option>
              </select>
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="종목명 또는 티커 검색 (예: MSFT, 삼성전자)"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                검색
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="mt-2.5 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {searchResults.map((item) => {
                  const already = existingTickers.has(item.stock_code);
                  return (
                    <button
                      key={item.stock_code}
                      type="button"
                      disabled={already}
                      onClick={() => handlePick(item.stock_code)}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-blue-50/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <div>
                        <span className="text-xs font-semibold text-slate-800">
                          {item.stock_name}
                        </span>
                        <span className="ml-2 text-[11px] font-mono text-slate-400">
                          {item.stock_code}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                        <Plus className="w-3 h-3" />
                        {already ? '편입됨' : '편입'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 관심종목 목록 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>내 관심종목</span>
            </div>
            {loadingWatchlist ? (
              <div className="text-xs text-slate-400 py-3">관심종목을 불러오는 중...</div>
            ) : watchlist.length === 0 ? (
              <div className="text-xs text-slate-400 py-3">등록된 관심종목이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {watchlist.map((item) => {
                  const already = existingTickers.has(item.stock_code);
                  return (
                    <button
                      key={`${item.country}-${item.stock_code}`}
                      type="button"
                      disabled={already}
                      onClick={() => handlePick(item.stock_code)}
                      className="px-3 py-2 text-left rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {item.stock_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {item.stock_code} · {item.country}
                        </div>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
