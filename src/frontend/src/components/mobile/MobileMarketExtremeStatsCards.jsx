import { useMemo } from 'react';

/**
 * 차트 시계열 데이터로부터 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥)을 산출합니다.
 *
 * @param {Array<{ date: string, value: number, mdd: number, vix: number }>} chartData
 * @returns {{ maxVix: object|null, worstMdd: object|null } | null}
 */
export function calculateExtremeStats(chartData) {
  if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
    return null;
  }

  let maxVixItem = null;
  let worstMddItem = null;

  for (const item of chartData) {
    if (!item) continue;

    if (item.vix !== null && item.vix !== undefined && !isNaN(item.vix)) {
      if (!maxVixItem || item.vix > maxVixItem.vix) {
        maxVixItem = item;
      }
    }

    if (item.mdd !== null && item.mdd !== undefined && !isNaN(item.mdd)) {
      if (!worstMddItem || item.mdd < worstMddItem.mdd) {
        worstMddItem = item;
      }
    }
  }

  if (!maxVixItem && !worstMddItem) {
    return null;
  }

  return {
    maxVix: maxVixItem,
    worstMdd: worstMddItem,
  };
}

/**
 * 개별 극단값 인사이트 카드 서브 컴포넌트 (클린 라이트 톤)
 */
function ExtremeStatCard({
  testId,
  title,
  date,
  primaryLabel,
  primaryValue,
  primaryValueClass,
  secondaryLabel,
  secondaryValue,
  secondaryValueClass,
  priceValue,
}) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-4 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#191F28]">{title}</span>
        {date && (
          <span className="text-[11px] font-medium text-[#6B7684] bg-[#F2F4F6] px-2 py-0.5 rounded-full tabular-nums">
            {date}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F2F4F6] tabular-nums">
        <div>
          <span className="text-[11px] font-medium text-[#8B95A1] block mb-0.5">{primaryLabel}</span>
          <span className={`text-sm font-bold ${primaryValueClass}`}>
            {primaryValue}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-medium text-[#8B95A1] block mb-0.5">
            {secondaryLabel}
          </span>
          <span className={`text-sm font-bold ${secondaryValueClass}`}>
            {secondaryValue}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-[#F2F4F6] text-[#8B95A1] tabular-nums">
        <span>당시 지수 종가</span>
        <span className="font-semibold text-[#4E5968]">{priceValue}</span>
      </div>
    </div>
  );
}

/**
 * 모바일 시장 지수 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 분석 카드 컴포넌트
 */
export default function MobileMarketExtremeStatsCards({ chartData, stats: customStats }) {
  const stats = useMemo(() => {
    return customStats || calculateExtremeStats(chartData);
  }, [customStats, chartData]);

  if (!stats || (!stats.maxVix && !stats.worstMdd)) {
    return null;
  }

  const formatPrice = (val) =>
    val !== null && val !== undefined
      ? `${Number(val).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pt`
      : '-';

  return (
    <div
      data-testid="extreme-stats-cards-container"
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {/* 1. 최대 공포 (VIX 피크) 카드 */}
      {stats.maxVix && (
        <ExtremeStatCard
          testId="extreme-card-max-vix"
          title="기간 내 최대 공포 (VIX 피크)"
          date={stats.maxVix.date}
          primaryLabel="최고 VIX"
          primaryValue={
            stats.maxVix.vix !== null && stats.maxVix.vix !== undefined
              ? `${Number(stats.maxVix.vix).toFixed(2)} pt`
              : '-'
          }
          primaryValueClass="text-[#6366F1]"
          secondaryLabel="당시 낙폭 (MDD)"
          secondaryValue={
            stats.maxVix.mdd !== null && stats.maxVix.mdd !== undefined
              ? `${Number(stats.maxVix.mdd).toFixed(2)}%`
              : '-'
          }
          secondaryValueClass="text-[#3182F6]"
          priceValue={formatPrice(stats.maxVix.value)}
        />
      )}

      {/* 2. 최대 낙폭 (MDD 바닥) 카드 */}
      {stats.worstMdd && (
        <ExtremeStatCard
          testId="extreme-card-worst-mdd"
          title="기간 내 최대 낙폭 (MDD 바닥)"
          date={stats.worstMdd.date}
          primaryLabel="최저 MDD"
          primaryValue={
            stats.worstMdd.mdd !== null && stats.worstMdd.mdd !== undefined
              ? `${Number(stats.worstMdd.mdd).toFixed(2)}%`
              : '-'
          }
          primaryValueClass="text-[#3182F6]"
          secondaryLabel="당시 공포 (VIX)"
          secondaryValue={
            stats.worstMdd.vix !== null && stats.worstMdd.vix !== undefined
              ? `${Number(stats.worstMdd.vix).toFixed(2)} pt`
              : '-'
          }
          secondaryValueClass="text-[#6366F1]"
          priceValue={formatPrice(stats.worstMdd.value)}
        />
      )}
    </div>
  );
}
