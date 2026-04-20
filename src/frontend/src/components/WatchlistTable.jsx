import { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

function WatchlistRow({ item, realtimeData, onRemove }) {
  const [highlight, setHighlight] = useState(false);
  const prevPriceRef = useRef(null);

  const rtData = realtimeData[item.stock_code];
  const displayPrice = rtData ? rtData.current_price : null;
  const displayChangeRate = rtData ? rtData.change_rate : null;

  // 가격 변경 시 애니메이션 트리거
  useEffect(() => {
    if (displayPrice !== null && displayPrice !== prevPriceRef.current) {
      if (prevPriceRef.current !== null) {
        setHighlight(true);
        // 애니메이션 지속시간인 1초 뒤에 highlight 클래스를 제거
        const timer = setTimeout(() => setHighlight(false), 1000);
        return () => clearTimeout(timer);
      }
      prevPriceRef.current = displayPrice;
    }
  }, [displayPrice]);

  return (
    <tr className={`border-b border-gray-100 transition-colors ${highlight ? 'animate-highlight' : 'hover:bg-slate-50'}`}>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {item.stock_name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
        {item.stock_code}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
        {displayPrice 
          ? (item.country?.toUpperCase() === 'US' 
              ? '$' + displayPrice.toLocaleString() 
              : displayPrice.toLocaleString() + '원') 
          : '-'}
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
        displayChangeRate > 0 ? 'text-red-500' : (displayChangeRate < 0 ? 'text-blue-500' : 'text-gray-500')
      }`}>
        {displayChangeRate ? (displayChangeRate > 0 ? '+' : '') + displayChangeRate + '%' : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onRemove(item.stock_code)}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="삭제"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}

export default function WatchlistTable({ watchlist, realtimeData, onRemove, loading }) {
  if (loading && watchlist.length === 0) {
    return <div className="text-center py-10 text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-4xl mx-auto">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                종목명
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                종목코드
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                현재가
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                등락률
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {watchlist.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  등록된 관심종목이 없습니다. 위에서 추가해 보세요.
                </td>
              </tr>
            ) : (
              watchlist.map((item) => (
                <WatchlistRow
                  key={item.id}
                  item={item}
                  realtimeData={realtimeData}
                  onRemove={onRemove}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
