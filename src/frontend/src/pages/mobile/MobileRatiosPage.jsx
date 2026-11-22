import { useState, useMemo, useRef, useEffect } from 'react';
import { RefreshCw, PieChart } from 'lucide-react';
import { useRatios } from '../../hooks/useRatios';
import { useMasking } from '../../contexts/MaskingContext';
import { useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';
import { MobileToast, MobileErrorCard } from '../../components/mobile/MobileStatusFeedback';
import { calculateRealtimeRebalancing } from '../RatioCheckPage';
import MobileRatioCard from '../../components/mobile/MobileRatioCard';
import MobileRiskSection from '../../components/mobile/MobileRiskSection';

const SUB_TABS = [
  { id: 'ratios', label: '비중 점검' },
  { id: 'risk', label: '리스크' },
];

/**
 * 모바일 자산 비중 점검 및 리스크 진단 페이지 컴포넌트 (Read-Only, 클린 라이트 톤)
 * - 상단 2단 서브탭 스위처: [비중 점검] (기본) | [리스크]
 * - 비중 점검: 목표 비중 대비 현재 비중 및 리밸런싱 규모 확인
 * - 리스크: 포트폴리오 내재 변동성, 스펙트럼 게이지, 차트 2종, 종목별 기여도 진단
 * - 단일 헤더 새로고침 및 마스킹 연동
 */
export default function MobileRatiosPage() {
  const { hierarchy, loading, error, refreshHierarchy } = useRatios();
  const { maskValue } = useMasking();
  const [activeTab, setActiveTab] = useState('ratios');
  const [riskRefreshTrigger, setRiskRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
      if (activeTab === 'risk') {
        setRiskRefreshTrigger((prev) => prev + 1);
        setToastMessage({ type: 'success', text: '리스크 지표가 최신화되었습니다.' });
      } else {
        if (refreshHierarchy) {
          await refreshHierarchy();
        }
        setToastMessage({ type: 'success', text: '비중 데이터가 최신화되었습니다.' });
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.message || '새로고침 중 오류가 발생했습니다.',
      });
    } finally {
      setIsRefreshing(false);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    }
  };

  useMobileHeaderRefresh(handleRefresh, isRefreshing);

  const formatMoney = (val) => {
    return maskValue(Math.round(val).toLocaleString());
  };

  const renderRatiosContent = () => {
    if (loading && (!hierarchy || hierarchy.length === 0)) {
      return (
        <div className="space-y-3 animate-pulse">
          <div className="h-32 bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-[#3182F6] animate-spin" />
            <span className="text-xs text-[#8B95A1] font-medium">비중 데이터를 불러오는 중...</span>
          </div>
          <div className="h-28 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
          <div className="h-28 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        </div>
      );
    }

    if (error && (!hierarchy || hierarchy.length === 0)) {
      return <MobileErrorCard message={error} onRetry={handleRefresh} />;
    }

    return (
      <>
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
      </>
    );
  };

  return (
    <div className="space-y-3 max-w-md mx-auto relative pb-6">
      <MobileToast toast={toastMessage} />

      {/* 상단 2단 서브탭 스위처 ([비중 점검] | [리스크]) */}
      <div
        role="tablist"
        aria-label="비중 점검 서브 메뉴"
        className="flex p-1 bg-[#E5E8EB]/70 rounded-xl gap-1"
      >
        {SUB_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`view-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center ${
                isActive
                  ? 'bg-white text-[#191F28] font-semibold shadow-xs'
                  : 'text-[#6B7684] hover:text-[#191F28] font-medium'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 서브탭 1: 비중 점검 */}
      {activeTab === 'ratios' && (
        <div
          id="view-ratios"
          role="tabpanel"
          aria-labelledby="tab-ratios"
          className="space-y-3"
        >
          {renderRatiosContent()}
        </div>
      )}

      {/* 서브탭 2: 리스크 */}
      {activeTab === 'risk' && (
        <div
          id="view-risk"
          role="tabpanel"
          aria-labelledby="tab-risk"
          className="space-y-3"
        >
          <MobileRiskSection refreshTrigger={riskRefreshTrigger} />
        </div>
      )}
    </div>
  );
}
