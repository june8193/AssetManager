import React, { useState, useEffect } from 'react';
import { useRatios } from '../hooks/useRatios';
import { Save, Calculator, ArrowRight, TrendingUp, DollarSign } from 'lucide-react';

const RatioCalculatorPage = () => {
  const { targets, rebalancing, loading, updateTargets, calculateRebalancing } = useRatios();
  const [additionalCash, setAdditionalCash] = useState(0);
  const [editingTargets, setEditingTargets] = useState([]);

  useEffect(() => {
    if (targets.length > 0) {
      setEditingTargets(targets);
    } else {
      // 기본값 설정
      setEditingTargets([
        { category_name: '주식', category_type: 'major', target_percentage: 0 },
        { category_name: '현금', category_type: 'major', target_percentage: 0 }
      ]);
    }
  }, [targets]);

  const handleAddCategory = (type) => {
    const name = prompt(`${type === 'major' ? '대분류' : '중분류'} 이름을 입력하세요:`);
    if (!name) return;
    
    let parent = null;
    if (type === 'sub') {
      parent = prompt('상위 대분류 이름을 입력하세요:');
      if (!parent) return;
    }

    setEditingTargets([
      ...editingTargets,
      { category_name: name, category_type: type, target_percentage: 0, parent_category: parent }
    ]);
  };

  const handleRemoveCategory = (index) => {
    const newTargets = editingTargets.filter((_, i) => i !== index);
    setEditingTargets(newTargets);
  };

  const handleTargetChange = (index, value) => {
    const newTargets = [...editingTargets];
    newTargets[index].target_percentage = parseFloat(value) || 0;
    setEditingTargets(newTargets);
  };

  const handleSaveTargets = async () => {
    if (editingTargets.length === 0) {
      alert('저장할 카테고리가 없습니다.');
      return;
    }
    
    // 대분류 합계 체크
    const majorTotal = editingTargets
      .filter(t => t.category_type === 'major')
      .reduce((sum, t) => sum + t.target_percentage, 0);
    
    if (Math.abs(majorTotal - 100) > 0.01) {
      if (!confirm(`대분류 비중 합계가 ${majorTotal}%입니다. (권장: 100%) 계속하시겠습니까?`)) {
        return;
      }
    }

    try {
      await updateTargets(editingTargets);
      alert('목표 비중이 저장되었습니다.');
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  const handleCalculate = () => {
    calculateRebalancing(additionalCash);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(value)) + '원';
  };

  const formatPercent = (value) => {
    return value.toFixed(1) + '%';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6 text-indigo-600" />
          자산 배분 비율 계산기
        </h1>
        <p className="text-gray-600 mt-1">목표 비중에 따른 리밸런싱 가이드를 제공합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 왼쪽: 목표 설정 폼 */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              목표 비중 설정
            </h2>
            
            <div className="space-y-4">
              {editingTargets.map((target, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200 relative group">
                  <button 
                    onClick={() => handleRemoveCategory(idx)}
                    className="absolute -right-2 -top-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                    title="삭제"
                  >
                    <ArrowRight className="w-3 h-3 rotate-45" />
                  </button>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    {target.category_name} 
                    <span className="ml-1 text-[10px] bg-gray-200 px-1 rounded">
                      {target.category_type === 'major' ? '대분류' : `중분류 (${target.parent_category})`}
                    </span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      value={target.target_percentage}
                      onChange={(e) => handleTargetChange(idx, e.target.value)}
                      className="w-full pl-3 pr-10 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                    <span className="absolute right-3 top-1.5 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddCategory('major')}
                  className="flex-1 text-xs bg-white border border-gray-300 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  + 대분류 추가
                </button>
                <button
                  onClick={() => handleAddCategory('sub')}
                  className="flex-1 text-xs bg-white border border-gray-300 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  + 중분류 추가
                </button>
              </div>

              <button
                onClick={handleSaveTargets}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:bg-gray-400 mt-2"
              >
                <Save className="w-4 h-4" />
                목표 비중 저장
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              추가 투자금 설정
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="number"
                  value={additionalCash}
                  onChange={(e) => setAdditionalCash(parseFloat(e.target.value) || 0)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="추가 투자금 입력"
                />
                <span className="absolute right-3 top-2 text-gray-400">원</span>
              </div>
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                <Calculator className="w-4 h-4" />
                리밸런싱 계산
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 결과 테이블 */}
        <div className="lg:col-span-2">
          {rebalancing ? (
            <div className="space-y-6">
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <p className="text-sm text-indigo-600 font-medium">현재 총 자산</p>
                  <p className="text-xl font-bold text-indigo-900">{formatCurrency(rebalancing.total_valuation)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <p className="text-sm text-green-600 font-medium">목표 총 자산</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(rebalancing.total_target)}</p>
                </div>
              </div>

              {/* 대분류 결과 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-800">대분류 리밸런싱</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                        <th className="px-6 py-3">카테고리</th>
                        <th className="px-6 py-3 text-right">현재 (비중)</th>
                        <th className="px-6 py-3 text-right">목표 (비중)</th>
                        <th className="px-6 py-3 text-right">차이 (매수/매도)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rebalancing.major_results.map((res, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors text-sm">
                          <td className="px-6 py-4 font-medium text-gray-900">{res.category}</td>
                          <td className="px-6 py-4 text-right">
                            {formatCurrency(res.current_amt)}
                            <span className="text-xs text-gray-400 ml-1">({formatPercent(res.current_ratio)})</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {formatCurrency(res.target_amt)}
                            <span className="text-xs text-gray-400 ml-1">({formatPercent(res.target_percentage)})</span>
                          </td>
                          <td className={`px-6 py-4 text-right font-semibold ${res.diff_amt >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {res.diff_amt > 0 ? '+' : ''}{formatCurrency(res.diff_amt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 중분류 결과 */}
              {rebalancing.sub_results.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-800">중분류 리밸런싱 (대분류 내 비중)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                          <th className="px-6 py-3">카테고리</th>
                          <th className="px-6 py-3 text-right">현재 (비중)</th>
                          <th className="px-6 py-3 text-right">목표 (비중)</th>
                          <th className="px-6 py-3 text-right">차이</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rebalancing.sub_results.map((res, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors text-sm">
                            <td className="px-6 py-4">
                              <span className="font-medium text-gray-900">{res.category}</span>
                              <span className="text-xs text-gray-400 block">{res.parent_category}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {formatCurrency(res.current_amt)}
                              <span className="text-xs text-gray-400 ml-1">({formatPercent(res.current_ratio)})</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {formatCurrency(res.target_amt)}
                              <span className="text-xs text-gray-400 ml-1">({formatPercent(res.target_percentage)})</span>
                            </td>
                            <td className={`px-6 py-4 text-right font-semibold ${res.diff_amt >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {res.diff_amt > 0 ? '+' : ''}{formatCurrency(res.diff_amt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl h-64 flex flex-col items-center justify-center text-gray-400">
              <Calculator className="w-12 h-12 mb-2 opacity-20" />
              <p>목표 비중을 설정하고 계산 버튼을 눌러주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RatioCalculatorPage;
