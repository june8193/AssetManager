import { useMemo } from 'react';
import { AlertCircle, TrendingUp } from 'lucide-react';

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

    // VIX 최대치 탐색 (기간 내 최대 공포)
    if (item.vix !== null && item.vix !== undefined && !isNaN(item.vix)) {
      if (!maxVixItem || item.vix > maxVixItem.vix) {
        maxVixItem = item;
      }
    }

    // MDD 최저치 탐색 (기간 내 최대 낙폭)
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
 * 개별 극단값 인사이트 카드 서브 컴포넌트
 */
function ExtremeStatCard({
  testId,
  icon: Icon,
  iconContainerClass,
  iconClass,
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
      className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconContainerClass}`}
          >
            <Icon className={`w-4 h-4 ${iconClass || ''}`} />
          </div>
          <span className="text-xs font-bold text-slate-200">{title}</span>
        </div>
        {date && (
          <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-md">
            {date}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{primaryLabel}</span>
          <span className={`text-sm font-extrabold font-mono ${primaryValueClass}`}>
            {primaryValue}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
            {secondaryLabel}
          </span>
          <span className={`text-sm font-extrabold font-mono ${secondaryValueClass}`}>
            {secondaryValue}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/40 text-slate-400">
        <span>당시 지수 종가</span>
        <span className="font-semibold text-slate-300 font-mono">{priceValue}</span>
      </div>
    </div>
  );
}

/**
 * 모바일 시장 지수 기간 내 2대 극단값(최대 공포 피크 & 최대 낙폭 바닥) 분석 카드 컴포넌트
 *
 * 🟣 기간 내 최대 공포 (VIX 피크): 패닉 발생일, 최고 VIX, 당시 MDD, 당시 지수 종가
 * 🔴 기간 내 최대 낙폭 (MDD 바닥): 바닥 발생일, 최저 MDD, 당시 VIX, 당시 지수 종가
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
      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
    >
      {/* 🟣 1. 최대 공포 (VIX 피크) 카드 */}
      {stats.maxVix && (
        <ExtremeStatCard
          testId="extreme-card-max-vix"
          icon={AlertCircle}
          iconContainerClass="bg-purple-500/10 border border-purple-500/20 text-purple-400"
          title="기간 내 최대 공포 (VIX 피크)"
          date={stats.maxVix.date}
          primaryLabel="최고 VIX"
          primaryValue={
            stats.maxVix.vix !== null && stats.maxVix.vix !== undefined
              ? `${Number(stats.maxVix.vix).toFixed(2)} pt`
              : '-'
          }
          primaryValueClass="text-purple-300"
          secondaryLabel="당시 낙폭 (MDD)"
          secondaryValue={
            stats.maxVix.mdd !== null && stats.maxVix.mdd !== undefined
              ? `${Number(stats.maxVix.mdd).toFixed(2)}%`
              : '-'
          }
          secondaryValueClass="text-rose-400"
          priceValue={formatPrice(stats.maxVix.value)}
        />
      )}

      {/* 🔴 2. 최대 낙폭 (MDD 바닥) 카드 */}
      {stats.worstMdd && (
        <ExtremeStatCard
          testId="extreme-card-worst-mdd"
          icon={TrendingUp}
          iconContainerClass="bg-rose-500/10 border border-rose-500/20 text-rose-400"
          iconClass="rotate-180"
          title="기간 내 최대 낙폭 (MDD 바닥)"
          date={stats.worstMdd.date}
          primaryLabel="최저 MDD"
          primaryValue={
            stats.worstMdd.mdd !== null && stats.worstMdd.mdd !== undefined
              ? `${Number(stats.worstMdd.mdd).toFixed(2)}%`
              : '-'
          }
          primaryValueClass="text-rose-400"
          secondaryLabel="당시 공포 (VIX)"
          secondaryValue={
            stats.worstMdd.vix !== null && stats.worstMdd.vix !== undefined
              ? `${Number(stats.worstMdd.vix).toFixed(2)} pt`
              : '-'
          }
          secondaryValueClass="text-purple-300"
          priceValue={formatPrice(stats.worstMdd.value)}
        />
      )}
    </div>
  );
}
