import React from 'react';
import { Receipt, Clock } from 'lucide-react';

/**
 * 모바일 지출 관리 페이지 플레이스홀더 (`/m/expenses`)
 * 
 * 티켓 03에서 세부 KPI 요약, 다기간 분석 필터, 카테고리 비중 랭킹,
 * 및 카드형 거래 내역 목록이 구현될 예정입니다.
 */
export default function MobileExpensesPage() {
  return (
    <div className="space-y-4 pb-4">
      {/* 상단 타이틀 */}
      <div className="px-1">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-sky-400" />
          <span>지출 관리</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          월별 및 다기간 지출 내역과 소비 패턴을 분석합니다.
        </p>
      </div>

      {/* 스켈레톤 / 준비 중 안내 카드 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-base font-semibold text-slate-100 mb-1">
          지출 관리 화면 준비 중
        </h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
          모바일 전용 지출 요약 카드, 기간별 지출 추이 및 거래 내역 상세 기능이 곧 제공됩니다.
        </p>

        {/* 스켈레톤 플레이스홀더 UI */}
        <div className="mt-6 space-y-3">
          <div className="h-16 rounded-xl bg-slate-800/60 animate-pulse border border-slate-700/40" />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-20 rounded-xl bg-slate-800/40 animate-pulse border border-slate-700/30" />
            <div className="h-20 rounded-xl bg-slate-800/40 animate-pulse border border-slate-700/30" />
          </div>
          <div className="h-32 rounded-xl bg-slate-800/30 animate-pulse border border-slate-700/20" />
        </div>
      </div>
    </div>
  );
}
