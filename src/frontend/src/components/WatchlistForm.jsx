import { useState } from 'react';
import { PlusCircle } from 'lucide-react';

export default function WatchlistForm({ onAdd, error }) {
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stockCode.trim() || !stockName.trim()) return;
    
    const success = await onAdd(stockCode, stockName);
    if (success) {
      setStockCode('');
      setStockName('');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 w-full max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center font-headline">
        관심종목 추가
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="stockCode" className="sr-only">종목코드</label>
          <input
            id="stockCode"
            type="text"
            placeholder="종목코드 (예: 005930)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="stockName" className="sr-only">종목명</label>
          <input
            id="stockName"
            type="text"
            placeholder="종목명 (예: 삼성전자)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={stockName}
            onChange={(e) => setStockName(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <PlusCircle size={20} />
          추가
        </button>
      </form>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
}
