import React from 'react';
import { getAccountDisplayName } from '../../../utils/snapshotCalculator';

/**
 * 3단계: 은행 계좌 선택 화면
 */
export const Step3BankSelect = ({
  bankAccounts = [],
  selectedAccountIds = [],
  loadingAccounts = false,
  toggleAccountSelection,
  selectAllBank,
}) => {
  const isAllBankSelected =
    bankAccounts.length > 0 &&
    bankAccounts.every((a) => selectedAccountIds.includes(a.id));

  const selectedBankCount = selectedAccountIds.filter((id) =>
    bankAccounts.some((acc) => acc.id === id)
  ).length;

  return (
    <div className="py-2 space-y-8 animate-in fade-in duration-500" data-testid="step-3-bank-select">
      <div>
        <h2 className="text-xl font-semibold mb-2">은행 계좌 선택</h2>
        <p className="text-slate-500 mb-6">스냅샷에 포함할 은행 계좌를 선택해주세요.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-700">은행 계좌 목록 ({bankAccounts.length})</h3>
          <span className="text-xs text-slate-400 font-medium">선택됨: {selectedBankCount}개</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    aria-label="은행 계좌 전체 선택"
                    className="rounded text-blue-600 focus:ring-blue-500"
                    checked={isAllBankSelected}
                    onChange={(e) => selectAllBank?.(e.target.checked)}
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-slate-600">소유자</th>
                <th className="px-4 py-3 font-semibold text-slate-600">금융기관</th>
                <th className="px-4 py-3 font-semibold text-slate-600">계좌명(번호)</th>
                <th className="px-4 py-3 font-semibold text-slate-600">별칭</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingAccounts ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-400">
                    계좌 목록을 불러오는 중...
                  </td>
                </tr>
              ) : bankAccounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-400">
                    활성화된 은행 계좌가 없습니다.
                  </td>
                </tr>
              ) : (
                bankAccounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      selectedAccountIds.includes(acc.id) ? 'bg-blue-50/30' : ''
                    }`}
                    onClick={() => toggleAccountSelection?.(acc.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`${acc.name} 선택`}
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedAccountIds.includes(acc.id)}
                        onChange={() => toggleAccountSelection?.(acc.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{acc.user_name}</td>
                    <td className="px-4 py-3 text-slate-600">{acc.provider}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{getAccountDisplayName(acc)}</td>
                    <td className="px-4 py-3 text-slate-500">{acc.alias || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
