import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  ShieldCheck,
  Flame,
  Shield,
  ArrowUpDown,
  AlertCircle,
} from 'lucide-react';
import { useFormatters } from '../hooks/useFormatters';

const PERIODS = [
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '1Y', label: '1년 (표준)' },
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
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (ratio <= 1.15) {
    return {
      label: '시장 유사',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  return {
    label: '공격적 (시장 상회)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

const GUIDE_BANNER_THEMES = {
  amber: {
    container: 'bg-amber-50/60 border-amber-200/80',
    title: 'text-amber-900',
    desc: 'text-amber-800/80',
    chipBorder: 'border-amber-200',
    value: 'text-amber-700',
    empty: 'text-amber-700',
  },
  emerald: {
    container: 'bg-emerald-50/60 border-emerald-200/80',
    title: 'text-emerald-900',
    desc: 'text-emerald-800/80',
    chipBorder: 'border-emerald-200',
    value: 'text-emerald-700',
    empty: 'text-emerald-700',
  },
};

/**
 * 액셀 Top 3 및 완충 자산 가이드 배너용 공통 카드 컴포넌트입니다.
 */
function GuideBannerCard({
  title,
  description,
  items,
  emptyText,
  renderValue,
  variant = 'amber',
  iconNode,
}) {
  const theme = GUIDE_BANNER_THEMES[variant] || GUIDE_BANNER_THEMES.amber;
  return (
    <div className={`border rounded-2xl p-5 ${theme.container}`}>
      <div className={`flex items-center gap-2 text-sm font-bold mb-2 ${theme.title}`}>
        {iconNode}
        <span>{title}</span>
      </div>
      <p className={`text-xs mb-3 ${theme.desc}`}>{description}</p>
      <div className="flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.ticker}
              className={`px-3 py-1.5 rounded-xl bg-white border text-xs flex items-center gap-2 shadow-xs ${theme.chipBorder}`}
            >
              <span className="font-semibold text-slate-800">{item.name}</span>
              <span className={`font-mono font-bold ${theme.value}`}>{renderValue(item)}</span>
            </div>
          ))
        ) : (
          <span className={`text-xs ${theme.empty}`}>{emptyText}</span>
        )}
      </div>
    </div>
  );
}

/**
 * 데스크톱 리스크 관리(포트폴리오 내재 변동성 진단) 페이지 컴포넌트입니다.
 */
