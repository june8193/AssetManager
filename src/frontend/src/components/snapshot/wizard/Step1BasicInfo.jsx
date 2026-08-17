import React from 'react';
import { Calendar, DollarSign } from 'lucide-react';
import { getAccountDisplayName } from '../../../utils/snapshotCalculator';

/**
 * 1단계: 기본 정보(기준 일자, 환율) 및 증권 계좌 선택 화면
 */
export const Step1BasicInfo = ({
  inputDate,
  setInputDate,
  exchangeRate,
  brokerageAccounts = [],
  selectedAccountIds = [],
  loadingAccounts = false,
  toggleAccountSelection,
  selectAllBrokerage,
}) => {
  const isAllBrokerageSelected =
    brokerageAccounts.length > 0 &&
    brokerageAccounts.every((a) => selectedAccountIds.includes(a.id));

  const selectedBrokerageCount = selectedAccountIds.filter((id) =>
    brokerageAccounts.some((acc) => acc.id === id)
  ).length;

  return (
    <div className="py-2 space-y-8 animate-in fade-in duration-500" data-testid="step-1-basic-info">
      <div>
        <h2 className="text-xl font-semibold mb-2">기본 정보 및 증권 계좌 선택</h2>
        <p className="text-slate-500 mb-6">스냅샷 기준 일자와 대상 증권 계좌를 선택해주세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar size={14} /> 기준 일자
          </label>
          <input
            type="date"
            value={inputDate}
            onChange={(e) => setInputDate?.(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={14} /> 기준 환율 (USD/KRW)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="환율 정보 없음"
            value={exchangeRate}
            readOnly
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none"
            title="환율은 DB에 저장된 최근 환율이 자동으로 적용됩니다."
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-700">증권 계좌 목록 ({brokerageAccounts.length})</h3>
          <span className="text-xs text-slate-400 font-medium">선택됨: {selectedBrokerageCount}개</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    aria-label="증권 계좌 전체 선택"
                    className="rounded text-blue-600 focus:ring-blue-500"
                    checked={isAllBrokerageSelected}
                    onChange={(e) => selectAllBrokerage?.(e.target.checked)}
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
              ) : brokerageAccounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-400">
                    활성화된 증권 계좌가 없습니다.
                  </td>
                </tr>
              ) : (
                brokerageAccounts.map((acc) => (
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
