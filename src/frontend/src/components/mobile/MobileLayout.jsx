import MobileHeader from './MobileHeader';
import MobileTabBar from './MobileTabBar';
import { MobileHeaderProvider } from '../../contexts/MobileHeaderContext';

/**
 * 모바일 전용 레이아웃 쉘 컴포넌트 (클린 라이트 미니멀)
 * - 상단: MobileHeader (페이지 타이틀, 마스킹, 새로고침, 설정)
 * - 중앙: 스크롤 본문 영역 (#F2F4F6)
 * - 하단: MobileTabBar (5대 핵심 탭)
 */
export default function MobileLayout({ children }) {
  return (
    <MobileHeaderProvider>
      <div className="flex flex-col h-screen w-full bg-[#F2F4F6] text-[#191F28] font-sans overflow-hidden select-none">
        {/* 상단 단일 헤더 */}
        <MobileHeader />

        {/* 중앙 스크롤 컨텐츠 영역 (하단 탭 바 높이 + 여유 공간 확보) */}
        <main className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-24 select-text">
          {children}
        </main>

        {/* 하단 5대 핵심 탭 바 */}
        <MobileTabBar />
      </div>
    </MobileHeaderProvider>
  );
}
