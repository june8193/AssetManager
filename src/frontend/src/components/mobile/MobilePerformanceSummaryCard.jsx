import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const ITEMS_PER_PAGE = 5;

const TABS = [
  { key: 'yearly', label: '연도별' },
  { key: 'monthly', label: '월별' },
  { key: 'daily', label: '일별' },
];

/**
 * 기간별 날짜 배지 문자열 포맷팅
 * - yearly: YYYY (예: 2026)
 * - monthly: YY.MM (예: 26.05)
 * - daily: YY.MM.DD (예: 26.05.15)
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
    const match = raw.match(/(?:(\d{4})|(\d{2}))[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) {
      const yy = match[1] ? match[1].slice(2) : match[2];
      const mm = match[3].padStart(2, '0');
      const dd = match[4].padStart(2, '0');
      return `${yy}.${mm}.${dd}`;
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
 * 모바일 연간/월간/일간 및 누적 수익률 성과 요약 카드 (클린 라이트 톤)
 * - 누적 ROI 헤더 및 [연도별 | 월별 | 일별] 세그먼트 탭 컨트롤
 * - 단일 흰색 카드 내 얇은 구분선 플랫 리스트 (한국 증권앱 기준: 상승 빨강 / 하락 파랑)
 * - 마스킹(***) 연동
 *
 * @param {Object} props
 * @param {Object} props.data - 대시보드 성과 데이터 (cumulative_roi, total_profit, yearly, monthly, daily 등)
 */
export default function MobilePerformanceSummaryCard({ data }) {
  const { maskValue } = useMasking();
  const [activeTab, setActiveTab] = useState('yearly');
  const [currentPage, setCurrentPage] = useState(1);

  if (!data) return null;

  const { cumulative_roi = 0, total_profit = 0, yearly = [], monthly = [], daily = [] } = data;
  const isCumulativeProfit = total_profit >= 0;

  const currentItems =
    activeTab === 'monthly' ? monthly : activeTab === 'daily' ? daily : yearly;

  const handleTabChange = (key) => {
    setActiveTab(key);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil((currentItems?.length || 0) / ITEMS_PER_PAGE);
  const paginatedItems = currentItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5">
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-[15px] font-bold text-[#191F28] leading-tight">성과 요약</h2>
          <span className="text-xs text-[#8B95A1] font-medium">연간 및 누적 수익률</span>
        </div>

        <div className="text-right tabular-nums">
          <span className="text-[11px] text-[#8B95A1] block font-medium">누적 ROI</span>
          <span
            className={`text-sm font-bold ${
              isCumulativeProfit ? 'text-[#F04452]' : 'text-[#3182F6]'
            }`}
          >
            {isCumulativeProfit ? '+' : ''}
            {Number(cumulative_roi).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 세그먼트 탭 컨트롤 */}
      <div className="flex bg-[#F2F4F6] p-1 rounded-xl mb-3 gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-all text-center ${
                isActive
                  ? 'bg-white text-[#191F28] font-semibold shadow-xs'
                  : 'text-[#6B7684] hover:text-[#191F28] font-medium'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 성과 플랫 리스트 */}
      {paginatedItems && paginatedItems.length > 0 ? (
        <div className="divide-y divide-[#F2F4F6]">
          {paginatedItems.map((item, index) => {
            const isProfit = (item.profit ?? item.roi) >= 0;
            const dateBadge = formatDateBadge(activeTab, item);
            const key = item.year || item.month || item.date || index;

            return (
              <div
                key={key}
                className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-2 tabular-nums"
              >
                {/* 날짜 & 평가액/추가액 */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="min-w-[54px] px-2 py-1 rounded-lg bg-[#F2F4F6] text-center font-semibold text-[#191F28] text-xs shrink-0">
                    {dateBadge}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold text-[#191F28] block truncate">
                      {maskValue(Math.round(item.assets || 0).toLocaleString())} 원
                    </span>
                    <span className="text-[11px] text-[#8B95A1] font-medium block truncate">
                      추가액 {maskValue(Math.round(item.contribution || 0).toLocaleString())} 원
                    </span>
                  </div>
                </div>

                {/* 수익률 & 수익금 */}
                <div className="text-right shrink-0">
                  <span
                    className={`text-[13px] font-bold block ${
                      isProfit ? 'text-[#F04452]' : 'text-[#3182F6]'
                    }`}
                  >
                    {isProfit ? '+' : ''}
                    {Number(item.roi || 0).toFixed(2)}%
                  </span>
                  <span
                    className={`text-[11px] font-medium block ${
                      isProfit ? 'text-[#F04452]/80' : 'text-[#3182F6]/80'
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
        <div className="py-6 text-center text-xs text-[#8B95A1] font-medium">
          해당 기간 성과 데이터가 없습니다.
        </div>
      )}

      {/* 페이지네이션 컨트롤 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#F2F4F6] tabular-nums">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              currentPage === 1
                ? 'text-[#CBD5E1] cursor-not-allowed'
                : 'text-[#4E5968] hover:bg-[#F2F4F6]'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>이전</span>
          </button>

          <span className="text-xs font-semibold text-[#6B7684]">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              currentPage === totalPages
                ? 'text-[#CBD5E1] cursor-not-allowed'
                : 'text-[#4E5968] hover:bg-[#F2F4F6]'
            }`}
          >
            <span>다음</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
