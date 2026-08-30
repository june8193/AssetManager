import { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import MobileTotalAssetCard from '../../components/mobile/MobileTotalAssetCard';
import MobileCategoryBreakdownCard from '../../components/mobile/MobileCategoryBreakdownCard';
import MobilePerformanceSummaryCard from '../../components/mobile/MobilePerformanceSummaryCard';

/**
 * 모바일 최적화 대시보드 페이지 컴포넌트
 * - 총 자산, 카테고리별 자산 비중, 연간/누적 성과 요약 카드 렌더링
 * - 상단 실시간 시세 새로고침 버튼 및 토스트 알림
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

  // 로딩 상태 (모바일 스켈레톤)
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse py-2">
        <div className="flex items-center justify-between px-1">
          <div className="h-5 w-24 bg-slate-800 rounded-lg" />
          <div className="h-8 w-24 bg-slate-800 rounded-xl" />
        </div>
        <div className="h-48 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">자산 데이터를 불러오는 중...</span>
        </div>
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
        <div className="h-40 bg-slate-900 border border-slate-800 rounded-3xl" />
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="py-12 px-4 text-center">
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 flex flex-col items-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">데이터 로드 실패</h2>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => refresh()}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-600/20"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 max-w-md mx-auto relative pb-4">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div
          className={`sticky top-2 z-30 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all text-center animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : toastMessage.type === 'info'
              ? 'bg-sky-500 text-white shadow-sky-500/20'
              : 'bg-rose-500 text-white shadow-rose-500/20'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* 페이지 헤더 및 새로고침 컨트롤 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">대시보드</h2>
          <p className="text-[10px] text-slate-400 font-medium">실시간 포트폴리오 요약</p>
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

      {/* 1. 총 자산 요약 카드 */}
      <MobileTotalAssetCard data={data} />

      {/* 2. 카테고리별 자산 비중 요약 카드 */}
      <MobileCategoryBreakdownCard
        categories={data.categories}
        totalValuation={data.total_valuation_krw}
      />

      {/* 3. 연간 및 누적 수익률 성과 요약 카드 */}
      <MobilePerformanceSummaryCard data={data} />
    </div>
  );
}
