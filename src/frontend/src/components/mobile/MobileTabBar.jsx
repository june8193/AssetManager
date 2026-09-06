import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, TrendingUp, PieChart, Settings } from 'lucide-react';

/**
 * 모바일 하단 5대 탭 바 컴포넌트
 * 1. 대시보드 (/)
 * 2. 자산 조회 (/m/assets)
 * 3. 지수분석 (/m/market)
 * 4. 비중 점검 (/m/ratios)
 * 5. 설정 (/m/settings)
 */
export default function MobileTabBar() {
  const location = useLocation();
  const pathname = location.pathname;

  const tabs = [
    {
      name: '대시보드',
      path: '/',
      icon: LayoutDashboard,
      isActive: pathname === '/' || pathname === '/dashboard' || pathname === '/m/dashboard',
    },
    {
      name: '자산 조회',
      path: '/m/assets',
      icon: Wallet,
      isActive: pathname.startsWith('/m/assets'),
    },
    {
      name: '지수분석',
      path: '/m/market',
      icon: TrendingUp,
      isActive: pathname.startsWith('/m/market'),
    },
    {
      name: '비중 점검',
      path: '/m/ratios',
      icon: PieChart,
      isActive: pathname.startsWith('/m/ratios'),
    },
    {
      name: '설정',
      path: '/m/settings',
      icon: Settings,
      isActive: pathname.startsWith('/m/settings'),
    },
  ];

  return (
    <nav
      aria-label="모바일 하단 메뉴"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 text-slate-400 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive;

          return (
            <Link
              key={tab.name}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              data-active={active ? 'true' : 'false'}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-xl transition-all duration-200 ${
                active
                  ? 'text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  active ? 'scale-110 bg-sky-500/10' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
