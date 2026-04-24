import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Database, Menu, ChevronLeft, Globe, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 메뉴 항목 정의
 */
const MENU_ITEMS = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/watchlist', label: '관심종목', icon: Activity },
  { path: '/db', label: 'DB 관리', icon: Database },
  { path: '/connection', label: 'API 연결 관리', icon: LinkIcon },
];

/**
 * 좌측 사이드바 컴포넌트
 * @param {Object} props - 컴포넌트 속성
 * @param {boolean} props.isConnected - 실시간 연결 상태
 */
const Sidebar = ({ isConnected }) => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();
  const { isMasked, toggleMasking } = useMasking();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    if (path === '/watchlist') {
      return location.pathname.startsWith('/watchlist');
    }
    return location.pathname === path;
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

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
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 font-headline tracking-tight">
              AssetManager
            </span>
          )}
        </Link>
      </div>

      {/* 메뉴 항목 */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              } ${!isOpen && 'justify-center'}`}
              title={!isOpen ? item.label : ''}
            >
              <Icon size={20} className="flex-shrink-0" />
              {isOpen && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
            </Link>
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

        {/* 연결 상태 표시 */}
        {isConnected ? (
          <div className={`flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium border border-emerald-100 ${!isOpen && 'justify-center'}`} title={!isOpen ? "실시간 연동 중" : ""}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
            {isOpen && <span className="whitespace-nowrap overflow-hidden text-ellipsis">실시간 연동 중</span>}
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 ${!isOpen && 'justify-center'}`} title={!isOpen ? "연결 끊김" : ""}>
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
            {isOpen && <span className="whitespace-nowrap overflow-hidden text-ellipsis">연결 끊김</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;