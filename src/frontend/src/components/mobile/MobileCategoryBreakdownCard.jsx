import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

const CATEGORY_COLORS = [
  '#3182F6',
  '#6366F1',
  '#14B8A6',
  '#F59E0B',
  '#F04452',
  '#8B5CF6',
  '#94A3B8',
];

/**
 * 모바일 카테고리별 자산 비중 요약 카드 (클린 라이트 톤)
 * - 단일 흰색 카드 내 얇은 구분선 플랫 리스트로 중첩 제거
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
    <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5">
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold text-[#191F28] leading-tight">자산 비중</h2>
        <span className="text-[11px] text-[#8B95A1] font-medium">카테고리별 분포</span>
      </div>

      {/* 카테고리 플랫 리스트 */}
      <div className="divide-y divide-[#F2F4F6]">
        {categories.map((cat, idx) => {
          const isExpanded = expandedCategories.has(cat.category);
          const percentage = totalValuation > 0 ? (cat.value_krw / totalValuation) * 100 : 0;
          const colorHex = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const hasSubCategories = cat.sub_categories && cat.sub_categories.length > 0;

          return (
            <div key={cat.category} className="py-3.5 first:pt-1 last:pb-1">
              {/* 대분류 헤더 (터치 가능) */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.category)}
                className="w-full text-left focus:outline-none"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: colorHex }}
                    />
                    <span className="text-[13px] font-semibold text-[#191F28]">{cat.category}</span>
                    {hasSubCategories && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-[#8B95A1] transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-[#3182F6]' : ''
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 tabular-nums">
                    <span className="text-xs font-medium text-[#8B95A1]">
                      {maskValue(Math.round(cat.value_krw).toLocaleString())} 원
                    </span>
                    <span className="text-[13px] font-bold text-[#191F28] min-w-[44px] text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 슬림 프로그레스 바 */}
                <div className="h-1.5 w-full bg-[#F2F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, percentage))}%`,
                      backgroundColor: colorHex,
                    }}
                  />
                </div>
              </button>

              {/* 하위 중분류 아코디언 */}
              {isExpanded && hasSubCategories && (
                <div className="mt-3 pl-4 space-y-2">
                  {cat.sub_categories.map((sub) => {
                    const subPercentage =
                      totalValuation > 0 ? (sub.value_krw / totalValuation) * 100 : 0;
                    return (
                      <div
                        key={sub.category}
                        className="flex items-center justify-between text-xs tabular-nums"
                      >
                        <span className="text-[#4E5968] font-medium">{sub.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#8B95A1]">
                            {maskValue(Math.round(sub.value_krw).toLocaleString())} 원
                          </span>
                          <span className="text-[#4E5968] font-semibold min-w-[38px] text-right">
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
    </section>
  );
}
