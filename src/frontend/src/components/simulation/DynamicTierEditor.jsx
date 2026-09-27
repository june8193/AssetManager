import React from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

/**
 * 다단계 공포 매수 트리거(티어) 편집 컴포넌트입니다.
 * 사용자가 공포 단계(낙폭 기준 %, VIX 임계값, 목표 주식 비중 %)를 추가/수정/삭제할 수 있습니다.
 *
 * @param {Object} props
 * @param {Array} props.tiers - 현재 티어 목록 [{ tier, dd_threshold, vix_threshold, target_stock_ratio }]
 * @param {Function} props.onChange - 티어 목록 변경 시 호출되는 콜백 함수
 */
const DynamicTierEditor = ({ tiers = [], onChange }) => {
  // 개별 티어 속성 변경 핸들러
  const handleTierChange = (index, field, value) => {
    const numericValue = value === '' ? 0 : parseFloat(value);
    const updatedTiers = tiers.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          [field]: isNaN(numericValue) ? item[field] : numericValue,
        };
      }
      return item;
    });
    onChange(updatedTiers);
  };

  // 새 티어 단계 추가
  const handleAddTier = () => {
    const nextTierNum = tiers.length + 1;
    const lastTier = tiers[tiers.length - 1];
    const newTier = {
      tier: nextTierNum,
      dd_threshold: lastTier ? Math.min(-5, lastTier.dd_threshold - 10) : -10.0,
      vix_threshold: lastTier ? lastTier.vix_threshold + 5.0 : 25.0,
      target_stock_ratio: lastTier ? Math.min(100.0, lastTier.target_stock_ratio + 10.0) : 75.0,
    };
    onChange([...tiers, newTier]);
  };

  // 티어 단계 삭제
  const handleDeleteTier = (indexToDelete) => {
    const filtered = tiers.filter((_, idx) => idx !== indexToDelete);
    // 티어 번호 재정렬
    const renumbered = filtered.map((item, idx) => ({
      ...item,
      tier: idx + 1,
    }));
    onChange(renumbered);
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-500" />
          다단계 공포 매수 조건 (AND)
        </h2>
        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
          {tiers.length}단계 설정됨
        </span>
      </div>

      {/* 티어 행 목록 */}
      <div className="space-y-3">
        {tiers.map((tierItem, index) => (
          <div
            key={`tier-${tierItem.tier}`}
            className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100/80 space-y-2.5 transition-all hover:border-slate-200"
          >

            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200/50 shadow-xs">
                {tierItem.tier}단계
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-blue-600">
                  주식 {tierItem.target_stock_ratio}%
                </span>
                <button
                  type="button"
                  aria-label={`${tierItem.tier}단계 티어 삭제`}
                  onClick={() => handleDeleteTier(index)}
                  disabled={tiers.length <= 1}
                  className={`p-1.5 rounded-lg transition-colors ${
                    tiers.length <= 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* 입력 인풋 그리드 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  낙폭(DD) ≤ (%)
                </label>
                <input
                  type="number"
                  step="1"
                  value={tierItem.dd_threshold}
                  onChange={(e) => handleTierChange(index, 'dd_threshold', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  VIX ≥ (pt)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={tierItem.vix_threshold}
                  onChange={(e) => handleTierChange(index, 'vix_threshold', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  목표 주식 (%)
                </label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={tierItem.target_stock_ratio}
                  onChange={(e) => handleTierChange(index, 'target_stock_ratio', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 단계 추가 버튼 */}
      <button
        type="button"
        onClick={handleAddTier}
        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-dashed border-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
      >
        <Plus size={14} />
        단계 추가 (Add Tier)
      </button>

      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
        * 조건 충족 당일 즉시 주식 비중을 확대하며, 월말 점검일에 공포가 해소되면 평상시 기본 비중으로 복귀합니다.
      </p>
    </div>
  );
};

export default DynamicTierEditor;
