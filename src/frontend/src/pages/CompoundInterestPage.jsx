import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, 
  ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Calculator, HelpCircle, ArrowUpRight, TrendingUp, Sparkles, 
  Check, Percent, DollarSign, Calendar, Info 
} from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';
import { formatWithCommas } from '../utils/formatters';
import { API_BASE_URL } from '../config';

const CompoundInterestPage = () => {
  const { maskValue, isMasked } = useMasking();

  // 탭 상태: 'current-asset' (현재 자산기반 계산) | 'free-calc' (자유 계산)
  const [activeTab, setActiveTab] = useState('current-asset');

  // 현재 연도 (서버 및 클라이언트 정합성을 위해 2026년 기준)
  const currentYear = 2026;

  // 공통 매개변수 상태
  const [initialAsset, setInitialAsset] = useState(10000000); // 초기 자산 (1000만원)
  const [annualReturn, setAnnualReturn] = useState(5.0); // 연평균 수익률 (5%)
  const [annualDeposit, setAnnualDeposit] = useState(10000000); // 연평균 추가금 (1000만원)

  // 탭 1 (현재 자산기반) 전용 상태
  const [birthYear, setBirthYear] = useState(1995); // 출생연도 (기본값 1995)
  const [targetYear, setTargetYear] = useState(2056); // 목표연도 (기본값 2056)

  // 탭 2 (자유 계산) 전용 상태
  const [investmentPeriod, setInvestmentPeriod] = useState(30); // 투자 기간 (30년)

  // 임시 입력을 위한 로컬 문자열 상태
  const [birthYearInput, setBirthYearInput] = useState(birthYear.toString());
  const [targetYearInput, setTargetYearInput] = useState(targetYear.toString());
  const [investmentPeriodInput, setInvestmentPeriodInput] = useState(investmentPeriod.toString());

  // 메인 계산용 상태가 변경될 때 임시 입력 상태 동기화 (예: 스냅샷 자동 적용, 탭 전환 리셋)
  useEffect(() => {
    setBirthYearInput(birthYear.toString());
  }, [birthYear]);

  useEffect(() => {
    setTargetYearInput(targetYear.toString());
  }, [targetYear]);

  useEffect(() => {
    setInvestmentPeriodInput(investmentPeriod.toString());
  }, [investmentPeriod]);

  // 최종 값 검증 및 반영 핸들러
  const applyBirthYear = () => {
    const val = parseInt(birthYearInput, 10);
    if (isNaN(val) || val < 1900 || val > currentYear) {
      setBirthYearInput(birthYear.toString());
    } else {
      setBirthYear(val);
    }
  };

  const applyTargetYear = () => {
    const val = parseInt(targetYearInput, 10);
    if (isNaN(val) || val < currentYear + 1 || val > currentYear + 100) {
      setTargetYearInput(targetYear.toString());
    } else {
      setTargetYear(val);
    }
  };

  const applyInvestmentPeriod = () => {
    const val = parseInt(investmentPeriodInput, 10);
    if (isNaN(val) || val < 1 || val > 100) {
      setInvestmentPeriodInput(investmentPeriod.toString());
    } else {
      setInvestmentPeriod(val);
    }
  };

  const handleKeyDown = (e, applyFn) => {
    if (e.key === 'Enter') {
      applyFn();
      e.target.blur();
    }
  };

  // 스냅샷 데이터 기반 통계 상태
  const [snapshotStats, setSnapshotStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // 1. 스냅샷 데이터 기반 통계 API 호출
  useEffect(() => {
    const fetchSnapshotStats = async () => {
      setLoadingStats(true);
      setStatsError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/simulation/compound/snapshot-stats`);
        if (!response.ok) {
          throw new Error('스냅샷 통계를 가져오는데 실패했습니다.');
        }
        const data = await response.json();
        setSnapshotStats(data);
        
        // 기본 탭이 'current-asset'이므로 데이터 성공 시 자동으로 최신 자산 총합 적용
        if (data.has_enough_data) {
          setInitialAsset(Math.round(data.latest_total_valuation));
        }
      } catch (err) {
        console.error(err);
        setStatsError(err.message);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchSnapshotStats();
  }, []);

  // 탭 전환 핸들러
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'current-asset') {
      // 현재 자산기반 계산으로 리셋
      if (snapshotStats && snapshotStats.has_enough_data) {
        setInitialAsset(Math.round(snapshotStats.latest_total_valuation));
      } else {
        setInitialAsset(10000000);
      }
    } else {
      // 자유 계산으로 리셋
      setInitialAsset(10000000);
    }
  };

  // 추천 수치 적용 핸들러
  const handleApplyRecommended = () => {
    if (!snapshotStats || !snapshotStats.has_enough_data) return;
    
    setInitialAsset(Math.round(snapshotStats.latest_total_valuation));
    setAnnualReturn(parseFloat(snapshotStats.annual_roi_avg.toFixed(2)));
    setAnnualDeposit(Math.round(snapshotStats.annual_deposit_avg));
  };

  // 3. 복리 시뮬레이션 계산
  const simulationData = useMemo(() => {
    // 투자 기간(년수) 도출
    let years = 30;
    if (activeTab === 'current-asset') {
      years = targetYear - currentYear;
    } else {
      years = investmentPeriod;
    }

    if (years <= 0) return [];

    const data = [];
    let currentValuation = initialAsset;
    let totalInvested = initialAsset;
    let totalInterest = 0;
    const r = annualReturn / 100;

    // t=0 (현재 시점)
    const baseAge = currentYear - birthYear;
    data.push({
      year: currentYear,
      age: baseAge,
      yearIndex: 0,
      valuation: currentValuation,
      invested: totalInvested,
      interest: totalInterest,
      annualInterest: 0,
      formattedValuation: formatKRW(currentValuation),
      formattedInvested: formatKRW(totalInvested),
      formattedInterest: formatKRW(totalInterest),
      formattedAnnualInterest: formatKRW(0)
    });

    for (let i = 1; i <= years; i++) {
      const startVal = currentValuation;
      const interestEarned = startVal * r;
      currentValuation = startVal + interestEarned + annualDeposit;
      totalInvested += annualDeposit;
      totalInterest = currentValuation - totalInvested;

      const calcYear = currentYear + i;
      const calcAge = baseAge + i;

      data.push({
        year: calcYear,
        age: calcAge,
        yearIndex: i,
        valuation: Math.round(currentValuation),
        invested: Math.round(totalInvested),
        interest: Math.round(totalInterest),
        annualInterest: Math.round(interestEarned),
        formattedValuation: formatKRW(Math.round(currentValuation)),
        formattedInvested: formatKRW(Math.round(totalInvested)),
        formattedInterest: formatKRW(Math.round(totalInterest)),
        formattedAnnualInterest: formatKRW(Math.round(interestEarned))
      });
    }

    return data;
  }, [initialAsset, activeTab, birthYear, targetYear, investmentPeriod, annualReturn, annualDeposit, isMasked]);

  // 최종 요약 카드 데이터
  const summary = useMemo(() => {
    if (simulationData.length === 0) return { finalValuation: 0, finalInvested: 0, finalInterest: 0, profitRate: 0 };
    const lastRow = simulationData[simulationData.length - 1];
    const profitRate = lastRow.invested > 0 ? (lastRow.interest / lastRow.invested) * 100 : 0;
    return {
      finalValuation: lastRow.valuation,
      finalInvested: lastRow.invested,
      finalInterest: lastRow.interest,
      profitRate: profitRate.toFixed(1)
    };
  }, [simulationData]);


  // 금액 포맷터 (3자리 쉼표 및 마스킹 처리)
  function formatKRW(value) {
    if (isMasked) {
      return maskValue(value) + ' 원';
    }
    return formatWithCommas(value) + ' 원';
  }

  // 나이 연산 정보
  const calculatedAges = useMemo(() => {
    const curAge = currentYear - birthYear;
    const tgtAge = targetYear - birthYear;
    return { curAge, tgtAge };
  }, [birthYear, targetYear]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* 헤더 타이틀 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-600/10">
            <Calculator size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">시뮬레이션 복리 계산기</h1>
            <p className="text-sm text-slate-500">스냅샷 분석을 통해 산출한 내 자산 성장률 기반 혹은 자유 설정을 통해 미래 가치를 시뮬레이션합니다.</p>
          </div>
        </div>

        {/* 미려한 디자인의 탭 스위처 */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto border border-slate-200/40">
          <button
            onClick={() => handleTabChange('current-asset')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'current-asset'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            현재 자산기반 계산
          </button>
          <button
            onClick={() => handleTabChange('free-calc')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === 'free-calc'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            자유 계산
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 입력 제어 영역 (Left 5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 과거 기록 기반 추천 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600 animate-pulse" />
                <span className="font-semibold text-slate-800 text-sm">나의 스냅샷 기록 연동</span>
              </div>
              <span className="text-xs text-slate-400">실제 기록 자동 계산</span>
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
              </div>
            ) : statsError ? (
              <div className="text-xs text-rose-500 bg-rose-50 rounded-lg p-3">
                통계 로드 오류: {statsError}
              </div>
            ) : snapshotStats && snapshotStats.has_enough_data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-medium">연평균 수익률 (기하)</span>
                    <span className="font-bold text-slate-800 text-sm">{snapshotStats.annual_roi_avg.toFixed(2)}%</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-medium">연평균 추가금</span>
                    <span className="font-bold text-slate-800 text-sm truncate block" title={formatKRW(snapshotStats.annual_deposit_avg)}>
                      {formatKRW(snapshotStats.annual_deposit_avg)}
                    </span>
                  </div>
                  <div className="space-y-1 col-span-2 border-t border-slate-200/60 pt-2 mt-1">
                    <span className="text-slate-400 block font-medium">최신 자산 총액</span>
                    <span className="font-bold text-slate-800 text-sm block truncate" title={formatKRW(snapshotStats.latest_total_valuation)}>
                      {formatKRW(snapshotStats.latest_total_valuation)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleApplyRecommended}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  위 통계 수치를 계산기에 자동 적용하기
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                <div className="flex gap-2">
                  <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    최소 1년 이상의 자산 스냅샷 기록이 확보되어야 과거 연평균 수익률 및 연평균 추가금을 자동 계산할 수 있습니다.
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 text-right">※ 현재 데이터가 부족하여 기본값으로 자동 로드되었습니다.</p>
              </div>
            )}
          </div>

          {/* 파라미터 제어 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Calculator size={16} className="text-blue-500" />
              {activeTab === 'current-asset' ? '현재 자산기반 설정' : '자유 계산 설정'}
            </h2>

            {/* 초기 투자 자산 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="initialAsset" className="text-slate-500 font-medium">
                  {activeTab === 'current-asset' ? '현재 보유 자산' : '초기 투자 자산'}
                </label>
                <span className="font-bold text-blue-600 text-sm">{formatKRW(initialAsset)}</span>
              </div>
              <input 
                id="initialAsset"
                type="range"
                min="0"
                max="500000000" // 5억
                step="1000000" // 100만 단위
                value={initialAsset}
                onChange={(e) => setInitialAsset(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <input
                type="number"
                value={initialAsset}
                onChange={(e) => setInitialAsset(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
              />
            </div>

            {/* 탭1: 현재 자산기반 계산 전용 연도 설정 */}
            {activeTab === 'current-asset' ? (
              <div className="space-y-4 bg-slate-50 border border-slate-200/50 p-4 rounded-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="birthYear" className="text-xs text-slate-500 font-medium block">출생 연도</label>
                    <input
                      id="birthYear"
                      type="number"
                      min="1900"
                      max={currentYear}
                      value={birthYearInput}
                      onChange={(e) => setBirthYearInput(e.target.value)}
                      onBlur={applyBirthYear}
                      onKeyDown={(e) => handleKeyDown(e, applyBirthYear)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="targetYear" className="text-xs text-slate-500 font-medium block">목표 연도</label>
                    <input
                      id="targetYear"
                      type="number"
                      min={currentYear + 1}
                      max={currentYear + 100}
                      value={targetYearInput}
                      onChange={(e) => setTargetYearInput(e.target.value)}
                      onBlur={applyTargetYear}
                      onKeyDown={(e) => handleKeyDown(e, applyTargetYear)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
                
                {/* 동적 계산 나이 가이드 라벨 */}
                <div className="text-xs text-slate-500 flex flex-col gap-1 border-t border-slate-200/60 pt-3 mt-1 font-medium">
                  <div className="flex justify-between">
                    <span>현재 나이 ({currentYear}년)</span>
                    <span className="text-slate-800 font-bold">{calculatedAges.curAge} 세</span>
                  </div>
                  <div className="flex justify-between">
                    <span>목표 연도 나이 ({targetYear}년)</span>
                    <span className="text-blue-700 font-bold">{calculatedAges.tgtAge} 세</span>
                  </div>
                  <div className="flex justify-between text-indigo-600 font-semibold border-t border-dashed border-slate-200 pt-2 mt-1">
                    <span>총 시뮬레이션 기간</span>
                    <span>{targetYear - currentYear} 년</span>
                  </div>
                </div>
              </div>
            ) : (
              /* 탭2: 자유 계산 전용 기간 설정 */
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="investmentPeriod" className="text-slate-500 font-medium">투자 기간</label>
                  <span className="font-bold text-slate-700 text-sm">{investmentPeriod}년</span>
                </div>
                <input 
                  id="investmentPeriod"
                  type="range"
                  min="1"
                  max="50"
                  value={investmentPeriod}
                  onChange={(e) => setInvestmentPeriod(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-600"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={investmentPeriodInput}
                  onChange={(e) => setInvestmentPeriodInput(e.target.value)}
                  onBlur={applyInvestmentPeriod}
                  onKeyDown={(e) => handleKeyDown(e, applyInvestmentPeriod)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-mono"
                />
              </div>
            )}

            {/* 연평균 수익률 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="annualReturn" className="text-slate-500 font-medium">연평균 목표 수익률</label>
                <span className="font-bold text-indigo-600 text-sm">{annualReturn}%</span>
              </div>
              <input 
                id="annualReturn"
                type="range"
                min="-10"
                max="30"
                step="0.1"
                value={annualReturn}
                onChange={(e) => setAnnualReturn(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <input
                type="number"
                step="0.1"
                value={annualReturn}
                onChange={(e) => setAnnualReturn(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right font-mono"
              />
            </div>

            {/* 연평균 추가금 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="annualDeposit" className="text-slate-500 font-medium">연평균 추가 적립금</label>
                <span className="font-bold text-emerald-600 text-sm">{formatKRW(annualDeposit)}</span>
              </div>
              <input 
                id="annualDeposit"
                type="range"
                min="0"
                max="100000000" // 1억
                step="50000" // 5만 단위
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
        </div>

        {/* 결과 및 시각화 영역 (Right 7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 요약 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 최종 평가액 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between h-28">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-xs font-semibold">최종 예상 자산</span>
                <div className="p-1 bg-blue-50 text-blue-600 rounded-lg">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <div>
                <span className="text-lg font-bold text-slate-800 truncate block" title={formatKRW(summary.finalValuation)}>
                  {formatKRW(summary.finalValuation)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {activeTab === 'current-asset' ? `${targetYear}년 (${calculatedAges.tgtAge}세) 시점` : `${investmentPeriod}년 후 시점`}
                </span>
              </div>
            </div>

            {/* 누적 추가 원금 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between h-28">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-xs font-semibold">누적 추가 원금</span>
                <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Calendar size={16} />
                </div>
              </div>
              <div>
                <span className="text-lg font-bold text-slate-800 truncate block" title={formatKRW(summary.finalInvested)}>
                  {formatKRW(summary.finalInvested)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">총 추가 납입 금액 합계</span>
              </div>
            </div>

            {/* 복리 이자 수익 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between h-28">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-xs font-semibold">복리 이자 수익</span>
                <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div>
                <span className="text-lg font-bold text-slate-800 truncate block" title={formatKRW(summary.finalInterest)}>
                  {formatKRW(summary.finalInterest)}
                </span>
                <span className="text-[10px] text-indigo-500 font-semibold block mt-0.5">원금 대비 +{summary.profitRate}%</span>
              </div>
            </div>

          </div>

          {/* Recharts 자산 시각화 차트 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 text-sm">연도별 누적 자산 성장 곡선</h3>
              <div className="flex gap-4 text-[10px] font-semibold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>투자 원금</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span>이자 수익</span>
              </div>
            </div>

            <div className="h-72">
              {simulationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={simulationData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey={activeTab === 'current-asset' ? 'year' : 'yearIndex'} 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(v) => activeTab === 'current-asset' ? `${v}년` : `${v}년차`}
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(value) => {
                        const valMan = Math.round(value / 10000);
                        if (isMasked) return maskValue(valMan) + '만';
                        return formatWithCommas(valMan) + '만';
                      }}
                    />
                    <ChartTooltip 
                      formatter={(value, name) => {
                        const labelName = name === 'invested' ? '누적 원금' : name === 'interest' ? '누적 이자수익' : name === 'annualInterest' ? '당해 이자' : '평가 자산';
                        return [formatKRW(value), labelName];
                      }}
                      labelFormatter={(label) => {
                        if (activeTab === 'current-asset') {
                          const yearVal = Number(label);
                          const ageVal = yearVal - birthYear;
                          return `${yearVal}년 (${ageVal}세) 시점`;
                        }
                        return `${label}년차 경과`;
                      }}
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="invested" 
                      stackId="1" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorInvested)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="interest" 
                      stackId="1" 
                      stroke="#6366f1" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorInterest)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="annualInterest" 
                      stroke="transparent" 
                      fill="transparent" 
                      legendType="none"
                      activeDot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  기간 설정을 올바르게 입력해 주세요.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 연도별 상세 데이터 표 */}
        <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">연도별 상세 추이표</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                <tr>
                  <th className="px-4 py-3">경과 연수</th>
                  {activeTab === 'current-asset' && (
                    <>
                      <th className="px-4 py-3">연도</th>
                      <th className="px-4 py-3">나이</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right">누적 원금</th>
                  <th className="px-4 py-3 text-right">당해 이자</th>
                  <th className="px-4 py-3 text-right">누적 이자</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-700">기말 자산</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                {simulationData.map((row) => (
                  <tr key={row.yearIndex} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">{row.yearIndex === 0 ? '시작' : `${row.yearIndex}년차`}</td>
                    {activeTab === 'current-asset' && (
                      <>
                        <td className="px-4 py-2.5">{row.year}년</td>
                        <td className="px-4 py-2.5">{row.age}세</td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-right text-slate-500">{row.formattedInvested}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-500">{row.formattedAnnualInterest}</td>
                    <td className="px-4 py-2.5 text-right text-indigo-500">{row.formattedInterest}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{row.formattedValuation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CompoundInterestPage;
