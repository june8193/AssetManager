import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Sliders, TrendingUp, Play, Percent, ShieldAlert, Award, Calendar, AlertCircle, Info, RefreshCw
} from 'lucide-react';

const COLORS = ['#3b82f6', '#94a3b8']; // 주식(Blue), 현금(Slate)

const AllocationStudioPage = () => {
  // 오늘 날짜 문자열 YYYY-MM-DD 구하기
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // 전략 변수 State
  const [targetIndex, setTargetIndex] = useState('S&P500');
  const [lookbackPeriod, setLookbackPeriod] = useState(200);
  const [rebalancingFrequency, setRebalancingFrequency] = useState('매월 말');
  const [vixThreshold, setVixThreshold] = useState(30);
  const [minCashWeight, setMinCashWeight] = useState(10);
  const [maxCashWeight, setMaxCashWeight] = useState(40);
  const [startDate, setStartDate] = useState('1990-01-01');
  const [endDate, setEndDate] = useState(getTodayString());

  // 시뮬레이션 결과 State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // 백테스트 API 호출 함수
  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/allocation/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_index: targetIndex,
          lookback_period: lookbackPeriod,
          rebalancing_frequency: rebalancingFrequency,
          vix_threshold: parseFloat(vixThreshold),
          min_cash_weight: parseFloat(minCashWeight),
          max_cash_weight: parseFloat(maxCashWeight),
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || '백테스트 수행에 실패했습니다.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 초기 렌더링 및 지수/기간 변경 시 자동으로 실행
  useEffect(() => {
    handleRunBacktest();
  }, [targetIndex]); // 지수 변경 시 자동 재실행


  // 추천 비중 데이터 포맷
  const getPieData = () => {
    if (!result || !result.today_recommendation) return [];
    return [
      { name: '주식 (ETF)', value: result.today_recommendation.recommended_stock_weight },
      { name: '현금', value: result.today_recommendation.recommended_cash_weight }
    ];
  };

  // 차트 시계열 데이터 구성
  const getChartData = () => {
    if (!result) return [];
    return result.dates.map((date, idx) => ({
      date: date.substring(2), // YY-MM-DD 형식으로 포맷팅
      '내 전략 수익률 (%)': result.strategy_returns[idx],
      '지수 보유(B&H) 수익률 (%)': result.benchmark_returns[idx]
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-800">
            자산배분 스튜디오
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            추세, 모멘텀, 공포지수를 활용한 동적 자산배분 모델 설계 및 백테스트 시뮬레이터
          </p>
        </div>
        <button
          onClick={handleRunBacktest}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={18} />
          ) : (
            <Play fill="white" size={14} />
          )}
          <span>시뮬레이션 실행</span>
        </button>
      </div>

      {/* 안내 공지 배너 (한국 지수 선택 시의 VIX 일괄 적용 안내 포함) */}
      {(targetIndex === 'KOSPI' || targetIndex === 'KOSDAQ') && (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm shadow-sm transition-all duration-300">
          <Info className="text-amber-600 flex-shrink-0" size={20} />
          <div className="space-y-1">
            <span className="font-bold">알림: 변동성 지수(VIX) 일괄 적용 안내</span>
            <p className="text-amber-700 leading-relaxed text-xs">
              한국 시장(KOSPI, KOSDAQ)은 야후 파이낸스의 국내 지표 역사적 데이터 제공 제약으로 인해, 백테스트 및 실시간 비중 계산 시 <strong>미국 VIX 지수(^VIX)</strong>를 심리 공포 점수의 측정 지표로 일괄 사용합니다. 글로벌 금융시장 공포지수 간의 높은 동조성을 활용한 전략적 설정입니다.
            </p>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. 전략 설정 패널 (좌측) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="text-blue-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">전략 파라미터 설정</h2>
          </div>

          <div className="space-y-4 text-sm">
            {/* 시뮬레이션 기간 */}
            <div className="space-y-1.5 border-b border-slate-100 pb-3">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>시뮬레이션 기간</span>
                <span className="relative group ml-1 inline-block align-middle cursor-help">
                  <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                  <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                    백테스트 시뮬레이션을 돌릴 시작일과 종료일을 지정합니다. 최소 1990년도부터 설정이 권장됩니다.
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* 대상 지수 */}
            <div className="space-y-1.5">
              <label htmlFor="target-index-select" className="font-semibold text-slate-700 flex items-center gap-1">
                <span>대상 지수 (Target Index)</span>
                <span className="relative group ml-1 inline-block align-middle cursor-help">
                  <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                  <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                    백테스트 및 자산배분의 기준이 되는 기초 자산 지수입니다. 한국 지수 선택 시 VIX는 미국 지표(^VIX)를 대용으로 적용합니다.
                  </span>
                </span>
              </label>
              <select
                id="target-index-select"
                value={targetIndex}
                onChange={(e) => setTargetIndex(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              >
                <option value="S&P500">S&P 500 (^GSPC)</option>
                <option value="NASDAQ">NASDAQ (^IXIC)</option>
                <option value="KOSPI">KOSPI 종합 (^KS11)</option>
                <option value="KOSDAQ">KOSDAQ 종합 (^KQ11)</option>
              </select>
            </div>

            {/* 기준 기간 */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-700 items-center">
                <span className="flex items-center gap-1">
                  <span>기준 기간 (Lookback Period)</span>
                  <span className="relative group ml-1 inline-block align-middle cursor-help">
                    <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                    <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                      추세를 판단하기 위한 이동평균선(MA) 일수와 모멘텀 판단을 위한 과거 시점과의 간격입니다. (추천: 200일)
                    </span>
                  </span>
                </span>
                <span className="text-blue-600 font-bold">{lookbackPeriod}일</span>
              </div>
              <input
                type="range"
                min="50"
                max="300"
                step="10"
                value={lookbackPeriod}
                onChange={(e) => setLookbackPeriod(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-[10px] text-slate-400 block">추세(이동평균) 및 룩백 모멘텀 기간에 동시 적용됩니다.</span>
            </div>

            {/* 리밸런싱 주기 */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <span>리밸런싱 주기</span>
                <span className="relative group ml-1 inline-block align-middle cursor-help">
                  <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                  <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                    포트폴리오 비중을 재조정하는 빈도입니다. 매일, 매월 말, 매 분기 말 영업일 종가 기준으로 비중을 갱신합니다.
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['매월 말', '매 분기 말', '매일'].map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setRebalancingFrequency(freq)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      rebalancingFrequency === freq
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            {/* VIX 임계값 */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-700 items-center">
                <span className="flex items-center gap-1">
                  <span>VIX 공포 임계값</span>
                  <span className="relative group ml-1 inline-block align-middle cursor-help">
                    <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                    <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                      시장의 변동성 지수(VIX)가 이 값 미만일 때 시장이 안정적(탐욕)이라고 판단하여 심리 점수 +1점을 얻습니다. (추천: 30 pt)
                    </span>
                  </span>
                </span>
                <span className="text-blue-600 font-bold">{vixThreshold} pt</span>
              </div>
              <input
                type="range"
                min="15"
                max="45"
                step="1"
                value={vixThreshold}
                onChange={(e) => setVixThreshold(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-[10px] text-slate-400 block">VIX 지수가 이 임계값 미만일 때 공포점수 +1점이 가산됩니다.</span>
            </div>

            {/* 최소 현금 비중 */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-700 items-center">
                <span className="flex items-center gap-1">
                  <span>최소 현금 비중 (Min Cash)</span>
                  <span className="relative group ml-1 inline-block align-middle cursor-help">
                    <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                    <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                      아무리 시장이 상승 추세(3점 만점)이더라도 포트폴리오 안전을 위해 유지할 최소한의 현금 비중입니다. (추천: 10%)
                    </span>
                  </span>
                </span>
                <span className="text-blue-600 font-bold">{minCashWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={minCashWeight}
                onChange={(e) => setMinCashWeight(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* 최대 현금 비중 */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-700 items-center">
                <span className="flex items-center gap-1">
                  <span>최대 현금 비중 (Max Cash)</span>
                  <span className="relative group ml-1 inline-block align-middle cursor-help">
                    <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                    <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                      시장이 하락세(0점)이거나 극심한 패닉 상황이더라도 주식 시장 반등 참여를 위해 현금을 최대 이 수준까지만 보유하고, 나머지는 주식 비중으로 채웁니다. (추천: 40%)
                    </span>
                  </span>
                </span>
                <span className="text-blue-600 font-bold">{maxCashWeight}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="90"
                step="5"
                value={maxCashWeight}
                onChange={(e) => setMaxCashWeight(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>


        {/* 우측 2단 영역 */}
        <div className="lg:col-span-2 space-y-6">

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex gap-2 text-sm">
              <AlertCircle className="text-rose-500 flex-shrink-0" size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* 2. 오늘 자 추천 비중 요약 (우측 상단) */}
          {result && result.today_recommendation && (() => {
            const curScore = result.today_recommendation.current_score;
            const baseCashW = curScore === 3 ? 0 : curScore === 2 ? 35 : curScore === 1 ? 65 : 100;
            return (
              <div className="space-y-6 col-span-1 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* 스코어 카드 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-slate-800">시장 분석 스코어</h3>
                        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                          오늘 자 기준
                        </div>
                      </div>

                      <div className="flex items-center gap-4 py-4">
                        <span className="text-5xl font-black text-blue-600">
                          {curScore}
                          <span className="text-xl text-slate-400 font-normal"> / 3점</span>
                        </span>
                        <span className="text-xs font-medium text-slate-500 leading-normal">
                          추세, 모멘텀, 공포 세 가지 조건을 통과하여 최적화된 자산배분 비중을 추천합니다.
                        </span>
                      </div>

                      {/* 세부 점수 통과 여부 */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-600 font-semibold">1. 추세 점수 (이동평균 위)</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            result.today_recommendation.score_breakdown.trend_pass 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {result.today_recommendation.score_breakdown.trend_pass ? '+1점 통과' : '0점 미달'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-600 font-semibold">2. 모멘텀 점수 (과거 가격 대비 상승)</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            result.today_recommendation.score_breakdown.momentum_pass 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {result.today_recommendation.score_breakdown.momentum_pass ? '+1점 통과' : '0점 미달'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-600 font-semibold flex items-center gap-1">
                            3. 심리 공포 점수 (VIX 안정)
                            <Info title="한국시장도 미국 VIX 지수가 적용됩니다." size={12} className="text-slate-400 cursor-help" />
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            result.today_recommendation.score_breakdown.vix_stable 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {result.today_recommendation.score_breakdown.vix_stable ? '+1점 통과' : '0점 미달'}
                          </span>
                        </div>
                      </div>

                      {/* 스코어별 기본 비중 매핑 표 */}
                      <div className="mt-4 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                        <div className="bg-slate-50 px-3 py-1.5 font-bold text-slate-500 border-b border-slate-100">
                          스코어별 기본 비중 매핑
                        </div>
                        <div className="divide-y divide-slate-100">
                          {[
                            { score: 3, stock: 100, cash: 0 },
                            { score: 2, stock: 65, cash: 35 },
                            { score: 1, stock: 35, cash: 65 },
                            { score: 0, stock: 0, cash: 100 }
                          ].map((row) => (
                            <div 
                              key={row.score} 
                              className={`flex justify-between px-3 py-2 transition-colors ${
                                curScore === row.score 
                                  ? 'bg-blue-50/70 text-blue-700 font-bold border-l-4 border-blue-500' 
                                  : 'text-slate-600'
                              }`}
                            >
                              <span>{row.score}점</span>
                              <span>주식 {row.stock}% / 현금 {row.cash}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 도넛 비중 차트 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-slate-800">추천 포트폴리오 비중</h3>
                    </div>
                    
                    <div className="flex items-center justify-center py-2 relative">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={getPieData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {getPieData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      {/* 중앙 텍스트 */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                        <span className="text-xs text-slate-400 font-semibold">주식 비중</span>
                        <span className="text-xl font-black text-blue-600">
                          {result.today_recommendation.recommended_stock_weight}%
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-slate-600">주식 ETF: {result.today_recommendation.recommended_stock_weight}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                        <span className="text-slate-600">현금: {result.today_recommendation.recommended_cash_weight}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 자산배분 결정 프로세스 다이어그램 */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm">
                    자산배분 결정 프로세스 (Allocation Decision Flow)
                  </h4>
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-xs">
                    {/* 1단계 */}
                    <div className="flex-1 w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-center shadow-sm">
                      <div className="text-slate-400 font-semibold mb-1">1단계: 시장분석 스코어</div>
                      <div className="font-black text-blue-600 text-xl">{curScore}점</div>
                      <div className="text-[10px] text-slate-400 mt-1">3가지 조건 중 {curScore}개 통과</div>
                    </div>
                    
                    <div className="text-slate-300 font-black text-lg rotate-90 lg:rotate-0">&rarr;</div>
                    
                    {/* 2단계 */}
                    <div className="flex-1 w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-center shadow-sm">
                      <div className="text-slate-400 font-semibold mb-1">2단계: 기본 현금 비중</div>
                      <div className="font-black text-slate-700 text-xl">{baseCashW}%</div>
                      <div className="text-[10px] text-slate-400 mt-1">(주식 {100 - baseCashW}%)</div>
                    </div>
                    
                    <div className="text-slate-300 font-black text-lg rotate-90 lg:rotate-0">&rarr;</div>
                    
                    {/* 3단계 */}
                    <div className="flex-1 w-full bg-blue-50/50 border border-blue-100/50 p-3.5 rounded-2xl text-center shadow-sm relative overflow-hidden">
                      <div className="text-blue-600 font-semibold mb-1">3단계: 최소/최대 현금 제약 (Clamping)</div>
                      <div className="font-black text-blue-700 text-base">{minCashWeight}% ~ {maxCashWeight}%</div>
                      <div className="text-[10px] text-slate-400 mt-1">기본 {baseCashW}% &rarr; 최종 {result.today_recommendation.recommended_cash_weight}% 조정</div>
                    </div>
                    
                    <div className="text-blue-400 font-black text-lg rotate-90 lg:rotate-0">&rarr;</div>
                    
                    {/* 4단계 */}
                    <div className="flex-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 rounded-2xl text-center text-white shadow-md shadow-blue-500/10">
                      <div className="opacity-90 font-semibold mb-1">최종 추천 포트폴리오 비중</div>
                      <div className="font-black text-xs">주식 {result.today_recommendation.recommended_stock_weight}%</div>
                      <div className="font-black text-xs">현금 {result.today_recommendation.recommended_cash_weight}%</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}


          {/* 3. 성과 시뮬레이션 결과 및 꺾은선 차트 (우측 하단) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-800">백테스트 성과 분석</h3>
              </div>
              {result && (
                <div className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                  <Calendar size={14} />
                  <span>시뮬레이션 기간: {result.dates[0]} ~ {result.dates[result.dates.length - 1]}</span>
                </div>
              )}
            </div>

            {/* 성과 카드 */}
            {result && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 border border-blue-100 rounded-2xl p-4 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Award size={14} className="text-blue-600" />
                    연평균 수익률 (CAGR)
                  </span>
                  <span className="text-3xl font-black text-blue-700 mt-2">
                    {result.cagr}%
                  </span>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-50/30 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Percent size={14} className="text-slate-500" />
                    최대 낙폭 (MDD)
                  </span>
                  <span className="text-3xl font-black text-slate-700 mt-2">
                    -{result.mdd}%
                  </span>
                </div>
              </div>
            )}

            {/* 차트 영역 */}
            <div className="h-80 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm gap-2">
                  <RefreshCw className="animate-spin" size={18} />
                  <span>데이터 분석 중...</span>
                </div>
              ) : result ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={getChartData()}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                    <Tooltip formatter={(value) => [`${value}%`]} labelStyle={{ color: '#64748b' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="내 전략 수익률 (%)"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="지수 보유(B&H) 수익률 (%)"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  전략 설정을 튜닝한 후 [시뮬레이션 실행] 버튼을 클릭하세요.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AllocationStudioPage;
