import { useState, useEffect, useRef } from 'react';
import { PlusCircle, Search, Loader2 } from 'lucide-react';

export default function WatchlistForm({ onAdd, error, country = 'kr' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // 검색 로직 (debounce 적용)
  useEffect(() => {
    const searchStocks = async () => {
      if (query.length < 1) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/stocks/search?q=${encodeURIComponent(query)}&country=${country.toUpperCase()}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error('검색 에러:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchStocks, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (stock) => {
    const success = await onAdd(stock.stock_code, stock.stock_name);
    if (success) {
      setQuery('');
      setResults([]);
      setShowDropdown(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 만약 검색어가 완벽히 일치하는 결과가 하나라면 바로 추가하는 로직을 넣을 수도 있지만,
    // 명시적인 선택을 유도하기 위해 여기서는 드롭다운 선택을 우선함.
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 w-full max-w-4xl mx-auto relative">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center font-headline">
        관심종목 추가
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-4 relative">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </div>
          <input
            type="text"
            placeholder={country === 'us' ? "종목명 또는 티커 (예: Apple, AAPL)" : "종목명 또는 종목코드 (예: 삼성전자, 005930)"}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => query.length > 0 && setShowDropdown(true)}
          />
          
          {/* 드롭다운 결과창 */}
          {showDropdown && results.length > 0 && (
            <div 
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-x-hidden"
            >
              <ul className="py-1 text-sm text-gray-700">
                {results.map((stock) => (
                  <li 
                    key={stock.stock_code}
                    onClick={() => handleSelect(stock)}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-gray-900">{stock.stock_name}</span>
                    <span className="text-gray-400 font-mono text-xs">{stock.stock_code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </form>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
}
