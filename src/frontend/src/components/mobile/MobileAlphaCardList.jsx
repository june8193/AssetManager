import { useState, useMemo } from 'react';
import { Award, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 4대 주요 벤치마크 지수 메타데이터 정의
 */
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

/**
 * 수치를 퍼센트 문자열로 포맷팅합니다.
 *
 * @param {number|string|null|undefined} val - 수치
 * @param {boolean} showSign - 양수 부호(+) 노출 여부
 * @returns {string} 포맷팅된 문자열 또는 '-'
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
 * 알파 초과수익률을 %p 문자열로 포맷팅합니다.
 *
 * @param {number|string|null|undefined} val - 알파 수치
 * @returns {string} 포맷팅된 문자열 또는 '-'
 */
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
 * 모바일 알파 초과수익률 컴팩트 카드 리스트 및 상세 데이터 표 토글 컴포넌트
 *
 * 1. 4대 지수(S&P 500, NASDAQ, KOSPI, KOSDAQ)별 알파 초과수익률 컴팩트 카드 4종
 *    - 지수명, 지수 기간 수익률, 내 포트폴리오 수익률, 알파 초과수익률 뱃지
 * 2. 마스킹(`isMasked`) 지원: 포트폴리오 수익률 및 알파 수치 마스킹
 * 3. 우측 상단 아코디언 토글 버튼: '상세 표 보기 / 상세 표 접기'
 * 4. 토글 확장 시 가로 스크롤 정규 상세 데이터 테이블 노출
 *    - 컬럼: 지수명, 지수 수익률, 내 수익률, 알파, 지수 MDD
 *
 * @param {object} props
 * @param {Array<object>} [props.alphaAnalysis] - 백엔드 알파 분석 요약 목록
 * @param {Record<string, number>} [props.indicesMdd] - 4대 지수 MDD 맵
 * @param {number|string|null} [props.portfolioReturn] - 포트폴리오 기간 수익률 fallback
 * @param {boolean} [props.isMasked] - 마스킹 적용 여부
 * @returns {JSX.Element}
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

  // props로 주입된 마스킹 플래그 우선, 없으면 context 사용
  const effectiveMasked = isMaskedProp !== undefined ? isMaskedProp : isMaskedContext;

  // 4대 지수별 데이터 정규화 매핑
  const cardsData = useMemo(() => {
    const hasAlphaAnalysis = Array.isArray(alphaAnalysis) && alphaAnalysis.length > 0;
    const hasIndices = indices && Object.keys(indices).length > 0;

    if (!hasAlphaAnalysis && !hasIndices) {
      return [];
    }

    return TARGET_BENCHMARKS.map((benchmark) => {
      // 1. alphaAnalysis 항목 매칭 (ticker 또는 benchmark명 대소문자 무시)
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

      // 2. indices 객체 매칭 폴백
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

      // MDD 매칭 (indicesMdd 또는 matchedIndex.mdd)
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

  // 마스킹 헬퍼
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
    <div
      data-testid="mobile-alpha-card-list"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5"
    >
      {/* 카드 섹션 헤더 & 아코디언 토글 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-bold text-slate-200">초과수익률 (Alpha) 성과</h2>
        </div>

        {cardsData.length > 0 && (
          <button
            type="button"
            data-testid="alpha-table-toggle-btn"
            aria-expanded={isOpen}
            aria-controls="alpha-detail-table-container"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-sky-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            <span>{isOpen ? '상세 표 접기' : '상세 표 보기'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* 데이터 없음 처리 */}
      {cardsData.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-500 font-medium">
          초과수익률 비교 데이터가 없습니다.
        </div>
      )}

      {/* 1. 컴팩트 카드 리스트 (2열 그리드) */}
      {cardsData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {cardsData.map((item) => (
            <div
              key={item.key}
              data-testid={`alpha-card-${item.key}`}
              className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3 space-y-2"
            >
              {/* 1행: 지수명 & 알파 뱃지 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">{item.name}</span>
                <div
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-extrabold font-mono border ${
                    item.isAlphaPositive
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                      : item.isAlphaNegative
                      ? 'bg-rose-950/60 text-rose-400 border-rose-800/80'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {!effectiveMasked && item.isAlphaPositive && <TrendingUp className="w-3 h-3" />}
                  {!effectiveMasked && item.isAlphaNegative && <TrendingDown className="w-3 h-3" />}
                  {!effectiveMasked && !item.isAlphaPositive && !item.isAlphaNegative && <Minus className="w-3 h-3" />}
                  <span>{getDisplayAlpha(item.alpha)}</span>
                </div>
              </div>

              {/* 2행: 지수 기간 수익률 & 내 포트폴리오 수익률 */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">지수 수익률</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {formatPercent(item.benchmarkReturn, true)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px]">내 수익률</span>
                  <span className="font-mono font-bold text-sky-400">
                    {getDisplayPortfolioReturn(item.portfolioReturn)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. 상세 데이터 표 (아코디언 확장 영역) */}
      {isOpen && cardsData.length > 0 && (
        <div
          id="alpha-detail-table-container"
          className="pt-2 border-t border-slate-800/80 transition-all animate-in fade-in duration-200"
        >
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
            <table data-testid="alpha-detail-table" className="w-full text-xs text-left min-w-[320px]">
              <thead className="bg-slate-800/60 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">지수명</th>
                  <th className="px-3 py-2.5 text-right">지수 수익률</th>
                  <th className="px-3 py-2.5 text-right">내 수익률</th>
                  <th className="px-3 py-2.5 text-right">알파</th>
                  <th className="px-3 py-2.5 text-right">지수 MDD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {cardsData.map((item) => (
                  <tr
                    key={item.key}
                    data-testid={`alpha-table-row-${item.key}`}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-bold text-slate-200 whitespace-nowrap">
                      {item.name}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-300 whitespace-nowrap">
                      {formatPercent(item.benchmarkReturn, true)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-sky-400 whitespace-nowrap">
                      {getDisplayPortfolioReturn(item.portfolioReturn)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap ${
                        item.isAlphaPositive
                          ? 'text-emerald-400'
                          : item.isAlphaNegative
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {getDisplayAlpha(item.alpha)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-rose-400/90 whitespace-nowrap">
                      {formatPercent(item.mdd, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
