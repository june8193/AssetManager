import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Database, PlusCircle } from 'lucide-react';

const Navbar = ({ isConnected }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Activity className="text-blue-600 mb-0.5" size={24} />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 font-headline tracking-tight">
              AssetManager
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            <Link 
              to="/watchlist/kr" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/watchlist/kr') || isActive('/')
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard size={18} />
              관심종목(국내)
            </Link>
            <Link 
              to="/watchlist/us" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/watchlist/us') 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard size={18} />
              관심종목(미국)
            </Link>
            <Link 
              to="/connection" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/connection') 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Database size={18} />
              API 연결 관리
            </Link>
            <Link 
              to="/input" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/input') 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <PlusCircle size={18} />
              정보 입력
            </Link>
          </div>
        </div>

        <div className="flex items-center text-sm">
          {isConnected ? (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-2 font-medium border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              실시간 연동 중
            </span>
          ) : (
            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full flex items-center gap-2 font-medium border border-red-100">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              연결 끊김
            </span>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
