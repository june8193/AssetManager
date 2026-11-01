import React from 'react';
import { ListChecks, Plus, Trash2, ArrowRight } from 'lucide-react';
import { formatWithCommas, getAccountDisplayName } from '../../../utils/snapshotCalculator';

/**
 * 증권 및 은행 상세 화면에서 사용하는 공통 거래 내역 입력/조회 테이블 컴포넌트
 */
export const TransactionTable = ({
  accId,
  isBrokerage = true,
  accounts = [],
  incomingTransfers = [],
  existingTxs = [],
  newTransactions = [],
  loadingExistingTxs = false,
  inputDate = '',
  onAddTx,
  onRemoveTx,
  onUpdateTx,
}) => {
  const eligibleTargetAccounts = accounts.filter(
    (a) => a.is_active && String(a.id) !== String(accId)
  );

  return (
    <div className="space-y-4" data-testid={`transaction-table-${accId}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <ListChecks size={18} className="text-slate-500" /> 기간 내 거래 내역 (기존: {existingTxs.length}건 / 신규: {newTransactions.length}건
          {incomingTransfers.length > 0 ? ` / 이체 입금: ${incomingTransfers.length}건` : ''})
        </h4>
        <button
          type="button"
          onClick={() => onAddTx?.(accId)}
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 border border-blue-100"
        >
          <Plus size={14} /> 신규 거래 추가
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 sticky top-0">
            <tr>
              <th className="px-3 py-3 font-semibold w-[15%]">날짜</th>
              <th className="px-3 py-3 font-semibold w-[25%]">종목</th>
              <th className="px-3 py-3 font-semibold w-[15%]">유형</th>
              <th className="px-3 py-3 font-semibold w-[20%] text-right">금액/수량</th>
              <th className="px-3 py-3 font-semibold w-[15%]">메모</th>
              <th className="px-3 py-3 font-semibold w-[10%] text-center">동작</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* 기존 거래 내역 (읽기 전용) */}
            {loadingExistingTxs ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-slate-400">기존 거래 내역 불러오는 중...</td>
              </tr>
            ) : existingTxs.length === 0 && newTransactions.length === 0 && incomingTransfers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-slate-400">기록된 거래 내역이 없습니다. 신규 거래를 추가해 보세요.</td>
              </tr>
            ) : (
              existingTxs.map((tx) => {
                const displayAmount =
                  tx.currency === 'USD'
                    ? `$${Number(tx.total_amount || 0).toLocaleString()}`
                    : `${Number(tx.total_amount || 0).toLocaleString()}원`;
                const isStock = tx.asset_ticker && tx.asset_ticker !== 'KRW' && tx.asset_ticker !== 'USD';
                const displayValue = isStock
                  ? `${Number(tx.quantity || 0).toLocaleString()}주 / ${displayAmount}`
                  : displayAmount;

                return (
                  <tr key={tx.id} className="bg-slate-50/50 text-slate-500 hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono">{tx.transaction_date}</td>
                    <td className="px-3 py-3">
                      {tx.asset_name ? (
                        <div>
                          <span className="font-semibold text-slate-700">{tx.asset_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">({tx.asset_ticker})</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-1.5 py-0.5 rounded-full font-bold text-[9px] bg-slate-200 text-slate-600">
                        {tx.type} (기존)
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-medium text-slate-700">
                      {displayValue}
                    </td>
                    <td className="px-3 py-3 text-slate-400 truncate max-w-[150px]" title={tx.memo}>
                      {tx.memo || '-'}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px] text-slate-400 font-medium">읽기 전용</td>
                  </tr>
                );
              })
            )}

            {/* 타 계좌발 연동 이체 입금 내역 (읽기 전용) */}
            {incomingTransfers.map((tx, idx) => (
              <tr key={`incoming-${idx}`} className="bg-purple-50/40 text-slate-700 hover:bg-purple-50/60 border-l-4 border-purple-400">
                <td className="px-3 py-3 font-mono">{tx.date || tx.transaction_date || inputDate}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-purple-900">{tx.source_account_name}</span>
                    <span className="text-[10px] text-purple-600 bg-purple-100 px-1 py-0.5 rounded font-medium flex items-center gap-0.5">
                      <ArrowRight size={10} /> 출발
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="px-1.5 py-0.5 rounded-full font-bold text-[9px] bg-purple-100 text-purple-700 border border-purple-200">
                    DEPOSIT (이체 연동: {tx.source_account_name})
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono font-semibold text-purple-900">
                  {formatWithCommas(tx.amount || tx.total_amount || 0)}원
                </td>
                <td className="px-3 py-3 text-purple-700 truncate max-w-[150px]" title={tx.memo}>
                  {tx.memo || '-'}
                </td>
                <td className="px-3 py-3 text-center text-[10px] text-purple-600 font-medium">
                  읽기 전용 (이체 연동)
                </td>
              </tr>
            ))}

            {/* 신규 거래 내역 (편집 가능) */}
            {newTransactions.map((tx, idx) => {
              const isTransfer = tx.type === 'TRANSFER';
              const newTxAssetName = tx.currency === 'USD' ? '달러 예수금' : '원화 예수금';
              const newTxAssetTicker = tx.currency === 'USD' ? 'USD' : 'KRW';

              return (
                <tr key={`new-${idx}`} className="bg-blue-50/10 hover:bg-blue-50/20">
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={tx.date || inputDate}
                      onChange={(e) => onUpdateTx?.(accId, idx, 'date', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {isTransfer ? (
                      <div>
                        <select
                          aria-label="도착 계좌"
                          value={tx.target_account_id || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            onUpdateTx?.(accId, idx, 'target_account_id', val);
                          }}
                          className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium ${
                            !tx.target_account_id ? 'border-amber-300 text-amber-700 bg-amber-50/30' : 'border-slate-200 text-slate-700'
                          }`}
                        >
                          <option value="">-- 도착 계좌 선택 --</option>
                          {eligibleTargetAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {getAccountDisplayName(a)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">{newTxAssetName}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-1">({newTxAssetTicker})</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <select
                        value={tx.type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          onUpdateTx?.(accId, idx, 'type', newType);
                          if (newType === 'TRANSFER') {
                            onUpdateTx?.(accId, idx, 'currency', 'KRW');
                          }
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
                      >
                        <option value="DEPOSIT">입금</option>
                        <option value="WITHDRAW">출금</option>
                        <option value="TRANSFER">이체</option>
                        <option value="INTEREST">이자</option>
                        <option value="FEE">수수료</option>
                        <option value="TAX">세금</option>
                        {!isBrokerage && <option value="CASH_ADJUSTMENT">현금 보정</option>}
                      </select>
                      {isBrokerage && !isTransfer && (
                        <select
                          value={tx.currency}
                          onChange={(e) => onUpdateTx?.(accId, idx, 'currency', e.target.value)}
                          className="px-1 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="KRW">KRW</option>
                          <option value="USD">USD</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="금액"
                        value={formatWithCommas(tx.amount)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          onUpdateTx?.(accId, idx, 'amount', raw);
                        }}
                        className="w-full pl-2 pr-6 py-1 text-xs text-right border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono font-medium"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                        {isTransfer ? '₩' : isBrokerage ? (tx.currency === 'USD' ? '$' : '₩') : '₩'}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      placeholder="메모 (선택)"
                      value={tx.memo}
                      onChange={(e) => onUpdateTx?.(accId, idx, 'memo', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveTx?.(accId, idx)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors inline-flex items-center justify-center"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
