import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Database, Menu, ChevronLeft, Link as LinkIcon, Eye, EyeOff, Calculator, ChevronDown, ChevronUp, TrendingUp, PieChart } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 메뉴 항목 정의
 */
const MENU_ITEMS = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { 
    label: '시장분석', 
    icon: TrendingUp,
    subItems: [
      { path: '/benchmark', label: '벤치마크 비교' },
      { path: '/benchmark/compare-returns', label: '수익률 비교 분석' },
      { path: '/market/analysis', label: '지수분석' },
      { path: '/market/stock-analysis', label: '종목분석' }
    ]
  },
  { path: '/ratios/check', label: '비중 점검', icon: PieChart },
  { 
    label: '시뮬레이션', 
    icon: Calculator,
    subItems: [
      { path: '/simulation/asset-allocation', label: '자산배분 시뮬레이션' },
      { path: '/simulation/compound-interest', label: '복리 계산기' }
    ]
  },
  { 
    label: 'DB 관리', 
    icon: Database,
    subItems: [
      { path: '/db', label: '마스터 관리' },
      { path: '/db/snapshots/new', label: '스냅샷 생성' },
      { path: '/db/watchlist-sector', label: '관심종목/섹터 관리' }
    ]
  },
  { path: '/connection', label: 'API 연결 관리', icon: LinkIcon },
];

/**
 * 좌측 사이드바 컴포넌트
 */
const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({});
  const location = useLocation();
  const { isMasked, toggleMasking } = useMasking();

  const isActive = (path) => {
    if (!path) return false;
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }

    if (path === '/benchmark') {
      return location.pathname === '/benchmark';
    }
    return location.pathname === path;
  };

  const isParentActive = (item) => {
    if (item.path) return isActive(item.path);
    if (item.subItems) {
      return item.subItems.some(subItem => isActive(subItem.path));
    }
    return false;
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  const toggleMenu = (label) => {
    if (!isOpen) {
      setIsOpen(true);
      setOpenMenus(prev => ({ ...prev, [label]: true }));
      return;
    }
    setOpenMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  return (
    <div className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'} relative z-50`}>
      {/* 토글 버튼 */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-500 hover:text-blue-600 shadow-sm z-50 flex items-center justify-center transition-colors"
        aria-label={isOpen ? "사이드바 접기" : "사이드바 펼치기"}
      >
        {isOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
      </button>

      {/* 로고 영역 */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 overflow-hidden">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity whitespace-nowrap">
          <Activity className="text-blue-600 flex-shrink-0" size={24} />
          {isOpen && (
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 font-headline tracking-tight">
                AssetManager
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded-md font-mono self-center">
                v{import.meta.env.VITE_APP_VERSION || '0.0.0'}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* 메뉴 항목 */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const active = isParentActive(item);
          const isExpanded = openMenus[item.label];
          
          return (
            <React.Fragment key={item.label}>
              {hasSubItems ? (
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full text-left ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                  } ${!isOpen && 'justify-center'}`}
                  title={!isOpen ? item.label : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {isOpen && (
                    <>
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis flex-1">{item.label}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </>
                  )}
                </button>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                  } ${!isOpen && 'justify-center'}`}
                  title={!isOpen ? item.label : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {isOpen && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
                </Link>
              )}

              {/* 하위 메뉴 */}
              {isOpen && hasSubItems && isExpanded && (
                <div className="flex flex-col gap-1 ml-4 border-l border-slate-100 pl-2">
                  {item.subItems.map((subItem) => (
                    <Link
                      key={subItem.path}
                      to={subItem.path}
                      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isActive(subItem.path) ? 'text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{subItem.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 하단 설정 영역 */}
      <div className="p-4 border-t border-slate-200 flex flex-col gap-2">
        {/* 모자이크 모드 토글 */}
        <button
          onClick={toggleMasking}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isMasked ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'
          } ${!isOpen && 'justify-center'}`}
          title={!isOpen ? (isMasked ? "모자이크 해제" : "모자이크 설정") : ""}
        >
          {isMasked ? <EyeOff size={20} className="flex-shrink-0" /> : <Eye size={20} className="flex-shrink-0" />}
          {isOpen && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{isMasked ? "모자이크 해제" : "모자이크 설정"}</span>}
        </button>

      </div>
    </div>
  );
};

export default Sidebar;