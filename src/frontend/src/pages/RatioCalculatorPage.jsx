import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRatios } from '../hooks/useRatios';
import { Save, Calculator, ArrowRight, TrendingUp, DollarSign, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';

/**
 * 실시간 리밸런싱 계산 로직
 * @param {Array} hierarchy 계층형 데이터
 * @param {number} additionalCash 추가 투자금
 * @returns {Array} 계산 결과가 포함된 계층형 데이터
 */
export const calculateRealtimeRebalancing = (hierarchy, additionalCash) => {
  if (!hierarchy || hierarchy.length === 0) return [];

  // 1. 현재 총 자산 계산
  const totalCurrentValue = hierarchy.reduce((sum, major) => sum + (major.current_value || 0), 0);
  const totalTargetValue = totalCurrentValue + additionalCash;

  return hierarchy.map(major => {
    // 2. 대분류 목표 금액 및 차액 계산
    const majorTargetAmt = totalTargetValue * (major.target_percentage / 100);
    const majorDiffAmt = majorTargetAmt - (major.current_value || 0);

    const updatedMajor = {
      ...major,
      target_amt: majorTargetAmt,
      diff_amt: majorDiffAmt,
      children: (major.children || []).map(sub => {
        // 3. 중분류 목표 금액 및 차액 계산
        const subTargetAmt = majorTargetAmt * (sub.target_percentage / 100);
        const subDiffAmt = subTargetAmt - (sub.current_value || 0);

        return {
          ...sub,
          target_amt: subTargetAmt,
          diff_amt: subDiffAmt,
          children: (sub.children || []).map(stock => {
            // 4. 종목 목표 금액 및 차액 계산 (중분류 목표 금액 * 중분류 내 목표 비중)
            const stockTargetAmt = subTargetAmt * ((stock.target_percentage || 0) / 100);
            const stockDiffAmt = stockTargetAmt - (stock.valuation_krw || 0);

            return {
              ...stock,
              target_amt: stockTargetAmt,
              diff_amt: stockDiffAmt
            };
          })
        };
      })
    };
    return updatedMajor;
  });
};

const RatioCalculatorPage = () => {
  const { targets, hierarchy, loading, updateTargets } = useRatios();
  const [additionalCash, setAdditionalCash] = useState(0);
  const [editingHierarchy, setEditingHierarchy] = useState([]);
  const [expandedMajors, setExpandedMajors] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});
  
  // 사이드바 폭 조절 상태
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const isResizing = useRef(false);

  // 초기 로드 및 hierarchy 변경 시 editingHierarchy 초기화
  useEffect(() => {
    if (hierarchy && hierarchy.length > 0) {
      setEditingHierarchy(hierarchy);
      // 기본적으로 모두 접힌 상태로 시작 (빈 객체)
      setExpandedMajors({});
      setExpandedSubs({});
    }
  }, [hierarchy]);

  // 사이드바 리사이징 로직
  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current) return;
    
    // 최소 300px, 최대 800px 제한
    // 256은 좌측 메인 사이드바 폭 (w-64)
    const newWidth = Math.min(Math.max(300, e.clientX - 256 - 24), 800); 
    setSidebarWidth(newWidth);
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, [handleMouseMove]);

  const startResizing = useCallback((e) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleMouseMove, stopResizing]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [handleMouseMove, stopResizing]);

  // 모든 항목 접기/펼치기
  const toggleAll = (expand) => {
    if (expand) {
      const allMajors = {};
      const allSubs = {};
      editingHierarchy.forEach(m => {
        allMajors[m.category_name] = true;
        m.children.forEach(s => {
          allSubs[`${m.category_name}-${s.category_name}`] = true;
        });
      });
      setExpandedMajors(allMajors);
      setExpandedSubs(allSubs);
    } else {
      setExpandedMajors({});
      setExpandedSubs({});
    }
  };

  // 실시간 계산 결과 (useMemo 활용)
  const rebalancingResult = useMemo(() => {
    return calculateRealtimeRebalancing(editingHierarchy, additionalCash);
  }, [editingHierarchy, additionalCash]);

  const totalCurrentValue = useMemo(() => {
    return editingHierarchy.reduce((sum, major) => sum + (major.current_value || 0), 0);
  }, [editingHierarchy]);

  const totalTargetValue = totalCurrentValue + additionalCash;

  const toggleMajor = (name) => {
    setExpandedMajors(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const toggleSub = (majorName, subName) => {
    const key = `${majorName}-${subName}`;
    setExpandedSubs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleTargetChange = (categoryName, type, value, parentName = null, grandParentName = null) => {
    const numValue = parseFloat(value) || 0;
    
    setEditingHierarchy(prev => prev.map(major => {
      if (type === 'major' && major.category_name === categoryName) {
        return { ...major, target_percentage: numValue };
      }
      
      if (type === 'sub' && major.category_name === parentName) {
        return {
          ...major,
          children: major.children.map(sub => 
            sub.category_name === categoryName 
              ? { ...sub, target_percentage: numValue }
              : sub
          )
        };
      }

      if (type === 'stock' && major.category_name === grandParentName) {
        return {
          ...major,
          children: major.children.map(sub => {
            if (sub.category_name === parentName) {
              return {
                ...sub,
                children: sub.children.map(stock => 
                  stock.ticker === categoryName 
                    ? { ...stock, target_percentage: numValue }
                    : stock
                )
              };
            }
            return sub;
          })
        };
      }
      
      return major;
    }));
  };

  const handleSaveTargets = async () => {
    const flatTargets = [];
    editingHierarchy.forEach(major => {
      flatTargets.push({
        category_name: major.category_name,
        category_type: 'major',
        target_percentage: major.target_percentage,
        parent_category: null
      });
      
      major.children.forEach(sub => {
        flatTargets.push({
          category_name: sub.category_name,
          category_type: 'sub',
          target_percentage: sub.target_percentage,
          parent_category: major.category_name
        });

        sub.children.forEach(stock => {
          flatTargets.push({
            category_name: stock.ticker,
            category_type: 'stock',
            target_percentage: stock.target_percentage,
            parent_category: sub.category_name
          });
        });
      });
    });

    // 대분류 합계 체크
    const majorTotal = editingHierarchy.reduce((sum, m) => sum + m.target_percentage, 0);
    if (Math.abs(majorTotal - 100) > 0.01) {
      if (!confirm(`대분류 비중 합계가 ${majorTotal}%입니다. (권장: 100%) 계속하시겠습니까?`)) {
        return;
      }
    }

    try {
      await updateTargets(flatTargets);
      alert('목표 비중이 저장되었습니다.');
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(value)) + '원';
  };

  const formatPercent = (value) => {
    return (value || 0).toFixed(1) + '%';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <Calculator className="w-6 h-6 text-indigo-600" />
          자산 배분 비율 계산기
        </h1>
        <p className="text-gray-600 mt-1">목표 비중과 추가 투자금을 입력하면 실시간으로 리밸런싱 가이드를 계산합니다.</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-0 items-start">
        {/* 왼쪽: 설정 (가변 폭) */}
        <div 
          className="w-full xl:flex-shrink-0 space-y-6"
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1280 ? `${sidebarWidth}px` : '100%' }}
        >
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-800">
              <TrendingUp className="w-5 h-5 text-green-600" />
              목표 비중 및 자산 구조
            </h2>
            
            <div className="space-y-4">
              {editingHierarchy.map((major, mIdx) => (
                <div key={mIdx} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  {/* 대분류 (Major) */}
                  <div className="bg-blue-50/50 p-4 border-b border-blue-100/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-blue-900">
                        <button 
                          onClick={() => toggleMajor(major.category_name)} 
                          className="text-blue-400 hover:text-blue-600 transition-colors"
                        >
                          {expandedMajors[major.category_name] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        {major.category_name}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-blue-400 font-medium">현재 {formatPercent(major.current_ratio)}</span>
                        <div className="relative w-20">
                          <input
                            type="number"
                            value={major.target_percentage}
                            onChange={(e) => handleTargetChange(major.category_name, 'major', e.target.value)}
                            className="w-full pl-2 pr-6 py-1 border border-blue-200 rounded text-right text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                          />
                          <span className="absolute right-1.5 top-1 text-blue-300 text-xs font-bold">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 중분류 (Sub) 목록 */}
                  {expandedMajors[major.category_name] && (
                    <div className="bg-white">
                      {major.children.map((sub, sIdx) => (
                          <div className="flex flex-col border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between p-3 pl-6 bg-gray-50/30">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => toggleSub(major.category_name, sub.category_name)} 
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {expandedSubs[`${major.category_name}-${sub.category_name}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <span className="text-sm font-semibold text-gray-700">{sub.category_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">현재 {formatPercent(sub.current_ratio)}</span>
                                <div className="relative w-16">
                                  <input
                                    type="number"
                                    value={sub.target_percentage}
                                    onChange={(e) => handleTargetChange(sub.category_name, 'sub', e.target.value, major.category_name)}
                                    className="w-full pl-2 pr-5 py-0.5 border border-gray-200 rounded text-right text-xs font-medium text-gray-700 focus:ring-1 focus:ring-indigo-400 outline-none"
                                  />
                                  <span className="absolute right-1 top-0.5 text-gray-300 text-[10px] font-bold">%</span>
                                </div>
                              </div>
                            </div>

                            {/* 종목 (Stock) 목록 (Sidebar) */}
                            {expandedSubs[`${major.category_name}-${sub.category_name}`] && (
                              <div className="bg-white pb-2">
                                {sub.children.map((stock, stIdx) => (
                                  <div key={stIdx} className="flex items-center justify-between py-1.5 pl-12 pr-3 hover:bg-gray-50/50">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-medium text-gray-500 leading-tight">{stock.name}</span>
                                      <span className="text-[9px] text-gray-400 font-mono uppercase">{stock.ticker}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-300">현재 {formatPercent(stock.current_ratio)}</span>
                                      <div className="relative w-14">
                                        <input
                                          type="number"
                                          value={stock.target_percentage}
                                          onChange={(e) => handleTargetChange(stock.ticker, 'stock', e.target.value, sub.category_name, major.category_name)}
                                          className="w-full pl-1.5 pr-4 py-0 border border-gray-100 rounded text-right text-[10px] font-medium text-gray-500 focus:ring-1 focus:ring-indigo-300 outline-none"
                                        />
                                        <span className="absolute right-1 top-0 text-gray-300 text-[9px] font-bold">%</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              <button
                onClick={handleSaveTargets}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:bg-gray-400 mt-4"
              >
                <Save className="w-4 h-4" />
                목표 비중 저장
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <DollarSign className="w-5 h-5 text-amber-600" />
              추가 투자금
            </h2>
            <div className="relative">
              <input
                type="number"
                value={additionalCash}
                onChange={(e) => setAdditionalCash(parseFloat(e.target.value) || 0)}
                className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
                placeholder="0"
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-medium">원</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">입력 즉시 리밸런싱 결과에 반영됩니다.</p>
          </div>
        </div>

        {/* 리사이저 핸들 (데스크탑 전용) */}
        <div 
          onMouseDown={startResizing}
          className="hidden xl:flex w-6 group cursor-col-resize items-center justify-center self-stretch hover:bg-indigo-50 transition-colors"
        >
          <div className="w-1 h-12 bg-gray-200 rounded-full group-hover:bg-indigo-300 transition-colors flex items-center justify-center">
            <GripVertical className="w-3 h-3 text-gray-400 group-hover:text-indigo-500" />
          </div>
        </div>

        {/* 오른쪽: 결과 테이블 (나머지 공간) */}
        <div className="w-full xl:flex-1 min-w-0 space-y-6 xl:pl-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">현재 총 자산</p>
              <p className="text-2xl font-black text-gray-900">{formatCurrency(totalCurrentValue)}</p>
            </div>
            <div className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-100">
              <p className="text-sm text-indigo-100 mb-1">목표 총 자산 (현재 + 추가)</p>
              <p className="text-2xl font-black text-white">{formatCurrency(totalTargetValue)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 bg-white flex items-center justify-between">
              <h3 className="font-bold text-gray-800">계층별 리밸런싱 가이드</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => toggleAll(true)}
                  className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-bold transition-colors"
                >
                  모두 펼치기
                </button>
                <button 
                  onClick={() => toggleAll(false)}
                  className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-bold transition-colors"
                >
                  모두 접기
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                    <th className="px-6 py-4">항목</th>
                    <th className="px-6 py-4 text-right">현재</th>
                    <th className="px-6 py-4 text-right">목표 (비중)</th>
                    <th className="px-6 py-4 text-right">조정 금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rebalancingResult.map((major, mIdx) => (
                    <React.Fragment key={`m-${mIdx}`}>
                      {/* 대분류 (Major) 행 */}
                      <tr className="bg-blue-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleMajor(major.category_name)} 
                              className="text-blue-400 hover:text-blue-600 transition-colors"
                            >
                              {expandedMajors[major.category_name] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                            <span className="font-bold text-blue-900">{major.category_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-blue-800/70 font-medium">
                          {formatCurrency(major.current_value)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          <span className="font-bold text-blue-900">{formatCurrency(major.target_amt)}</span>
                          <span className="text-xs text-blue-400 block font-semibold">{formatPercent(major.target_percentage)}</span>
                        </td>
                        <td className={`px-6 py-4 text-right font-black ${major.diff_amt >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {major.diff_amt > 0 ? '+' : ''}{formatCurrency(major.diff_amt)}
                        </td>
                      </tr>

                      {expandedMajors[major.category_name] && major.children.map((sub, sIdx) => (
                        <React.Fragment key={`s-${mIdx}-${sIdx}`}>
                          {/* 중분류 (Sub) 행 */}
                          <tr className="bg-gray-50/80">
                            <td className="px-6 py-3 pl-12 border-l-4 border-blue-200/50">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => toggleSub(major.category_name, sub.category_name)} 
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {expandedSubs[`${major.category_name}-${sub.category_name}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <span className="text-sm font-bold text-gray-700">{sub.category_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 text-right text-xs text-gray-500 font-medium">
                              {formatCurrency(sub.current_value)}
                            </td>
                            <td className="px-6 py-3 text-right text-xs">
                              <span className="font-bold text-gray-800">{formatCurrency(sub.target_amt)}</span>
                              <span className="text-xs text-gray-400 block font-semibold">{formatPercent(sub.target_percentage)}</span>
                            </td>
                            <td className={`px-6 py-3 text-right text-sm font-black ${sub.diff_amt >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                              {sub.diff_amt > 0 ? '+' : ''}{formatCurrency(sub.diff_amt)}
                            </td>
                          </tr>

                          {/* 종목 (Stock) 목록 */}
                          {expandedSubs[`${major.category_name}-${sub.category_name}`] && sub.children.map((stock, stIdx) => (
                            <tr key={`st-${mIdx}-${sIdx}-${stIdx}`} className="bg-white hover:bg-gray-50/30 transition-colors">
                              <td className="px-6 py-2 pl-24 text-gray-400">
                                <div className="flex items-start gap-1">
                                  <span className="text-xs opacity-50 font-mono">ㄴ</span>
                                  <div className="flex flex-col">
                                    <span className="text-[13px] font-medium text-gray-600 leading-tight">{stock.name}</span>
                                    <span className="text-[10px] text-gray-400 font-mono uppercase tracking-tight">{stock.ticker}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-2 text-right text-[11px] text-gray-400 font-medium">
                                {formatCurrency(stock.valuation_krw)}
                              </td>
                              <td className="px-6 py-2 text-right text-[11px] text-gray-500">
                                {formatCurrency(stock.target_amt)}
                              </td>
                              <td className={`px-6 py-2 text-right text-xs font-bold ${stock.diff_amt >= 0 ? 'text-blue-500/70' : 'text-red-500/70'}`}>
                                {stock.diff_amt > 0 ? '+' : ''}{formatCurrency(stock.diff_amt)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {rebalancingResult.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                  <Calculator className="w-12 h-12 mb-3 opacity-10" />
                  <p>자산 데이터를 불러오는 중이거나 데이터가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatioCalculatorPage;
