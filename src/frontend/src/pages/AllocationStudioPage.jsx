import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Sliders, TrendingUp, Play, Percent, ShieldAlert, Award, Calendar, AlertCircle, Info, RefreshCw,
  Trash2, Star, Save, Plus, X, BarChart2, Table
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
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState(getTodayString());

  // 저장된 설정 목록 및 UI State
  const [settings, setSettings] = useState([]);
  const [selectedSettingId, setSelectedSettingId] = useState(null);
  const [settingName, setSettingName] = useState('');
  const [settingDescription, setSettingDescription] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [skipAutoBacktest, setSkipAutoBacktest] = useState(false);
  const [activeTab, setActiveTab] = useState('annual'); // 'annual' or 'monthly'

  // 시뮬레이션 결과 State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // 저장된 설정 목록 조회
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/allocation/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        return data;
      }
    } catch (err) {
      console.error('설정 목록을 가져오지 못했습니다.', err);
    }
    return [];
  };

  // 설정값 적용
  const applySetting = (setting) => {
    setSkipAutoBacktest(true); // targetIndex 변경으로 인한 백테스트 트리거 차단
    setSelectedSettingId(setting.id);
    setTargetIndex(setting.target_index);
    setLookbackPeriod(setting.lookback_period);
    setRebalancingFrequency(setting.rebalancing_frequency);
    setVixThreshold(setting.vix_threshold);
    setMinCashWeight(setting.min_cash_weight);
    setMaxCashWeight(setting.max_cash_weight);
    setStartDate(setting.start_date);
    setEndDate(setting.end_date || getTodayString());
    
    if (setting.simulation_result) {
      try {
        const cachedResult = JSON.parse(setting.simulation_result);
        setResult(cachedResult);
      } catch (err) {
        console.error('캐시 파싱 실패, 백테스트 재실행', err);
        handleRunBacktestDirect(setting);
      }
    } else {
      handleRunBacktestDirect(setting);
    }
  };

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

  // 특정 설정을 기반으로 백테스트 직접 실행
  const handleRunBacktestDirect = async (setting) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/allocation/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_index: setting.target_index,
          lookback_period: setting.lookback_period,
          rebalancing_frequency: setting.rebalancing_frequency,
          vix_threshold: parseFloat(setting.vix_threshold),
          min_cash_weight: parseFloat(setting.min_cash_weight),
          max_cash_weight: parseFloat(setting.max_cash_weight),
          start_date: setting.start_date,
          end_date: setting.end_date || getTodayString(),
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

  // 신규 설정 저장
  const handleSaveSetting = async () => {
    if (!settingName.trim()) {
      alert('설정 이름을 입력해주세요.');
      return;
    }
    try {
      const payload = {
        name: settingName,
        description: settingDescription,
        target_index: targetIndex,
        lookback_period: lookbackPeriod,
        rebalancing_frequency: rebalancingFrequency,
        vix_threshold: parseFloat(vixThreshold),
        min_cash_weight: parseFloat(minCashWeight),
        max_cash_weight: parseFloat(maxCashWeight),
        start_date: startDate,
        end_date: endDate,
        simulation_result: result ? JSON.stringify(result) : null
      };

      const response = await fetch('/api/allocation/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || '설정 저장에 실패했습니다.');
      }

      const newSetting = await response.json();
      setSettingName('');
      setSettingDescription('');
      setShowSaveModal(false);
      setSelectedSettingId(newSetting.id);
      await fetchSettings();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // 설정 삭제
  const handleDeleteSetting = async (id, e) => {
    e.stopPropagation();
    if (!confirm('정말 이 설정을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/allocation/settings/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        if (selectedSettingId === id) setSelectedSettingId(null);
        await fetchSettings();
      } else {
        alert('설정 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 즐겨찾기 설정 토글
  const handleToggleFavorite = async (id, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/allocation/settings/${id}/favorite`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchSettings();
      } else {
        alert('즐겨찾기 지정에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 초기 로드 시 설정 패치 및 즐겨찾기 로드
  useEffect(() => {
    const init = async () => {
      const loaded = await fetchSettings();
      const favorite = loaded.find(s => s.is_favorite);
      if (favorite) {
        applySetting(favorite);
      } else {
        handleRunBacktest();
      }
    };
    init();
  }, []);

  // 지수 변경 시 자동 재실행 (단, 설정 적용 중 targetIndex가 바뀔 때는 스킵)
  useEffect(() => {
    if (skipAutoBacktest) {
      setSkipAutoBacktest(false);
      return;
    }
    handleRunBacktest();
  }, [targetIndex]);

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-semibold shadow-sm active:scale-95 transition-all"
          >
            <Save size={16} />
            <span>설정 저장</span>
          </button>
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
        
        {/* 1. 좌측 영역 (설정 튜닝 및 저장 목록) */}
        <div className="space-y-6 h-fit">
          
          {/* 전략 설정 패널 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
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
                      type="button"
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
              </div>

              {/* 최소 현금 비중 */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold text-slate-700 items-center">
                  <span className="flex items-center gap-1">
                    <span>최소 현금 비중 (Min Cash)</span>
                    <span className="relative group ml-1 inline-block align-middle cursor-help">
                      <Info className="text-slate-400 hover:text-slate-600 transition-colors" size={14} />
                      <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-56 -left-24 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                        아무리 상승 추세이더라도 유지할 최소한의 현금 비중입니다. (추천: 10%)
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
                        하락세가 깊을 때 보유할 최대 현금 비중입니다. 나머지는 주식 비중으로 채웁니다. (추천: 40%)
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

          {/* 저장된 설정 목록 관리 패널 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Star className="text-amber-500 fill-amber-500" size={18} />
                <h3 className="font-bold text-slate-800">저장된 설정 목록</h3>
              </div>
              <span className="text-xs text-slate-400 font-semibold">{settings.length}개 저장됨</span>
            </div>

            {settings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                저장된 파라미터 설정이 없습니다.<br/>우측 상단 [설정 저장] 버튼으로 등록하세요.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {settings.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => applySetting(s)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                      selectedSettingId === s.id
                        ? 'border-blue-600 bg-blue-50/30'
                        : 'border-slate-150 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{s.name}</span>
                        {s.is_favorite && (
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-bold">
                            기본참고
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {s.target_index} · {s.lookback_period}일 · {s.rebalancing_frequency}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite(s.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          s.is_favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                        }`}
                        title="주요 참조 설정으로 지정"
                      >
                        <Star className={s.is_favorite ? 'fill-amber-500' : ''} size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSetting(s.id, e)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                        title="설정 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. 우측 2단 영역 */}
        <div className="lg:col-span-2 space-y-6">

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex gap-2 text-sm">
              <AlertCircle className="text-rose-500 flex-shrink-0" size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* 스코어 및 추천 비중 요약 */}
          {result && result.today_recommendation && (() => {
            const curScore = result.today_recommendation.current_score;
            return (
              <div className="space-y-6">
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
                          <span className="text-slate-600 font-semibold flex items-center gap-1">
                            1. 추세 점수 (이동평균 위)
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({Math.round(result.today_recommendation.score_breakdown.trend_val)} &gt; {Math.round(result.today_recommendation.score_breakdown.ma_val)})
                            </span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            result.today_recommendation.score_breakdown.trend_pass 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {result.today_recommendation.score_breakdown.trend_pass ? '+1점 통과' : '0점 미달'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-600 font-semibold flex items-center gap-1">
                            2. 모멘텀 점수 (과거 대비 상승)
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({Math.round(result.today_recommendation.score_breakdown.trend_val)} &gt; {Math.round(result.today_recommendation.score_breakdown.past_val)})
                            </span>
                          </span>
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
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({result.today_recommendation.score_breakdown.vix_val.toFixed(1)} &lt; {vixThreshold})
                            </span>
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
              </div>
            );
          })()}

          {/* 성과 시뮬레이션 결과 및 꺾은선 차트 */}
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

            {/* 성과 지표 비교 카드 */}
            {result && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CAGR 비교 카드 */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 border border-blue-100 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                      <Award size={14} className="text-blue-600" />
                      연평균 수익률 (CAGR)
                    </span>
                    <span className="relative group cursor-help">
                      <Info className="text-slate-400 hover:text-slate-600" size={14} />
                      <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-60 -right-2 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                        연평균성장률(Compound Annual Growth Rate). 기하평균을 기준으로 자산이 매년 복리로 얼마나 성장했는지를 보여주는 수익 성능 지표입니다.
                      </span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400">내 전략</span>
                      <span className="text-3xl font-black text-blue-700">{result.cagr}%</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400">지수 B&H</span>
                      <span className="text-xl font-bold text-slate-500">{result.benchmark_cagr}%</span>
                    </div>
                  </div>
                </div>

                {/* MDD 비교 카드 */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/30 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                      <Percent size={14} className="text-slate-500" />
                      최대 낙폭 (MDD)
                    </span>
                    <span className="relative group cursor-help">
                      <Info className="text-slate-400 hover:text-slate-600" size={14} />
                      <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[10px] rounded-lg p-2.5 w-60 -right-2 top-6 z-20 shadow-xl leading-relaxed font-normal normal-case border border-slate-700">
                        최대낙폭(Maximum Drawdown). 백테스트 기간 중 전고점 대비 최대 하락 비율을 말하며, 모델의 최악 리스크 크기를 평가하는 기준이 됩니다.
                      </span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400">내 전략</span>
                      <span className="text-3xl font-black text-rose-600">-{result.mdd}%</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400">지수 B&H</span>
                      <span className="text-xl font-bold text-slate-500">-{result.benchmark_mdd}%</span>
                    </div>
                  </div>
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
                <ResponsiveContainer width="100%" height={260}>
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

          {/* 연간 및 월간 성과 상세 분석 표 */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Table className="text-blue-600" size={18} />
                  <h3 className="font-bold text-slate-800">연간/월간 수익률 비교</h3>
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('annual')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      activeTab === 'annual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    연간 성과표
                  </button>
                  <button
                    onClick={() => setActiveTab('monthly')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      activeTab === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    월간 성과표
                  </button>
                </div>
              </div>

              {/* 연간 성과표 탭 */}
              {activeTab === 'annual' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-2.5 px-3">연도</th>
                        <th className="py-2.5 px-3 text-right">내 전략 수익률</th>
                        <th className="py-2.5 px-3 text-right">지수 B&H 수익률</th>
                        <th className="py-2.5 px-3 text-right">초과 수익률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.annual_returns?.map((row) => {
                        const alpha = row.strategy - row.benchmark;
                        return (
                          <tr key={row.year} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{row.year}년</td>
                            <td className="py-2.5 px-3 text-right font-bold text-blue-600">{row.strategy}%</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{row.benchmark}%</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${alpha >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {alpha >= 0 ? `+${alpha.toFixed(2)}` : alpha.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 월간 성과표 탭 */}
              {activeTab === 'monthly' && (
                <div className="overflow-x-auto max-h-96 overflow-y-auto pr-1">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="py-2.5 px-3">연월</th>
                        <th className="py-2.5 px-3 text-right">내 전략 수익률</th>
                        <th className="py-2.5 px-3 text-right">지수 B&H 수익률</th>
                        <th className="py-2.5 px-3 text-right">초과 수익률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.monthly_returns?.slice().reverse().map((row) => {
                        const alpha = row.strategy - row.benchmark;
                        return (
                          <tr key={`${row.year}-${row.month}`} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              {row.year}년 {row.month}월
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-blue-600">{row.strategy}%</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{row.benchmark}%</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${alpha >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {alpha >= 0 ? `+${alpha.toFixed(2)}` : alpha.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 3. 하단 영역 (저장된 파라미터 비교 요약 대조표) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
          <BarChart2 className="text-indigo-600" size={20} />
          <h2 className="text-lg font-bold text-slate-800">파라미터 설정 비교 대조표</h2>
        </div>
        
        {settings.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            저장된 설정이 없어 비교 데이터를 표시할 수 없습니다. 설정을 등록해 보세요!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                  <th className="py-3 px-4">설정 이름</th>
                  <th className="py-3 px-4">대상 지수</th>
                  <th className="py-3 px-4 text-center">룩백 (일)</th>
                  <th className="py-3 px-4">리밸런싱</th>
                  <th className="py-3 px-4 text-center">VIX 임계</th>
                  <th className="py-3 px-4 text-center">현금 비중 (최소~최대)</th>
                  <th className="py-3 px-4 text-right">전략 CAGR</th>
                  <th className="py-3 px-4 text-right">지수 CAGR</th>
                  <th className="py-3 px-4 text-right">전략 MDD</th>
                  <th className="py-3 px-4 text-right">지수 MDD</th>
                  <th className="py-3 px-4 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.map((s) => {
                  let cached = null;
                  if (s.simulation_result) {
                    try {
                      cached = JSON.parse(s.simulation_result);
                    } catch (e) {}
                  }
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                        selectedSettingId === s.id ? 'bg-blue-50/20 font-medium' : ''
                      }`}
                      onClick={() => applySetting(s)}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-1">
                        {s.name}
                        {s.is_favorite && <Star className="text-amber-500 fill-amber-500" size={10} />}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{s.target_index}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{s.lookback_period}</td>
                      <td className="py-3 px-4 text-slate-600">{s.rebalancing_frequency}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{s.vix_threshold} pt</td>
                      <td className="py-3 px-4 text-center text-slate-600">{s.min_cash_weight}% ~ {s.max_cash_weight}%</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600">
                        {cached ? `${cached.cagr}%` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {cached ? `${cached.benchmark_cagr}%` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-500">
                        {cached ? `-${cached.mdd}%` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {cached ? `-${cached.benchmark_mdd}%` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDeleteSetting(s.id, e)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 설정 저장 모달 다이얼로그 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl p-6 relative flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowSaveModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-lg font-bold text-slate-800">시뮬레이션 파라미터 저장</h3>
              <p className="text-xs text-slate-400 mt-1">현재 설정해놓은 전략 변수와 백테스트 결과를 캐시 보관합니다.</p>
            </div>
            
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">설정 이름 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="예: 보수적 미국 주도 전략"
                  value={settingName}
                  onChange={(e) => setSettingName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">설정 설명 (선택)</label>
                <textarea
                  placeholder="간단한 메모나 설명을 입력하세요."
                  value={settingDescription}
                  onChange={(e) => setSettingDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 text-xs">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold"
              >
                취소
              </button>
              <button
                onClick={handleSaveSetting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/10"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllocationStudioPage;
