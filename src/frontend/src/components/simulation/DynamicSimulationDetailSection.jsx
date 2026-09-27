import React, { useState, useMemo } from 'react';
import { formatWithCommas } from '../../utils/formatters';

// 동적 시뮬레이션 전략명 상수 정의 (Primitive Obsession 방지)
export const STRATEGY_NAMES = {
  DYNAMIC: '동적 리밸런싱 전략',
  REGULAR: '일반 정기 리밸런싱',
  BUY_AND_HOLD: 'S&P 500 단순 보유',
};

/**
 * 수익률 수치에 따른 공통 뱃지 컴포넌트 (Duplicated Code 방지)
 */
const ReturnBadge = ({ value, isBold = false }) => {
  if (value === undefined || value === null) return <span>-</span>;
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${
        isBold ? 'font-black' : 'font-bold'
      } ${isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}
    >
      {isPositive ? '+' : ''}{value}%
    </span>
  );
};

/**
 * 리밸런싱 이벤트 구분 전용 뱃지 컴포넌트
 */
const EventBadge = ({ eventType, eventCode, tier }) => {
  const isPanic = eventCode === 'PANIC_BUY' || (eventType && eventType.includes('공포'));
  const tierNum = tier || 1;
  const badgeClass = isPanic
    ? tierNum >= 2
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${badgeClass}`}>
      {eventType}
    </span>
  );
};

/**
 * 동적 리밸런싱 전용 상세 분석 및 이벤트 로그 컨테이너
 * - [이벤트 로그] / [연도별 현황] / [월별 현황] 탭 전환 제공
 * - 3개 벤치마크(동적 전략, 일반 정기, 단순 보유)의 다기간 성과 및 MDD 비교 테이블 지원
 */
const DynamicSimulationDetailSection = ({ apiData, dynamicMode, formatKRW }) => {
  const [dynamicDetailTab, setDynamicDetailTab] = useState('events'); // 'events' | 'yearly' | 'monthly'

  // 3개 벤치마크 연도별/월별 비교 데이터 가공
  const comparisonData = useMemo(() => {
    if (!apiData) return [];
    const statsKey = dynamicDetailTab === 'monthly' ? 'monthly_stats' : 'yearly_stats';
    const dynamicStats = apiData[statsKey]?.[STRATEGY_NAMES.DYNAMIC] || [];
    const regularStats = apiData[statsKey]?.[STRATEGY_NAMES.REGULAR] || [];
    const spStats = apiData[statsKey]?.[STRATEGY_NAMES.BUY_AND_HOLD] || [];

    return dynamicStats.map(dItem => {
      const rItem = regularStats.find(r =>
        dynamicDetailTab === 'monthly'
          ? (r.year === dItem.year && r.month === dItem.month)
          : r.year === dItem.year
      );
      const sItem = spStats.find(s =>
        dynamicDetailTab === 'monthly'
          ? (s.year === dItem.year && s.month === dItem.month)
          : s.year === dItem.year
      );

      return {
        year: dItem.year,
        month: dItem.month,
        dynamic: dItem,
        regular: rItem || {},
        sp500: sItem || {},
      };
    });
  }, [apiData, dynamicDetailTab]);

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
      {/* 탭 네비게이션 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-slate-700 text-xs font-black">동적 시뮬레이션 상세 분석</span>
          <span className="text-[11px] text-slate-400 font-medium">
            {dynamicDetailTab === 'events' && '공포 지표 충족 시점의 비중 확대 및 월말 복귀 이력'}
            {dynamicDetailTab === 'yearly' && '3개 벤치마크의 연도별 성과 및 최대 낙폭 비교'}
            {dynamicDetailTab === 'monthly' && '3개 벤치마크의 월별 성과 및 최대 낙폭 비교'}
          </span>
        </div>

        {/* [이벤트 로그] / [연도별 현황] / [월별 현황] 3개 탭 버튼 */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setDynamicDetailTab('events')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              dynamicDetailTab === 'events'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            이벤트 로그
          </button>
          <button
            onClick={() => setDynamicDetailTab('yearly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              dynamicDetailTab === 'yearly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            연도별 현황
          </button>
          <button
            onClick={() => setDynamicDetailTab('monthly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
              dynamicDetailTab === 'monthly'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            월별 현황
          </button>
        </div>
      </div>

      {/* 탭별 컨텐츠 */}
      {dynamicDetailTab === 'events' ? (
        /* 1) 리밸런싱 이벤트 로그 테이블 */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-4 py-3.5 text-center border-r border-slate-100">일자</th>
                <th className="px-4 py-3.5 text-center border-r border-slate-100">이벤트 구분</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-100">S&P 500 종가</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-100">고점 대비 낙폭</th>
                <th className="px-4 py-3.5 text-right border-r border-slate-100">VIX 지수</th>
                <th className="px-4 py-3.5 text-center">주식 비중 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {apiData?.rebalancing_events && apiData.rebalancing_events.length > 0 ? (
                apiData.rebalancing_events.map((event, idx) => {
                  const isPanic = event.event_code === 'PANIC_BUY' || (event.event_type && event.event_type.includes('공포'));
                  return (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors font-mono">
                      <td className="px-4 py-3.5 text-center font-bold text-slate-700 border-r border-slate-100">
                        {event.date}
                      </td>
                      <td className="px-4 py-3.5 text-center border-r border-slate-100 font-sans">
                        <EventBadge
                          eventType={event.event_type}
                          eventCode={event.event_code}
                          tier={event.tier}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-800 font-bold border-r border-slate-100">
                        {formatWithCommas(Math.round(event.sp500_price))} pt
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-rose-600 border-r border-slate-100">
                        {event.drawdown > 0 ? `+${event.drawdown}%` : `${event.drawdown}%`}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-700 font-bold border-r border-slate-100">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-slate-700 text-[11px]">
                          {event.vix}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-black">
                        <span className="text-slate-500">{event.old_stock_ratio}%</span>
                        <span className="mx-1.5 text-blue-600">→</span>
                        <span className={isPanic ? 'text-rose-600' : 'text-blue-700'}>
                          {event.new_stock_ratio}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-xs text-slate-400 font-bold">
                    시뮬레이션 기간 동안 발생한 리밸런싱 이벤트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* 2) 3개 벤치마크 연도별/월별 비교 테이블 */
        <div className="overflow-x-auto">
          {dynamicMode === 'recurring' ? (
            /* 적립식 비교 테이블 */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th rowSpan="2" className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-r border-slate-100">
                    {dynamicDetailTab === 'yearly' ? '연도' : '연월'}
                  </th>
                  <th colSpan="3" className="px-4 py-2 text-[11px] font-black text-blue-600 text-center border-b border-slate-100 border-r border-slate-100 bg-blue-50/20">
                    {STRATEGY_NAMES.DYNAMIC}
                  </th>
                  <th colSpan="3" className="px-4 py-2 text-[11px] font-black text-emerald-600 text-center border-b border-slate-100 border-r border-slate-100 bg-emerald-50/20">
                    {STRATEGY_NAMES.REGULAR}
                  </th>
                  <th colSpan="3" className="px-4 py-2 text-[11px] font-black text-amber-600 text-center border-b border-slate-100 bg-amber-50/20">
                    {STRATEGY_NAMES.BUY_AND_HOLD}
                  </th>
                </tr>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[9px] font-black text-slate-400">
                  <th className="px-3 py-2 text-right border-r border-slate-100">기말 자산</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">MDD</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">기말 자산</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">MDD</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">기말 자산</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">수익률</th>
                  <th className="px-3 py-2 text-right">MDD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {comparisonData.map((row, idx) => {
                  const dRet = dynamicDetailTab === 'yearly' ? row.dynamic.year_return : row.dynamic.month_return;
                  const rRet = dynamicDetailTab === 'yearly' ? row.regular.year_return : row.regular.month_return;
                  const sRet = dynamicDetailTab === 'yearly' ? row.sp500.year_return : row.sp500.month_return;
                  return (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors font-mono">
                      <td className="px-4 py-3.5 text-center font-black text-slate-700 border-r border-slate-100">
                        {dynamicDetailTab === 'yearly' ? `${row.year}년` : `${row.year}년 ${row.month}월`}
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-slate-800 border-r border-slate-100">
                        {formatKRW(row.dynamic.valuation || 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right border-r border-slate-100">
                        <ReturnBadge value={dRet} isBold={true} />
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-rose-500 border-r border-slate-100">
                        {row.dynamic.mdd}%
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-700 border-r border-slate-100">
                        {formatKRW(row.regular.valuation || 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right border-r border-slate-100">
                        <ReturnBadge value={rRet} />
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-rose-500 border-r border-slate-100">
                        {row.regular.mdd}%
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-700 border-r border-slate-100">
                        {formatKRW(row.sp500.valuation || 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right border-r border-slate-100">
                        <ReturnBadge value={sRet} />
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-rose-500">
                        {row.sp500.mdd}%
                      </td>
                    </tr>
                  );
                })}
                {comparisonData.length === 0 && (
                  <tr>
                    <td colSpan="10" className="text-center py-8 text-xs text-slate-400 font-bold">
                      해당하는 통계 데이터가 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* 거치식 비교 테이블 */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th rowSpan="2" className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center border-r border-slate-100">
                    {dynamicDetailTab === 'yearly' ? '연도' : '연월'}
                  </th>
                  <th colSpan="3" className="px-4 py-2 text-[11px] font-black text-blue-600 text-center border-b border-slate-100 border-r border-slate-100 bg-blue-50/20">
                    {STRATEGY_NAMES.DYNAMIC}
                  </th>
                  <th colSpan="3" className="px-4 py-2 text-[11px] font-black text-emerald-600 text-center border-b border-slate-100 border-r border-slate-100 bg-emerald-50/20">
                    {STRATEGY_NAMES.REGULAR}
                  </th>
                  <th colSpan="3" className="px-4 py-2 text-[11px] font-black text-amber-600 text-center border-b border-slate-100 bg-amber-50/20">
                    {STRATEGY_NAMES.BUY_AND_HOLD}
                  </th>
                </tr>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[9px] font-black text-slate-400">
                  <th className="px-3 py-2 text-right border-r border-slate-100">기간 수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">누적 수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">MDD</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">기간 수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">누적 수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">MDD</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">기간 수익률</th>
                  <th className="px-3 py-2 text-right border-r border-slate-100">누적 수익률</th>
                  <th className="px-3 py-2 text-right">MDD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {comparisonData.map((row, idx) => {
                  const dRet = dynamicDetailTab === 'yearly' ? row.dynamic.year_return : row.dynamic.month_return;
                  const rRet = dynamicDetailTab === 'yearly' ? row.regular.year_return : row.regular.month_return;
                  const sRet = dynamicDetailTab === 'yearly' ? row.sp500.year_return : row.sp500.month_return;
                  return (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors font-mono">
                      <td className="px-4 py-3.5 text-center font-black text-slate-700 border-r border-slate-100">
                        {dynamicDetailTab === 'yearly' ? `${row.year}년` : `${row.year}년 ${row.month}월`}
                      </td>
                      <td className="px-3 py-3.5 text-right border-r border-slate-100">
                        <ReturnBadge value={dRet} isBold={true} />
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-slate-700 border-r border-slate-100">
                        <span className={row.dynamic.cumulative_return >= 0 ? 'text-blue-600' : 'text-rose-500'}>
                          {row.dynamic.cumulative_return >= 0 ? '+' : ''}{row.dynamic.cumulative_return}%
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-rose-500 border-r border-slate-100">
                        {row.dynamic.mdd}%
                      </td>
                      <td className="px-3 py-3.5 text-right border-r border-slate-100">
                        <ReturnBadge value={rRet} />
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-slate-600 border-r border-slate-100">
                        <span className={row.regular.cumulative_return >= 0 ? 'text-slate-700' : 'text-rose-500'}>
                          {row.regular.cumulative_return >= 0 ? '+' : ''}{row.regular.cumulative_return}%
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-rose-500 border-r border-slate-100">
                        {row.regular.mdd}%
                      </td>
                      <td className="px-3 py-3.5 text-right border-r border-slate-100">
                        <ReturnBadge value={sRet} />
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-slate-600 border-r border-slate-100">
                        <span className={row.sp500.cumulative_return >= 0 ? 'text-slate-700' : 'text-rose-500'}>
                          {row.sp500.cumulative_return >= 0 ? '+' : ''}{row.sp500.cumulative_return}%
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-rose-500">
                        {row.sp500.mdd}%
                      </td>
                    </tr>
                  );
                })}
                {comparisonData.length === 0 && (
                  <tr>
                    <td colSpan="10" className="text-center py-8 text-xs text-slate-400 font-bold">
                      해당하는 통계 데이터가 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default DynamicSimulationDetailSection;
