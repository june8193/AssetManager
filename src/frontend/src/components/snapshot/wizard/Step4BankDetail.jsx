import React from 'react';
import { Check, Landmark, RefreshCw } from 'lucide-react';
import { formatWithCommas, getAccountDisplayName } from '../../../utils/snapshotCalculator';
import { TransactionTable } from './TransactionTable';

/**
 * 4단계: 은행 계좌 상세 입력 (신규 거래 내역, 예상 잔액 계산 및 실제 최종 잔액 입력, 확정)
 */
export const Step4BankDetail = ({
  currentAccIdx = 0,
  selectedBankIds = [],
  accounts = [],
  accountsFormData = {},
  inputDate = '',
  processing = false,
  existingTxs = {},
  loadingExistingTxs = false,
  updateAccData,
  addTx,
  removeTx,
  updateTx,
  calculateBankDiff,
  handleConfirmAccount,
}) => {
  const accId = selectedBankIds[currentAccIdx];
  const acc = accounts.find((a) => a.id === accId);
  if (!acc) return null;

  const data = accountsFormData[accId] || { newTransactions: [], totalValuation: '0' };
  const calc = data.calcResult;

  return (
    <div className="space-y-8 animate-in fade-in duration-500" data-testid="step-4-bank-detail">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">은행 상세 정보 입력</h2>
          <p className="text-slate-500">선택한 은행 계좌별 신규 내역 및 최종 잔액을 입력합니다.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
          <span className="text-sm font-bold text-blue-600">{currentAccIdx + 1}</span>
          <span className="text-sm text-slate-400">/</span>
          <span className="text-sm font-medium text-slate-600">{selectedBankIds.length} 계좌</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
            {acc.provider ? acc.provider[0] : '은'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-900">{getAccountDisplayName(acc)}</h3>
              <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">은행</span>
            </div>
            <p className="text-slate-500 text-sm">
              {acc.provider} · {acc.user_name}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">기준 일자</p>
          <p className="font-mono font-bold text-slate-700">{inputDate}</p>
        </div>
      </div>

      <div className="space-y-8">
        {data.isConfirmed ? (
          /* 확정 완료 상태 UI */
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <Check size={20} className="stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 text-lg">정산 결과 확정 완료</h4>
                  <p className="text-emerald-700 text-xs mt-0.5">이 계좌의 정산 결과가 성공적으로 확정되었습니다.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateAccData?.(accId, { isConfirmed: false })}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                수정하기
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-emerald-100">
              <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">최종 잔액</p>
                <p className="text-lg font-mono font-bold text-slate-800">
                  {Math.round(
                    parseFloat(data.totalValuation || (calc?.theoretical_krw || 0))
                  ).toLocaleString()}원
                </p>
              </div>
              {calc && (
                <>
                  <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                      시스템 계산 예상 잔액
                    </p>
                    <p className="text-lg font-mono font-bold text-slate-800">
                      {Math.round(calc.theoretical_krw || 0).toLocaleString()}원
                    </p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                    <p className="text-[10px] font-bold text-emerald-800 tracking-wider mb-1">
                      기간 총 입금 / 출금
                    </p>
                    <p className="text-sm font-mono font-bold text-slate-700">
                      입금: {(calc.total_deposit || 0).toLocaleString()}원 / 출금:{' '}
                      {(calc.total_withdraw || 0).toLocaleString()}원
                    </p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                    <p className="text-[10px] font-bold text-emerald-800 tracking-wider mb-1">
                      이자 / 세금 합계
                    </p>
                    <p className="text-sm font-mono font-bold text-slate-700">
                      이자: +{(calc.total_interest || 0).toLocaleString()}원 / 세금: -
                      {(calc.total_tax || 0).toLocaleString()}원
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* 미확정 상태 UI (입력 폼 및 테이블) */
          <>
            <TransactionTable
              accId={accId}
              isBrokerage={false}
              existingTxs={existingTxs[accId] || []}
              newTransactions={data.newTransactions || []}
              loadingExistingTxs={loadingExistingTxs}
              inputDate={inputDate}
              onAddTx={addTx}
              onRemoveTx={removeTx}
              onUpdateTx={updateTx}
            />

            {/* 최종 잔액 입력 */}
            <div className="space-y-6">
              <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 space-y-6">
                <h4 className="font-bold text-amber-900 flex items-center gap-2">
                  <Landmark size={18} /> 최종 잔액(평가액) 입력
                </h4>

                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => calculateBankDiff?.(accId)}
                    disabled={processing}
                    className="w-full py-3 bg-white border border-amber-200 hover:bg-amber-100 text-amber-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    예상 잔액 계산하기
                  </button>

                  {calc && (
                    <div className="space-y-4">
                      <div className="bg-white/60 p-4 rounded-xl border border-amber-200">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                          시스템 계산 예상 잔액
                        </p>
                        <p className="text-xl font-mono font-bold text-slate-700">
                          {Math.round(calc.theoretical_krw || 0).toLocaleString()}원
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            updateAccData?.(accId, {
                              totalValuation: Math.round(calc.theoretical_krw || 0).toString(),
                            })
                          }
                          className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                        >
                          이 금액 적용하기
                        </button>
                      </div>

                      {/* 은행 계좌 거래 유형별 상세 집계 카드 */}
                      <div className="grid grid-cols-2 gap-3 mt-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-white/40 p-3 rounded-lg border border-amber-100 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-amber-800">기간 총 입금</span>
                          <span className="text-sm font-mono font-bold text-slate-700 mt-1">
                            {(calc.total_deposit || 0).toLocaleString()}원
                          </span>
                        </div>
                        <div className="bg-white/40 p-3 rounded-lg border border-amber-100 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-amber-800">기간 총 출금</span>
                          <span className="text-sm font-mono font-bold text-slate-700 mt-1">
                            {(calc.total_withdraw || 0).toLocaleString()}원
                          </span>
                        </div>
                        <div className="bg-white/40 p-3 rounded-lg border border-amber-100 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-amber-800">이자 합계</span>
                          <span className="text-sm font-mono font-bold text-emerald-600 mt-1">
                            +{(calc.total_interest || 0).toLocaleString()}원
                          </span>
                        </div>
                        <div className="bg-white/40 p-3 rounded-lg border border-amber-100 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-amber-800">세금 합계</span>
                          <span className="text-sm font-mono font-bold text-rose-600 mt-1">
                            -{(calc.total_tax || 0).toLocaleString()}원
                          </span>
                        </div>
                        {calc.total_fee > 0 && (
                          <div className="bg-white/40 p-3 rounded-lg border border-amber-100 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-amber-800">수수료 합계</span>
                            <span className="text-sm font-mono font-bold text-rose-500 mt-1">
                              -{(calc.total_fee || 0).toLocaleString()}원
                            </span>
                          </div>
                        )}
                        {Math.abs(calc.total_adjustment || 0) > 0.01 && (
                          <div className="bg-white/40 p-3 rounded-lg border border-amber-100 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-amber-800">현금보정 합계</span>
                            <span
                              className={`text-sm font-mono font-bold mt-1 ${
                                calc.total_adjustment >= 0 ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {calc.total_adjustment > 0 ? '+' : ''}
                              {(calc.total_adjustment || 0).toLocaleString()}원
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label
                      htmlFor={`total-valuation-${accId}`}
                      className="text-xs font-bold text-amber-700 uppercase tracking-wider"
                    >
                      실제 최종 잔액 (KRW)
                    </label>
                    <div className="relative">
                      <input
                        id={`total-valuation-${accId}`}
                        type="text"
                        value={formatWithCommas(data.totalValuation)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          updateAccData?.(accId, { totalValuation: raw });
                        }}
                        className="w-full pl-4 pr-12 py-3 bg-white border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono font-bold text-lg"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">원</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleConfirmAccount?.(accId)}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 이 결과로 확정
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
