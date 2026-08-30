import { useState } from 'react';
import { PieChart, ChevronDown } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const CATEGORY_COLORS = [
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-slate-500',
];

/**
 * 모바일 카테고리별 자산 비중 요약 카드
 * - 주요 카테고리별 평가액, 비중(%) 바 렌더링
 * - 항목 클릭 시 하위 카테고리(중분류) 아코디언 확장/축소
 * - 마스킹(***) 연동
 *
 * @param {Object} props
 * @param {Array<Object>} props.categories - 카테고리별 자산 목록
 * @param {number} props.totalValuation - 총 평가액
 */
export default function MobileCategoryBreakdownCard({ categories = [], totalValuation = 0 }) {
  const { maskValue } = useMasking();
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const toggleCategory = (categoryName) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">자산 비중</h3>
            <span className="text-[10px] text-slate-400 font-medium">카테고리별 분포</span>
          </div>
        </div>
      </div>

      {/* 카테고리 리스트 */}
      <div className="space-y-3.5">
        {categories.map((cat, idx) => {
          const isExpanded = expandedCategories.has(cat.category);
          const percentage = totalValuation > 0 ? (cat.value_krw / totalValuation) * 100 : 0;
          const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const hasSubCategories = cat.sub_categories && cat.sub_categories.length > 0;

          return (
            <div
              key={cat.category}
              className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3 transition-colors hover:bg-slate-800/70"
            >
              {/* 대분류 헤더 (터치 가능) */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.category)}
                className="w-full text-left focus:outline-none"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
                    <span className="text-xs font-bold text-slate-200">{cat.category}</span>
                    {hasSubCategories && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-sky-400' : ''
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400">
                      {maskValue(Math.round(cat.value_krw).toLocaleString())} 원
                    </span>
                    <span className="text-xs font-extrabold text-white min-w-[42px] text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 프로그레스 바 */}
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                  />
                </div>
              </button>

              {/* 하위 중분류 아코디언 */}
              {isExpanded && hasSubCategories && (
                <div className="mt-3 pt-2.5 border-t border-slate-700/50 space-y-2 pl-2">
                  {cat.sub_categories.map((sub) => {
                    const subPercentage =
                      totalValuation > 0 ? (sub.value_krw / totalValuation) * 100 : 0;
                    return (
                      <div key={sub.category} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">{sub.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">
                            {maskValue(Math.round(sub.value_krw).toLocaleString())} 원
                          </span>
                          <span className="text-slate-300 font-semibold min-w-[36px] text-right">
                            {subPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
