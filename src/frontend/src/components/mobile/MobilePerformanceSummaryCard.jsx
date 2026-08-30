import { Award, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 모바일 연간 및 누적 수익률 성과 요약 카드
 * - 누적 ROI 및 총 누적수익 헤더
 * - 연도별 성과 리스트 (연도, 수익률, 수익금액, 자산평가액)
 * - 마스킹(***) 연동
 *
 * @param {Object} props
 * @param {Object} props.data - 대시보드 성과 데이터 (cumulative_roi, total_profit, yearly 등)
 */
export default function MobilePerformanceSummaryCard({ data }) {
  const { maskValue } = useMasking();

  if (!data) return null;

  const { cumulative_roi = 0, total_profit = 0, yearly = [] } = data;
  const isCumulativeProfit = total_profit >= 0;

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

      {/* 연도별 성과 리스트 */}
      {yearly && yearly.length > 0 ? (
        <div className="space-y-2.5">
          {yearly.map((item) => {
            const isProfit = (item.profit ?? item.roi) >= 0;
            return (
              <div
                key={item.year}
                className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3 flex items-center justify-between transition-colors hover:bg-slate-800/70"
              >
                {/* 연도 & 배지 */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                    {item.year}
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
                    {Number(item.roi).toFixed(2)}%
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
          연도별 성과 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
