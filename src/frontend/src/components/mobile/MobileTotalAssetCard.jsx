import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 모바일 총 자산 요약 카드 컴포넌트
 * - 총 평가 자산
 * - 총 투자 원금
 * - 누적 평가 손익 및 수익률
 * - 원금/수익 비율 프로그레스 바
 * - USD/KRW 환율 정보
 *
 * @param {Object} props
 * @param {Object} props.data - 대시보드 요약 데이터
 */
export default function MobileTotalAssetCard({ data }) {
  const { maskValue } = useMasking();

  if (!data) return null;

  const {
    total_valuation_krw = 0,
    total_contribution = 0,
    initial_base_asset = 0,
    total_profit = 0,
    cumulative_roi = 0,
    contribution_ratio = 100,
    profit_ratio = 0,
    exchange_rate,
  } = data;

  const totalInvested = total_contribution + initial_base_asset;
  const isProfit = total_profit >= 0;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800/80 rounded-3xl p-5 shadow-lg relative overflow-hidden">
      {/* 백그라운드 발광 효과 */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 헤더 배지 & 환율 정보 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-bold">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>총 자산 요약</span>
        </div>

        {exchange_rate && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium bg-slate-800/50 px-2 py-0.5 rounded-lg border border-slate-700/40">
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span>USD:</span>
            <span className="text-slate-200 font-bold">
              {Number(exchange_rate.rate).toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-slate-400">원</span>
          </div>
        )}
      </div>

      {/* 총 평가 자산 */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-400 mb-1">총 평가 자산</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black tracking-tight text-white">
            {maskValue(Math.round(total_valuation_krw).toLocaleString())}
          </span>
          <span className="text-lg font-bold text-slate-300">원</span>
        </div>
      </div>

      {/* 원금 / 손익 / 수익률 그리드 */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80">
        <div>
          <span className="text-[11px] font-medium text-slate-400 block mb-0.5">투자 원금</span>
          <div className="text-sm font-bold text-slate-200 truncate">
            {maskValue(Math.round(totalInvested).toLocaleString())}
            <span className="text-[10px] text-slate-400 ml-0.5">원</span>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-400 block mb-0.5">평가 손익</span>
          <div
            className={`text-sm font-bold truncate flex items-center ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isProfit ? '+' : ''}
            {maskValue(Math.round(total_profit).toLocaleString())}
            <span className="text-[10px] text-slate-400 ml-0.5">원</span>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-400 block mb-0.5">수익률</span>
          <div
            className={`text-sm font-extrabold flex items-center gap-0.5 ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isProfit ? <TrendingUp className="w-3.5 h-3.5 inline" /> : <TrendingDown className="w-3.5 h-3.5 inline" />}
            <span>
              {isProfit ? '+' : ''}
              {Number(cumulative_roi).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* 투자 원금 대 수익 비율 바 */}
      <div className="mt-4">
        <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1">
          <span>원금 {contribution_ratio.toFixed(1)}%</span>
          <span>수익 {profit_ratio.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="bg-sky-500 h-full transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, contribution_ratio))}%` }}
          />
          <div
            className={`h-full transition-all duration-700 ${
              isProfit ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, Math.abs(profit_ratio)))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
