import React, { useState } from 'react';
import { RefreshCw, X, AlertTriangle, CheckCircle2, ArrowRight, Layers } from 'lucide-react';
import { DB_API_BASE } from '../../config';

/**
 * 차액 수치에 대한 서식 및 증감 배지 텍스트를 생성하는 헬퍼 함수입니다.

 * 
 * @param {number} diff - 차액 수치
 * @returns {React.ReactNode} 서식화된 차액 요소
 */
const renderDiffBadge = (diff) => {
  if (diff === 0) return null;
  const isPositive = diff > 0;
  return (
    <span className={`ml-1 text-[11px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
      ({isPositive ? '+' : ''}{diff.toLocaleString()}원)
    </span>
  );
};

/**
 * 스냅샷 일괄 재계산 다이얼로그 모달 컴포넌트입니다.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Array} props.accounts - 전체 계좌 목록
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Function} props.onSuccess - 재계산 완료 후 콜백
 */
const SnapshotRecalculateModal = ({ isOpen, accounts = [], onClose, onSuccess }) => {
  const [fromDate, setFromDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [isCommitting, setIsCommitting] = useState(false);

  if (!isOpen) return null;

  /**
   * 재계산 미리보기(Dry Run)를 요청합니다.
   */
  const handlePreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        from_date: fromDate || null,
        account_id: accountId ? parseInt(accountId, 10) : null,
        dry_run: true,
      };

      const response = await fetch(`${DB_API_BASE}/snapshots/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '스냅샷 재계산 미리보기에 실패했습니다.');
      }

      const data = await response.json();
      setPreviewResult(data);
    } catch (err) {
      console.error('스냅샷 재계산 미리보기 오류:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 재계산 결과를 DB에 실제 영속화(Commit)합니다.
   */
  const handleCommit = async () => {
    try {
      setIsCommitting(true);
      setError(null);

      const payload = {
        from_date: fromDate || null,
        account_id: accountId ? parseInt(accountId, 10) : null,
        dry_run: false,
      };

      const response = await fetch(`${DB_API_BASE}/snapshots/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '스냅샷 재계산 데이터 반영에 실패했습니다.');
      }

      const data = await response.json();
      alert(data.summary_message || '스냅샷 재계산이 성공적으로 반영되었습니다.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('스냅샷 재계산 반영 오류:', err);
      setError(err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const changedDiffs = previewResult?.diffs?.filter((d) => d.is_changed) || [];
  const hasChanges = changedDiffs.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">스냅샷 일괄 재계산</h3>
              <p className="text-xs text-slate-500">원장 거래 내역을 기반으로 과거 스냅샷의 입출금 및 기간 수익을 재산출합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 필터 및 조건 입력 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label htmlFor="recalc-from-date" className="block text-xs font-semibold text-slate-600 mb-1.5">
                재계산 시작일
              </label>
              <input
                id="recalc-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreviewResult(null);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">비워둘 경우 전체 기간의 스냅샷을 검토합니다.</p>
            </div>

            <div>
              <label htmlFor="recalc-account-id" className="block text-xs font-semibold text-slate-600 mb-1.5">
                대상 계좌
              </label>
              <select
                id="recalc-account-id"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setPreviewResult(null);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 계좌</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.account_type === 'BANK' ? '은행' : '증권'})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">특정 계좌만 선택하여 재계산할 수 있습니다.</p>
            </div>

            <div className="sm:col-span-2 flex justify-end pt-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={loading || isCommitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                {loading ? '계산 중...' : '미리보기(Dry Run)'}
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 미리보기 결과 영역 */}
          {previewResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200/80 px-4 py-3 rounded-xl text-sm text-blue-900">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-blue-600" />
                  <span className="font-semibold">{previewResult.summary_message}</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">
                  평가 {previewResult.total_snapshots_evaluated}건 / 변경 대상 {previewResult.total_snapshots_updated}건
                </span>
              </div>

              {hasChanges ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">기준일</th>
                          <th className="py-2.5 px-3">계좌명</th>
                          <th className="py-2.5 px-3 text-right">평가액</th>
                          <th className="py-2.5 px-3 text-right">기존 입출금</th>
                          <th className="py-2.5 px-3 text-right">신규 입출금 (차액)</th>
                          <th className="py-2.5 px-3 text-right">기존 기간수익</th>
                          <th className="py-2.5 px-3 text-right">신규 기간수익 (차액)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {changedDiffs.map((diff) => (
                          <tr key={diff.snapshot_id} className="hover:bg-amber-50/50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{diff.snapshot_date}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-700">
                              {diff.account_name}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({diff.account_type === 'BANK' ? '은행' : '증권'})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                              {diff.new_total_valuation.toLocaleString()}원
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{diff.old_period_deposit.toLocaleString()}원</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-600">
                              {diff.new_period_deposit.toLocaleString()}원
                              {renderDiffBadge(diff.diff_period_deposit)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{diff.old_period_profit.toLocaleString()}원</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-600">
                              {diff.new_period_profit.toLocaleString()}원
                              {renderDiffBadge(diff.diff_period_profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">정합성에 이상이 없습니다.</p>
                  <p className="text-xs text-slate-500 mt-1">검토된 모든 스냅샷이 거래 원장과 완벽히 일치합니다.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={!previewResult || !hasChanges || isCommitting || loading}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isCommitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                DB에 반영하는 중...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                재계산 데이터 반영
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnapshotRecalculateModal;

