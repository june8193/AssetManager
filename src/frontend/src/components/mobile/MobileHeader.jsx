import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, RefreshCw, Settings, ChevronLeft } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';
import { useMobileHeader } from '../../contexts/MobileHeaderContext';

/**
 * 모바일 최상단 단일 헤더 컴포넌트 (클린 라이트 톤)
 * - 좌측: 현재 페이지 타이틀 (설정 화면 진입 시 뒤로가기 버튼 포함)
 * - 우측: 금액 마스킹 토글, 새로고침(연동된 경우), 환경 설정 아이콘 버튼
 */
export default function MobileHeader() {
  const { isMasked, toggleMasking } = useMasking();
  const { title, onRefresh, isRefreshing } = useMobileHeader();
  const location = useLocation();
  const navigate = useNavigate();

  const isSettingsPage = location.pathname.startsWith('/m/settings');

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E8EB] text-[#191F28] px-4 h-14 flex items-center justify-between select-none">
      {/* 좌측: 페이지 타이틀 (+ 설정 페이지 뒤로가기) */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isSettingsPage && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로 가기"
            className="w-8 h-8 -ml-1.5 rounded-full flex items-center justify-center text-[#4E5968] hover:bg-[#F2F4F6] active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-[17px] font-bold tracking-tight text-[#191F28] truncate">
          {title}
        </h1>
      </div>

      {/* 우측 컨트롤 영역 (마스킹 토글 + 새로고침 + 환경 설정) */}
      <div className="flex items-center gap-1">
        {/* 마스킹 토글 버튼 */}
        <button
          type="button"
          onClick={toggleMasking}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#3182F6]/30 ${
            isMasked
              ? 'bg-[#E8F3FF] text-[#3182F6]'
              : 'text-[#4E5968] hover:bg-[#F2F4F6]'
          }`}
          aria-label={isMasked ? '금액 마스킹 해제' : '금액 마스킹 적용'}
          title={isMasked ? '금액 마스킹 해제' : '금액 마스킹 적용'}
        >
          {isMasked ? (
            <EyeOff data-testid="masking-icon-hidden" className="w-[18px] h-[18px]" />
          ) : (
            <Eye data-testid="masking-icon-visible" className="w-[18px] h-[18px]" />
          )}
        </button>

        {/* 페이지 새로고침 버튼 (활성 페이지에 핸들러가 등록된 경우 표시) */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="새로고침"
            title="새로고침"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#4E5968] hover:bg-[#F2F4F6] active:scale-95 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3182F6]/30"
          >
            <RefreshCw
              className={`w-[18px] h-[18px] ${
                isRefreshing ? 'animate-spin text-[#3182F6]' : ''
              }`}
            />
          </button>
        )}

        {/* 환경 설정 이동 링크 */}
        <Link
          to="/m/settings"
          aria-label="환경 설정"
          title="환경 설정"
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#3182F6]/30 ${
            isSettingsPage
              ? 'bg-[#E8F3FF] text-[#3182F6]'
              : 'text-[#4E5968] hover:bg-[#F2F4F6]'
          }`}
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>
      </div>
    </header>
  );
}
