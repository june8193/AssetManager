import { useMasking } from '../../contexts/MaskingContext';

/**
 * 모바일 총 자산 요약 카드 컴포넌트 (클린 라이트 톤)
 * - 총 평가 자산, USD/KRW 환율 정보
 * - 투자 원금, 평가 손익, 수익률 (한국 증권앱 기준: 상승 빨강 / 하락 파랑)
 * - 원금/수익 비율 슬림 바
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
    <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5">
      {/* 상단 라벨 & 환율 */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-[#8B95A1]">총 평가 자산</span>

        {exchange_rate && (
          <span className="text-[11px] font-medium text-[#8B95A1] tabular-nums">
            USD{' '}
            <strong className="font-semibold text-[#4E5968]">
              {Number(exchange_rate.rate).toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              })}
            </strong>
            원
          </span>
        )}
      </div>

      {/* 총 평가 자산 히어로 숫자 */}
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-[28px] font-bold tracking-tight text-[#191F28] tabular-nums leading-tight">
          {maskValue(Math.round(total_valuation_krw).toLocaleString())}
        </span>
        <span className="text-base font-semibold text-[#4E5968]">원</span>
      </div>

      {/* 손익 배지 */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
            isProfit
              ? 'bg-[#FFF0F1] text-[#F04452]'
              : 'bg-[#E8F3FF] text-[#3182F6]'
          }`}
        >
          {isProfit ? '+' : ''}
          {maskValue(Math.round(total_profit).toLocaleString())}원 ({isProfit ? '+' : ''}
          {Number(cumulative_roi).toFixed(2)}%)
        </span>
      </div>

      {/* 원금 / 손익 / 수익률 3열 요약 */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-[#F2F4F6] tabular-nums">
        <div>
          <span className="text-[11px] font-medium text-[#8B95A1] block mb-0.5">투자 원금</span>
          <div className="text-[13px] font-semibold text-[#191F28] truncate">
            {maskValue(Math.round(totalInvested).toLocaleString())}
            <span className="text-[11px] font-normal text-[#6B7684] ml-0.5">원</span>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium text-[#8B95A1] block mb-0.5">평가 손익</span>
          <div
            className={`text-[13px] font-semibold truncate ${
              isProfit ? 'text-[#F04452]' : 'text-[#3182F6]'
            }`}
          >
            {isProfit ? '+' : ''}
            {maskValue(Math.round(total_profit).toLocaleString())}
            <span className="text-[11px] font-normal ml-0.5">원</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-medium text-[#8B95A1] block mb-0.5">수익률</span>
          <div
            className={`text-[13px] font-bold ${
              isProfit ? 'text-[#F04452]' : 'text-[#3182F6]'
            }`}
          >
            {isProfit ? '+' : ''}
            {Number(cumulative_roi).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 투자 원금 대 수익 비율 슬림 바 */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-[#8B95A1] font-medium mb-1.5 tabular-nums">
          <span>원금 {contribution_ratio.toFixed(1)}%</span>
          <span>수익 {profit_ratio.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full bg-[#F2F4F6] rounded-full overflow-hidden flex">
          <div
            className="bg-[#3182F6] h-full transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, contribution_ratio))}%` }}
          />
          <div
            className={`h-full transition-all duration-700 ${
              isProfit ? 'bg-[#F04452]' : 'bg-[#93C5FD]'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, Math.abs(profit_ratio)))}%` }}
          />
        </div>
      </div>
    </section>
  );
}