export default function PerformanceAnalysisPage() {
  const { formatCurrency } = useFormatters();
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('volatility_share');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchVolatility = useCallback(async (period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/risk/volatility?period=${period}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('내재 변동성 데이터 로드 실패:', e);
      setError('포트폴리오 내재 변동성 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchVolatility(selectedPeriod);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedPeriod, fetchVolatility]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // 스펙트럼 게이지 최대 스케일 계산 (0% ~ max(벤치마크, 포트폴리오) * 1.15)
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

  // 액셀 Top 3 (비현금 보유 종목 중 변동성 기여도 상위 3개)
  const accelTop3 = useMemo(() => {
    if (!data?.assets) return [];
    return [...data.assets]
      .filter((a) => !a.is_cash && a.volatility_share > 0)
      .sort((a, b) => b.volatility_share - a.volatility_share)
      .slice(0, 3);
  }, [data]);

  // 완충 자산 (현금 + S&P 500 변동성보다 낮은 저변동성 보유 자산)
  const bufferAssets = useMemo(() => {
    if (!data?.assets) return [];
    const sp500Vol = data.benchmarks?.sp500?.annualized_volatility || 15;
    return data.assets.filter(
      (a) => a.is_cash || (a.weight > 0 && a.annualized_volatility < sp500Vol)
    );
  }, [data]);

  const sortedAssets = useMemo(() => {
    if (!data?.assets) return [];
    return [...data.assets].sort((a, b) => {
      const valA = a[sortKey] ?? 0;
      const valB = b[sortKey] ?? 0;
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [data, sortKey, sortOrder]);

  const portfolio = data?.portfolio;
  const benchmarks = data?.benchmarks;
  const statusBadge = portfolio
    ? getVolatilityStatusBadge(portfolio.sp500_ratio)
    : null;

  return (
    <div className="space-y-6 pb-12">
      {/* 상단 헤더 및 기간 선택 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Portfolio Implied Volatility</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">리스크 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            현재 보유 비중과 유효 종가 공분산 행렬 기반의{' '}
            <span className="font-semibold text-slate-700">포트폴리오 내재 변동성</span>을 3대
            시장 지수와 비교해 진단합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            {PERIODS.map((p) => {
              const active = selectedPeriod === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelectedPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => fetchVolatility(selectedPeriod)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && portfolio && benchmarks && (
        <>
          {/* 3열 요약 KPI 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KPI 1: 연율화 내재 변동성 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
                <span>포트폴리오 내재 변동성</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                  현재 보유 비중 기준
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {portfolio.annualized_volatility.toFixed(2)}%
              </div>
              <p className="text-xs text-slate-500 mt-2">
                연율화 표준편차 ({data.period} 기준 · {data.as_of_date})
              </p>
            </div>

            {/* KPI 2: 평소 하루 평균 출렁임 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
                <span>평소 하루 평균 출렁임</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                ±{portfolio.daily_volatility_pct.toFixed(2)}%
              </div>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                원화 체감 폭: 약 ±{formatCurrency(portfolio.daily_volatility_krw)}
              </p>
            </div>

            {/* KPI 3: S&P 500 대비 배수 및 상태 배지 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-2">
                <span>시장 대비 변동성 배수</span>
                {statusBadge && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusBadge.badgeClass}`}
                  >
                    {statusBadge.label}
                  </span>
                )}
              </div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                S&P 500의 {portfolio.sp500_ratio.toFixed(2)}배
              </div>
              <p className="text-xs text-slate-500 mt-2">
                NASDAQ {portfolio.nasdaq_ratio.toFixed(2)}배 · KOSPI{' '}
                {portfolio.kospi_ratio.toFixed(2)}배
              </p>
            </div>
          </div>

          {/* 벤치마크 위치 스펙트럼 게이지 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  3대 시장 지수 대비 변동성 위치 스펙트럼
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  현금(0%)부터 S&P 500, NASDAQ, KOSPI 지수 변동성까지의 수평 스펙트럼에서 내
                  포트폴리오 위치를 확인합니다.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">0% ~ {gaugeMax}%</span>
            </div>

            <div className="relative pt-8 pb-10 px-2">
              {/* 트랙 바 */}
              <div className="h-3 w-full rounded-full bg-gradient-to-r from-emerald-100 via-blue-100 to-amber-200 relative">
                {/* 내 포트폴리오 마커 */}
                <div
                  className="absolute -top-7 -translate-x-1/2 flex flex-col items-center z-20"
                  style={{ left: `${toGaugePercent(portfolio.annualized_volatility)}%` }}
                >
                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-bold whitespace-nowrap shadow-sm">
                    내 포트폴리오 ({portfolio.annualized_volatility.toFixed(2)}%)
                  </span>
                  <div className="w-0.5 h-4 bg-blue-600 mt-0.5" />
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow" />
                </div>

                {/* 0% 현금 기준선 */}
                <div
                  className="absolute top-4 -translate-x-1/2 flex flex-col items-center text-[11px] text-slate-500"
                  style={{ left: '0%' }}
                >
                  <div className="w-px h-2 bg-slate-300 mb-1" />
                  <span>0% (현금)</span>
                </div>

                {/* 3대 벤치마크 눈금 */}
                {[
                  { key: 'sp500', label: 'S&P 500', data: benchmarks.sp500 },
                  { key: 'nasdaq', label: 'NASDAQ', data: benchmarks.nasdaq },
                  { key: 'kospi', label: 'KOSPI', data: benchmarks.kospi },
                ].map((bm) => (
                  <div
                    key={bm.key}
                    className="absolute top-3 -translate-x-1/2 flex flex-col items-center text-[11px]"
                    style={{ left: `${toGaugePercent(bm.data.annualized_volatility)}%` }}
                  >
                    <div className="w-0.5 h-2.5 bg-slate-400 mb-1" />
                    <span className="font-semibold text-slate-700 whitespace-nowrap">
                      {bm.label}
                    </span>
                    <span className="font-mono text-slate-500">
                      {bm.data.annualized_volatility.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 액셀 Top 3 & 완충 자산 가이드 배너 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GuideBannerCard
              title="액셀 Top 3"
              description="포트폴리오 전체 흔들림에 가장 큰 비중을 차지하는 핵심 변동성 드라이버입니다."
              items={accelTop3}
              emptyText="표시할 위험 기여 종목이 없습니다."
              renderValue={(item) => `${item.volatility_share.toFixed(1)}%`}
              variant="amber"
              iconNode={<Flame className="w-4 h-4 text-amber-600" />}
            />
            <GuideBannerCard
              title="완충 자산"
              description="현금 및 S&P 500 대비 낮은 변동성으로 계좌 흔들림을 흡수하는 방어 자산입니다."
              items={bufferAssets}
              emptyText="현재 완충 자산이 없습니다."
              renderValue={(item) => `비중 ${item.weight.toFixed(1)}%`}
              variant="emerald"
              iconNode={<Shield className="w-4 h-4 text-emerald-600" />}
            />
          </div>

          {/* 종목별 변동성·기여도 기본 테이블 */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  종목별 자체 변동성 및 흔들림 기여도
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  오일러 위험 분해 기준 기여 점유율 합계는 항상 100%입니다.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3 px-5">종목</th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('valuation_krw')}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        <span>보유 금액</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">비중</th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('annualized_volatility')}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        <span>자체 변동성</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('volatility_share')}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        <span>흔들림 기여도</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {sortedAssets.map((asset) => (
                    <tr key={asset.ticker} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-800">{asset.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{asset.ticker}</span>
                          <span>·</span>
                          <span>{asset.category_label}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {formatCurrency(asset.valuation_krw)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {asset.weight.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {asset.annualized_volatility.toFixed(2)}%
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.max(0, Math.min(100, asset.volatility_share))}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-800 w-16 text-right">
                            {asset.volatility_share.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
