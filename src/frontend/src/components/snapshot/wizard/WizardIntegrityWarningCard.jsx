import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * 스냅샷 위저드 정합성 이상 경고 및 사용자 확인 체크박스 공통 카드 컴포넌트
 */
export const WizardIntegrityWarningCard = ({
  title = '정합성 이상 감지',
  warnings = [],
  confirmed = false,
  onConfirmChange,
  checkboxLabel = '비정상 차액/수익 발생을 확인하였으며 계속 진행합니다',
  testId = 'integrity-warning-card',
}) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div
      data-testid={testId}
      className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 space-y-3 animate-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
        <AlertTriangle size={18} className="text-rose-600 shrink-0" />
        <span>{title}</span>
      </div>
      <ul className="text-xs list-disc list-inside space-y-1 text-rose-700 font-medium">
        {warnings.map((msg, idx) => (
          <li key={idx}>{msg}</li>
        ))}
      </ul>
      {onConfirmChange && (
        <div className="pt-2 border-t border-rose-200/60">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-rose-900 select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => onConfirmChange(e.target.checked)}
              data-testid="integrity-confirm-checkbox"
              className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
            />
            {checkboxLabel}
          </label>
        </div>
      )}
    </div>
  );
};
