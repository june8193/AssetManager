import { useMemo } from 'react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 4대 대표 시장 지수 정의 (순서, 표시명, 별칭 목록, testId 매핑)
 */
const TARGET_INDICES = [
  {
    key: 'sp500',
    name: 'S&P 500',
    testId: 'index-mdd-sp500',
    aliases: ['S&P 500', 'sp500', '^GSPC', 'S&P500', 'sp_500'],
  },
  {
    key: 'nasdaq',
    name: 'NASDAQ',
    testId: 'index-mdd-nasdaq',
    aliases: ['NASDAQ', 'nasdaq', '^IXIC', '^NDX', 'nasdaq_100'],
  },
  {
    key: 'kospi',
    name: 'KOSPI',
    testId: 'index-mdd-kospi',
    aliases: ['KOSPI', 'kospi', '^KS11'],
  },
  {
    key: 'kosdaq',
    name: 'KOSDAQ',
    testId: 'index-mdd-kosdaq',
    aliases: ['KOSDAQ', 'kosdaq', '^KQ11'],
  },
];

function formatPercent(val, showSign = true) {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '-';
  }
  const num = Number(val);
  const formatted = num.toFixed(2);
  if (showSign && num > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * 모바일 포트폴리오 & 4대 지수 MDD 요약 카드 컴포넌트 (클린 라이트 톤)
 * - 한국 증권앱 기준: 수익률 상승 빨강(#F04452) / 하락 파랑(#3182F6), MDD 파랑(#3182F6)
 */
export default function MobileMddSummaryCard({
  portfolioReturn,
  portfolioMdd,
  indicesMdd = {},
  isMasked: isMaskedProp,
}) {
  const { isMasked: isMaskedContext, maskValue } = useMasking();
  const effectiveMasked = isMaskedProp !== undefined ? isMaskedProp : isMaskedContext;

  const displayReturn = useMemo(() => {
    if (portfolioReturn === null || portfolioReturn === undefined || isNaN(Number(portfolioReturn))) {
      return '-';
    }
    const formatted = formatPercent(portfolioReturn, true);
    if (effectiveMasked) {
      return maskValue(formatted, true);
    }
    return formatted;
  }, [portfolioReturn, effectiveMasked, maskValue]);

  const displayPortfolioMdd = useMemo(() => {
    return formatPercent(portfolioMdd, false);
  }, [portfolioMdd]);

  const indexMddMap = useMemo(() => {
    const result = {};
    TARGET_INDICES.forEach((idx) => {
      let matchedVal;
      for (const alias of idx.aliases) {
        if (indicesMdd[alias] !== undefined && indicesMdd[alias] !== null) {
          matchedVal = indicesMdd[alias];
          break;
        }
      }
      result[idx.key] = formatPercent(matchedVal, false);
    });
    return result;
  }, [indicesMdd]);

  const returnNum = Number(portfolioReturn);
  const isPositive = !isNaN(returnNum) && returnNum > 0;
  const isNegative = !isNaN(returnNum) && returnNum < 0;

  return (
    <section
      data-testid="mdd-summary-card"
      className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3.5"
    >
      {/* 카드 타이틀 */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#191F28]">성과 및 최대 낙폭 (MDD)</h2>
        <span className="text-[11px] text-[#8B95A1] font-medium">단위 %</span>
      </div>

      {/* 헤드라인: 내 포트폴리오 성과 (수익률 + MDD) */}
      <div className="bg-[#F9FAFB] rounded-xl p-3.5 flex items-center justify-between tabular-nums">
        <div className="space-y-0.5">
          <span className="text-[11px] text-[#8B95A1] font-medium block">포트폴리오 수익률</span>
          <span
            data-testid="masked-return"
            className={`text-base font-bold tracking-tight ${
              isPositive ? 'text-[#F04452]' : isNegative ? 'text-[#3182F6]' : 'text-[#191F28]'
            }`}
          >
            {displayReturn}
          </span>
        </div>

        <div className="h-8 w-px bg-[#E5E8EB] mx-2" />

        <div className="space-y-0.5 text-right">
          <span className="text-[11px] text-[#8B95A1] font-medium block">포트폴리오 MDD</span>
          <span
            data-testid="portfolio-mdd-value"
            className="text-base font-bold text-[#3182F6] tracking-tight"
          >
            {displayPortfolioMdd}
          </span>
        </div>
      </div>

      {/* 하위 4열 그리드: 4대 지수 기간 MDD */}
      <div>
        <span className="text-[11px] font-medium text-[#8B95A1] block mb-2">
          4대 주요 지수 MDD
        </span>
        <div className="grid grid-cols-4 gap-1.5 tabular-nums">
          {TARGET_INDICES.map((idx) => {
            const mddText = indexMddMap[idx.key];
            return (
              <div
                key={idx.key}
                className="bg-[#F9FAFB] rounded-xl py-2 px-1 text-center"
              >
                <span className="text-[10px] font-medium text-[#6B7684] block truncate mb-0.5">
                  {idx.name}
                </span>
                <span
                  data-testid={idx.testId}
                  className="text-xs font-bold text-[#3182F6] block"
                >
                  {mddText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
