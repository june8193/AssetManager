import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Flame, Shield } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';
import { MobileErrorCard } from './MobileStatusFeedback';
import MobileRiskChartsCard from './MobileRiskChartsCard';

const PERIODS = [
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '1Y', label: '1년 (표준)' },
];

const SORT_OPTIONS = [
  { key: 'volatility_share', label: '기여도순' },
  { key: 'annualized_volatility', label: '자체 변동성순' },
  { key: 'valuation_krw', label: '보유금액순' },
];

/**
 * S&P 500 대비 변동성 배수에 따른 상태 배지 정보를 반환합니다.
 *
 * @param {number} ratio - S&P 500 대비 변동성 배수
 * @returns {{ label: string, badgeClass: string }}
 */
function getVolatilityStatusBadge(ratio) {
  if (ratio < 0.85) {
    return {
      label: '안정적 (시장 하회)',
      badgeClass: 'bg-[#E8F8F2] text-[#00A870] border-[#00A870]/30',
    };
  }
  if (ratio <= 1.15) {
    return {
      label: '시장 유사',
      badgeClass: 'bg-[#E8F3FF] text-[#3182F6] border-[#3182F6]/30',
    };
  }
  return {
    label: '공격적 (시장 상회)',
    badgeClass: 'bg-[#FFF8E6] text-[#D97706] border-[#D97706]/30',
  };
}

/**
 * 모바일 리스크 관리(포트폴리오 내재 변동성 진단) 섹션 컴포넌트입니다. (Read-Only)
 *
 * @param {object} props - 컴포넌트 속성
 * @param {number} [props.refreshTrigger=0] - 외부 헤더 새로고침 트리거 카운터
 */
