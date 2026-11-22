const TRADING_DAYS_PER_YEAR = 252;

/**
 * 공분산 행렬과 자산별 일별 수익률 시계열을 기반으로 클라이언트 측 실시간 매매 시뮬레이션 결과를 계산합니다.
 *
 * @param {object} params
 * @param {object} params.data - 백엔드 `/api/v1/risk/volatility` 응답 데이터
 * @param {Record<string, number>} params.simValuations - 비현금 자산별 시뮬레이션 평가액(원) 맵
 * @param {number} params.extraCashKrw - 신규 여유자금 추가/인출 금액(원)
 * @returns {object|null} 시뮬레이션 포트폴리오 지표, 자산별 기여도, 낙폭 시계열
 */
export function computeSimulatedRisk({ data, simValuations, extraCashKrw = 0 }) {
  if (!data?.assets?.length) return null;

  const assets = data.assets;
  const covMatrix = data.covariance_matrix || [];
  const cashAsset = assets.find((a) => a.is_cash);
  const baseCash = cashAsset ? cashAsset.valuation_krw : 0;

  let netBuyDiff = 0;
  let isAssetChanged = false;

  assets.forEach((asset) => {
    if (asset.is_cash) return;
    const baseVal = asset.valuation_krw || 0;
    const simVal = simValuations[asset.ticker] ?? baseVal;
    netBuyDiff += simVal - baseVal;
    if (Math.abs(simVal - baseVal) > 1e-6 || asset.is_added) {
      isAssetChanged = true;
    }
  });

  const simCash = baseCash + extraCashKrw - netBuyDiff;
  const effectiveCash = Math.max(0, simCash);
  const isCashShortage = simCash < -1e-6;
  const cashShortageAmount = isCashShortage ? Math.abs(simCash) : 0;
  const isModified = isAssetChanged || Math.abs(extraCashKrw) > 1e-6;

  // 시뮬레이션 변경이 없으면 백엔드 기준값을 그대로 반환해 반올림 오차를 방지합니다.
  const resolvedValuations = assets.map((asset) => {
    if (asset.is_cash) return effectiveCash;
    return Math.max(0, simValuations[asset.ticker] ?? asset.valuation_krw ?? 0);
  });

  const simTotalValuation = resolvedValuations.reduce((acc, v) => acc + v, 0);
  const weights = resolvedValuations.map((val) =>
    simTotalValuation > 0 ? val / simTotalValuation : 0
  );

  // w^T * Sigma * w 계산
  const n = assets.length;
  const sigmaW = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = covMatrix[i] || [];
    let sum = 0;
    for (let j = 0; j < n; j += 1) {
      sum += (row[j] || 0) * weights[j];
    }
    sigmaW[i] = sum;
  }

  let variance = 0;
  for (let i = 0; i < n; i += 1) {
    variance += weights[i] * sigmaW[i];
  }
  const simAnnVol = isModified
    ? Math.sqrt(Math.max(0, variance))
    : data.portfolio.annualized_volatility;

  const simDailyPct = isModified
    ? simAnnVol / Math.sqrt(TRADING_DAYS_PER_YEAR)
    : data.portfolio.daily_volatility_pct;
  const simDailyKrw = isModified
    ? simTotalValuation * (simDailyPct / 100)
    : data.portfolio.daily_volatility_krw;

  const safeRatio = (benchKey, fallback) => {
    if (!isModified) return fallback;
    const bVol = data.benchmarks?.[benchKey]?.annualized_volatility || 0;
    return bVol > 0 ? simAnnVol / bVol : 0;
  };

  const simAssets = assets.map((asset, idx) => {
    const val = asset.is_cash ? simCash : resolvedValuations[idx];
    const weightPct = weights[idx] * 100;
    if (!isModified) {
      return {
        ...asset,
        sim_valuation_krw: val,
        sim_weight: asset.weight,
        sim_component_volatility: asset.component_volatility,
        sim_volatility_share: asset.volatility_share,
      };
    }

    const compVol =
      simAnnVol > 0 && !asset.is_cash ? (weights[idx] * sigmaW[idx]) / simAnnVol : 0;
    const volShare = simAnnVol > 0 && !asset.is_cash ? (compVol / simAnnVol) * 100 : 0;

    return {
      ...asset,
      sim_valuation_krw: val,
      sim_weight: weightPct,
      sim_component_volatility: compVol,
      sim_volatility_share: volShare,
    };
  });

  // 시뮬레이션 낙폭(MDD) 곡선 계산
  let simDrawdownSeries = null;
  const drawdown = data.drawdown_comparison;
  if (isModified && drawdown?.dates?.length) {
    const returnsMap = drawdown.asset_daily_returns || {};
    const datesLen = drawdown.dates.length;
    let indexVal = 100;
    let peakVal = 100;
    simDrawdownSeries = new Array(datesLen).fill(0);

    for (let t = 0; t < datesLen; t += 1) {
      let portRet = 0;
      for (let i = 0; i < n; i += 1) {
        if (assets[i].is_cash) continue;
        const series = returnsMap[assets[i].ticker];
        if (series && t < series.length) {
          portRet += weights[i] * (series[t] || 0);
        }
      }
      indexVal = indexVal * (1 + portRet);
      if (indexVal > peakVal) {
        peakVal = indexVal;
      }
      simDrawdownSeries[t] = peakVal > 0 ? Number((((indexVal / peakVal) - 1) * 100).toFixed(2)) : 0;
    }
  }

  return {
    isModified,
    simCash,
    effectiveCash,
    isCashShortage,
    cashShortageAmount,
    simTotalValuation,
    annualizedVolatility: simAnnVol,
    deltaVolatilityPctp: simAnnVol - data.portfolio.annualized_volatility,
    dailyVolatilityPct: simDailyPct,
    dailyVolatilityKrw: simDailyKrw,
    sp500Ratio: safeRatio('sp500', data.portfolio.sp500_ratio),
    nasdaqRatio: safeRatio('nasdaq', data.portfolio.nasdaq_ratio),
    kospiRatio: safeRatio('kospi', data.portfolio.kospi_ratio),
    assets: simAssets,
    simDrawdownSeries,
  };
}
