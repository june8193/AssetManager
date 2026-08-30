import { useState, useMemo } from 'react';
import { RefreshCw, AlertCircle, PieChart } from 'lucide-react';
import { useRatios } from '../../hooks/useRatios';
import { useMasking } from '../../contexts/MaskingContext';
import { calculateRealtimeRebalancing } from '../RatioCheckPage';
import MobileRatioCard from '../../components/mobile/MobileRatioCard';

/**
 * 모바일 자산 비중 점검 및 리밸런싱 페이지 컴포넌트 (Read-Only)
 * - 목표 비중 대비 현재 비중 및 리밸런싱 규모 확인
 * - 자산군/종목 계층 아코디언 카드 리스트
 * - 실시간 시세 새로고침 및 마스킹 연동
 */
export default function MobileRatiosPage() {
  const { hierarchy, loading, error, refreshHierarchy } = useRatios();
  const { maskValue } = useMasking();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 실시간 리밸런싱 계산 결과 도출
  const rebalancingResult = useMemo(() => {
    return calculateRealtimeRebalancing(hierarchy || [], 0);
  }, [hierarchy]);

  // 총 현재 평가액 및 단일 리밸런싱 규모 산출
  const { totalCurrentValue, rebalanceAmount } = useMemo(() => {
    if (!rebalancingResult || rebalancingResult.length === 0) {
      return { totalCurrentValue: 0, rebalanceAmount: 0 };
    }
    const currentVal = rebalancingResult.reduce((sum, item) => sum + (item.current_value || 0), 0);

    let needBuy = 0;
    let overSold = 0;
    rebalancingResult.forEach((major) => {
      if (major.diff_amt > 0) needBuy += major.diff_amt;
      else if (major.diff_amt < 0) overSold += Math.abs(major.diff_amt);
    });

    return {
      totalCurrentValue: currentVal,
      rebalanceAmount: Math.max(needBuy, overSold),
    };
  }, [rebalancingResult]);

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
        </div>

        {/* 현재 총 자산 단일 메인 금액 */}
        <div className="pt-1">
          <span className="text-[10px] text-slate-400 font-medium block">현재 총 자산</span>
          <div className="text-xl font-extrabold text-white font-mono mt-0.5 tracking-tight">
            {formatMoney(totalCurrentValue)}
            <span className="text-xs font-normal text-slate-400 ml-0.5">원</span>
          </div>
        </div>

        {/* 단일화된 리밸런싱 규모 안내 */}
        {rebalanceAmount > 0 && (
          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">리밸런싱 규모</span>
            <div className="text-sky-400 font-mono font-bold text-[11px]">
              {formatMoney(rebalanceAmount)}
              <span className="text-[10px] font-normal text-slate-400 ml-0.5">원</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. 자산군별 비중 카드 목록 */}
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