export default function MobileRiskSection({ refreshTrigger = 0 }) {
  const { maskValue } = useMasking();
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('volatility_share');

  const fetchVolatility = useCallback(async (period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/risk/volatility?period=${encodeURIComponent(period)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError('포트폴리오 내재 변동성 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVolatility(selectedPeriod);
  }, [selectedPeriod, refreshTrigger, fetchVolatility]);

  const formatMoney = (val) => maskValue(Math.round(val || 0).toLocaleString('ko-KR'));

  const gaugeMax = useMemo(() => {
    if (!data) return 30;
    const candidates = [
      data.portfolio?.annualized_volatility || 0,
      data.benchmarks?.sp500?.annualized_volatility || 0,
      data.benchmarks?.nasdaq?.annualized_volatility || 0,
      data.benchmarks?.kospi?.annualized_volatility || 0,
      20,
    ];
    return Math.ceil(Math.max(...candidates) * 1.15);
  }, [data]);

  const toGaugePercent = (val) => {
    if (!gaugeMax) return 0;
    return Math.max(0, Math.min(100, (val / gaugeMax) * 100));
  };

  const accelTop3 = useMemo(() => {
    if (!data?.assets) return [];
    return [...data.assets]
      .filter((a) => !a.is_cash && (a.volatility_share ?? 0) > 0)
      .sort((a, b) => (b.volatility_share ?? 0) - (a.volatility_share ?? 0))
      .slice(0, 3);
  }, [data]);

  const bufferAssets = useMemo(() => {
    if (!data?.assets) return [];
    const sp500Vol = data.benchmarks?.sp500?.annualized_volatility || 15;
    return data.assets.filter(
      (a) => a.is_cash || ((a.weight ?? 0) > 0 && (a.annualized_volatility ?? 0) < sp500Vol)
    );
  }, [data]);

  const sortedAssets = useMemo(() => {
    if (!data?.assets) return [];
    const cashRows = data.assets.filter((a) => a.is_cash);
    const nonCashRows = [...data.assets.filter((a) => !a.is_cash)].sort(
      (a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0)
    );
    return [...cashRows, ...nonCashRows];
  }, [data, sortKey]);

  if (loading && !data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-36 bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#3182F6] animate-spin" />
          <span className="text-xs text-[#8B95A1] font-medium">리스크 데이터를 불러오는 중...</span>
        </div>
        <div className="h-32 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
        <div className="h-44 bg-white border border-[#E5E8EB]/60 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return <MobileErrorCard message={error} onRetry={() => fetchVolatility(selectedPeriod)} />;
  }

  const portfolio = data?.portfolio;
  const benchmarks = data?.benchmarks;
  const annVol = portfolio?.annualized_volatility ?? 0;
  const dailyPct = portfolio?.daily_volatility_pct ?? 0;
  const dailyKrw = portfolio?.daily_volatility_krw ?? 0;
  const sp500Ratio = portfolio?.sp500_ratio ?? 0;
  const nasdaqRatio = portfolio?.nasdaq_ratio ?? 0;
  const kospiRatio = portfolio?.kospi_ratio ?? 0;
  const statusBadge = getVolatilityStatusBadge(sp500Ratio);
  const myPinPercent = Math.max(6, Math.min(94, toGaugePercent(annVol)));

  const benchmarkChips = [
    { key: 'sp500', label: 'S&P 500', val: benchmarks?.sp500?.annualized_volatility ?? 0, dotCls: 'bg-[#00A870]' },
    { key: 'kospi', label: 'KOSPI', val: benchmarks?.kospi?.annualized_volatility ?? 0, dotCls: 'bg-[#6B7684]' },
    { key: 'nasdaq', label: 'NASDAQ', val: benchmarks?.nasdaq?.annualized_volatility ?? 0, dotCls: 'bg-[#D97706]' },
  ];

  return (
    <div className="space-y-3">
      {/* 기간 선택 바 */}
      <div className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-2 flex items-center gap-1">
        {PERIODS.map((p) => {
          const active = selectedPeriod === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setSelectedPeriod(p.value)}
              className={`flex-1 py-1.5 rounded-xl text-xs transition-all ${
                active
                  ? 'bg-[#3182F6] text-white font-semibold shadow-xs'
                  : 'text-[#6B7684] hover:bg-[#F2F4F6] font-medium'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-[#FFF0F1] border border-[#F04452]/20 text-[#F04452] text-xs font-medium">
          {error}
        </div>
      )}

      {data && portfolio && benchmarks && (
        <>
          {/* 1. 핵심 KPI 통합 카드 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3.5 tabular-nums">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#8B95A1]">포트폴리오 내재 변동성</span>
              <span
                className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusBadge.badgeClass}`}
              >
                {statusBadge.label}
              </span>
            </div>

            <div>
              <div className="text-3xl font-bold text-[#191F28] tracking-tight">
                {annVol.toFixed(2)}%
              </div>
              <div className="text-[11px] text-[#8B95A1] mt-0.5">
                연율화 표준편차 ({data.period} 기준 · {data.as_of_date})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#F2F4F6]">
              <div className="bg-[#F9FAFB] rounded-xl p-3">
                <span className="text-[11px] text-[#8B95A1] block">하루 평균 출렁임</span>
                <div className="text-sm font-bold text-[#191F28] mt-0.5">
                  ±{dailyPct.toFixed(2)}%
                </div>
                <div className="text-[11px] text-[#6B7684] mt-0.5">
                  약 ±{formatMoney(dailyKrw)}원
                </div>
              </div>
              <div className="bg-[#F9FAFB] rounded-xl p-3">
                <span className="text-[11px] text-[#8B95A1] block">시장 대비 변동성 배수</span>
                <div className="text-sm font-bold text-[#191F28] mt-0.5">
                  S&amp;P 500의 {sp500Ratio.toFixed(2)}배
                </div>
                <div className="text-[11px] text-[#6B7684] mt-0.5">
                  NDX {nasdaqRatio.toFixed(2)} · KOSPI {kospiRatio.toFixed(2)}
                </div>
              </div>
            </div>
          </section>

          {/* 2. 3대 시장 지수 대비 변동성 위치 스펙트럼 카드 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3 tabular-nums">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#191F28]">시장 지수 대비 변동성 위치</h3>
              <span className="text-[11px] text-[#8B95A1]">0% ~ {gaugeMax}%</span>
            </div>

            <div className="pt-7 pb-3">
              <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#D1FAE5] via-[#DBEAFE] to-[#FDE68A]">
                {/* 내 포트폴리오 핀 */}
                <div
                  className="absolute -top-7 -translate-x-1/2 flex flex-col items-center z-20 transition-all duration-300"
                  style={{ left: `${myPinPercent}%` }}
                >
                  <span className="px-2 py-0.5 rounded-md bg-[#3182F6] text-white text-[10px] font-bold whitespace-nowrap shadow-xs">
                    내 포폴 {annVol.toFixed(2)}%
                  </span>
                  <div className="w-0.5 h-2.5 bg-[#3182F6]" />
                  <div className="w-3 h-3 rounded-full bg-[#3182F6] border-2 border-white shadow-xs -mt-0.5" />
                </div>

                {/* 벤치마크 점 마커 */}
                {benchmarkChips.map((bm) => (
                  <div
                    key={bm.key}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${bm.dotCls} ring-2 ring-white`}
                    style={{ left: `${Math.max(2, Math.min(98, toGaugePercent(bm.val)))}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {benchmarkChips.map((bm) => (
                <div key={bm.key} className="bg-[#F9FAFB] rounded-xl px-2 py-2 text-center">
                  <div className="text-[10px] text-[#8B95A1] font-medium">{bm.label}</div>
                  <div className="text-xs font-bold text-[#191F28] mt-0.5">{bm.val.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. 액셀 Top 3 & 완충 자산 카드 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D97706] mb-2">
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span>액셀 Top 3</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {accelTop3.length > 0 ? (
                  accelTop3.map((item) => (
                    <div
                      key={item.ticker}
                      className="px-2.5 py-1.5 rounded-xl bg-[#FFF8E6] border border-[#FDE68A] text-xs flex items-center gap-1.5"
                    >
                      <span className="font-semibold text-[#191F28]">{item.name}</span>
                      <span className="font-bold text-[#D97706] tabular-nums">
                        {item.volatility_share.toFixed(1)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-[#8B95A1]">표시할 위험 기여 종목이 없습니다.</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#F2F4F6]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#00A870] mb-2">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>완충 자산</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bufferAssets.length > 0 ? (
                  bufferAssets.map((item) => (
                    <div
                      key={item.ticker}
                      className="px-2.5 py-1.5 rounded-xl bg-[#E8F8F2] border border-[#A7F3D0] text-xs flex items-center gap-1.5"
                    >
                      <span className="font-semibold text-[#191F28]">{item.name}</span>
                      <span className="font-bold text-[#00A870] tabular-nums">
                        비중 {(item.weight ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-[#8B95A1]">현재 완충 자산이 없습니다.</span>
                )}
              </div>
            </div>
          </section>

          {/* 4. 시각화 차트 카드 (옵션 A: 2종 탭 + 상위 8개 기본/전체 보기 토글) */}
          <MobileRiskChartsCard
            assets={data.assets}
            benchmarks={benchmarks}
            drawdownComparison={data.drawdown_comparison}
          />

          {/* 5. 종목별 변동성 & 기여도 리스트 카드 */}
          <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl overflow-hidden tabular-nums">
            <div className="px-5 pt-4 pb-3 border-b border-[#F2F4F6] space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#191F28]">종목별 변동성 &amp; 기여도</h3>
                <span className="text-[11px] text-[#8B95A1]">현금 최상단 고정</span>
              </div>
              <div className="flex items-center gap-1.5">
                {SORT_OPTIONS.map((opt) => {
                  const active = sortKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSortKey(opt.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                        active
                          ? 'bg-[#E8F3FF] border-[#3182F6]/40 text-[#3182F6] font-semibold'
                          : 'bg-white border-[#E5E8EB] text-[#6B7684] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-[#F2F4F6]">
              {sortedAssets.map((asset) => {
                const share = asset.volatility_share ?? 0;
                const barWidth = Math.min(100, Math.max(0, share));
                return (
                  <div
                    key={asset.ticker}
                    data-testid={`mobile-risk-asset-${asset.ticker}`}
                    data-ticker={asset.ticker}
                    className={`px-5 py-3.5 space-y-2 ${
                      asset.is_cash ? 'bg-[#F9FAFB]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-[#191F28] truncate">
                          {asset.name}
                        </div>
                        <div className="text-[11px] text-[#8B95A1] mt-0.5">
                          {asset.ticker} · {asset.category_label}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold text-[#191F28]">
                          {formatMoney(asset.valuation_krw)}원
                        </div>
                        <div className="text-[11px] text-[#8B95A1] mt-0.5">
                          비중 {(asset.weight ?? 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {asset.is_cash ? (
                      <div className="text-[11px] text-[#00A870] font-medium">
                        변동성 0.0% · 완충 역할 수행
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#6B7684]">
                            자체 변동성{' '}
                            <strong className="text-[#191F28]">
                              {(asset.annualized_volatility ?? 0).toFixed(1)}%
                            </strong>
                          </span>
                          <span className="text-[#3182F6] font-bold">
                            흔들림 기여도 {share.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#F2F4F6] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#3182F6] transition-all duration-300"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
