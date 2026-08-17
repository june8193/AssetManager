import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { parseCommas, getAccountDisplayName } from '../../../utils/snapshotCalculator';

/**
 * 5단계: 전체 계좌 정산 요약 검토 및 최종 확인 화면
 */
export const Step5FinalConfirm = ({
  accounts = [],
  selectedAccountIds = [],
  accountsFormData = {},
}) => {
  const selectedAccounts = accounts.filter((acc) => selectedAccountIds.includes(acc.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-500" data-testid="step-5-final-confirm">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
        <div className="text-sm text-emerald-800">
          <p className="font-semibold mb-1">모든 계좌 정산 완료</p>
          <p className="opacity-80">
            입력하신 데이터와 계산된 내역이 최종적으로 반영됩니다. 하단의 [저장하기]를 누르면 스냅샷이
            생성됩니다.
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">계좌명</th>
              <th className="px-4 py-3 font-semibold text-slate-600">유형</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">신규 내역</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">정산 결과(차액)</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">기간 입금 / 수익</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">최종 잔액/평가액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selectedAccounts.map((acc) => {
              const data = accountsFormData[acc.id] || {};
              const txCount = (data.newTransactions || []).length;

              let resultElement = <span className="text-slate-400">-</span>;
              let periodElement = <span className="text-slate-400">-</span>;
              let finalValElement = <span className="text-slate-400">-</span>;

              if (acc.account_type === 'BROKERAGE') {
                if (data.calcResult) {
                  const diffKrw = Math.round(data.calcResult.diff_krw || 0);
                  const diffUsd = data.calcResult.diff_usd || 0;
                  resultElement = (
                    <div className="flex flex-col items-end">
                      <span className={diffKrw >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {diffKrw > 0 ? '+' : ''}
                        {diffKrw.toLocaleString()}원
                      </span>
                      {Math.abs(diffUsd) > 0.001 && (
                        <span
                          className={`text-[10px] ${
                            diffUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {diffUsd > 0 ? '+' : ''}
                          {diffUsd.toLocaleString()}$
                        </span>
                      )}
                    </div>
                  );
                }
                finalValElement = (
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-slate-900">
                      {Math.round(parseFloat(data.currentKrw || 0)).toLocaleString()}원
                    </span>
                    {parseFloat(data.currentUsd || 0) > 0 && (
                      <span className="text-[10px] text-slate-500">
                        {parseFloat(data.currentUsd || 0).toLocaleString()}$
                      </span>
                    )}
                  </div>
                );
                if (data.calcResult) {
                  const pDeposit = Math.round(data.calcResult.period_deposit || 0);
                  const pProfit = Math.round(data.calcResult.period_profit || 0);
                  periodElement = (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-600">입금: {pDeposit.toLocaleString()}원</span>
                      <span
                        className={`text-xs font-bold ${
                          pProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        수익: {pProfit > 0 ? '+' : ''}
                        {pProfit.toLocaleString()}원
                      </span>
                    </div>
                  );
                }
              } else {
                // Bank
                const finalVal = data.totalValuation
                  ? parseCommas(data.totalValuation)
                  : data.calcResult?.theoretical_krw || 0;
                finalValElement = (
                  <span className="font-bold text-slate-900">
                    {Math.round(finalVal).toLocaleString()}원
                  </span>
                );

                if (data.calcResult) {
                  const pDeposit = Math.round(data.calcResult.total_deposit || 0);
                  const pWithdraw = Math.round(data.calcResult.total_withdraw || 0);
                  const pInterest = Math.round(data.calcResult.total_interest || 0);
                  const pTax = Math.round(data.calcResult.total_tax || 0);
                  const pFee = Math.round(data.calcResult.total_fee || 0);
                  const pAdjustment = Math.round(data.calcResult.total_adjustment || 0);
                  const pProfit = pInterest - pTax - pFee + pAdjustment;

                  periodElement = (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-600">
                        입금: {pDeposit.toLocaleString()}원 / 출금: {pWithdraw.toLocaleString()}원
                      </span>
                      {pProfit !== 0 && (
                        <span
                          className={`text-xs font-bold ${
                            pProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          이자/기타: {pProfit > 0 ? '+' : ''}
                          {pProfit.toLocaleString()}원
                        </span>
                      )}
                    </div>
                  );

                  // 은행 잔고 보정(차액)
                  const theoretical = data.calcResult.theoretical_krw || 0;
                  const diff = finalVal - theoretical;
                  if (Math.abs(diff) > 0.01) {
                    resultElement = (
                      <span className={diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {diff > 0 ? '+' : ''}
                        {Math.round(diff).toLocaleString()}원 (보정)
                      </span>
                    );
                  }
                }
              }

              return (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-800">{getAccountDisplayName(acc)}</div>
                    <div className="text-[10px] text-slate-400">
                      {acc.provider} · {acc.user_name}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold ${
                        acc.account_type === 'BROKERAGE'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {acc.account_type === 'BROKERAGE' ? '증권' : '은행'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-600">{txCount}건</td>
                  <td className="px-4 py-4 text-right font-mono">{resultElement}</td>
                  <td className="px-4 py-4 text-right font-mono">{periodElement}</td>
                  <td className="px-4 py-4 text-right font-mono">{finalValElement}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
