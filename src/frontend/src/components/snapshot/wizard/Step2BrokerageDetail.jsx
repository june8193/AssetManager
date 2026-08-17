import React from 'react';
import { Check, Wallet, RefreshCw, HelpCircle, CheckCircle2 } from 'lucide-react';
import { formatWithCommas, getAccountDisplayName } from '../../../utils/snapshotCalculator';
import { TransactionTable } from './TransactionTable';

/**
 * 2단계: 증권 계좌 상세 입력 (거래 내역, 원화/달러 예수금 잔액, 정산 계산 및 확정)
 */
export const Step2BrokerageDetail = ({
  currentAccIdx = 0,
  selectedBrokerageIds = [],
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
  calculateAccountDiff,
  handleConfirmAccount,
}) => {
  const accId = selectedBrokerageIds[currentAccIdx];
  const acc = accounts.find((a) => a.id === accId);
  if (!acc) return null;

  const data = accountsFormData[accId] || { newTransactions: [], currentKrw: '0', currentUsd: '0' };
  const calc = data.calcResult;

  return (
    <div className="space-y-8 animate-in fade-in duration-500" data-testid="step-2-brokerage-detail">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">증권사 상세 정보 입력</h2>
          <p className="text-slate-500">선택한 증권 계좌별 상세 잔고 및 자산 정보를 입력합니다.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
          <span className="text-sm font-bold text-blue-600">{currentAccIdx + 1}</span>
          <span className="text-sm text-slate-400">/</span>
          <span className="text-sm font-medium text-slate-600">{selectedBrokerageIds.length} 계좌</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
            {acc.provider ? acc.provider[0] : '증'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-900">{getAccountDisplayName(acc)}</h3>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">증권</span>
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
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">원화 잔액</p>
                <p className="text-lg font-mono font-bold text-slate-800">
                  {Math.round(parseFloat(data.currentKrw || 0)).toLocaleString()}원
                </p>
              </div>
              <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">달러 잔액</p>
                <p className="text-lg font-mono font-bold text-slate-800">
                  {parseFloat(data.currentUsd || 0).toLocaleString()}$
                </p>
              </div>
              {calc && (
                <>
                  <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">기간 입금액</p>
                    <p className="text-lg font-mono font-bold text-slate-800">
                      {Math.round(calc.period_deposit || 0).toLocaleString()}원
                    </p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">기간 수익</p>
                    <p
                      className={`text-lg font-mono font-bold ${
                        calc.period_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {calc.period_profit > 0 ? '+' : ''}
                      {Math.round(calc.period_profit || 0).toLocaleString()}원
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
              isBrokerage={true}
              existingTxs={existingTxs[accId] || []}
              newTransactions={data.newTransactions || []}
              loadingExistingTxs={loadingExistingTxs}
              inputDate={inputDate}
              onAddTx={addTx}
              onRemoveTx={removeTx}
              onUpdateTx={updateTx}
            />

            {/* 잔고 입력 및 결과 */}
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 space-y-6">
                <h4 className="font-bold text-blue-900 flex items-center gap-2">
                  <Wallet size={18} /> 현재 예수금 잔액 입력
                </h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor={`krw-balance-${accId}`}
                      className="text-xs font-bold text-blue-700 uppercase tracking-wider"
                    >
                      원화 잔액 (KRW)
                    </label>
                    <div className="relative">
                      <input
                        id={`krw-balance-${accId}`}
                        type="text"
                        value={formatWithCommas(data.currentKrw)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          updateAccData?.(accId, { currentKrw: raw });
                        }}
                        className="w-full pl-4 pr-12 py-3 bg-white border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono font-bold text-lg"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">원</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor={`usd-balance-${accId}`}
                      className="text-xs font-bold text-blue-700 uppercase tracking-wider"
                    >
                      달러 잔액 (USD)
                    </label>
                    <div className="relative">
                      <input
                        id={`usd-balance-${accId}`}
                        type="text"
                        value={formatWithCommas(data.currentUsd)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          updateAccData?.(accId, { currentUsd: raw });
                        }}
                        className="w-full pl-4 pr-12 py-3 bg-white border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono font-bold text-lg"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => calculateAccountDiff?.(accId)}
                  disabled={processing}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:bg-blue-300"
                >
                  {processing ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                  정산 결과 계산하기
                </button>
              </div>

              {calc && calc.need_last_exchange_rate && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <HelpCircle size={18} className="text-amber-600" />
                    이전 스냅샷 일자({calc.last_snapshot_date})의 환율 정보가 없습니다.
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed font-medium">
                    정확한 정산 계산(해외 자산의 이전 평가액 계산)을 위해 이전 스냅샷 일자의 환율 정보가 필요합니다.{' '}
                    <br />
                    <strong>[DB 관리 &gt; 마스터 관리 &gt; 환율 관리]</strong> 메뉴에서{' '}
                    <strong>{calc.last_snapshot_date}</strong> 일자의 환율(USD/KRW)을 등록한 후 다시 정산 계산을 시도해
                    주세요.
                  </p>
                  <div className="flex gap-3">
                    <a
                      href="/db"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-center text-xs transition-all shadow-sm"
                    >
                      DB 관리 바로가기 (새창)
                    </a>
                    <button
                      type="button"
                      onClick={() => calculateAccountDiff?.(accId)}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-md shadow-amber-100"
                    >
                      <RefreshCw size={14} /> 다시 계산하기
                    </button>
                  </div>
                </div>
              )}

              {calc && !calc.need_last_exchange_rate && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-500" /> 계산 결과
                    </h4>
                    <div className="relative group/tooltip">
                      <HelpCircle
                        size={16}
                        className="text-slate-400 hover:text-slate-600 cursor-help transition-colors"
                      />
                      <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50 normal-case font-normal leading-relaxed">
                        입력하신 현재 잔고와 거래 내역을 바탕으로 산출된 정산 결과입니다. 원화/달러 예수금의 보정액은 하단
                        '종목별 기간수익 상세'의 예수금 항목 기간 수익에 자동으로 반영됩니다.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">기간 입금액</p>
                      <p className="text-lg font-mono font-bold text-slate-700">
                        {Math.round(calc.period_deposit || 0).toLocaleString()}원
                      </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">기간 수익</p>
                      <p
                        className={`text-lg font-mono font-bold ${
                          calc.period_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {calc.period_profit > 0 ? '+' : ''}
                        {Math.round(calc.period_profit || 0).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleConfirmAccount?.(accId)}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={20} /> 이 결과로 확정
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
