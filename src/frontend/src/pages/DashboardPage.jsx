import React, { useState, useMemo } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { Wallet, PieChart, TrendingUp, RefreshCw, AlertCircle, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import YearlyStatusTable from '../components/YearlyStatusTable';
import AssetChart from '../components/Dashboard/AssetChart';

/**
 * 대시보드 페이지 컴포넌트.
 *
 * 전체 평가 자산, 적용 환율, 계좌별 현황, 자산 비중 및 트렌드 차트를 보여줍니다.
 * useDashboard 훅을 통해 데이터를 가져오며, 실시간 가격 갱신을 위한 새로고침 기능을 제공합니다.
 *
 * Returns:
 *     JSX.Element: 대시보드 화면 렌더링 결과
 */
const DashboardPage = () => {
  const { data, loading, error, refresh } = useDashboard();
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [assetSortOptions, setAssetSortOptions] = useState({});

  const handleSortChange = (accountId, sortType) => {
    setAssetSortOptions(prev => ({ ...prev, [accountId]: sortType }));
  };

  const toggleAccount = (id) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAccounts(newExpanded);
  };

  const toggleCategory = (catName) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catName)) {
      newExpanded.delete(catName);
    } else {
      newExpanded.add(catName);
    }
    setExpandedCategories(newExpanded);
  };
  // 계좌별로 정렬된 자산 목록을 메모이제이션하여 계산
  const sortedAccounts = useMemo(() => {
    if (!data?.accounts) return [];
    
    return data.accounts.map(acc => {
      const sortType = assetSortOptions[acc.id] || 'valuation';
      const sortedAssets = [...(acc.assets || [])].sort((a, b) => {
        if (sortType === 'category') {
          const catA = a.category || '미분류';
          const catB = b.category || '미분류';
          if (catA !== catB) return catA.localeCompare(catB);
          return b.valuation_krw - a.valuation_krw;
        }
        // 기본값: 평가액 내림차순
        return b.valuation_krw - a.valuation_krw;
      });
      return { ...acc, sortedAssets };
    });
  }, [data, assetSortOptions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium">자산 데이터를 분석 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-red-50 border border-red-100 p-8 rounded-3xl inline-flex flex-col items-center">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-red-700 mb-6">{error}</p>
          <button 
            onClick={refresh}
            className="px-6 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const { categories, total_valuation_krw, exchange_rate, yearly } = data;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Header & Overall Summary */}
      <div className="mb-10 p-8 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-blue-400 opacity-10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -m-20 w-60 h-60 bg-indigo-400 opacity-10 rounded-full blur-[80px]"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-blue-200 text-xs font-bold mb-4 border border-white/10 uppercase tracking-wider">
              <TrendingUp size={14} /> Global Portfolio Summary
            </div>
            <h1 className="text-4xl font-extrabold font-headline tracking-tighter mb-1">
              총 평가 자산
            </h1>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                {Math.round(total_valuation_krw).toLocaleString()}
              </span>
              <span className="text-2xl font-bold text-blue-300">원</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:min-w-[300px]">
            <div className="flex items-center gap-2 text-blue-200 text-sm font-bold mb-3">
              <RefreshCw size={16} /> 적용 환율 정보 (USD/KRW)
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl font-black text-white">
                {exchange_rate.rate.toLocaleString()}
              </span>
              <span className="text-lg font-bold text-blue-300">원</span>
            </div>
            <div className="space-y-1.5 border-t border-white/10 pt-3">
              <div className="flex items-center gap-2 text-xs text-blue-200/70 antialiased">
                <Calendar size={12} />
                <span>기준일: <span className="text-white font-medium">{exchange_rate.date}</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-200/70 antialiased">
                <Clock size={12} />
                <span>입력일: <span className="text-white font-medium">{new Date(exchange_rate.created_at).toLocaleString()}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Account Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Wallet className="text-blue-600" size={28} />
              계좌별 현황
            </h2>
            <button 
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:shadow-sm rounded-xl font-bold transition-all group/refresh"
              title="새로고침"
            >
              <RefreshCw size={18} className="group-hover/refresh:rotate-180 transition-transform duration-500" />
              <span className="text-sm">새로고침</span>
            </button>
          </div>

          <div className="grid gap-4">
            {sortedAccounts.map((acc) => {
              const isExpanded = expandedAccounts.has(acc.id);
              return (
                <div 
                  key={acc.id} 
                  className={`group bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                    isExpanded ? 'border-blue-200 shadow-xl shadow-blue-900/5' : 'border-slate-100 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Account Header (Clickable) */}
                  <div 
                    onClick={() => toggleAccount(acc.id)}
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        <Wallet size={28} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isExpanded ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                          }`}>{acc.provider}</span>
                          <h3 className={`font-bold transition-colors ${isExpanded ? 'text-blue-900' : 'text-slate-900'}`}>
                            {acc.name}
                          </h3>
                        </div>
                        <p className={`text-sm font-medium transition-colors ${isExpanded ? 'text-blue-700/60' : 'text-slate-500'}`}>
                          {acc.alias || '별칭 없음'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className={`text-xl font-black transition-colors ${isExpanded ? 'text-blue-700' : 'text-slate-900'}`}>
                          {Math.round(acc.total_valuation_krw).toLocaleString()} <span className="text-sm font-bold text-slate-400">원</span>
                        </div>
                        <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                          {((acc.total_valuation_krw / total_valuation_krw) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                      <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-600' : 'text-slate-300'}`}>
                        <ChevronDown size={24} />
                      </div>
                    </div>
                  </div>

                  {/* Account Details (Expanded) */}
                  {isExpanded && (
                    <div className="px-6 pb-6 bg-slate-50/50 border-t border-blue-50">
                      <div className="flex justify-end mt-4 px-2">
                        <select
                          className="text-sm border-slate-200 rounded-md text-slate-600 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={assetSortOptions[acc.id] || 'valuation'}
                          onChange={(e) => handleSortChange(acc.id, e.target.value)}
                        >
                          <option value="valuation">평가액 순 정렬</option>
                          <option value="category">카테고리별 정렬</option>
                        </select>
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-inner">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">종목명 (티커)</th>
                              <th className="px-4 py-3">카테고리</th>
                              <th className="px-4 py-3 text-right">수량</th>
                              <th className="px-4 py-3 text-right">현재가</th>
                              <th className="px-4 py-3 text-right text-blue-600">평가액 (KRW)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {acc.sortedAssets.map((asset, idx) => (
                              <tr key={`${acc.id}-${asset.ticker}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900">{asset.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{asset.ticker}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold">
                                    {asset.category || '미분류'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-600">
                                  {asset.quantity.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-600">
                                  {asset.price.toLocaleString()} <span className="text-[10px] text-slate-300">{asset.country === 'US' ? 'USD' : 'KRW'}</span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">
                                  {Math.round(asset.valuation_krw).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                            {(!acc.sortedAssets || acc.sortedAssets.length === 0) && (
                              <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-400 font-medium bg-white">
                                  보유 종목이 없습니다.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 px-2">
            <PieChart className="text-indigo-600" size={28} />
            자산 비중
          </h2>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="space-y-6">
              {categories.map((cat, idx) => {
                const isExpanded = expandedCategories.has(cat.category);
                const percentage = (cat.value_krw / total_valuation_krw) * 100;
                
                return (
                  <div key={cat.category} className="group/cat">
                    {/* Major Category Header */}
                    <div 
                      className="flex justify-between items-end mb-2 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => toggleCategory(cat.category)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">{cat.category}</span>
                        <ChevronDown 
                          size={14} 
                          className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                        />
                      </div>
                      <span className="text-sm font-black text-slate-900">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    {/* Major Category Bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          idx === 0 ? 'bg-blue-600' : 
                          idx === 1 ? 'bg-indigo-500' : 
                          idx === 2 ? 'bg-purple-500' : 
                          'bg-slate-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>

                    <div className="text-right mt-1.5 mb-2">
                      <span className="text-[11px] font-bold text-slate-400">
                        {Math.round(cat.value_krw).toLocaleString()} 원
                      </span>
                    </div>

                    {/* Sub Categories (Collapsible) */}
                    {isExpanded && cat.sub_categories && cat.sub_categories.length > 0 && (
                      <div className="mt-4 pl-4 border-l-2 border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {cat.sub_categories.map((sub) => {
                          const subInMajorPerc = (sub.value_krw / cat.value_krw) * 100;
                          const subInTotalPerc = (sub.value_krw / total_valuation_krw) * 100;
                          
                          return (
                            <div key={sub.category} className="relative">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-bold text-slate-600">{sub.category}</span>
                                <div className="text-[10px] font-black">
                                  <span className="text-slate-900">{subInMajorPerc.toFixed(1)}%</span>
                                  <span className="text-slate-400 ml-1 font-bold">({subInTotalPerc.toFixed(1)}%)</span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-slate-300 rounded-full transition-all duration-700"
                                  style={{ width: `${subInMajorPerc}%` }}
                                ></div>
                              </div>
                              <div className="text-right mt-1">
                                <span className="text-[10px] font-bold text-slate-300">
                                  {Math.round(sub.value_krw).toLocaleString()} 원
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-10 p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                자산 비중을 클릭하면 상세 중분류 내역을 확인할 수 있습니다. 각 자산의 현재가를 기준으로 자동 계산됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Trend Chart */}
      <AssetChart data={data.snapshots} />

      {/* Yearly Performance Table */}
      <YearlyStatusTable data={yearly} />
    </main>
  );
};

export default DashboardPage;
