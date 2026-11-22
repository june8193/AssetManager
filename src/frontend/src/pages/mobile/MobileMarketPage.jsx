import { useState, useRef, useEffect } from 'react';
import { useMasking } from '../../contexts/MaskingContext';
import { useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';
import { MobileToast } from '../../components/mobile/MobileStatusFeedback';
import MobileMarketIndexSection from '../../components/mobile/MobileMarketIndexSection';
import MobileBenchmarkSection from '../../components/mobile/MobileBenchmarkSection';

const SUB_TABS = [
  { id: 'market', label: '시장 지수' },
  { id: 'compare', label: '포트폴리오 비교' },
];

/**
 * 모바일 지수분석 쉘 페이지 컴포넌트 (`/m/market`, 클린 라이트 톤)
 *
 * - 상단 서브탭 스위처: [시장 지수] (기본) | [포트폴리오 비교]
 * - 단일 헤더 새로고침 버튼 연동, 토스트 알림, 마스킹 연동
 * - 서브 탭 전환 시 화면 전환 지연 없이 클라이언트 상태로 즉각적인 뷰 전환
 */
export default function MobileMarketPage() {
  const [activeTab, setActiveTab] = useState('market'); // 'market' | 'compare'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);
  const { isMasked } = useMasking();

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage(null);
    try {
      setRefreshKey((prev) => prev + 1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setToastMessage({ type: 'success', text: '지수 및 시장 데이터가 최신화되었습니다.' });
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

  return (
    <div className="space-y-3 max-w-md mx-auto relative pb-6">
      <MobileToast toast={toastMessage} testId="market-toast" />

      {/* 상단 2단 서브탭 스위처 ([시장 지수] | [포트폴리오 비교]) */}
      <div
        role="tablist"
        aria-label="지수분석 서브 메뉴"
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

      {/* 서브탭 1: 시장 지수 뷰 쉘 */}
      {activeTab === 'market' && (
        <section
          id="view-market"
          role="tabpanel"
          aria-labelledby="tab-market"
          data-testid="market-indices-view"
          className="space-y-3"
        >
          <MobileMarketIndexSection key={refreshKey} />
        </section>
      )}

      {/* 서브탭 2: 포트폴리오 비교 뷰 쉘 */}
      {activeTab === 'compare' && (
        <section
          id="view-compare"
          role="tabpanel"
          aria-labelledby="tab-compare"
          data-testid="portfolio-comparison-view"
          className="space-y-3"
        >
          <MobileBenchmarkSection
            key={refreshKey}
            isMasked={isMasked}
          />
        </section>
      )}
    </div>
  );
}
