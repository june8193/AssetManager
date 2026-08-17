import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * 과거 확정된 스냅샷 기준일 이전 거래 조작 시 스냅샷 정합성 영향을 안내하는 경고 모달 컴포넌트
 */
export const PastTransactionWarningModal = ({
  isOpen = false,
  title = '과거 거래 조작 경고',
  actionType = '추가', // '추가' | '수정' | '삭제'
  transactionDate = '',
  latestSnapshotDate = '',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="past-tx-warning-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden border border-rose-100 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 text-rose-600 mb-3">
            <div className="p-2.5 bg-rose-50 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{title}</h3>
              <p className="text-xs text-rose-600 font-semibold">스냅샷 결산 데이터 정합성 주의</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p>
              선택하신 거래 일자(<strong className="text-slate-900">{transactionDate}</strong>)는 이미 확정된
              최신 스냅샷 기준일(<strong className="text-slate-900">{latestSnapshotDate}</strong>) 이전(또는 당일)입니다.
            </p>
            <p className="text-xs text-rose-700 font-medium">
              ⚠️ 과거 일자의 거래를 {actionType}할 경우 해당 기간 및 이후 스냅샷의 결산 수익, 잔액 데이터와 불일치가 발생할 수 있습니다.
              조작 완료 후 <strong>[스냅샷 재계산]</strong>을 수행해야 전체 정합성이 유지됩니다.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              data-testid="past-tx-cancel-btn"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              data-testid="past-tx-confirm-btn"
              className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200"
            >
              확인 및 진행
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
