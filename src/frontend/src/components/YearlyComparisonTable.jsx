import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, ArrowUpRight, Info } from 'lucide-react';
import { useMasking } from '../contexts/MaskingContext';

/**
 * 연도별 포트폴리오 자산과 주요 지수(KOSPI, KOSDAQ, S&P 500, NASDAQ)의 수익률을 비교하는 표 컴포넌트입니다.
 * 
 * Args:
 *     data (Array): 연도별 비교 데이터 배열 (year, assets, roi, kospi, kosdaq, sp500, nasdaq 포함)
 * 
 * Returns:
 *     JSX.Element: 연간 수익률 비교 표 섹션
 */
const YearlyComparisonTable = ({ data }) => {
  const { maskValue } = useMasking();
  if (!data || data.length === 0) return null;

  // 수익률 변화에 따른 텍스트 및 배지 스타일 반환 함수
  const getReturnBadgeClass = (val) => {
    if (val > 0) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (val < 0) return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const renderReturnCell = (val) => {
    const isPositive = val > 0;
    const isNegative = val < 0;
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
            <BarChart3 className="text-blue-600" size={28} />
            연간 수익률 비교
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
            연도별 포트폴리오의 평가 자산과 ROI, 그리고 시장 지수의 연간 성과 비교입니다.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
          Yearly Index Comparison
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">연도</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">내 자산 (평가액)</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">내 수익률</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSPI</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSDAQ</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">S&P 500</th>
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">NASDAQ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((item) => {
                const isPositiveProfit = item.roi >= 0;
                return (
                  <tr key={item.year} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-5 text-center">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-900 font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        {item.year}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900">
                      ₩ {maskValue(Math.round(item.assets).toLocaleString())}
                    </td>
                    <td className="px-6 py-5 text-center font-bold">
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
                    <td className="px-6 py-5 text-center">
                      {renderReturnCell(item.kospi)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {renderReturnCell(item.kosdaq)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {renderReturnCell(item.sp500)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {renderReturnCell(item.nasdaq)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                <Info size={14} />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">내 수익률(ROI)</span>은 <span className="text-slate-900 font-bold">수익 / (기초 자산 + 해당 연도 추가액)</span> 공식을 기준으로 산출되었습니다. 
                기초 데이터는 거래 내역과 연도별 평가 스냅샷을 기반으로 합니다.
              </p>
            </div>
            <div className="flex items-start gap-3 pl-8">
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">지수 수익률</span>은 포트폴리오 기록 기간과 관계없이 순수 달력 기준인 **해당 연도 1월 1일(혹은 첫 거래일) 대비 12월 31일(혹은 마지막 거래일)**의 종가 변동률로 산출되었습니다. 단, 진행 중인 올해는 연초 대비 현재 시점까지의 누적(YTD) 수익률을 적용합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearlyComparisonTable;
