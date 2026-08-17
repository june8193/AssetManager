import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  TrendingUp, Calculator, HelpCircle, Calendar, Plus, Trash2, 
  RefreshCw, AlertCircle, ArrowUpRight, TrendingDown, Info, Trash 
} from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';
import { formatWithCommas } from '../utils/formatters';
import { API_BASE_URL } from '../config';

// 차트 렌더링에 사용될 고유 테마 색상들
const COLORS = [
  '#3b82f6', // Blue (주식 100%)
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

// 초기 기본 제공 조합 목록
const INITIAL_ALLOCATIONS = [
  { name: '주식 100%', stock_ratio: 100.0, isVisible: true, isDefault: true },
  { name: '주식 90% / 현금 10%', stock_ratio: 90.0, isVisible: true, isDefault: true },
  { name: '주식 80% / 현금 20%', stock_ratio: 80.0, isVisible: true, isDefault: true },
  { name: '주식 70% / 현금 30%', stock_ratio: 70.0, isVisible: true, isDefault: true },
  { name: '주식 60% / 현금 40%', stock_ratio: 60.0, isVisible: true, isDefault: true },
  { name: '주식 50% / 현금 50%', stock_ratio: 50.0, isVisible: true, isDefault: true },
];

const AssetAllocationSimulationPage = () => {
  const { maskValue, isMasked } = useMasking();

  // 상태 관리 정의
  const [activeTab, setActiveTab] = useState('recurring'); // 기본값: 적립식 시뮬레이션
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [period, setPeriod] = useState('5Y'); // 기본값: 최근 5년
  const [rebalancing, setRebalancing] = useState('monthly'); // 기본값: 매월 리밸런싱
  const [annualDeposit, setAnnualDeposit] = useState(20000000); // 기본값: 매년 2,000만 원 추가금
  
  // 커스텀 조합 입력 상태
  const [customName, setCustomName] = useState('');
  const [customStockRatio, setCustomStockRatio] = useState('');
  
  // API 데이터 상태
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI 인터랙션 상태
  const [selectedAllocForTable, setSelectedAllocForTable] = useState('주식 100%');
  const [activeTableTab, setActiveTableTab] = useState('yearly'); // 'yearly' | 'monthly'
  const [showCagrTooltip, setShowCagrTooltip] = useState(false);

  // 금액 포맷터 (3자리 쉼표 및 마스킹 처리)
  const formatKRW = (value) => {
    if (isMasked) {
      return maskValue(value) + ' 원';
    }
    return formatWithCommas(Math.round(value)) + ' 원';
  };

  // 1. 시뮬레이션 계산 API 요청
  const runSimulation = async () => {
    // 최소 하나 이상의 보이는 조합이 있는지 확인
    const activeAllocations = allocations.filter(a => a.isVisible);
    if (activeAllocations.length === 0) {
      setApiData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = activeTab === 'recurring' ? 'run-recurring' : 'run';
      const bodyPayload = {
        allocations: activeAllocations.map(a => ({ name: a.name, stock_ratio: a.stock_ratio })),
        period,
        rebalancing
      };
      
      if (activeTab === 'recurring') {
        bodyPayload.annual_deposit = annualDeposit;
      }

      const response = await fetch(`${API_BASE_URL}/simulation/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (상태코드: ${response.status})`);
      }

      const data = await response.json();
      setApiData(data);

      // 현재 선택된 상세 테이블용 조합이 활성 상태가 아니면 첫 번째 활성 조합으로 자동 선택 변경
      const activeNames = activeAllocations.map(a => a.name);
      if (!activeNames.includes(selectedAllocForTable) && activeNames.length > 0) {
        setSelectedAllocForTable(activeNames[0]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || '시뮬레이션 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 설정값 변경 시 자동으로 백테스트 실행
  useEffect(() => {
    runSimulation();
  }, [allocations, period, rebalancing, activeTab, annualDeposit]);

  // 2. Recharts 데이터 가공
  const chartData = useMemo(() => {
    if (!apiData?.chart?.labels) return [];
    const { labels, datasets } = apiData.chart;
    return labels.map((label, idx) => {
      const row = { date: label };
      datasets.forEach(ds => {
        row[ds.label] = ds.data[idx];
      });
      return row;
    });
  }, [apiData]);

  // 차트에 표시할 활성 선들 (체크박스로 숨겨지지 않은 조합들)
  const activeLines = useMemo(() => {
    if (!apiData?.chart?.datasets) return [];
    return apiData.chart.datasets.map((ds, idx) => ({
      label: ds.label,
      color: COLORS[idx % COLORS.length]
    }));
  }, [apiData]);

  // 3. 커스텀 조합 추가 및 삭제 핸들러
  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customName.trim()) {
      alert('조합 이름을 입력해 주세요.');
      return;
    }
    const ratioNum = parseFloat(customStockRatio);
    if (isNaN(ratioNum) || ratioNum < 0 || ratioNum > 100) {
      alert('주식 비중은 0%에서 100% 사이의 숫자여야 합니다.');
      return;
    }

    // 이름 중복 검사
    if (allocations.some(a => a.name === customName.trim())) {
      alert('이미 동일한 이름의 조합이 존재합니다.');
      return;
    }

    const newAlloc = {
      name: customName.trim(),
      stock_ratio: ratioNum,
      isVisible: true,
      isDefault: false
    };

    setAllocations([...allocations, newAlloc]);
    setSelectedAllocForTable(newAlloc.name);
    setCustomName('');
    setCustomStockRatio('');
  };

  const handleRemoveCustom = (nameToRemove) => {
    setAllocations(allocations.filter(a => a.name !== nameToRemove));
  };

  const handleToggleVisibility = (name) => {
    setAllocations(allocations.map(a => 
      a.name === name ? { ...a, isVisible: !a.isVisible } : a
    ));
  };

  // 테이블 표시용 데이터 바인딩
  const currentTableData = useMemo(() => {
    if (!apiData) return [];
    if (activeTableTab === 'yearly') {
      return apiData.yearly_stats[selectedAllocForTable] || [];
    } else {
      return apiData.monthly_stats[selectedAllocForTable] || [];
    }
  }, [apiData, selectedAllocForTable, activeTableTab]);

  // S&P 500 (주식 100%) 데이터 추출
  const benchmarkTableData = useMemo(() => {
    if (!apiData) return [];
    if (activeTableTab === 'yearly') {
      return apiData.yearly_stats['주식 100%'] || [];
    } else {
      return apiData.monthly_stats['주식 100%'] || [];
    }
  }, [apiData, activeTableTab]);

  // 선택한 조합과 S&P 500 데이터를 결합
  const combinedTableData = useMemo(() => {
    return currentTableData.map(pItem => {
      const bItem = benchmarkTableData.find(b => 
        activeTableTab === 'yearly'
          ? b.year === pItem.year
          : (b.year === pItem.year && b.month === pItem.month)
      );
      
      return {
        year: pItem.year,
        month: pItem.month,
        portfolio_return: activeTableTab === 'yearly' ? pItem.year_return : pItem.month_return,
        portfolio_cumulative: pItem.cumulative_return,
        portfolio_mdd: pItem.mdd,
        portfolio_valuation: pItem.valuation,
        portfolio_invested: pItem.invested,
        portfolio_interest: pItem.interest,
        portfolio_annual_interest: pItem.annual_interest,
        benchmark_return: bItem
          ? (activeTableTab === 'yearly' ? bItem.year_return : bItem.month_return)
          : 0.0,
        benchmark_cumulative: bItem ? bItem.cumulative_return : 0.0,
        benchmark_mdd: bItem ? bItem.mdd : 0.0
      };
    });
  }, [currentTableData, benchmarkTableData, activeTableTab]);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md">
            <Calculator size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">자산배분 시뮬레이션</h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
              <Info size={12} className="text-blue-500" />
              S&P500 지수와 현금을 활용한 과거 성과 백테스트 및 비교 대시보드
            </p>
          </div>
        </div>

        {/* 탭 네비게이션 스위치 */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40">
          <button
            onClick={() => setActiveTab('recurring')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'recurring'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            적립식 시뮬레이션
          </button>
          <button
            onClick={() => setActiveTab('lump')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'lump'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            거치식 백테스트
          </button>
        </div>

        {/* 기간 설정 버튼 프리셋 */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50">
          {[
            { key: '5Y', label: '최근 5년' },
            { key: '10Y', label: '최근 10년' },
            { key: '20Y', label: '최근 20년' },
            { key: '30Y', label: '최근 30년' },
            { key: 'ALL', label: '전체 기간' }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                period === opt.key 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 주 제어 및 시뮬레이션 설정 영역 (2컬럼 레이아웃) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 좌측 패널: 비중 조합 리스트 & 설정 (Lg 4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* 리밸런싱 설정 카드 */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              리밸런싱 주기 설정
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'monthly', label: '매월' },
                { key: 'yearly', label: '매년' },
                { key: 'none', label: '안함' }
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    rebalancing === opt.key
                      ? 'border-blue-500 bg-blue-50/40 text-blue-700 font-bold shadow-sm'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="rebalancing"
                    value={opt.key}
                    checked={rebalancing === opt.key}
                    onChange={(e) => setRebalancing(e.target.value)}
                    className="sr-only"
                    id={`rebal-${opt.key}`}
                  />
                  <span className="text-xs font-black">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 매년 추가 적립금 설정 카드 (적립식 시뮬레이션 탭일 때만 노출) */}
          {activeTab === 'recurring' && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calculator size={16} className="text-emerald-600" />
                  매년 추가 적립금
                </span>
                <span className="font-bold text-emerald-600 text-xs">{formatKRW(annualDeposit)}</span>
              </h2>
              <div className="space-y-3">
                <input 
                  type="range"
                  min="0"
                  max="100000000" // 1억 원
                  step="500000" // 50만 원 단위
                  value={annualDeposit}
                  onChange={(e) => setAnnualDeposit(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <input
                  type="number"
                  value={annualDeposit}
                  onChange={(e) => setAnnualDeposit(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right font-mono"
                />
              </div>
            </div>
          )}

          {/* 비중 조합 추가 및 리스트 관리 카드 */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[400px]">
            <div className="space-y-4">
              <h2 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center justify-between">
                <span>비중 조합 비교 리스트</span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  총 {allocations.length}개
                </span>
              </h2>

              {/* 조합 리스트 스크롤 영역 */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {allocations.map((alloc) => {
                  const matchingColor = activeLines.find(l => l.label === alloc.name)?.color || '#94a3b8';
                  return (
                    <div 
                      key={alloc.name} 
                      className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors ${
                        !alloc.isVisible && 'opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={alloc.isVisible}
                          onChange={() => handleToggleVisibility(alloc.name)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        {alloc.isVisible && (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: matchingColor }} />
                        )}
                        <span className="text-xs font-bold text-slate-700">{alloc.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          주식 {alloc.stock_ratio}% / 현금 {100 - alloc.stock_ratio}%
                        </span>
                        {!alloc.isDefault && (
                          <button
                            onClick={() => handleRemoveCustom(alloc.name)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="조합 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 커스텀 조합 추가 폼 */}
            <form onSubmit={handleAddCustom} className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <p className="text-[11px] font-bold text-slate-400">새로운 비중 조합 추가</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="예: 70/30 포트폴리오"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <input
                  type="number"
                  placeholder="주식 비중 (0-100)"
                  value={customStockRatio}
                  onChange={(e) => setCustomStockRatio(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  min="0"
                  max="100"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors shadow-sm"
              >
                <Plus size={14} />
                조합 추가
              </button>
            </form>
          </div>
        </div>

        {/* 우측 패널: 시뮬레이션 차트 시계열 (Lg 8/12) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[500px]">
          <h2 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            {activeTab === 'recurring' 
              ? '자산 조합별 적립식 자산 성장 추이 (금액)' 
              : '자산 조합별 정규화 누적 수익률 비교 추이 (%)'}
          </h2>

          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 min-h-[300px]">
              <RefreshCw className="animate-spin text-blue-600" size={32} />
              <p className="text-xs text-slate-500 font-bold">백테스트 시뮬레이션 가동 중...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 min-h-[300px] text-rose-500 text-center">
              <AlertCircle size={32} />
              <p className="text-xs font-bold">{error}</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 min-h-[300px] text-slate-400 text-center">
              <Info size={32} />
              <p className="text-xs font-bold">비교 리스트에서 최소 하나 이상의 비중 조합을 체크해 주세요.</p>
            </div>
          ) : (
            <div className="w-full h-[400px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 9, fill: '#64748b' }} 
                    stroke="#cbd5e1"
                    tickFormatter={(val) => {
                      const parts = val.split('-');
                      return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : val;
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fill: '#64748b' }} 
                    stroke="#cbd5e1"
                    tickFormatter={(val) => {
                      if (activeTab === 'recurring') {
                        const valMan = Math.round(val / 10000);
                        if (isMasked) return maskValue(valMan) + '만';
                        return formatWithCommas(valMan) + '만';
                      }
                      return `${val}%`;
                    }}
                  />
                  <ChartTooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '16px',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      fontSize: '11px',
                    }}
                    labelFormatter={(label) => `날짜: ${label}`}
                    formatter={(value, name) => {
                      if (activeTab === 'recurring') {
                        return [formatKRW(value), name];
                      }
                      return [`${value}%`, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                  />
                  {activeLines.map((line) => (
                    <Line
                      key={line.label}
                      type="monotone"
                      dataKey={line.label}
                      stroke={line.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      name={line.label}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 3. 성과 지표 요약 카드 */}
      {apiData?.summaries && apiData.summaries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <h2 className="text-md font-black text-slate-800 flex items-center gap-1.5">
              조합별 성과 지표 요약
            </h2>
            <div className="relative flex items-center">
              <button
                onMouseEnter={() => setShowCagrTooltip(true)}
                onMouseLeave={() => setShowCagrTooltip(false)}
                className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                aria-label="지표 설명 조회"
              >
                <HelpCircle size={15} />
              </button>
              {showCagrTooltip && (
                <div className="absolute z-50 w-80 p-4 bg-slate-800 text-white text-[11px] rounded-2xl shadow-xl left-6 -top-12 leading-relaxed border border-slate-700 transition-all duration-300">
                  <p className="font-black text-xs text-blue-400 mb-1">기하 연평균 수익률 (CAGR)</p>
                  <p>포트폴리오의 과거 연평균 복리 성장 속도입니다.</p>
                  <p className="font-black text-[10px] text-amber-400 mt-2">최대 낙폭 (MDD)</p>
                  <p>분석 기간 고점 대비 가장 큰 자산의 손실(낙폭) 폭이며, 리스크 척도입니다.</p>
                  {activeTab === 'recurring' && (
                    <>
                      <p className="font-black text-[10px] text-emerald-400 mt-2">복리 이자 수익 / 누적 수익률</p>
                      <p>적립 원금 대비 불어난 순수 이자 금액 및 수익률 비율입니다.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {apiData.summaries.map((item) => {
              const matchedColor = activeLines.find(l => l.label === item.name)?.color || '#94a3b8';
              return (
                <div 
                  key={item.name} 
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: matchedColor }} />
                  
                  <div>
                    <p className="text-xs font-black text-slate-700 truncate pl-1" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 pl-1 mt-0.5">
                      주식 비중 {item.stock_ratio}%
                    </p>
                  </div>
                  
                  <div className="space-y-1.5 pl-1">
                    {activeTab === 'recurring' ? (
                      <>
                        <div className="flex items-center justify-between text-[10px] border-b border-slate-50 pb-0.5">
                          <span className="text-slate-400 font-bold">최종 예상 자산</span>
                          <span className="font-black text-blue-600 truncate max-w-[80px]" title={formatKRW(item.final_valuation)}>
                            {formatKRW(item.final_valuation)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">누적 투자 원금</span>
                          <span className="font-bold text-slate-700 truncate max-w-[80px]" title={formatKRW(item.total_invested)}>
                            {formatKRW(item.total_invested)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">복리 이자 수익</span>
                          <span className="font-black text-emerald-600 truncate max-w-[80px]" title={formatKRW(item.total_interest)}>
                            {formatKRW(item.total_interest)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] border-t border-slate-50 pt-1 mt-1">
                          <span className="text-slate-400 font-bold">누적 수익률</span>
                          <span className={`font-black ${item.final_return >= 0 ? 'text-blue-600' : 'text-rose-500'}`}>
                            {item.final_return > 0 ? '+' : ''}{item.final_return}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">CAGR / MDD</span>
                          <span className="font-black text-slate-700">
                            {item.cagr}% / <span className="text-rose-500">{item.mdd}%</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-bold">CAGR (연평균)</span>
                          <span className="font-black text-emerald-600">
                            {item.cagr > 0 ? '+' : ''}{item.cagr}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-bold">MDD (최대낙폭)</span>
                          <span className="font-black text-rose-500">
                            {item.mdd}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] border-t border-slate-50 pt-1 mt-1">
                          <span className="text-slate-400 font-bold">누적 수익률</span>
                          <span className={`font-black ${item.final_return >= 0 ? 'text-blue-600' : 'text-rose-500'}`}>
                            {item.final_return > 0 ? '+' : ''}{item.final_return}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. 상세 시뮬레이션 현황 테이블 (연도별/월별 현황) */}
      {apiData && allocations.filter(a => a.isVisible).length > 0 && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 pb-4">
            <div className="flex items-center gap-4">
              <span className="text-slate-700 text-xs font-black">비중 조합 상세 조회</span>
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                {allocations.filter(a => a.isVisible).map(a => (
                  <button
                    key={a.name}
                    onClick={() => setSelectedAllocForTable(a.name)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                      selectedAllocForTable === a.name
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 연도별 / 월별 토글 탭 */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/50">
              <button
                onClick={() => setActiveTableTab('yearly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeTableTab === 'yearly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                연도별 현황
              </button>
              <button
                onClick={() => setActiveTableTab('monthly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeTableTab === 'monthly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                월별 현황
              </button>
            </div>
          </div>

          {/* 테이블 리스트 */}
          <div className="overflow-x-auto">
            {activeTab === 'recurring' ? (
              // 1) 적립식 전용 상세 테이블
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-4 text-center border-r border-slate-100">
                      {activeTableTab === 'yearly' ? '연도' : '연월'}
                    </th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">기말 자산</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">누적 원금</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">당해 이자</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">누적 이자</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">포트폴리오 수익률</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">S&P 500 수익률</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">누적 수익률</th>
                    <th className="px-3 py-4 text-right border-r border-slate-100">포트폴리오 MDD</th>
                    <th className="px-3 py-4 text-right">S&P500 누적수익률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {combinedTableData.map((item, idx) => {
                    const isPositivePortRet = item.portfolio_return >= 0;
                    const isPositivePortCum = item.portfolio_cumulative >= 0;
                    const isPositiveSpCum = item.benchmark_cumulative >= 0;

                    return (
                      <tr key={idx} className="hover:bg-blue-50/20 transition-colors font-mono">
                        <td className="px-4 py-3.5 text-center font-black text-slate-700 border-r border-slate-100">
                          {activeTableTab === 'yearly' 
                            ? `${item.year}년` 
                            : `${item.year}년 ${item.month}월`}
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-slate-800 border-r border-slate-100">
                          {formatKRW(item.portfolio_valuation)}
                        </td>
                        <td className="px-3 py-3.5 text-right text-slate-500 border-r border-slate-100">
                          {formatKRW(item.portfolio_invested)}
                        </td>
                        <td className={`px-3 py-3.5 text-right border-r border-slate-100 ${item.portfolio_annual_interest >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600'}`}>
                          {formatKRW(item.portfolio_annual_interest)}
                        </td>
                        <td className="px-3 py-3.5 text-right text-indigo-600 border-r border-slate-100">
                          {formatKRW(item.portfolio_interest)}
                        </td>
                        <td className="px-3 py-3.5 text-right border-r border-slate-100">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border ${
                            isPositivePortRet 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {isPositivePortRet ? '+' : ''}{item.portfolio_return}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right border-r border-slate-100">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            item.benchmark_return >= 0 
                              ? 'bg-slate-100 text-slate-700 border-slate-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {item.benchmark_return >= 0 ? '+' : ''}{item.benchmark_return}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right border-r border-slate-100">
                          <span className={`font-black ${isPositivePortCum ? 'text-blue-600' : 'text-rose-500'}`}>
                            {isPositivePortCum ? '+' : ''}{item.portfolio_cumulative}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold text-rose-600 border-r border-slate-100">
                          {item.portfolio_mdd}%
                        </td>
                        <td className="px-3 py-3.5 text-right text-slate-500">
                          <span className={isPositiveSpCum ? 'text-slate-700' : 'text-rose-500'}>
                            {isPositiveSpCum ? '+' : ''}{item.benchmark_cumulative}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {combinedTableData.length === 0 && (
                    <tr>
                      <td colSpan="10" className="text-center py-8 text-xs text-slate-400 font-bold">
                        해당하는 통계 데이터가 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              // 2) 거치식 전용 상세 테이블
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th rowSpan="2" className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-r border-slate-100">
                      {activeTableTab === 'yearly' ? '연도' : '연월'}
                    </th>
                    <th colSpan="2" className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-100 border-r border-slate-100">
                      기간 수익률
                    </th>
                    <th colSpan="2" className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-100 border-r border-slate-100">
                      기간 누적 수익률
                    </th>
                    <th colSpan="2" className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-b border-slate-100">
                      최대 낙폭 (MDD)
                    </th>
                  </tr>
                  <tr className="bg-slate-50/60 border-b border-slate-100 text-[9px] font-bold text-slate-400">
                    <th className="px-3 py-2 text-right border-r border-slate-100">포트폴리오</th>
                    <th className="px-3 py-2 text-right border-r border-slate-100">S&P 500</th>
                    <th className="px-3 py-2 text-right border-r border-slate-100">포트폴리오</th>
                    <th className="px-3 py-2 text-right border-r border-slate-100">S&P 500</th>
                    <th className="px-3 py-2 text-right border-r border-slate-100">포트폴리오</th>
                    <th className="px-3 py-2 text-right">S&P 500</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {combinedTableData.map((item, idx) => {
                    const isPositivePortRet = item.portfolio_return >= 0;
                    const isPositiveSpRet = item.benchmark_return >= 0;
                    const isPositivePortCum = item.portfolio_cumulative >= 0;
                    const isPositiveSpCum = item.benchmark_cumulative >= 0;

                    return (
                      <tr key={idx} className="hover:bg-blue-50/20 transition-colors font-mono">
                        <td className="px-4 py-4 text-center font-black text-slate-700 border-r border-slate-100">
                          {activeTableTab === 'yearly' 
                            ? `${item.year}년` 
                            : `${item.year}년 ${item.month}월`}
                        </td>
                        <td className="px-3 py-4 text-right border-r border-slate-100">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            isPositivePortRet 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {isPositivePortRet ? '+' : ''}{item.portfolio_return}%
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right border-r border-slate-100 bg-slate-50/30">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPositiveSpRet 
                              ? 'bg-slate-100 text-slate-700 border-slate-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {isPositiveSpRet ? '+' : ''}{item.benchmark_return}%
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right font-black text-slate-700 border-r border-slate-100">
                          <span className={isPositivePortCum ? 'text-blue-600' : 'text-rose-500'}>
                            {isPositivePortCum ? '+' : ''}{item.portfolio_cumulative}%
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right font-medium border-r border-slate-100 bg-slate-50/30 text-slate-500 font-bold">
                          <span className={isPositiveSpCum ? 'text-slate-600' : 'text-rose-500'}>
                            {isPositiveSpCum ? '+' : ''}{item.benchmark_cumulative}%
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right font-bold text-rose-600 border-r border-slate-100">
                          {item.portfolio_mdd}%
                        </td>
                        <td className="px-3 py-4 text-right font-medium text-rose-400 bg-slate-50/30">
                          {item.benchmark_mdd}%
                        </td>
                      </tr>
                    );
                  })}
                  {combinedTableData.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-xs text-slate-400 font-bold">
                        해당하는 통계 데이터가 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetAllocationSimulationPage;
