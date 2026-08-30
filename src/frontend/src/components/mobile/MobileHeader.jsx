import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 모바일 최상단 간소화 헤더 컴포넌트
 * - 앱 로고 및 타이틀
 * - 서버 헬스 상태 인디케이터
 * - 금액 마스킹 토글 버튼
 */
export default function MobileHeader() {
  const { isMasked, toggleMasking } = useMasking();
  const [isServerOnline, setIsServerOnline] = useState(true);

  // 간단한 온라인 상태 감지 (기본 온라인 상태 및 navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setIsServerOnline(true);
    const handleOffline = () => setIsServerOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100 px-4 py-3 flex items-center justify-between shadow-sm select-none">
      {/* 로고 & 타이틀 */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-inner">
          <span className="font-bold text-white text-base">A</span>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-white leading-tight">
            AssetManager
          </span>
          <span className="text-[10px] text-slate-400 font-medium leading-none">
            Mobile
          </span>
        </div>
      </div>

      {/* 우측 컨트롤 영역 (서버 상태 + 마스킹 토글) */}
      <div className="flex items-center gap-2">
        {/* 서버 상태 인디케이터 */}
        <div
          data-testid="server-status-indicator"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs"
          title={isServerOnline ? '서버 연결됨' : '네트워크 오프라인'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isServerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] text-slate-300 font-medium">
            {isServerOnline ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* 마스킹 토글 버튼 */}
        <button
          type="button"
          onClick={toggleMasking}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          aria-label={isMasked ? '금액 마스킹 해제' : '금액 마스킹 적용'}
          title={isMasked ? '금액 마스킹 해제' : '금액 마스킹 적용'}
        >
          {isMasked ? (
            <EyeOff data-testid="masking-icon-hidden" className="w-4 h-4 text-slate-400" />
          ) : (
            <Eye data-testid="masking-icon-visible" className="w-4 h-4 text-sky-400" />
          )}
        </button>
      </div>
    </header>
  );
}
