import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const TARGET_BENCHMARKS = [
  {
    key: 'sp500',
    name: 'S&P 500',
    ticker: '^GSPC',
    aliases: ['S&P 500', 'sp500', '^GSPC', 'S&P500', 'sp_500'],
  },
  {
    key: 'nasdaq',
    name: 'NASDAQ',
    ticker: '^IXIC',
    aliases: ['NASDAQ', 'nasdaq', '^IXIC', '^NDX', 'nasdaq_100'],
  },
  {
    key: 'kospi',
    name: 'KOSPI',
    ticker: '^KS11',
    aliases: ['KOSPI', 'kospi', '^KS11'],
  },
  {
    key: 'kosdaq',
    name: 'KOSDAQ',
    ticker: '^KQ11',
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

function formatAlpha(val) {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '-';
  }
  const num = Number(val);
  const formatted = num.toFixed(2);
  if (num > 0) {
    return `+${formatted}%p`;
  }
  return `${formatted}%p`;
}

/**
 * 모바일 알파 초과수익률 플랫 리스트 및 상세 데이터 표 토글 컴포넌트 (클린 라이트 톤)
 * - 한국 증권앱 기준: 초과수익(+) 빨강(#F04452), 저조(-) 파랑(#3182F6)
 */
export default function MobileAlphaCardList({
  alphaAnalysis = [],
  indices = {},
  indicesMdd = {},
  portfolioReturn = null,
  isMasked: isMaskedProp,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { isMasked: isMaskedContext, maskValue } = useMasking();
  const effectiveMasked = isMaskedProp !== undefined ? isMaskedProp : isMaskedContext;

  const cardsData = useMemo(() => {
    const hasAlphaAnalysis = Array.isArray(alphaAnalysis) && alphaAnalysis.length > 0;
    const hasIndices = indices && Object.keys(indices).length > 0;

    if (!hasAlphaAnalysis && !hasIndices) {
      return [];
    }

    return TARGET_BENCHMARKS.map((benchmark) => {
      const matchedAlpha = hasAlphaAnalysis
        ? alphaAnalysis.find((item) => {
            if (!item) return false;
            if (item.ticker && benchmark.aliases.some((a) => a.toLowerCase() === item.ticker.toLowerCase())) {
              return true;
            }
            if (item.benchmark && benchmark.aliases.some((a) => a.toLowerCase() === item.benchmark.toLowerCase())) {
              return true;
            }
            return false;
          })
        : null;

      let matchedIndex = null;
      if (hasIndices) {
        for (const alias of benchmark.aliases) {
          if (indices[alias]) {
            matchedIndex = indices[alias];
            break;
          }
        }
        if (!matchedIndex) {
          matchedIndex = Object.values(indices).find(
            (idxItem) => idxItem?.name && benchmark.aliases.some((a) => a.toLowerCase() === idxItem.name.toLowerCase())
          );
        }
      }

      const benchReturn = matchedAlpha?.benchmark_return ?? matchedIndex?.return ?? null;
      const portReturn = matchedAlpha?.portfolio_return ?? portfolioReturn;

      let alphaVal = matchedAlpha?.alpha ?? matchedIndex?.alpha ?? null;
      if (alphaVal === null && benchReturn !== null && portReturn !== null) {
        alphaVal = Number(portReturn) - Number(benchReturn);
      }

      let mddVal = matchedIndex?.mdd ?? null;
      if (mddVal === null) {
        for (const alias of benchmark.aliases) {
          if (indicesMdd[alias] !== undefined && indicesMdd[alias] !== null) {
            mddVal = indicesMdd[alias];
            break;
          }
        }
      }

      const alphaNum = alphaVal !== null && !isNaN(Number(alphaVal)) ? Number(alphaVal) : null;
      const isAlphaPositive = alphaNum !== null && alphaNum > 0;
      const isAlphaNegative = alphaNum !== null && alphaNum < 0;

      return {
        key: benchmark.key,
        name: benchmark.name,
        benchmarkReturn: benchReturn,
        portfolioReturn: portReturn,
        alpha: alphaVal,
        mdd: mddVal,
        isAlphaPositive,
        isAlphaNegative,
      };
    });
  }, [alphaAnalysis, indices, indicesMdd, portfolioReturn]);

  const getDisplayPortfolioReturn = (val) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    const formatted = formatPercent(val, true);
    return effectiveMasked ? maskValue(formatted, true) : formatted;
  };

  const getDisplayAlpha = (val) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    const formatted = formatAlpha(val);
    return effectiveMasked ? maskValue(formatted, true) : formatted;
  };

  return (
    <section
      data-testid="mobile-alpha-card-list"
      className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3"
    >
      {/* 카드 섹션 헤더 & 아코디언 토글 버튼 */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#191F28]">초과수익률 (Alpha)</h2>

        {cardsData.length > 0 && (
          <button
            type="button"
            data-testid="alpha-table-toggle-btn"
            aria-expanded={isOpen}
            aria-controls="alpha-detail-table-container"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B7684] hover:text-[#3182F6] transition-colors px-2 py-1 rounded-lg hover:bg-[#F2F4F6]"
          >
            <span>{isOpen ? '상세 표 접기' : '상세 표 보기'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* 데이터 없음 처리 */}
      {cardsData.length === 0 && (
        <div className="py-6 text-center text-xs text-[#8B95A1] font-medium">
          초과수익률 비교 데이터가 없습니다.
        </div>
      )}

      {/* 1. 플랫 행 리스트 (중첩 박스 제거) */}
      {cardsData.length > 0 && (
        <div className="divide-y divide-[#F2F4F6]">
          {cardsData.map((item) => (
            <div
              key={item.key}
              data-testid={`alpha-card-${item.key}`}
              className="py-3 first:pt-1 last:pb-1 space-y-1.5 tabular-nums"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#191F28]">{item.name}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    item.isAlphaPositive
                      ? 'bg-[#FFF0F1] text-[#F04452]'
                      : item.isAlphaNegative
                      ? 'bg-[#E8F3FF] text-[#3182F6]'
                      : 'bg-[#F2F4F6] text-[#4E5968]'
                  }`}
                >
                  {getDisplayAlpha(item.alpha)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#8B95A1]">
                <span>
                  지수 <strong className="font-semibold text-[#4E5968]">{formatPercent(item.benchmarkReturn, true)}</strong>
                </span>
                <span>
                  내 수익률 <strong className="font-semibold text-[#191F28]">{getDisplayPortfolioReturn(item.portfolioReturn)}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. 상세 데이터 표 (아코디언 확장 영역) */}
      {isOpen && cardsData.length > 0 && (
        <div
          id="alpha-detail-table-container"
          className="pt-2 border-t border-[#F2F4F6]"
        >
          <div className="overflow-x-auto rounded-xl border border-[#E5E8EB] bg-[#F9FAFB]">
            <table data-testid="alpha-detail-table" className="w-full text-xs text-left min-w-[320px] tabular-nums">
              <thead className="bg-[#F2F4F6] text-[#6B7684] text-[11px] font-semibold border-b border-[#E5E8EB]">
                <tr>
                  <th className="px-3 py-2.5">지수명</th>
                  <th className="px-3 py-2.5 text-right">지수 수익률</th>
                  <th className="px-3 py-2.5 text-right">내 수익률</th>
                  <th className="px-3 py-2.5 text-right">알파</th>
                  <th className="px-3 py-2.5 text-right">지수 MDD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8EB]/60 bg-white">
                {cardsData.map((item) => (
                  <tr key={item.key} data-testid={`alpha-table-row-${item.key}`}>
                    <td className="px-3 py-2.5 font-semibold text-[#191F28] whitespace-nowrap">
                      {item.name}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-[#4E5968] whitespace-nowrap">
                      {formatPercent(item.benchmarkReturn, true)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#191F28] whitespace-nowrap">
                      {getDisplayPortfolioReturn(item.portfolioReturn)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                        item.isAlphaPositive
                          ? 'text-[#F04452]'
                          : item.isAlphaNegative
                          ? 'text-[#3182F6]'
                          : 'text-[#6B7684]'
                      }`}
                    >
                      {getDisplayAlpha(item.alpha)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#3182F6] whitespace-nowrap">
                      {formatPercent(item.mdd, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
