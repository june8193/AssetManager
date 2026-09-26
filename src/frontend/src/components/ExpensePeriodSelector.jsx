import React, { useMemo } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';

/**
 * 년월(YYYY-MM)과 오프셋(과거 개월 수)을 받아 과거 년월 문자열을 반환하는 헬퍼 함수
 * @param {string} ym - 기준 년월 (YYYY-MM)
 * @param {number} offsetMonths - 과거로 이동할 개월 수
 * @returns {string} 계산된 과거 년월 (YYYY-MM)
 */
export function getPastMonth(ym, offsetMonths) {
  if (!ym) return ym;
  const [yearStr, monthStr] = ym.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10);
  if (isNaN(y) || isNaN(m)) return ym;

  for (let i = 0; i < offsetMonths; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

const PRESETS = [
  { id: '1m', label: '당월', offset: 0 },
  { id: '3m', label: '3개월', offset: 2 },
  { id: '6m', label: '6개월', offset: 5 },
  { id: '1y', label: '1년', offset: 11 },
  { id: 'ytd', label: '올해 누적' },
];

/**
 * 지출 기간 선택 공통 컴포넌트입니다.
 * 5종 프리셋(당월, 3개월, 6개월, 1년, 올해 누적)과 시작월~종료월 직접 선택 콤보박스를 지원합니다.
 *
 * @param {Object} props
 * @param {string} props.startMonth - 조회 시작년월 (YYYY-MM)
 * @param {string} props.endMonth - 조회 종료년월 (YYYY-MM)
 * @param {Function} props.onChange - 기간 변경 콜백 ({ startMonth, endMonth, preset })
 * @param {Array<string>} [props.monthOptions] - 선택 가능한 년월 옵션 배열
 * @param {string} [props.className] - 추가 스타일 클래스
 */
export default function ExpensePeriodSelector({
  startMonth,
  endMonth,
  onChange,
  monthOptions = [],
  className = '',
}) {
  // 현재 선택된 상태가 어떤 프리셋에 해당하는지 계산
  const activePreset = useMemo(() => {
    if (!startMonth || !endMonth) return 'custom';

    const endYear = endMonth.split('-')[0];
    const ytdStart = `${endYear}-01`;

    if (startMonth === endMonth) {
      return '1m';
    }
    if (startMonth === getPastMonth(endMonth, 2)) {
      return '3m';
    }
    if (startMonth === getPastMonth(endMonth, 5)) {
      return '6m';
    }
    if (startMonth === getPastMonth(endMonth, 11)) {
      return '1y';
    }
    if (startMonth === ytdStart) {
      return 'ytd';
    }
    return 'custom';
  }, [startMonth, endMonth]);

  // 프리셋 클릭 핸들러
  const handlePresetClick = (presetId) => {
    // 종료월이 없으면 기본적으로 monthOptions의 첫 번째(최신) 또는 현재 월
    const baseEnd = endMonth || monthOptions[0] || new Date().toISOString().slice(0, 7);
    let newStart = baseEnd;
    let newEnd = baseEnd;

    if (presetId === '1m') {
      newStart = baseEnd;
    } else if (presetId === '3m') {
      newStart = getPastMonth(baseEnd, 2);
    } else if (presetId === '6m') {
      newStart = getPastMonth(baseEnd, 5);
    } else if (presetId === '1y') {
      newStart = getPastMonth(baseEnd, 11);
    } else if (presetId === 'ytd') {
      const year = baseEnd.split('-')[0];
      newStart = `${year}-01`;
    }

    onChange({
      startMonth: newStart,
      endMonth: newEnd,
      preset: presetId,
    });
  };

  // 시작월 드롭다운 변경 핸들러
  const handleStartMonthChange = (e) => {
    const val = e.target.value;
    let newEnd = endMonth;
    // 시작월이 종료월보다 미래인 경우 종료월을 시작월과 동일하게 맞춤
    if (newEnd && val > newEnd) {
      newEnd = val;
    }
    onChange({
      startMonth: val,
      endMonth: newEnd,
      preset: 'custom',
    });
  };

  // 종료월 드롭다운 변경 핸들러
  const handleEndMonthChange = (e) => {
    const val = e.target.value;
    let newStart = startMonth;
    // 종료월이 시작월보다 과거인 경우 시작월을 종료월과 동일하게 맞춤
    if (newStart && val < newStart) {
      newStart = val;
    }
    onChange({
      startMonth: newStart,
      endMonth: val,
      preset: 'custom',
    });
  };

  // 월 옵션이 없는 경우 기본 24개월 생성
  const options = useMemo(() => {
    if (monthOptions && monthOptions.length > 0) {
      return monthOptions;
    }
    const list = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    for (let i = 0; i < 24; i++) {
      list.push(`${y}-${String(m).padStart(2, '0')}`);
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return list;
  }, [monthOptions]);

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200 p-1.5 rounded-xl ${className}`}
      data-testid="expense-period-selector"
    >
      {/* 1. 프리셋 버튼 그룹 */}
      <div className="inline-flex rounded-lg bg-white border border-slate-200/80 p-0.5 shadow-xs">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-200 hidden sm:block" />

      {/* 2. 시작월 ~ 종료월 직접 선택 드롭다운 */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <Calendar size={15} className="text-slate-400 flex-shrink-0" />
        <select
          value={startMonth}
          onChange={handleStartMonthChange}
          aria-label="시작년월 선택"
          className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((ym) => (
            <option key={`start-${ym}`} value={ym}>
              {ym}
            </option>
          ))}
        </select>
        <span className="text-slate-400">~</span>
        <select
          value={endMonth}
          onChange={handleEndMonthChange}
          aria-label="종료년월 선택"
          className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((ym) => (
            <option key={`end-${ym}`} value={ym}>
              {ym}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
