import React, { useState } from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 일자별 자산 현황 및 수익률 정보를 페이지네이션이 포함된 테이블 형식으로 표시하는 컴포넌트입니다.
 * 
 * 각 일자(스냅샷 날짜)별 추가 투자액(기여금), 실현/평가 수익, ROI(수익률), 
 * 자산 평가액 및 직전 스냅샷 대비 자산 증가액을 보여줍니다.
 *
 * Args:
 *     data (Array): 일자별 데이터 배열 (date, contribution, profit, roi, assets, increase 포함)
 *
 * Returns:
 *     JSX.Element: 일자별 현황 테이블 섹션
 */
const DailyStatusTable = ({ data }) => {
  const { maskValue } = useMasking();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!data || data.length === 0) return null;

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 현재 페이지의 데이터 슬라이싱
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // 최초 날짜(가장 과거 날짜)인지 판단하기 위한 기준
  const firstSnapshotDate = data[data.length - 1]?.date;

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Calendar className="text-blue-600" size={28} />
            일자별 현황
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
            스냅샷 기록이 발생한 모든 날짜별 자산 성과 지표입니다.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
          Snapshot Performance
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">날짜</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">추가액</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">수익</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">수익률</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">자산</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">자산 증가액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((item) => {
                const isPositiveProfit = item.profit >= 0;
                const isPositiveIncrease = item.increase >= 0;
                const isFirstSnapshot = item.date === firstSnapshotDate;
                
                return (
                  <tr key={item.date} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-slate-100 text-slate-900 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        {item.date}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                      ₩ {maskValue(Math.round(item.contribution).toLocaleString())}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${isPositiveProfit ? 'text-emerald-600' : 'text-rose-500'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {isPositiveProfit ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />}
                        {isPositiveProfit ? '+' : ''}{maskValue(Math.round(item.profit).toLocaleString())}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${
                        isPositiveProfit 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {item.roi}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₩ {maskValue(Math.round(item.assets).toLocaleString())}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${isPositiveIncrease ? 'text-blue-600' : 'text-slate-400'}`}>
                      {isFirstSnapshot ? '-' : (
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="py-4 border-t border-slate-100 flex items-center justify-center gap-4 bg-slate-50/50">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl transition-all ${
                currentPage === 1 
                  ? 'text-slate-300 cursor-not-allowed' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              aria-label="이전 페이지"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isSelected = page === currentPage;
                // 현재 페이지 주변 몇 개만 렌더링하도록 생략 기호 처리할 수도 있지만,
                // 총 7개 페이지 정도이므로 직접 모두 렌더링해도 무방함.
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-xl transition-all ${
                currentPage === totalPages 
                  ? 'text-slate-300 cursor-not-allowed' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              aria-label="다음 페이지"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <TrendingUp size={14} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              일자별 수익률은 <span className="text-slate-900 font-bold">수익 / (기초 자산 + 해당 일자 추가액)</span> 공식을 기준으로 산출되었습니다. 
              기초 데이터는 계좌별 당일 스냅샷에 기록된 평가액과 추가액 합산치를 기준으로 연산합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyStatusTable;
