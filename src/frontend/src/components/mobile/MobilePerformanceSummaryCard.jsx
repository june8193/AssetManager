import { useState } from 'react';
import { Award, TrendingDown, ArrowUpRight } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const TABS = [
  { key: 'yearly', label: '연도별' },
  { key: 'monthly', label: '월별' },
  { key: 'daily', label: '일별' },
];

/**
 * 기간별 날짜 배지 문자열 포맷팅
 * - yearly: YYYY (예: 2026)
 * - monthly: YY.MM (예: 26.05)
 * - daily: MM.DD (예: 05.15)
 *
 * @param {'yearly' | 'monthly' | 'daily'} period
 * @param {Object} item
 * @returns {string}
 */
function formatDateBadge(period, item) {
  if (period === 'yearly') {
    return String(item.year || item.date || '').slice(0, 4);
  }
  if (period === 'monthly') {
    const raw = String(item.month || item.date || item.year || '');
    const match = raw.match(/(?:(\d{4})|(\d{2}))[-./](\d{1,2})/);
    if (match) {
      const yy = match[1] ? match[1].slice(2) : match[2];
      const mm = match[3].padStart(2, '0');
      return `${yy}.${mm}`;
    }
    return raw;
  }
  if (period === 'daily') {
    const raw = String(item.date || item.day || '');
    const match = raw.match(/\d{4}[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}.${match[2].padStart(2, '0')}`;
    }
    const shortMatch = raw.match(/^(\d{1,2})[-./](\d{1,2})$/);
    if (shortMatch) {
      return `${shortMatch[1].padStart(2, '0')}.${shortMatch[2].padStart(2, '0')}`;
    }
    return raw;
  }
  return '';
}

/**
 * 모바일 연간/월간/일간 및 누적 수익률 성과 요약 카드
 * - 누적 ROI 및 총 누적수익 헤더
 * - [연도별 | 월별 | 일별] 세그먼트 탭 컨트롤
 * - 기간별 성과 리스트 (날짜 배지, 수익률, 수익금액, 자산평가액, 추가액)
 * - 마스킹(***) 연동
 *
 * @param {Object} props
 * @param {Object} props.data - 대시보드 성과 데이터 (cumulative_roi, total_profit, yearly, monthly, daily 등)
 */
export default function MobilePerformanceSummaryCard({ data }) {
  const { maskValue } = useMasking();
  const [activeTab, setActiveTab] = useState('yearly');

  if (!data) return null;

  const { cumulative_roi = 0, total_profit = 0, yearly = [], monthly = [], daily = [] } = data;
  const isCumulativeProfit = total_profit >= 0;

  const currentItems =
    activeTab === 'monthly' ? monthly : activeTab === 'daily' ? daily : yearly;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">성과 요약</h3>
            <span className="text-[10px] text-slate-400 font-medium">연간 및 누적 수익률</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block font-medium">누적 ROI</span>
          <span
            className={`text-sm font-extrabold flex items-center justify-end gap-0.5 ${
              isCumulativeProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isCumulativeProfit ? '+' : ''}
            {Number(cumulative_roi).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 세그먼트 탭 컨트롤 */}
      <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 mb-3 gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center ${
                isActive
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 성과 리스트 */}
      {currentItems && currentItems.length > 0 ? (
        <div className="space-y-2.5">
          {currentItems.map((item, index) => {
            const isProfit = (item.profit ?? item.roi) >= 0;
            const dateBadge = formatDateBadge(activeTab, item);
            const key = item.year || item.month || item.date || index;

            return (
              <div
                key={key}
                className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3 flex items-center justify-between transition-colors hover:bg-slate-800/70"
              >
                {/* 날짜 배지 & 평가액/추가액 */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                    {dateBadge}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      {maskValue(Math.round(item.assets || 0).toLocaleString())} 원
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      추가액: {maskValue(Math.round(item.contribution || 0).toLocaleString())} 원
                    </span>
                  </div>
                </div>

                {/* 수익금 & 수익률 */}
                <div className="text-right">
                  <span
                    className={`text-xs font-extrabold flex items-center justify-end gap-0.5 ${
                      isProfit ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isProfit ? '+' : ''}
                    {Number(item.roi || 0).toFixed(2)}%
                  </span>
                  <span
                    className={`text-[10px] font-medium block ${
                      isProfit ? 'text-emerald-400/80' : 'text-rose-400/80'
                    }`}
                  >
                    {isProfit ? '+' : ''}
                    {maskValue(Math.round(item.profit || 0).toLocaleString())} 원
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-500 font-medium">
          해당 기간 성과 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}

