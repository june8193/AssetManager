import { useState, useRef, useEffect } from 'react';
import { RefreshCw, TrendingUp, BarChart2 } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const SUB_TABS = [
  { id: 'market', label: '시장 지수', icon: TrendingUp },
  { id: 'compare', label: '포트폴리오 비교', icon: BarChart2 },
];

/**
 * 모바일 지수분석 쉘 페이지 컴포넌트 (`/m/market`)
 * 
 * - 상단 서브탭 스위처: [시장 지수] (기본) | [포트폴리오 비교]
 * - 모바일 헤더 규격 준수: 타이틀, 새로고침 버튼, 토스트 알림, 마스킹 연동
 * - 서브 탭 전환 시 화면 전환 지연 없이 클라이언트 상태로 즉각적인 뷰 전환
 */
export default function MobileMarketPage() {
  const [activeTab, setActiveTab] = useState('market'); // 'market' | 'compare'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);
  const { maskValue } = useMasking();

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
      // 쉘 수준 새로고침 시뮬레이션 및 데이터 최신화 알림
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

  return (
    <div className="space-y-4 max-w-md mx-auto relative pb-6">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div
          role="status"
          data-testid="market-toast"
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
          <h1 className="text-lg font-extrabold text-white tracking-tight">지수분석</h1>
          <p className="text-[10px] text-slate-400 font-medium">시장 지수 추이 및 포트폴리오 비교</p>
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

      {/* 상단 2단 서브탭 스위처 ([시장 지수] | [포트폴리오 비교]) */}
      <div
        role="tablist"
        aria-label="지수분석 서브 메뉴"
        className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner"
      >
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
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
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
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
          className="space-y-4 animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-center">
            <TrendingUp className="w-8 h-8 text-sky-400 mx-auto mb-2 opacity-80" />
            <h2 className="text-sm font-bold text-white mb-1">시장 지수 분석</h2>
            <p className="text-xs text-slate-400">
              S&amp;P 500, 나스닥, 코스피, 코스닥 지수 추이와 VIX 공포지수를 한눈에 확인합니다.
            </p>
          </div>
        </section>
      )}

      {/* 서브탭 2: 포트폴리오 비교 뷰 쉘 */}
      {activeTab === 'compare' && (
        <section
          id="view-compare"
          role="tabpanel"
          aria-labelledby="tab-compare"
          data-testid="portfolio-comparison-view"
          className="space-y-4 animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm text-center">
            <BarChart2 className="w-8 h-8 text-sky-400 mx-auto mb-2 opacity-80" />
            <h2 className="text-sm font-bold text-white mb-1">포트폴리오 비교 분석</h2>
            <p className="text-xs text-slate-400">
              내 포트폴리오 수익률과 4대 주요 시장 지수를 벤치마크 비교합니다.
            </p>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-center gap-2">
              <span className="text-[11px] text-slate-400">포트폴리오 수익률:</span>
              <span data-testid="masked-return" className="text-xs font-bold text-emerald-400 font-mono">
                {maskValue('+12.4%')}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
