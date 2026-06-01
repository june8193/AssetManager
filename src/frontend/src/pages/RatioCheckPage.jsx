import React, { useState, useMemo, useEffect } from 'react';
import { useRatios } from '../hooks/useRatios';
import { useMasking } from '../contexts/MaskingContext';
import { PieChart as ReChartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, ChevronRight, ChevronDown, ChevronUp, Home, RotateCcw, AlertCircle, Loader2, Save, Calculator, DollarSign, Sparkles } from 'lucide-react';

// 대분류 기본 테마 색상 정의
const MAJOR_COLORS = {
  '주식': { main: '#6366f1', hover: '#4f46e5', light: '#818cf8', sub: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'] },
  '배당주': { main: '#ec4899', hover: '#db2777', light: '#f472b6', sub: ['#be185d', '#d946ef', '#f472b6', '#fbcfe8', '#fdf2f8'] },
  '현금': { main: '#14b8a6', hover: '#0d9488', light: '#2dd4bf', sub: ['#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4', '#ccfbf1'] },
  '채권': { main: '#f59e0b', hover: '#d97706', light: '#fbbf24', sub: ['#b45309', '#f59e0b', '#fbbf24', '#fde68a', '#fef3c7'] },
};

const DEFAULT_COLOR = { main: '#64748b', hover: '#475569', light: '#94a3b8', sub: ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'] };

/**
 * 실시간 리밸런싱 계산 로직
 */
export const calculateRealtimeRebalancing = (hierarchy, additionalCash) => {
  if (!hierarchy || hierarchy.length === 0) return [];

  const totalCurrentValue = hierarchy.reduce((sum, major) => sum + (major.current_value || 0), 0);
  const totalTargetValue = totalCurrentValue + additionalCash;

  return hierarchy.map(major => {
    const majorTargetAmt = totalTargetValue * ((major.target_percentage || 0) / 100);
    const majorDiffAmt = majorTargetAmt - (major.current_value || 0);

    return {
      ...major,
      target_amt: majorTargetAmt,
      diff_amt: majorDiffAmt,
      children: (major.children || []).map(sub => {
        const subTargetAmt = majorTargetAmt * ((sub.target_percentage || 0) / 100);
        const subDiffAmt = subTargetAmt - (sub.current_value || 0);

        return {
          ...sub,
          target_amt: subTargetAmt,
          diff_amt: subDiffAmt,
          children: (sub.children || []).map(stock => {
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
  });
};

/**
 * 파이차트의 각 조각 바깥으로 지시선과 텍스트 라벨을 그립니다.
 */
export const renderCustomizedLabel = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, outerRadius, fill, percent, name } = props;

  if (percent < 0.01) return null;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;

  const mx = cx + (outerRadius + 20) * cos;
  const my = cy + (outerRadius + 20) * sin;

  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;

  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} strokeWidth={1.5} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey - 4}
        textAnchor={textAnchor}
        fill="#334155"
        fontSize="10px"
        fontWeight="700"
      >
        {name}
      </text>

      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey + 8}
        textAnchor={textAnchor}
        fill="#64748b"
        fontSize="9px"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

const getMajorColor = (categoryName) => {
  return MAJOR_COLORS[categoryName] || DEFAULT_COLOR;
};

const getSubColor = (majorName, index) => {
  const theme = MAJOR_COLORS[majorName] || DEFAULT_COLOR;
  return theme.sub[index % theme.sub.length];
};

const RatioCheckPage = () => {
  const { hierarchy, loading, error, refreshHierarchy, updateTargets } = useRatios();
  const { isMasked, maskValue } = useMasking();

  // 탭 상태관리 ('list' or 'calc')
  const [activeTab, setActiveTab] = useState('list');
  const [additionalCash, setAdditionalCash] = useState(0);
  const [editingHierarchy, setEditingHierarchy] = useState([]);

  // 드릴다운 레벨 상태 관리
  const [level, setLevel] = useState('root');
  const [selectedMajorName, setSelectedMajorName] = useState(null);
  const [selectedSubName, setSelectedSubName] = useState(null);

  // 소분류(종목) 레벨에서 아코디언 형태로 펼쳐진 자산들의 상태 관리
  const [expandedAssets, setExpandedAssets] = useState({});

  // 초기 로드 및 hierarchy 변경 시 editingHierarchy 동기화
  useEffect(() => {
    if (hierarchy && hierarchy.length > 0) {
      setEditingHierarchy(hierarchy);
    }
  }, [hierarchy]);

  // 금액 포맷 유틸
  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('ko-KR').format(Math.round(value)) + '원';
    return maskValue(formatted);
  };

  // 비율 포맷 유틸
  const formatPercent = (value) => {
    return (value || 0).toFixed(1) + '%';
  };

  // 실시간 리밸런싱 연산
  const rebalancingResult = useMemo(() => {
    return calculateRealtimeRebalancing(editingHierarchy, additionalCash);
  }, [editingHierarchy, additionalCash]);

  // 현재 레벨에 따른 가공 데이터 산출 (리밸런싱 결과 적용)
  const { currentValuation, targetValuation, titleName, titleLabel, chartData, targetChartData, listData } = useMemo(() => {
    const defaultRes = {
      currentValuation: 0,
      targetValuation: 0,
      titleName: '전체 자산',
      titleLabel: '포트폴리오 루트',
      chartData: [],
      targetChartData: [],
      listData: []
    };

    if (!rebalancingResult || rebalancingResult.length === 0) return defaultRes;

    const totalCurrentVal = rebalancingResult.reduce((sum, item) => sum + (item.current_value || 0), 0);
    const totalTargetVal = totalCurrentVal + additionalCash;

    if (level === 'root') {
      const data = rebalancingResult.map((item) => {
        const theme = getMajorColor(item.category_name);
        return {
          name: item.category_name,
          value: item.current_value || 0,
          ratio: totalCurrentVal > 0 ? ((item.current_value || 0) / totalCurrentVal * 100) : 0,
          color: theme.main,
          hoverColor: theme.hover,
          currentVal: item.current_value || 0,
          targetVal: item.target_amt || 0,
          targetRatio: item.target_percentage || 0,
          diffAmt: item.diff_amt || 0,
          raw: item
        };
      });

      const targetData = data
        .filter(item => item.targetRatio > 0)
        .map(item => ({
          ...item,
          value: item.targetRatio
        }));

      return {
        currentValuation: totalCurrentVal,
        targetValuation: totalTargetVal,
        titleName: '전체 자산',
        titleLabel: '포트폴리오 루트',
        chartData: data,
        targetChartData: targetData,
        listData: [...data].sort((a, b) => b.value - a.value)
      };
    }

    if (level === 'major') {
      const majorNode = rebalancingResult.find(item => item.category_name === selectedMajorName);
      if (!majorNode) return defaultRes;

      const majorTotal = majorNode.current_value || 0;
      const majorTargetTotal = majorNode.target_amt || 0;

      const data = (majorNode.children || []).map((item, idx) => {
        const color = getSubColor(selectedMajorName, idx);
        return {
          name: item.category_name,
          value: item.current_value || 0,
          ratio: majorTotal > 0 ? ((item.current_value || 0) / majorTotal * 100) : 0,
          color: color,
          hoverColor: color,
          currentVal: item.current_value || 0,
          targetVal: item.target_amt || 0,
          targetRatio: item.target_percentage || 0,
          diffAmt: item.diff_amt || 0,
          raw: item
        };
      });

      const targetData = data
        .filter(item => item.targetRatio > 0)
        .map(item => ({
          ...item,
          value: item.targetRatio
        }));

      return {
        currentValuation: majorTotal,
        targetValuation: majorTargetTotal,
        titleName: majorNode.category_name,
        titleLabel: '선택된 대분류',
        chartData: data,
        targetChartData: targetData,
        listData: [...data].sort((a, b) => b.value - a.value)
      };
    }

    if (level === 'sub') {
      const majorNode = rebalancingResult.find(item => item.category_name === selectedMajorName);
      if (!majorNode) return defaultRes;

      const subNode = (majorNode.children || []).find(item => item.category_name === selectedSubName);
      if (!subNode) return defaultRes;

      const subTotal = subNode.current_value || 0;
      const subTargetTotal = subNode.target_amt || 0;

      const data = (subNode.children || []).map((item, idx) => {
        const color = getSubColor(selectedMajorName, idx + 2);
        return {
          name: item.name,
          ticker: item.ticker,
          value: item.valuation_krw || 0,
          ratio: subTotal > 0 ? ((item.valuation_krw || 0) / subTotal * 100) : 0,
          color: color,
          hoverColor: color,
          currentVal: item.valuation_krw || 0,
          targetVal: item.target_amt || 0,
          targetRatio: item.target_percentage || 0,
          diffAmt: item.diff_amt || 0,
          raw: item
        };
      });

      const targetData = data
        .filter(item => item.targetRatio > 0)
        .map(item => ({
          ...item,
          value: item.targetRatio
        }));

      return {
        currentValuation: subTotal,
        targetValuation: subTargetTotal,
        titleName: subNode.category_name,
        titleLabel: `대분류: ${majorNode.category_name}`,
        chartData: data,
        targetChartData: targetData,
        listData: [...data].sort((a, b) => b.value - a.value)
      };
    }

    return defaultRes;
  }, [rebalancingResult, level, selectedMajorName, selectedSubName, additionalCash]);

  // 네비게이션 줌 제어
  const zoomTo = (targetLevel, majorName = null, subName = null) => {
    setExpandedAssets({}); // 레벨 이동 시 아코디언 상태 초기화
    if (targetLevel === 'root') {
      setLevel('root');
      setSelectedMajorName(null);
      setSelectedSubName(null);
    } else if (targetLevel === 'major') {
      setLevel('major');
      setSelectedMajorName(majorName);
      setSelectedSubName(null);
    } else if (targetLevel === 'sub') {
      setLevel('sub');
      setSelectedMajorName(majorName);
      setSelectedSubName(subName);
    }
  };

  const handleReset = () => {
    zoomTo('root');
  };

  const handlePieClick = (dataEntry) => {
    if (level === 'root') {
      zoomTo('major', dataEntry.name);
    } else if (level === 'major') {
      zoomTo('sub', selectedMajorName, dataEntry.name);
    }
  };

  // 아이템 클릭 핸들러 (구성 리스트에서 사용)
  const handleItemClick = (item) => {
    if (level !== 'sub') {
      handlePieClick(item);
    } else {
      setExpandedAssets(prev => ({
        ...prev,
        [item.name]: !prev[item.name]
      }));
    }
  };

  // 실시간 목표 비중 변경 헨들러
  const handleTargetChange = (name, value) => {
    // 소수점 한자릿수까지만 입력 허용 (소수 둘째자리 이하 절사)
    let valStr = value.toString();
    const dotIdx = valStr.indexOf('.');
    if (dotIdx !== -1 && valStr.length - dotIdx - 1 > 1) {
      valStr = valStr.substring(0, dotIdx + 2);
    }
    const numValue = parseFloat(valStr) || 0;
    setEditingHierarchy(prev => prev.map(major => {
      if (level === 'root' && major.category_name === name) {
        return { ...major, target_percentage: numValue };
      }
      if (level === 'major' && major.category_name === selectedMajorName) {
        return {
          ...major,
          children: major.children.map(sub =>
            sub.category_name === name
              ? { ...sub, target_percentage: numValue }
              : sub
          )
        };
      }
      if (level === 'sub' && major.category_name === selectedMajorName) {
        return {
          ...major,
          children: major.children.map(sub => {
            if (sub.category_name === selectedSubName) {
              return {
                ...sub,
                children: sub.children.map(stock =>
                  stock.ticker === name || stock.name === name
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

  // 잔여 비중 자동 채우기
  const handleAutoFill = (name) => {
    let currentItems = [];
    if (level === 'root') {
      currentItems = editingHierarchy;
    } else if (level === 'major') {
      const majorNode = editingHierarchy.find(m => m.category_name === selectedMajorName);
      currentItems = majorNode ? majorNode.children : [];
    } else if (level === 'sub') {
      const majorNode = editingHierarchy.find(m => m.category_name === selectedMajorName);
      const subNode = majorNode ? majorNode.children.find(s => s.category_name === selectedSubName) : null;
      currentItems = subNode ? subNode.children : [];
    }

    const otherSum = currentItems.reduce((sum, item) => {
      const itemName = level === 'sub' ? (item.ticker || item.name) : item.category_name;
      if (itemName === name) return sum;
      return sum + (item.target_percentage || 0);
    }, 0);

    const fillValue = Math.round(Math.max(0, 100 - otherSum) * 10) / 10;
    handleTargetChange(name, fillValue);
  };

  // 현재 레벨의 편집 중인 목표 비중 합산 계산
  const currentTotalPercentage = useMemo(() => {
    let currentItems = [];
    if (level === 'root') {
      currentItems = editingHierarchy;
    } else if (level === 'major') {
      const majorNode = editingHierarchy.find(m => m.category_name === selectedMajorName);
      currentItems = majorNode ? majorNode.children : [];
    } else if (level === 'sub') {
      const majorNode = editingHierarchy.find(m => m.category_name === selectedMajorName);
      const subNode = majorNode ? majorNode.children.find(s => s.category_name === selectedSubName) : null;
      currentItems = subNode ? subNode.children : [];
    }
    return currentItems.reduce((sum, item) => sum + (item.target_percentage || 0), 0);
  }, [editingHierarchy, level, selectedMajorName, selectedSubName]);

  // 목표 비중 저장 핸들러
  const handleSaveTargets = async () => {
    if (Math.abs(currentTotalPercentage - 100) > 0.001) {
      alert('비중 합계가 100%여야 저장이 가능합니다.');
      return;
    }

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

    try {
      await updateTargets(flatTargets);
      alert('목표 비중이 성공적으로 저장되었습니다.');
      refreshHierarchy();
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  if (loading && editingHierarchy.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="font-medium">자산 비중 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error && editingHierarchy.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-red-500 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold mb-2">데이터 로드 실패</h2>
        <p className="text-sm text-slate-500 mb-6 text-center">{error}</p>
        <button
          onClick={refreshHierarchy}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800 font-headline">
            <PieChart className="w-6 h-6 text-indigo-600" />
            자산 비중 점검
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            포트폴리오의 비중을 대분류, 중분류, 종목 계층별로 입체적으로 분석하고, 추가 투자 계산을 바로 수행합니다.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="self-start sm:self-center px-4 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl border border-indigo-100 transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          전체 보기 (초기화)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 왼쪽: 차트 패널 */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            {/* Breadcrumb 내비게이션 */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 overflow-x-auto py-1">
              <button
                onClick={() => zoomTo('root')}
                className="hover:text-indigo-600 transition-colors flex items-center gap-1 text-slate-400"
              >
                <Home className="w-3.5 h-3.5" />
                포트폴리오
              </button>

              {selectedMajorName && (
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <button
                    data-testid="breadcrumb-major"
                    onClick={() => zoomTo('major', selectedMajorName)}
                    className={`hover:text-indigo-600 transition-colors font-semibold ${
                      level === 'major' ? 'text-slate-700 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {selectedMajorName}
                  </button>
                </div>
              )}

              {selectedSubName && (
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <span className="font-semibold text-slate-700 font-bold">
                    {selectedSubName}
                  </span>
                </div>
              )}
            </div>

            {/* 탭 상태 뱃지 표시 */}
            {activeTab === 'calc' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                리밸런싱 시뮬레이션 활성화
              </span>
            )}
          </div>

          {/* Recharts 파이차트 영역 */}
          <div className="relative flex-1 flex items-center justify-center min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <ReChartsPieChart>
                  {/* 안쪽 도넛: 현재 비중 */}
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={activeTab === 'calc' ? 65 : 90}
                    outerRadius={activeTab === 'calc' ? 90 : 120}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={handlePieClick}
                    cursor="pointer"
                    animationDuration={600}
                    label={activeTab === 'calc' ? null : renderCustomizedLabel}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        style={{ outline: 'none' }}
                      />
                    ))}
                  </Pie>

                  {/* 바깥쪽 도넛: 목표 비중 */}
                  {activeTab === 'calc' && targetChartData.length > 0 && (
                    <Pie
                      data={targetChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={100}
                      outerRadius={125}
                      paddingAngle={3}
                      dataKey="value"
                      cursor="pointer"
                      animationDuration={600}
                      label={renderCustomizedLabel}
                    >
                      {targetChartData.map((entry, index) => (
                        <Cell
                          key={`target-cell-${index}`}
                          fill={entry.color}
                          opacity={0.65}
                          style={{ outline: 'none' }}
                        />
                      ))}
                    </Pie>
                  )}
                  
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs flex flex-col gap-1">
                            <div className="font-bold flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }}></span>
                              {data.name} {data.ticker ? `(${data.ticker})` : ''}
                            </div>
                            <div>현재 비중: {formatPercent(data.ratio)} ({formatCurrency(data.currentVal || data.value)})</div>
                            {activeTab === 'calc' && (
                              <>
                                <div>목표 비중: {formatPercent(data.targetRatio)} ({formatCurrency(data.targetVal || 0)})</div>
                                <div className={`font-bold ${data.diffAmt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  조정 금액: {data.diffAmt > 0 ? '+' : ''}{formatCurrency(data.diffAmt)}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </ReChartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <PieChart className="w-12 h-12 mb-3 opacity-10 text-slate-400" />
                <p className="text-sm">자산 데이터가 존재하지 않습니다.</p>
              </div>
            )}

            {/* 도넛 차트 내부 텍스트 뱃지 */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {activeTab === 'calc' ? '목표 총 자산' : '현재 총 자산'}
              </span>
              <span className="text-lg md:text-xl font-black text-slate-800 font-headline mt-1">
                {formatCurrency(activeTab === 'calc' ? targetValuation : currentValuation)}
              </span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 bg-slate-50/50 py-2.5 rounded-xl border border-slate-100">
            {activeTab === 'calc' 
              ? '💡 바깥쪽 반투명 도넛은 설정하신 목표 비중을 실시간으로 반영합니다.'
              : '💡 차트 조각을 클릭하면 하위 카테고리 비중으로 깊게 탐색할 수 있습니다.'}
          </div>
        </div>

        {/* 오른쪽 패널 (탭 지원) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 요약 메인 카드 */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl text-white p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -right-16 -bottom-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl"></div>
            <div className="relative z-10 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                {titleLabel}
              </span>
              <h2 className="text-xl font-extrabold font-headline">{titleName}</h2>
              
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">현재 평가 금액</span>
                  <span className="text-lg font-black font-headline text-slate-100">
                    {formatCurrency(currentValuation)}
                  </span>
                </div>
                {activeTab === 'calc' && (
                  <>
                    <div className="flex items-baseline justify-between border-t border-white/5 pt-2">
                      <span className="text-xs text-slate-400">추가 투자금</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        +{formatCurrency(additionalCash)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-white/5 pt-2">
                      <span className="text-xs text-indigo-200 font-bold">목표 평가 금액</span>
                      <span className="text-xl font-black font-headline text-indigo-300">
                        {formatCurrency(targetValuation)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 구성 비중 / 투자 계산기 탭 헤더 */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'list' 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              구성 비중
            </button>
            <button
              onClick={() => setActiveTab('calc')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'calc' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-indigo-600'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              투자 계산기
            </button>
          </div>

          {/* 탭 내용 분기 */}
          {activeTab === 'list' ? (
            /* 기존 구성 리스트 카드 */
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">{titleName} 구성 비중</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {listData.length}개 항목
                </span>
              </div>

              <div className="divide-y divide-slate-50">
                {listData.map((item, idx) => (
                  <div
                    key={idx}
                    data-testid="ratio-row"
                    role={level !== 'sub' ? 'button' : undefined}
                    onClick={() => handleItemClick(item)}
                    className="flex flex-col py-3 group hover:bg-slate-50/50 transition-colors px-2 rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        ></span>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                            {item.name} {item.ticker ? `(${item.ticker})` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {formatCurrency(item.value)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-headline text-slate-800">
                          {formatPercent(item.ratio)}
                        </span>
                        {level !== 'sub' ? (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                        ) : (
                          item.raw?.accounts?.length > 0 && (
                            expandedAssets[item.name] ? (
                              <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
                            )
                          )
                        )}
                      </div>
                    </div>

                    {/* 아코디언 상세 계좌 정보 카드 */}
                    {level === 'sub' && expandedAssets[item.name] && item.raw && item.raw.accounts && item.raw.accounts.length > 0 && (
                      <div className="mt-2.5 pl-2 flex flex-col gap-2 w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                        {[...item.raw.accounts].sort((a, b) => (b.valuation_krw || 0) - (a.valuation_krw || 0)).map((acc, accIdx) => {
                          const accountLabel = acc.alias ? `${acc.account_name}(${acc.alias})` : acc.account_name;
                          return (
                            <div key={accIdx} className="flex items-center justify-between bg-slate-50/70 border border-slate-100 rounded-xl p-2.5 shadow-sm hover:bg-white transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                  {acc.provider}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600">
                                  {accountLabel}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-slate-800 font-headline">
                                {formatCurrency(acc.valuation_krw)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {listData.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    항목이 존재하지 않습니다.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 투자 계산기 카드 */
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col gap-5">
              {/* 추가 투자금 입력창 */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-2 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                  포트폴리오 추가 투자금 입력
                </label>
                <div className="relative">
                  <input
                    type="number"
                    data-testid="additional-cash-input"
                    value={additionalCash}
                    onChange={(e) => setAdditionalCash(parseFloat(e.target.value) || 0)}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm bg-slate-50/50"
                    placeholder="0"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">원</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-xs font-bold text-slate-700">{titleName} 목표 비중 설정</h4>
                  <span className="text-[10px] text-slate-400 font-medium">단위: %</span>
                </div>

                <div className="divide-y divide-slate-50 flex flex-col gap-2">
                  {listData.map((item, idx) => {
                    const itemName = level === 'sub' ? (item.ticker || item.name) : item.name;
                    return (
                      <div key={idx} className="flex flex-col gap-2 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">현재 {formatPercent(item.ratio)}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="0.1"
                              value={item.targetRatio}
                              onChange={(e) => handleTargetChange(itemName, e.target.value)}
                              className="w-full pl-2 pr-6 py-1.5 border border-slate-200 rounded-lg text-right text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                              placeholder="0"
                            />
                            <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400">%</span>
                          </div>
                          
                          <button
                            onClick={() => handleAutoFill(itemName)}
                            className="px-2 py-1.5 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-bold transition-all whitespace-nowrap"
                            title="남은 비중 자동 채우기"
                          >
                            자동채우기
                          </button>
                        </div>

                        {/* 리밸런싱 가이드 텍스트 */}
                        <div className="flex items-center justify-between text-[10px] font-medium bg-slate-50 px-2.5 py-1 rounded">
                          <span className="text-slate-400">목표액: {formatCurrency(item.targetVal)}</span>
                          <span className={`font-bold ${item.diffAmt >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {item.diffAmt > 0 ? '추가 매수: +' : item.diffAmt < 0 ? '매도: ' : ''}
                            {formatCurrency(item.diffAmt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 저장 및 유효성 검사 패널 */}
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">목표 비중 합계</span>
                  <span className={Math.abs(currentTotalPercentage - 100) < 0.001 ? "text-emerald-600" : "text-rose-500"}>
                    {currentTotalPercentage.toFixed(1)}% / 100%
                  </span>
                </div>

                {Math.abs(currentTotalPercentage - 100) > 0.001 && (
                  <p className="text-[10px] text-rose-500 leading-normal">
                    ⚠️ 비중 합계가 정확히 100%여야 저장이 활성화됩니다. '자동채우기'를 이용해보세요.
                  </p>
                )}

                <button
                  onClick={handleSaveTargets}
                  disabled={Math.abs(currentTotalPercentage - 100) > 0.001 || loading}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  <Save className="w-3.5 h-3.5" />
                  목표 비중 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RatioCheckPage;
