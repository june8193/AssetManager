import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const MAJOR_DOT_COLORS = {
  주식: 'bg-[#3182F6]',
  배당주: 'bg-[#6366F1]',
  현금: 'bg-[#14B8A6]',
  채권: 'bg-[#F59E0B]',
};

const REBALANCE_THRESHOLD = 1000;

/**
 * 모바일 비중 카드 컴포넌트 (Read-Only, 클린 라이트 톤)
 * - 대분류(major)는 단일 흰색 카드, 하위(sub/stock)는 구분선 플랫 행으로 평탄화
 * - 한국 증권앱 기준: 매수 필요 빨강(#F04452), 매도 필요 파랑(#3182F6), 적정 초록(#00A870)
 */
export default function MobileRatioCard({ item, totalValuation = 0, level = 'major' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { maskValue } = useMasking();

  if (!item) return null;

  const displayName = item.name || item.category_name || item.ticker || '기타';
  const currentValue = item.current_value !== undefined ? item.current_value : (item.valuation_krw || 0);
  const targetPercentage = item.target_percentage || 0;

  const currentRatio = item.current_ratio !== undefined
    ? item.current_ratio
    : (totalValuation > 0 ? (currentValue / totalValuation) * 100 : 0);

  const diffRatio = item.diff_ratio !== undefined
    ? item.diff_ratio
    : currentRatio - targetPercentage;

  const diffAmt = item.diff_amt !== undefined ? item.diff_amt : 0;
  const hasTarget = targetPercentage !== undefined && targetPercentage !== null && Number(targetPercentage) > 0;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const dotColor = MAJOR_DOT_COLORS[displayName] || 'bg-[#3182F6]';

  const isOver = hasTarget && diffAmt < -REBALANCE_THRESHOLD;
  const isUnder = hasTarget && diffAmt > REBALANCE_THRESHOLD;
  const isBalanced = hasTarget && Math.abs(diffAmt) <= REBALANCE_THRESHOLD;

  const formatMoney = (val) => {
    const formatted = Math.round(Math.abs(val)).toLocaleString();
    return maskValue(formatted);
  };

  const containerCls =
    level === 'major'
      ? 'bg-white border border-[#E5E8EB]/60 rounded-2xl p-5'
      : level === 'sub'
      ? 'py-3 first:pt-1 last:pb-1 pl-2'
      : 'py-2.5 first:pt-1 last:pb-1 pl-3';

  return (
    <div className={`${containerCls} transition-all duration-200`}>
      {/* 카드 헤더 / 메인 정보 영역 */}
      <button
        type="button"
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        className={`w-full text-left flex flex-col gap-2 ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-[#191F28] text-sm flex items-center gap-2 truncate">
              {level === 'major' && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              )}
              <span className="truncate">{displayName}</span>
            </span>

            {/* 상태 배지 */}
            {hasTarget && (
              isUnder ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF0F1] text-[#F04452] shrink-0">
                  매수 필요
                </span>
              ) : isOver ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F3FF] text-[#3182F6] shrink-0">
                  매도 필요
                </span>
              ) : isBalanced ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8F8F2] text-[#00A870] shrink-0">
                  적정
                </span>
              ) : null
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
            <div className="text-right">
              <span className="text-[13px] font-bold text-[#191F28]">
                {formatMoney(currentValue)}
              </span>
              <span className="text-[11px] text-[#6B7684] ml-0.5">원</span>
            </div>

            {hasChildren && (
              <div className="text-[#8B95A1] p-0.5">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[#3182F6]" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* 비중 및 진행률 바 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#6B7684] font-medium">
                현재 <strong className="text-[#191F28] font-bold">{currentRatio.toFixed(1)}%</strong>
              </span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-xs text-[#6B7684] font-medium">
                목표{' '}
                {hasTarget ? (
                  <strong className="text-[#4E5968] font-semibold">{targetPercentage.toFixed(1)}%</strong>
                ) : (
                  <strong className="text-[#8B95A1] font-medium">-</strong>
                )}
              </span>
            </div>

            {hasTarget && (
              <div className="text-xs font-bold">
                {diffRatio > 0 ? (
                  <span className="text-[#3182F6]">+{diffRatio.toFixed(1)}%p</span>
                ) : diffRatio < 0 ? (
                  <span className="text-[#F04452]">{diffRatio.toFixed(1)}%p</span>
                ) : (
                  <span className="text-[#8B95A1]">0.0%p</span>
                )}
              </div>
            )}
          </div>

          {/* 슬림 게이지 바 */}
          <div className="h-1.5 w-full bg-[#F2F4F6] rounded-full overflow-hidden flex">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                hasTarget
                  ? isOver
                    ? 'bg-[#3182F6]'
                    : isUnder
                    ? 'bg-[#F04452]'
                    : isBalanced
                    ? 'bg-[#00A870]'
                    : 'bg-[#CBD5E1]'
                  : 'bg-[#CBD5E1]'
              }`}
              style={{ width: `${Math.min(Math.max(currentRatio, 0), 100)}%` }}
            />
          </div>
        </div>

        {/* 리밸런싱 조정 필요 금액 */}
        {hasTarget && (isUnder || isOver) && (
          <div className="pt-1 flex items-center justify-between text-xs tabular-nums">
            <span className="text-[#8B95A1] font-medium">
              {diffAmt > 0 ? '매수 필요' : '매도 필요'}
            </span>
            <span
              className={`font-bold ${
                diffAmt > 0 ? 'text-[#F04452]' : 'text-[#3182F6]'
              }`}
            >
              {diffAmt > 0 ? '+' : '-'}
              {formatMoney(diffAmt)}
              <span className="text-[11px] font-normal text-[#6B7684] ml-0.5">원</span>
            </span>
          </div>
        )}
      </button>

      {/* 하위 아코디언 영역 (중분류 / 종목 플랫 리스트) */}
      {hasChildren && isExpanded && (
        <div className="mt-3 pt-3 border-t border-[#F2F4F6]">
          <div className="text-[11px] text-[#8B95A1] font-medium mb-2 pl-2">
            하위 포트폴리오 비중 ({item.children.length}개)
          </div>

          <div className="divide-y divide-[#F2F4F6]">
            {item.children.map((child, idx) => (
              <MobileRatioCard
                key={child.category_name || child.name || child.ticker || idx}
                item={child}
                totalValuation={currentValue || totalValuation}
                level={level === 'major' ? 'sub' : 'stock'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
