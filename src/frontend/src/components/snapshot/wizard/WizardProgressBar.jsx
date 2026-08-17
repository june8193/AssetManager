import React from 'react';
import { Settings, ListChecks, Landmark, FileSearch, Check } from 'lucide-react';

export const DEFAULT_STEPS = [
  { id: 1, label: '기본 정보/증권 선택', icon: <Settings size={18} /> },
  { id: 2, label: '증권 상세 입력', icon: <ListChecks size={18} /> },
  { id: 3, label: '은행 계좌 선택', icon: <Landmark size={18} /> },
  { id: 4, label: '은행 상세 입력', icon: <ListChecks size={18} /> },
  { id: 5, label: '최종 확인', icon: <FileSearch size={18} /> },
];

/**
 * 위저드 상단 단계 진행률 프로그레스바 컴포넌트
 */
export const WizardProgressBar = ({ step = 1, totalSteps = 5, steps = DEFAULT_STEPS }) => {
  return (
    <div className="mb-10" data-testid="wizard-progress-bar">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 transition-all duration-300 -z-10"
          style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
        ></div>

        {steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                step > s.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : step === s.id
                  ? 'bg-white border-blue-600 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              {step > s.id ? <Check size={20} /> : s.icon}
            </div>
            <span
              className={`text-xs mt-2 font-medium ${
                step === s.id ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
