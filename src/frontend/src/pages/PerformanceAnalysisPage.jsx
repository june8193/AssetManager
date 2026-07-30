import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  ShieldAlert, Award, TrendingDown, Percent, Info, RefreshCw, 
  HelpCircle, CheckCircle2, ChevronRight, BarChart2 
} from 'lucide-react';
import PerformanceInfoModal from '../components/PerformanceInfoModal';

const PERIODS = [
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '6M', label: '6개월' },
  { value: '1Y', label: '1년' },
  { value: 'YTD', label: 'YTD' },
  { value: 'Max', label: '전체' }
];

export default function PerformanceAnalysisPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [riskFreeRate, setRiskFreeRate] = useState(3.5);
  const [inputRate, setInputRate] = useState('3.5');
  const [isEditingRate, setIsEditingRate] = useState(false);
  
  const [portfolioPerf, setPortfolioPerf] = useState(null);
  const [assetPerfs, setAssetPerfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 테이블 정렬 상태
  const [sortKey, setSortKey] = useState('sharpe_ratio');
  const [sortOrder, setSortOrder] = useState('desc');

  // 모달 상태
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // 무위험 수익률 로드
  const fetchRiskFreeRate = async () => {
    try {
      const res = await fetch('/api/v1/performance/settings/risk-free-rate');
      if (res.ok) {
        const data = await res.json();
        setRiskFreeRate(data.rate);
        setInputRate(String(data.rate));
      }
    } catch (e) {
      console.error("무위험 수익률 로드 실패:", e);
    }
  };

  // 무위험 수익률 변경 저장
  const handleSaveRiskFreeRate = async () => {
    const numRate = parseFloat(inputRate);
    if (isNaN(numRate) || numRate < 0 || numRate > 100) {
      alert("0% 이상 100% 이하의 유효한 수치를 입력해주세요.");
      return;
    }

    try {
      const res = await fetch('/api/v1/performance/settings/risk-free-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: numRate })
      });
      if (res.ok) {
        const data = await res.json();
        setRiskFreeRate(data.rate);
        setIsEditingRate(false);
        fetchPerformanceData();
      }
    } catch (e) {
      console.error("무위험 수익률 저장 실패:", e);
      alert("무위험 수익률 저장 중 오류가 발생했습니다.");
    }
  };

  // 성과 데이터 로드 (총 자산 + 종목/지수 일괄)
  const fetchPerformanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [portRes, assetRes] = await Promise.all([
        fetch(`/api/v1/performance/portfolio?period=${selectedPeriod}`),
        fetch(`/api/v1/performance/assets/batch?period=${selectedPeriod}`)
      ]);

      if (portRes.ok) {
        const portData = await portRes.json();
        setPortfolioPerf(portData);
      }
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        setAssetPerfs(assetData);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskFreeRate();
  }, []);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  // 테이블 정렬 핸들러
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // 정렬된 자산 리스트
  const sortedAssetPerfs = useMemo(() => {
    if (!assetPerfs || assetPerfs.length === 0) return [];
    return [...assetPerfs].sort((a, b) => {
      let valA = a[sortKey] ?? 0;
      let valB = b[sortKey] ?? 0;

      if (typeof valA === 'string') {
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [assetPerfs, sortKey, sortOrder]);


  // 샤프 지수 레벨 평가
  const sharpeEvaluation = useMemo(() => {
    const s = portfolioPerf?.sharpe_ratio ?? 0;
    if (s > 1.0) return { label: '매우 우수', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (s > 0.5) return { label: '양호', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (s > 0.0) return { label: '보통', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: '저성과', color: 'text-rose-600 bg-rose-50 border-rose-200' };
  }, [portfolioPerf]);

  // 소티노 지수 레벨 평가
  const sortinoEvaluation = useMemo(() => {
    const s = portfolioPerf?.sortino_ratio ?? 0;
    if (s > 1.5) return { label: '매우 우수', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (s > 0.7) return { label: '양호', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (s > 0.0) return { label: '보통', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: '저성과', color: 'text-rose-600 bg-rose-50 border-rose-200' };
  }, [portfolioPerf]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* 헤더 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
            <BarChart2 size={16} />
            <span>Asset Risk Performance Metrics</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">위험조정 성과 분석 대시보드</h1>
          <p className="text-xs text-slate-500 mt-1">
            시간가중수익률(TWR) 기반 포트폴리오 위험대비 성과지표(Sharpe, Sortino) 및 MDD 추이를 분석합니다.
          </p>
        </div>

        {/* 오른쪽 무위험 수익률 설정 컨트롤 */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-xs">
            <span className="text-slate-500 font-medium block">연율 무위험 수익률 ($R_f$)</span>
            {!isEditingRate ? (
              <span className="text-sm font-bold text-slate-800 font-mono">{riskFreeRate.toFixed(2)}%</span>
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input 
                  type="number"
                  step="0.1"
                  value={inputRate}
                  onChange={(e) => setInputRate(e.target.value)}
                  className="w-16 px-2 py-0.5 text-xs font-mono border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold">%</span>
              </div>
            )}
          </div>

          {!isEditingRate ? (
            <button 
              onClick={() => setIsEditingRate(true)}
              className="px-2.5 py-1 text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
            >
              설정 변경
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button 
                onClick={handleSaveRiskFreeRate}
                className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
              <button 
                onClick={() => { setIsEditingRate(false); setInputRate(String(riskFreeRate)); }}
                className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
              >
                취소
              </button>
            </div>
          )}

          {/* 알고리즘 안내 모달 오픈 버튼 */}
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="p-2 text-blue-600 hover:bg-blue-100/60 rounded-lg transition-colors ml-1"
            title="AssetManager 상세 산출 공식 보기"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      {/* 기간 선택 서브 필터 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setSelectedPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedPeriod === p.value 
                  ? 'bg-white text-blue-700 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button 
          onClick={fetchPerformanceData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>새로고침</span>
        </button>
      </div>

      {/* KPI 카드리스트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. 샤프 지수 카드 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              샤프 지수 (Sharpe)
              <button 
                onClick={() => setIsInfoModalOpen(true)} 
                className="text-slate-400 hover:text-blue-600 transition-colors"
                title="공식 툴팁 및 가이드 모달 열기"
              >
                <Info size={14} />
              </button>
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${sharpeEvaluation.color}`}>
              {sharpeEvaluation.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
              {loading ? "..." : (portfolioPerf?.sharpe_ratio ?? "0.00")}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            전체 변동성 대비 연율 초과 수익률
          </p>
        </div>

        {/* 2. 소티노 지수 카드 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              소티노 지수 (Sortino)
              <button 
                onClick={() => setIsInfoModalOpen(true)} 
                className="text-slate-400 hover:text-blue-600 transition-colors"
                title="공식 툴팁 및 가이드 모달 열기"
              >
                <Info size={14} />
              </button>
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${sortinoEvaluation.color}`}>
              {sortinoEvaluation.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
              {loading ? "..." : (portfolioPerf?.sortino_ratio ?? "0.00")}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            하방 손실 위험 대비 연율 초과 수익률
          </p>
        </div>

        {/* 3. 최근 MDD 카드 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">최근 Drawdown (MDD)</span>
            <TrendingDown size={16} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-amber-600 font-mono tracking-tight">
              {loading ? "..." : `${portfolioPerf?.mdd ?? 0.00}%`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            최근 최고점 대비 현재 하락률
          </p>
        </div>

        {/* 4. 기간 최고 MDD 카드 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">기간 최고 MDD (Max MDD)</span>
            <ShieldAlert size={16} className="text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-rose-600 font-mono tracking-tight">
              {loading ? "..." : `${portfolioPerf?.max_mdd ?? 0.00}%`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            선택 기간 중 발생한 최악의 하락 폭
          </p>
        </div>

      </div>

      {/* MDD 추이 영역 차트 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <TrendingDown className="text-amber-500" size={18} />
              <span>포트폴리오 일별 Drawdown 백분율 추이 차트</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              외부 입출금 현금 흐름을 차감한 TWR 시계열 기준 고점 대비 하락 폭 시각화
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">연율화 수익률:</span>
              <span className="font-mono font-bold text-slate-700">
                {portfolioPerf?.annualized_return != null ? `${portfolioPerf.annualized_return}%` : '-'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">연율화 변동성:</span>
              <span className="font-mono font-bold text-slate-700">
                {portfolioPerf?.annualized_volatility != null ? `${portfolioPerf.annualized_volatility}%` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* 차트 렌더링 */}
        <div className="h-72 w-full pt-2">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              성과 차트 데이터를 계산 중입니다...
            </div>
          ) : !portfolioPerf?.drawdown_series || portfolioPerf.drawdown_series.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              선택한 기간에 대한 자산 스냅샷 데이터가 부족합니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioPerf.drawdown_series} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 0]}
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#f59e0b' }}
                  formatter={(val) => [`${val}%`, 'Drawdown']}
                  labelFormatter={(lbl) => `일자: ${lbl}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="drawdown" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#drawdownGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 보유 종목 및 벤치마크 지수 위험조정 성과 비교 테이블 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Award className="text-blue-600" size={18} />
              <span>보유 종목 및 벤치마크 지수 위험조정 성과 비교</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              선택한 기간 동안의 연율화 샤프/소티노 지수, MDD 및 연율 수익률을 한눈에 비교 분석합니다.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            총 <span className="font-bold text-slate-700">{sortedAssetPerfs.length}</span>개 자산
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    자산명 (티커)
                    {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('asset_type')}>
                  <div className="flex items-center gap-1">
                    구분
                    {sortKey === 'asset_type' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('sharpe_ratio')}>
                  <div className="flex items-center justify-end gap-1">
                    샤프 지수 (Sharpe)
                    {sortKey === 'sharpe_ratio' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('sortino_ratio')}>
                  <div className="flex items-center justify-end gap-1">
                    소티노 지수 (Sortino)
                    {sortKey === 'sortino_ratio' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('mdd')}>
                  <div className="flex items-center justify-end gap-1">
                    최대 낙폭 (MDD)
                    {sortKey === 'mdd' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('annualized_return')}>
                  <div className="flex items-center justify-end gap-1">
                    연율화 수익률
                    {sortKey === 'annualized_return' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    종목별 위험조정 지표를 산출 중입니다...
                  </td>
                </tr>
              ) : sortedAssetPerfs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    조회된 지수 및 종목 성과 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedAssetPerfs.map((item) => (
                  <tr key={item.ticker} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({item.ticker})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                        item.asset_type === 'benchmark'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {item.asset_type === 'benchmark' ? '벤치마크' : '보유종목'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                      {item.sharpe_ratio != null ? item.sharpe_ratio.toFixed(2) : '0.00'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                      {item.sortino_ratio != null ? item.sortino_ratio.toFixed(2) : '0.00'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-rose-600">
                      {item.mdd != null ? `${item.mdd.toFixed(2)}%` : '0.00%'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                      {item.annualized_return != null ? `${item.annualized_return.toFixed(2)}%` : '0.00%'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 안내 모달 */}
      <PerformanceInfoModal 
        isOpen={isInfoModalOpen} 
        onClose={() => setIsInfoModalOpen(false)} 
      />

    </div>

  );
}
