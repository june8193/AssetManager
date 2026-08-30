import MobileHeader from './MobileHeader';
import MobileTabBar from './MobileTabBar';

/**
 * 모바일 전용 레이아웃 쉘 컴포넌트
 * - 상단: MobileHeader (로고, 서버 상태, 마스킹 토글)
 * - 중앙: 스크롤 본문 영역
 * - 하단: MobileTabBar (4대 핵심 탭)
 */
export default function MobileLayout({ children }) {
  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* 상단 간소화 헤더 */}
      <MobileHeader />

      {/* 중앙 스크롤 컨텐츠 영역 (하단 탭 바 높이 64px + 여유 공간 확보) */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-24 select-text">
        {children}
      </main>

      {/* 하단 4대 탭 바 */}
      <MobileTabBar />
    </div>
  );
}
