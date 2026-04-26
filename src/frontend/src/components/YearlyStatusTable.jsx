import React from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 연도별 자산 현황 및 수익률 정보를 테이블 형식으로 표시하는 컴포넌트입니다.
 * 
 * 각 연도별 추가 투자액(기여금), 실현/평가 수익, ROI(수익률), 
 * 기말 자산 평가액 및 전년 대비 자산 증가액을 보여줍니다.
 *
 * Args:
 *     data (Array): 연도별 데이터 배열 (year, contribution, profit, roi, assets, increase 포함)
 *     lastSnapshotDate (string): 데이터의 기준이 되는 최신 스냅샷 날짜 (YYYY-MM-DD 형식)
 *
 * Returns:
 *     JSX.Element: 연도별 현황 테이블 섹션
 */
const YearlyStatusTable = ({ data, lastSnapshotDate }) => {
  const { maskValue } = useMasking();
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <BarChart3 className="text-blue-600" size={28} />
            연도별 현황
          </h2>
          {lastSnapshotDate && (
            <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
              <Calendar size={12} className="text-slate-300" />
              최근 스냅샷 기준: <span className="text-slate-600 font-black">{lastSnapshotDate}</span>
            </p>
          )}
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
          Yearly Performance
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">연도</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">추가액</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">수익</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">수익률</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">자산</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">자산 증가액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((item, index) => {
                const isPositiveProfit = item.profit >= 0;
                const isPositiveIncrease = item.increase >= 0;
                
                return (
                  <tr key={item.year} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-5 text-center">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-900 font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        {item.year}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-medium text-slate-600">
                      ₩ {maskValue(Math.round(item.contribution).toLocaleString())}
                    </td>
                    <td className={`px-6 py-5 text-right font-bold ${isPositiveProfit ? 'text-emerald-600' : 'text-rose-500'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {isPositiveProfit ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />}
                        {isPositiveProfit ? '+' : ''}{maskValue(Math.round(item.profit).toLocaleString())}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${
                        isPositiveProfit 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {item.roi}%
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900">
                      ₩ {maskValue(Math.round(item.assets).toLocaleString())}
                    </td>
                    <td className={`px-6 py-5 text-right font-bold ${isPositiveIncrease ? 'text-blue-600' : 'text-slate-400'}`}>
                      {index === data.length - 1 ? '-' : (
                        <div className="flex items-center justify-end gap-1 text-sm">
                          {isPositiveIncrease ? '+' : ''}{maskValue(Math.round(item.increase).toLocaleString())}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingUp size={14} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              수익률은 <span className="text-slate-900 font-bold">수익 / (기초 자산 + 해당 연도 추가액)</span> 공식을 기준으로 산출되었습니다. 
              기초 데이터는 거래 내역과 연도별 평가 스냅샷을 기반으로 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearlyStatusTable;
