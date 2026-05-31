import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 일자별 포트폴리오 자산과 주요 지수(KOSPI, KOSDAQ, S&P 500, NASDAQ)의 수익률을 비교하는 표 컴포넌트입니다.
 * 페이지네이션(페이지당 10개 행)을 제공합니다.
 * 
 * Args:
 *     data (Array): 일자별 비교 데이터 배열 (date, assets, roi, kospi, kosdaq, sp500, nasdaq 포함)
 * 
 * Returns:
 *     JSX.Element: 일간 수익률 비교 표 섹션
 */
const DailyComparisonTable = ({ data }) => {
  const { maskValue } = useMasking();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!data || data.length === 0) return null;

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

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

  const getReturnBadgeClass = (val) => {
    if (val > 0) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (val < 0) return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const renderReturnCell = (val) => {
    const isPositive = val > 0;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${getReturnBadgeClass(val)}`}>
        {isPositive ? '+' : ''}{val.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Calendar className="text-blue-600" size={28} />
            일간 수익률 비교
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
            스냅샷 기록이 발생한 일자별 자산 평가액 및 지수 대비 일간 성과 지표입니다.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
          Daily Index Comparison
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">날짜</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">내 자산 (평가액)</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">내 수익률</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSPI</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSDAQ</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">S&P 500</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">NASDAQ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((item) => {
                const isPositiveProfit = item.roi >= 0;
                return (
                  <tr key={item.date} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-slate-100 text-slate-900 font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        {item.date}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₩ {maskValue(Math.round(item.assets).toLocaleString())}
                    </td>
                    <td className="px-6 py-4 text-center font-bold">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${
                          isPositiveProfit 
                          ? 'bg-blue-50 text-blue-700 border-blue-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {isPositiveProfit ? '+' : ''}{item.roi.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {renderReturnCell(item.kospi)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {renderReturnCell(item.kosdaq)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {renderReturnCell(item.sp500)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {renderReturnCell(item.nasdaq)}
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
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                <Info size={14} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">내 수익률</span>은 <span className="text-slate-900 font-bold">수익 / (기초 자산 + 해당 일자 추가액)</span> 공식을 기준으로 산출되었습니다. 
                기초 데이터는 계좌별 당일 스냅샷에 기록된 평가액과 추가액 합산치를 기준으로 연산합니다.
              </p>
            </div>
            <div className="flex items-start gap-3 pl-8">
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">지수 수익률</span>은 포트폴리오의 일간 성과와 동일한 기준으로 비교하기 위해 **직전 스냅샷 날짜 대비 현재 스냅샷 날짜의 종가 변동률**로 산출되었습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyComparisonTable;
