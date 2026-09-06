import { useMemo } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

/**
 * 수치를 퍼센트 문자열로 포맷팅합니다.
 *
 * @param {number|string|null|undefined} val - 수치
 * @param {boolean} showSign - 양수 부호(+) 노출 여부
 * @returns {string} 포맷팅된 퍼센트 문자열 또는 '-'
 */
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
 * 모바일 포트폴리오 & 4대 지수 MDD 요약 카드 컴포넌트
 *
 * - 상단 헤드라인: 내 포트폴리오 기간 수익률(%) 및 포트폴리오 MDD(%)
 * - 마스킹 연동: `isMasked` 상태에 따라 포트폴리오 수익률 수치 마스킹 처리
 * - 하위 4열 그리드: S&P 500, NASDAQ, KOSPI, KOSDAQ의 기간 MDD(%) 표시
 *
 * @param {object} props
 * @param {number|string|null} props.portfolioReturn - 포트폴리오 기간 누적 수익률 (%)
 * @param {number|string|null} props.portfolioMdd - 포트폴리오 기간 최대 낙폭 MDD (%)
 * @param {Record<string, number>} [props.indicesMdd] - 4대 지수 MDD 맵
 * @param {boolean} [props.isMasked] - 마스킹 적용 여부 (부모 전달 또는 Context 연동)
 * @returns {JSX.Element}
 */
export default function MobileMddSummaryCard({
  portfolioReturn,
  portfolioMdd,
  indicesMdd = {},
  isMasked: isMaskedProp,
}) {
  const { isMasked: isMaskedContext, maskValue } = useMasking();

  // props로 직접 주입된 마스킹 플래그가 있으면 우선 사용, 없으면 Context 사용
  const effectiveMasked = isMaskedProp !== undefined ? isMaskedProp : isMaskedContext;

  // 포트폴리오 기간 수익률 텍스트
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

  // 포트폴리오 MDD 텍스트
  const displayPortfolioMdd = useMemo(() => {
    return formatPercent(portfolioMdd, false);
  }, [portfolioMdd]);

  // 4대 지수 MDD 매핑 텍스트
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
    <div
      data-testid="mdd-summary-card"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5"
    >
      {/* 카드 타이틀 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold text-slate-200">성과 및 최대 낙폭 (MDD) 비교</h2>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">단위: %</span>
      </div>

      {/* 헤드라인: 내 포트폴리오 성과 (수익률 + MDD) */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
        {/* 포트폴리오 수익률 */}
        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 font-semibold block">포트폴리오 수익률</span>
          <div className="flex items-center gap-1">
            {isPositive && <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            {isNegative && <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
            {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span
              data-testid="masked-return"
              className={`text-base font-extrabold font-mono tracking-tight ${
                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {displayReturn}
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-700/80 mx-2" />

        {/* 포트폴리오 MDD */}
        <div className="space-y-0.5 text-right">
          <span className="text-[10px] text-slate-400 font-semibold block">포트폴리오 MDD</span>
          <span
            data-testid="portfolio-mdd-value"
            className="text-base font-extrabold font-mono text-rose-400 tracking-tight"
          >
            {displayPortfolioMdd}
          </span>
        </div>
      </div>

      {/* 하위 4열 그리드: 4대 지수 기간 MDD */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 block mb-1.5 px-0.5">
          4대 주요 지수 MDD
        </span>
        <div className="grid grid-cols-4 gap-2">
          {TARGET_INDICES.map((idx) => {
            const mddText = indexMddMap[idx.key];
            return (
              <div
                key={idx.key}
                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2 text-center"
              >
                <span className="text-[10px] font-bold text-slate-400 block truncate mb-0.5">
                  {idx.name}
                </span>
                <span
                  data-testid={idx.testId}
                  className="text-xs font-extrabold font-mono text-rose-400/90 block"
                >
                  {mddText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

