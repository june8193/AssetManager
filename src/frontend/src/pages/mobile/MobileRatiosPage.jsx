import { useState, useMemo } from 'react';
import { RefreshCw, AlertCircle, PieChart, Sparkles, RotateCcw, Plus, Coins } from 'lucide-react';
import { useRatios } from '../../hooks/useRatios';
import { useMasking } from '../../contexts/MaskingContext';
import { calculateRealtimeRebalancing } from '../RatioCheckPage';
import MobileRatioCard from '../../components/mobile/MobileRatioCard';

/**
 * 모바일 자산 비중 점검 및 리밸런싱 페이지 컴포넌트 (Read-Only)
 * - 목표 비중 대비 현재 비중 및 리밸런싱 필요 금액 확인
 * - 추가 투자금에 따른 실시간 리밸런싱 시뮬레이션
 * - 자산군/종목 계층 아코디언 카드 리스트
 * - 실시간 시세 새로고침 및 마스킹 연동
 */
export default function MobileRatiosPage() {
  const { hierarchy, loading, error, refreshHierarchy } = useRatios();
  const { maskValue } = useMasking();
  const [additionalCash, setAdditionalCash] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 실시간 리밸런싱 계산 결과 도출
  const rebalancingResult = useMemo(() => {
    return calculateRealtimeRebalancing(hierarchy || [], additionalCash);
  }, [hierarchy, additionalCash]);

  // 총 현재 평가액 및 목표 총 자산 산출
  const { totalCurrentValue, totalTargetValue, totalNeedBuy, totalOverSold } = useMemo(() => {
    if (!rebalancingResult || rebalancingResult.length === 0) {
      return { totalCurrentValue: 0, totalTargetValue: 0, totalNeedBuy: 0, totalOverSold: 0 };
    }
    const currentVal = rebalancingResult.reduce((sum, item) => sum + (item.current_value || 0), 0);
    const targetVal = currentVal + additionalCash;

    let needBuy = 0;
    let overSold = 0;
    rebalancingResult.forEach((major) => {
      if (major.diff_amt > 0) needBuy += major.diff_amt;
      else if (major.diff_amt < 0) overSold += Math.abs(major.diff_amt);
    });

    return {
      totalCurrentValue: currentVal,
      totalTargetValue: targetVal,
      totalNeedBuy: needBuy,
      totalOverSold: overSold,
    };
  }, [rebalancingResult, additionalCash]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage(null);
    try {
      if (refreshHierarchy) {
        await refreshHierarchy();
      }
      setToastMessage({ type: 'success', text: '비중 데이터가 최신화되었습니다.' });
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.message || '새로고침 중 오류가 발생했습니다.',
      });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    }
  };

  const handleAddCash = (amount) => {
    setAdditionalCash((prev) => Math.max(0, prev + amount));
  };

  const handleResetCash = () => {
    setAdditionalCash(0);
  };

  const formatMoney = (val) => {
    return maskValue(Math.round(val).toLocaleString());
  };

  // 로딩 상태 (모바일 스켈레톤)
  if (loading && (!hierarchy || hierarchy.length === 0)) {
    return (
      <div className="space-y-4 animate-pulse py-2 max-w-md mx-auto">
        <div className="flex items-center justify-between px-1">
          <div className="h-5 w-24 bg-slate-800 rounded-lg" />
          <div className="h-8 w-24 bg-slate-800 rounded-xl" />
        </div>
        <div className="h-32 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">비중 데이터를 불러오는 중...</span>
        </div>
        <div className="h-28 bg-slate-900 border border-slate-800 rounded-3xl" />
        <div className="h-28 bg-slate-900 border border-slate-800 rounded-3xl" />
      </div>
    );
  }

  // 에러 상태
  if (error && (!hierarchy || hierarchy.length === 0)) {
    return (
      <div className="py-12 px-4 text-center max-w-md mx-auto">
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 flex flex-col items-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">데이터 로드 실패</h2>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-600/20"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto relative pb-6">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div
          className={`sticky top-2 z-30 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all text-center animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-rose-500 text-white shadow-rose-500/20'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* 페이지 헤더 & 새로고침 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">비중 점검</h2>
          <p className="text-[10px] text-slate-400 font-medium">목표 비중 대비 포트폴리오 분석</p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="새로고침"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            isRefreshing
              ? 'bg-slate-800 text-slate-500 border-slate-700/40 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border-slate-700/60 shadow-sm'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
          <span>{isRefreshing ? '갱신 중...' : '새로고침'}</span>
        </button>
      </div>

      {/* 1. 포트폴리오 요약 배너 */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-sky-400 tracking-wide flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5" />
            포트폴리오 비중 요약
          </span>
          {additionalCash > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              시뮬레이션 적용 중
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <span className="text-[10px] text-slate-400 font-medium block">현재 총 자산</span>
            <div className="text-base font-extrabold text-white font-mono mt-0.5">
              {formatMoney(totalCurrentValue)}
              <span className="text-xs font-normal text-slate-400 ml-0.5">원</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-medium block">목표 총 자산</span>
            <div className="text-base font-extrabold text-sky-400 font-mono mt-0.5">
              {formatMoney(totalTargetValue)}
              <span className="text-xs font-normal text-slate-400 ml-0.5">원</span>
            </div>
          </div>
        </div>

        {/* 리밸런싱 필요 총액 안내 */}
        {(totalNeedBuy > 0 || totalOverSold > 0) && (
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">리밸런싱 조정 요약</span>
            <div className="flex items-center gap-2 font-mono font-bold">
              {totalNeedBuy > 0 && (
                <span className="text-sky-400 text-[11px]">
                  매수 +{formatMoney(totalNeedBuy)}원
                </span>
              )}
              {totalOverSold > 0 && (
                <span className="text-amber-400 text-[11px]">
                  매도 -{formatMoney(totalOverSold)}원
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. 추가 투자금 시뮬레이터 (간편 칩 버튼) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>추가 투자금 시뮬레이션</span>
          </div>
          {additionalCash > 0 && (
            <span className="text-xs font-mono font-bold text-emerald-400">
              +{formatMoney(additionalCash)}원
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => handleAddCash(1000000)}
            className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold border border-slate-700/60 transition-all flex items-center justify-center gap-0.5 whitespace-nowrap"
          >
            <Plus className="w-3 h-3 text-sky-400" />
            100만
          </button>
          <button
            type="button"
            onClick={() => handleAddCash(5000000)}
            className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold border border-slate-700/60 transition-all flex items-center justify-center gap-0.5 whitespace-nowrap"
          >
            <Plus className="w-3 h-3 text-sky-400" />
            500만
          </button>
          <button
            type="button"
            onClick={() => handleAddCash(10000000)}
            className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold border border-slate-700/60 transition-all flex items-center justify-center gap-0.5 whitespace-nowrap"
          >
            <Plus className="w-3 h-3 text-sky-400" />
            1,000만
          </button>
          {additionalCash > 0 && (
            <button
              type="button"
              onClick={handleResetCash}
              aria-label="투자금 초기화"
              className="py-1.5 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 rounded-xl text-[11px] font-bold border border-rose-500/20 transition-all flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 3. 자산군별 비중 카드 목록 */}
      <div className="space-y-3">
        {rebalancingResult.length === 0 ? (
          <div className="py-12 text-center bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
            <PieChart className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">설정된 목표 비중 및 자산 데이터가 없습니다.</p>
          </div>
        ) : (
          rebalancingResult.map((item) => (
            <MobileRatioCard
              key={item.category_name}
              item={item}
              totalValuation={totalCurrentValue}
              level="major"
            />
          ))
        )}
      </div>
    </div>
  );
}
