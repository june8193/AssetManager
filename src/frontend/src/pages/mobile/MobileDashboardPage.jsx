import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';
import { MobileToast, MobileErrorCard } from '../../components/mobile/MobileStatusFeedback';
import MobileTotalAssetCard from '../../components/mobile/MobileTotalAssetCard';
import MobileAssetTrendCard from '../../components/mobile/MobileAssetTrendCard';
import MobileCategoryBreakdownCard from '../../components/mobile/MobileCategoryBreakdownCard';
import MobilePerformanceSummaryCard from '../../components/mobile/MobilePerformanceSummaryCard';

/**
 * 모바일 최적화 대시보드 페이지 컴포넌트 (클린 라이트 톤)
 * - 총 자산, 자산 추이(수익 지수), 카테고리별 자산 비중, 연간/누적 성과 요약 카드 렌더링
 * - 상단 단일 헤더의 새로고침 버튼과 연동 및 토스트 알림
 * - 로딩 스켈레톤 및 에러 재시도 처리
 */
export default function MobileDashboardPage() {
  const { data, loading, error, refresh } = useDashboard();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage(null);
    try {
      const result = await refresh(true);
      if (result) {
        if (result.status === 'success') {
          setToastMessage({ type: 'success', text: result.message || '시세가 최신화되었습니다.' });
        } else if (result.status === 'skipped') {
          setToastMessage({ type: 'info', text: result.message || '시세 최신화가 건너뛰어졌습니다.' });
        }
      } else {
        setToastMessage({ type: 'success', text: '시세가 최신화되었습니다.' });
      }
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

  // 로딩 상태 (모바일 스켈레톤)
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse max-w-md mx-auto">
        <div className="h-48 bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#3182F6] animate-spin" />
          <span className="text-xs text-[#8B95A1] font-medium">자산 데이터를 불러오는 중...</span>
        </div>
        <div className="h-44 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        <div className="h-40 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return <MobileErrorCard message={error} onRetry={() => refresh()} />;
  }

  if (!data) return null;

  return (
    <div className="space-y-3 max-w-md mx-auto relative pb-4">
      <MobileToast toast={toastMessage} />

      {/* 1. 총 자산 요약 카드 */}
      <MobileTotalAssetCard data={data} />

      {/* 2. 자산 추이 및 수익 지수 차트 카드 */}
      <MobileAssetTrendCard data={data.snapshots} />

      {/* 3. 카테고리별 자산 비중 요약 카드 */}
      <MobileCategoryBreakdownCard
        categories={data.categories}
        totalValuation={data.total_valuation_krw}
      />

      {/* 4. 연간 및 누적 수익률 성과 요약 카드 */}
      <MobilePerformanceSummaryCard data={data} />
    </div>
  );
}
