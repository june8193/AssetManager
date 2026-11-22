import { useState, useMemo } from 'react';
import { RefreshCw, PieChart } from 'lucide-react';
import { useRatios } from '../../hooks/useRatios';
import { useMasking } from '../../contexts/MaskingContext';
import { useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';
import { MobileToast, MobileErrorCard } from '../../components/mobile/MobileStatusFeedback';
import { calculateRealtimeRebalancing } from '../RatioCheckPage';
import MobileRatioCard from '../../components/mobile/MobileRatioCard';

/**
 * 모바일 자산 비중 점검 및 리밸런싱 페이지 컴포넌트 (Read-Only, 클린 라이트 톤)
 * - 목표 비중 대비 현재 비중 및 리밸런싱 규모 확인
 * - 자산군/종목 계층 아코디언 카드 리스트
 * - 단일 헤더 새로고침 및 마스킹 연동
 */
export default function MobileRatiosPage() {
  const { hierarchy, loading, error, refreshHierarchy } = useRatios();
  const { maskValue } = useMasking();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const rebalancingResult = useMemo(() => {
    return calculateRealtimeRebalancing(hierarchy || [], 0);
  }, [hierarchy]);

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

  useMobileHeaderRefresh(handleRefresh, isRefreshing);

  const formatMoney = (val) => {
    return maskValue(Math.round(val).toLocaleString());
  };

  // 로딩 상태 (모바일 스켈레톤)
  if (loading && (!hierarchy || hierarchy.length === 0)) {
    return (
      <div className="space-y-3 animate-pulse max-w-md mx-auto">
        <div className="h-32 bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#3182F6] animate-spin" />
          <span className="text-xs text-[#8B95A1] font-medium">비중 데이터를 불러오는 중...</span>
        </div>
        <div className="h-28 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        <div className="h-28 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
      </div>
    );
  }

  // 에러 상태
  if (error && (!hierarchy || hierarchy.length === 0)) {
    return <MobileErrorCard message={error} onRetry={handleRefresh} />;
  }

  return (
    <div className="space-y-3 max-w-md mx-auto relative pb-6">
      <MobileToast toast={toastMessage} />

      {/* 1. 포트폴리오 요약 배너 */}
      <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3 tabular-nums">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#8B95A1]">포트폴리오 비중 요약</span>
        </div>

        <div>
          <span className="text-[11px] text-[#8B95A1] font-medium block">현재 총 자산</span>
          <div className="text-2xl font-bold text-[#191F28] mt-0.5 tracking-tight">
            {formatMoney(totalCurrentValue)}
            <span className="text-sm font-semibold text-[#6B7684] ml-0.5">원</span>
          </div>
        </div>

        {rebalanceAmount > 0 && (
          <div className="pt-3 border-t border-[#F2F4F6] flex items-center justify-between text-xs">
            <span className="text-[#6B7684] font-medium">리밸런싱 규모</span>
            <div className="text-[#3182F6] font-bold">
              {formatMoney(rebalanceAmount)}
              <span className="text-[11px] font-medium text-[#6B7684] ml-0.5">원</span>
            </div>
          </div>
        )}
      </section>

      {/* 2. 자산군별 비중 카드 목록 */}
      <div className="space-y-3">
        {rebalancingResult.length === 0 ? (
          <div className="py-12 text-center bg-white border border-[#E5E8EB]/60 rounded-2xl p-6">
            <PieChart className="w-7 h-7 text-[#CBD5E1] mx-auto mb-2" />
            <p className="text-xs text-[#8B95A1] font-medium">설정된 목표 비중 및 자산 데이터가 없습니다.</p>
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
