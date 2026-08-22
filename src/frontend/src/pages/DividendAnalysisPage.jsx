import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Calendar, BarChart3, 
  RefreshCw, AlertCircle 
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, 
  Tooltip, Legend, CartesianGrid 
} from 'recharts';

/**
 * 배당 분석 메인 대시보드 페이지 (Variant A 대시보드 구조)
 */
const DividendAnalysisPage = () => {
  const [summary, setSummary] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customPrices, setCustomPrices] = useState({});

  const [activeTab, setActiveTab] = useState('배당주');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, stockRes] = await Promise.all([
        fetch('/api/dividend/summary'),
        fetch('/api/dividend/stocks')
      ]);

      if (!sumRes.ok || !stockRes.ok) {
        throw new Error('배당 데이터를 가져오는 데 실패했습니다.');
      }

      const sumData = await sumRes.json();
      const stockData = await stockRes.json();

      setSummary(sumData);
      setStocks(stockData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePriceChange = (stockId, val) => {
    setCustomPrices((prev) => ({
      ...prev,
      [stockId]: val === '' ? 0 : Number(val),
    }));
  };

  const filteredStocks = stocks.filter((stock) => {
    if (activeTab === '전체 자산') return true;
    if (activeTab === '배당주') {
      return stock.sub_category === '배당주' || stock.major_category === '배당주';
    }
    return stock.major_category === activeTab;
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="animate-spin text-blue-600 mb-3" size={32} />
        <p className="text-sm font-medium">배당 수령 내역 및 연간 배당률 데이터를 로딩 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle size={36} className="mb-2" />
        <p className="font-bold text-lg mb-2">데이터 로딩 오류</p>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const { total_krw = 0, ytd_krw = 0, avg_yield = 0, monthly_avg = 0, monthly_data = [] } = summary || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="text-blue-600" size={28} />
            배당 분석 대시보드
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            수령 배당금 추이, 종목별 고유 통화 기준 배당률 및 가상 주가 시뮬레이션
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 1. 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">총 누적 배당금 (KRW 환산)</p>
            <p className="text-xl font-bold text-slate-800">₩{total_krw.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">올해 수령 배당금 (YTD)</p>
            <p className="text-xl font-bold text-slate-800">₩{ytd_krw.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-violet-50 text-violet-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">평균 연간 배당률</p>
            <p className="text-xl font-bold text-violet-600">{avg_yield.toFixed(2)}%</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">월평균 수령액</p>
            <p className="text-xl font-bold text-slate-800">₩{monthly_avg.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 2. 중단 콤보 차트 */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">월별 배당 수령액 & 누적 추이</h3>
            <p className="text-xs text-slate-500">막대: 당월 수령액 / 꺾은선: 누적 배당금</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
            {new Date().getFullYear()}년 기준
          </span>
        </div>
        <div className="h-72 w-full">
          {monthly_data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly_data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis yAxisId="left" tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₩${v / 10000}만`} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₩${v / 10000}만`} />
                <Tooltip 
                  formatter={(val) => `₩${val.toLocaleString()}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="amount" name="당월 배당금" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Line yAxisId="right" type="monotone" dataKey="cumulative" name="누적 배당금" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              수령된 배당금 내역이 아직 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 3. 하단 종목별 배당 표 (Inline 가상 주가 입력 시뮬레이터) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">종목별 연간 배당률 & 가상 주가 시뮬레이터</h3>
            <p className="text-xs text-slate-500">가상 주가를 수정하면 즉시 가상 배당률(%)이 실시간으로 재계산됩니다.</p>
          </div>

          {/* 카테고리 탭 (배당주 / 채권 / 전체 자산) */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            {[
              { id: '배당주', label: '배당주' },
              { id: '채권', label: '채권' },
              { id: '전체 자산', label: '전체 자산' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">종목명 (티커)</th>
                <th className="px-4 py-3 text-center">통화</th>
                <th className="px-4 py-3 text-right">현재가 / 평단가</th>
                <th className="px-4 py-3 text-right">올해 수령액</th>
                <th className="px-4 py-3 text-right">추정 연배당금</th>
                <th className="px-4 py-3 text-right">시가 배당률</th>
                <th className="px-4 py-3 text-center bg-blue-50 text-blue-700">가상 주가 입력</th>
                <th className="px-4 py-3 text-right bg-blue-50 text-blue-700">가상 배당률</th>
                <th className="px-4 py-3 text-right">총 누적 배당금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock) => {
                  const symbol = stock.currency === 'USD' ? '$' : '₩';
                  const inputVal = customPrices[stock.id] ?? stock.current_price;
                  const simYield = inputVal > 0 && stock.annual_estimate > 0 
                    ? ((stock.annual_estimate / inputVal) * 100).toFixed(2) 
                    : '-';

                  return (
                    <tr key={stock.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {stock.name}
                        <span className="block text-xs text-slate-400 font-normal">{stock.ticker}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${stock.currency === 'USD' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {stock.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {stock.current_price > 0 ? `${symbol}${stock.current_price.toLocaleString()}` : '-'}
                        <span className="block text-xs text-slate-400">
                          {stock.buy_price > 0 ? `(${symbol}${stock.buy_price.toLocaleString()})` : '(-)'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {stock.ytd_amount > 0 ? `${symbol}${stock.ytd_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-medium text-slate-800">
                        {stock.annual_estimate > 0 ? `${symbol}${stock.annual_estimate.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                        {stock.yield_current > 0 ? `${stock.yield_current.toFixed(2)}%` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-center bg-blue-50/40">
                        <div className="inline-flex items-center gap-1 border border-blue-200 rounded px-2 py-1 bg-white focus-within:ring-2 focus-within:ring-blue-400">
                          <span className="text-xs text-slate-400 font-mono">{symbol}</span>
                          <input 
                            type="number"
                            value={inputVal}
                            onChange={(e) => handlePriceChange(stock.id, e.target.value)}
                            className="w-24 text-right font-mono text-xs focus:outline-none"
                            placeholder="주가 입력"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono bg-blue-50/40 text-blue-600 font-bold">
                        {simYield !== '-' ? `${simYield}%` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                        {stock.cumulative > 0 ? `${symbol}${stock.cumulative.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-slate-400 text-xs">
                    {activeTab} 카테고리에 해당하는 자산 정보가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DividendAnalysisPage;
