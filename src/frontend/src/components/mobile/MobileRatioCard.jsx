import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 대분류별 테마 색상 정의
 */
const MAJOR_THEMES = {
  주식: {
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    barColor: 'bg-indigo-500',
    borderColor: 'border-indigo-500/20',
  },
  배당주: {
    badgeBg: 'bg-pink-500/10',
    badgeText: 'text-pink-400',
    barColor: 'bg-pink-500',
    borderColor: 'border-pink-500/20',
  },
  현금: {
    badgeBg: 'bg-teal-500/10',
    badgeText: 'text-teal-400',
    barColor: 'bg-teal-500',
    borderColor: 'border-teal-500/20',
  },
  채권: {
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    barColor: 'bg-amber-500',
    borderColor: 'border-amber-500/20',
  },
};

const DEFAULT_THEME = {
  badgeBg: 'bg-sky-500/10',
  badgeText: 'text-sky-400',
  barColor: 'bg-sky-500',
  borderColor: 'border-slate-800',
};

/**
 * 모바일 비중 카드 컴포넌트 (Read-Only)
 * - 자산군/종목별 현재 평가액, 현재 비중(%), 목표 비중(%), 편차(%), 리밸런싱 필요 금액 렌더링
 * - 진행률 바(Progress Bar) 및 상태 배지(초과/부족/적정) 시각화
 * - 하위 카테고리/종목 아코디언 확장 지원
 */
export default function MobileRatioCard({ item, totalValuation = 0, level = 'major' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { maskValue } = useMasking();

  if (!item) return null;

  const displayName = item.name || item.category_name || item.ticker || '기타';
  const currentValue = item.current_value !== undefined ? item.current_value : (item.valuation_krw || 0);
  const targetPercentage = item.target_percentage || 0;

  // 현재 비중 계산
  const currentRatio = item.current_ratio !== undefined
    ? item.current_ratio
    : (totalValuation > 0 ? (currentValue / totalValuation) * 100 : 0);

  // 비중 편차 (%p)
  const diffRatio = item.diff_ratio !== undefined
    ? item.diff_ratio
    : currentRatio - targetPercentage;

  // 리밸런싱 필요 금액
  const diffAmt = item.diff_amt !== undefined ? item.diff_amt : 0;

  // 목표 비중 설정 여부 판별 (0% 초과인 경우만 목표 설정된 것으로 간주)
  const hasTarget = targetPercentage !== undefined && targetPercentage !== null && Number(targetPercentage) > 0;

  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const theme = MAJOR_THEMES[displayName] || DEFAULT_THEME;

  // 상태 배지 판별
  // diffAmt > 0 : 목표치보다 부족 -> 매수 필요
  // diffAmt < 0 : 목표치보다 초과 -> 매도 필요
  const isOver = hasTarget && (diffRatio > 0.5 || diffAmt < -1000);
  const isUnder = hasTarget && (diffRatio < -0.5 || diffAmt > 1000);
  const isBalanced = hasTarget && !isOver && !isUnder;

  const formatMoney = (val) => {
    const formatted = Math.round(Math.abs(val)).toLocaleString();
    return maskValue(formatted);
  };

  const getCardStyle = () => {
    if (level === 'major') {
      return 'bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm';
    }
    if (level === 'sub') {
      return 'bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5';
    }
    return 'bg-slate-900/60 border border-slate-800/80 rounded-xl p-3';
  };

  return (
    <div className={`${getCardStyle()} transition-all duration-200`}>
      {/* 카드 헤더 / 메인 정보 영역 */}
      <button
        type="button"
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        className={`w-full text-left flex flex-col gap-2.5 ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm flex items-center gap-1.5">
              {level === 'major' && (
                <span className={`w-2 h-2 rounded-full ${theme.barColor}`} />
              )}
              {displayName}
            </span>

            {/* 상태 배지 (목표 비중이 설정된 경우에만 표시) */}
            {hasTarget && isBalanced && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                적정
              </span>
            )}
            {hasTarget && isUnder && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <TrendingUp className="w-2.5 h-2.5" />
                매수 필요
              </span>
            )}
            {hasTarget && isOver && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <TrendingDown className="w-2.5 h-2.5" />
                매도 필요
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-right font-mono">
              <span className="text-xs font-extrabold text-white">
                {formatMoney(currentValue)}
              </span>
              <span className="text-[10px] text-slate-400 ml-0.5">원</span>
            </div>

            {hasChildren && (
              <div className="text-slate-400 p-0.5">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-sky-400" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* 비중 및 진행률 바 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">
                현재 <strong className="text-white font-bold">{currentRatio.toFixed(1)}%</strong>
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-[11px] text-slate-400 font-medium">
                목표{' '}
                {hasTarget ? (
                  <strong className="text-sky-400 font-bold">{targetPercentage.toFixed(1)}%</strong>
                ) : (
                  <strong className="text-slate-500 font-bold">-</strong>
                )}
              </span>
            </div>

            {/* 편차 %p (목표 비중이 설정된 경우에만 표시) */}
            {hasTarget && (
              <div className="text-[11px] font-mono font-bold">
                {diffRatio > 0 ? (
                  <span className="text-amber-400">+{diffRatio.toFixed(1)}%p</span>
                ) : diffRatio < 0 ? (
                  <span className="text-sky-400">{diffRatio.toFixed(1)}%p</span>
                ) : (
                  <span className="text-slate-400">0.0%p</span>
                )}
              </div>
            )}
          </div>

          {/* 게이지 바 */}
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                hasTarget
                  ? isOver
                    ? 'bg-amber-400'
                    : isUnder
                    ? 'bg-sky-400'
                    : 'bg-emerald-400'
                  : 'bg-slate-600'
              }`}
              style={{ width: `${Math.min(Math.max(currentRatio, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* 리밸런싱 조정 필요 금액 (목표 비중이 설정된 경우에만 표시) */}
        {hasTarget && Math.abs(diffAmt) >= 1 && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">
              {diffAmt > 0 ? '매수 필요' : '매도 필요'}
            </span>
            <span
              className={`font-mono font-bold ${
                diffAmt > 0 ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {diffAmt > 0 ? '+' : '-'}
              {formatMoney(diffAmt)}
              <span className="text-[9px] font-normal text-slate-400 ml-0.5">원</span>
            </span>
          </div>
        )}
      </button>

      {/* 하위 아코디언 영역 (중분류 / 종목) */}
      {hasChildren && isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold px-1">
            <Layers className="w-3 h-3 text-sky-400" />
            <span>하위 포트폴리오 비중 ({item.children.length}개)</span>
          </div>

          {item.children.map((child, idx) => (
            <MobileRatioCard
              key={child.category_name || child.name || child.ticker || idx}
              item={child}
              totalValuation={currentValue || totalValuation}
              level={level === 'major' ? 'sub' : 'stock'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
