import React, { useState } from 'react';
import { Calendar, BarChart3, TrendingUp, TrendingDown, ArrowUpRight, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import useFormatters from '../hooks/useFormatters';

/**
 * 성과 분석 및 지수 비교를 위한 통합 테이블 컴포넌트입니다.
 * 
 * type('status' | 'comparison')과 period('yearly' | 'daily')의 조합으로
 * 4가지 테이블 렌더링 모드를 단일 컴포넌트에서 지원하며,
 * 일별 모드에서의 페이지네이션 및 마스킹 포맷팅을 캡슐화합니다.
 *
 * @param {Object} props
 * @param {'status' | 'comparison'} props.type - 테이블 종류 ('status': 자산 현황, 'comparison': 지수 비교)
 * @param {'yearly' | 'daily'} props.period - 기간 단위 ('yearly': 연도별, 'daily': 일자별)
 * @param {Array<Object>} props.data - 테이블에 표시할 데이터 배열
 * @param {string} [props.lastSnapshotDate] - 최신 스냅샷 기준일자 (연도별 현황 모드에서 표시)
 * @returns {JSX.Element|null}
 */
const PerformanceTable = ({
  type = 'status',
  period = 'yearly',
  data = [],
  lastSnapshotDate,
}) => {
  const { formatCurrency, formatPercent } = useFormatters();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!data || data.length === 0) return null;

  const isDaily = period === 'daily';
  const isComparison = type === 'comparison';

  // 페이지네이션 연산 (일별 모드일 때만 적용)
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentItems = isDaily ? data.slice(indexOfFirstItem, indexOfLastItem) : data;

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // 지수 수익률 배지 스타일
  const getReturnBadgeClass = (val) => {
    if (val > 0) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (val < 0) return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const renderReturnCell = (val) => {
    if (val === null || val === undefined) return <span className="text-slate-400">-</span>;
    const isPositive = val > 0;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${getReturnBadgeClass(val)}`}>
        {isPositive ? '+' : ''}{Number(val).toFixed(2)}%
      </span>
    );
  };

  // 헤더 타이틀 및 배지 설정
  const getHeaderConfig = () => {
    if (!isComparison && !isDaily) {
      return {
        title: '연도별 현황',
        badge: 'Yearly Performance',
        icon: <BarChart3 className="text-blue-600" size={28} />,
        subtitle: lastSnapshotDate ? (
          <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
            <Calendar size={12} className="text-slate-300" />
            최근 스냅샷 기준: <span className="text-slate-600 font-black">{lastSnapshotDate}</span>
          </p>
        ) : null,
      };
    }
    if (!isComparison && isDaily) {
      return {
        title: '일자별 현황',
        badge: 'Snapshot Performance',
        icon: <Calendar className="text-blue-600" size={28} />,
        subtitle: (
          <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
            스냅샷 기록이 발생한 모든 날짜별 자산 성과 지표입니다.
          </p>
        ),
      };
    }
    if (isComparison && !isDaily) {
      return {
        title: '연간 수익률 비교',
        badge: 'Yearly Index Comparison',
        icon: <BarChart3 className="text-blue-600" size={28} />,
        subtitle: (
          <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
            연도별 포트폴리오의 평가 자산과 ROI, 그리고 시장 지수의 연간 성과 비교입니다.
          </p>
        ),
      };
    }
    return {
      title: '일간 수익률 비교',
      badge: 'Daily Index Comparison',
      icon: <Calendar className="text-blue-600" size={28} />,
      subtitle: (
        <p className="text-[11px] font-bold text-slate-400 mt-1 ml-10 flex items-center gap-1">
          스냅샷 기록이 발생한 일자별 자산 평가액 및 지수 대비 일간 성과 지표입니다.
        </p>
      ),
    };
  };

  const headerConfig = getHeaderConfig();
  const firstItemKey = isDaily ? data[data.length - 1]?.date : null;

  return (
    <div className="mt-12 space-y-6">
      {/* 헤더 섹션 */}
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            {headerConfig.icon}
            {headerConfig.title}
          </h2>
          {headerConfig.subtitle}
        </div>
        <div className="flex items-center gap-3">
          {isDaily && (
            <div className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-xl">
              <label htmlFor="performance-table-pagesize" className="sr-only">페이지당 표시 개수</label>
              <select
                id="performance-table-pagesize"
                aria-label="페이지당 표시 개수"
                value={pageSize}
                onChange={handlePageSizeChange}
                className="bg-transparent border-none text-xs font-black text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={10}>10개씩</option>
                <option value={20}>20개씩</option>
                <option value={30}>30개씩</option>
              </select>
            </div>
          )}
          <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {headerConfig.badge}
          </div>
        </div>
      </div>

      {/* 테이블 카드 래퍼 */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">
                  {isDaily ? '날짜' : '연도'}
                </th>
                {!isComparison ? (
                  <>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">추가액</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">수익</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">수익률</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">자산</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">자산 증가액</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">
                      내 자산 (평가액)
                    </th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">내 수익률</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSPI</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">KOSDAQ</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">S&P 500</th>
                    <th className="px-6 py-5 text-xs font-black text-slate-500 uppercase tracking-widest text-center">NASDAQ</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.map((item, index) => {
                const isPositiveProfit = (item.profit ?? item.roi) >= 0;
                const isPositiveIncrease = item.increase >= 0;
                const key = item.date || item.year;
                const isLastItem = isDaily
                  ? item.date === firstItemKey
                  : index === data.length - 1;

                return (
                  <tr key={key} className="group hover:bg-blue-50/30 transition-colors">
                    {/* 기간(연도/날짜) 컬럼 */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm ${
                        isDaily 
                          ? 'px-3 py-1.5 rounded-xl bg-slate-100 text-slate-900 text-xs' 
                          : 'w-12 h-12 rounded-2xl bg-slate-100 text-slate-900 font-black text-sm'
                      }`}>
                        {key}
                      </span>
                    </td>

                    {/* Status 모드 컬럼들 */}
                    {!isComparison && (
                      <>
                        <td className="px-6 py-4 text-right font-medium text-slate-600">
                          {formatCurrency(item.contribution)}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${isPositiveProfit ? 'text-emerald-600' : 'text-rose-500'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {isPositiveProfit ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />}
                            {formatCurrency(item.profit, { unit: '', showSign: true })}
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
                          {formatCurrency(item.assets)}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${isPositiveIncrease ? 'text-blue-600' : 'text-slate-400'}`}>
                          {isLastItem ? '-' : (
                            <div className="flex items-center justify-end gap-1 text-sm">
                              {formatCurrency(item.increase, { unit: '', showSign: true })}
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* Comparison 모드 컬럼들 */}
                    {isComparison && (
                      <>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          {formatCurrency(item.assets)}
                        </td>
                        <td className="px-6 py-4 text-center font-bold">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${
                              item.roi >= 0 
                                ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {item.roi >= 0 ? '+' : ''}{Number(item.roi).toFixed(2)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">{renderReturnCell(item.kospi)}</td>
                        <td className="px-6 py-4 text-center">{renderReturnCell(item.kosdaq)}</td>
                        <td className="px-6 py-4 text-center">{renderReturnCell(item.sp500)}</td>
                        <td className="px-6 py-4 text-center">{renderReturnCell(item.nasdaq)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 컨트롤 (일별 모드 && 총 페이지 > 1) */}
        {isDaily && totalPages > 1 && (
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

        {/* 하단 설명 가이드 영역 */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                {!isComparison ? <TrendingUp size={14} /> : <Info size={14} />}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">
                  {!isComparison ? (isDaily ? '일자별 수익률' : '수익률') : (!isDaily ? '내 수익률(ROI)' : '내 수익률')}
                </span>
                은 <span className="text-slate-900 font-bold">수익 / (기초 자산 + 해당 {isDaily ? '일자' : '연도'} 추가액)</span> 공식을 기준으로 산출되었습니다.{' '}
                {isDaily 
                  ? '기초 데이터는 계좌별 당일 스냅샷에 기록된 평가액과 추가액 합산치를 기준으로 연산합니다.'
                  : '기초 데이터는 거래 내역과 연도별 평가 스냅샷을 기반으로 합니다.'
                }
              </p>
            </div>
            {isComparison && (
              <div className="flex items-start gap-3 pl-8">
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  <span className="text-slate-900 font-bold">지수 수익률</span>은 {!isDaily 
                    ? '포트폴리오 기록 기간과 관계없이 순수 달력 기준인 **해당 연도 1월 1일(혹은 첫 거래일) 대비 12월 31일(혹은 마지막 거래일)**의 종가 변동률로 산출되었습니다. 단, 진행 중인 올해는 연초 대비 현재 시점까지의 누적(YTD) 수익률을 적용합니다.'
                    : '포트폴리오의 일간 성과와 동일한 기준으로 비교하기 위해 **직전 스냅샷 날짜 대비 현재 스냅샷 날짜의 종가 변동률**로 산출되었습니다.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTable;
