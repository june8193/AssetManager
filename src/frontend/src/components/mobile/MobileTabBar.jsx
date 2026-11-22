import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, Receipt, TrendingUp, PieChart } from 'lucide-react';
import { MOBILE_TABS, isMobileTabActive } from '../../contexts/MobileHeaderContext';

const TAB_ICONS = {
  '/': LayoutDashboard,
  '/m/assets': Wallet,
  '/m/expenses': Receipt,
  '/m/market': TrendingUp,
  '/m/ratios': PieChart,
};

/**
 * 모바일 하단 5대 핵심 탭 바 컴포넌트 (클린 라이트 톤)
 */
export default function MobileTabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="모바일 하단 메뉴"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E8EB] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {MOBILE_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.path] || LayoutDashboard;
          const active = isMobileTabActive(tab, pathname);

          return (
            <Link
              key={tab.name}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              data-active={active ? 'true' : 'false'}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-colors duration-150 min-w-0 ${
                active
                  ? 'text-[#191F28] font-semibold'
                  : 'text-[#8B95A1] hover:text-[#4E5968] font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
              <span className="text-[11px] mt-1 tracking-tight whitespace-nowrap text-center truncate">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
