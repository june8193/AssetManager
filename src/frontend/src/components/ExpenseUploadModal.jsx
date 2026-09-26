import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Check,
  CreditCard,
  Building,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { expenseService } from '../services/expenseService';

/**
 * 명세서 업로드 및 검토 모달 컴포넌트입니다.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 열림 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Function} [props.onSuccess] - 등록 완료 콜백
 * @param {Array} [props.paymentMethods] - 결제수단 목록 (선택)
 * @param {Array} [props.categories] - 카테고리 목록 (선택)
 */
export default function ExpenseUploadModal({
  isOpen,
  onClose,
  onSuccess,
  paymentMethods: propPaymentMethods,
  categories: propCategories,
}) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview'
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);

  const [paymentMethods, setPaymentMethods] = useState(propPaymentMethods || []);
  const [categories, setCategories] = useState(propCategories || []);

  // 프리뷰 상태
  const [previewData, setPreviewData] = useState(null);
  const [previewTransactions, setPreviewTransactions] = useState([]);
  const [previewPaymentMethodId, setPreviewPaymentMethodId] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (propPaymentMethods) {
      setPaymentMethods(propPaymentMethods);
    } else if (isOpen) {
      expenseService
        .getPaymentMethods()
        .then((res) => setPaymentMethods(res || []))
        .catch((err) => console.error('결제수단 목록 조회 실패:', err));
    }
  }, [propPaymentMethods, isOpen]);

  useEffect(() => {
    if (propCategories) {
      setCategories(propCategories);
    } else if (isOpen) {
      expenseService
        .getCategories()
        .then((res) => setCategories(res || []))
        .catch((err) => console.error('카테고리 목록 조회 실패:', err));
    }
  }, [propCategories, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // 모달 닫힐 때 상태 리셋
      setStep('upload');
      setFile(null);
      setPassword('');
      setSelectedPaymentMethodId('');
      setError(null);
      setPreviewData(null);
      setPreviewTransactions([]);
      setPreviewPaymentMethodId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- 업로드 핸들러 ---
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setError(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleParsePreview = async () => {
    if (!file) {
      setError('업로드할 명세서 파일을 선택해주세요.');
      return;
    }
    if (!selectedPaymentMethodId) {
      setError('결제수단을 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const parsed = await expenseService.uploadPreview(
        file,
        password || undefined,
        Number(selectedPaymentMethodId)
      );

      setPreviewData(parsed);
      setPreviewTransactions(parsed.transactions || []);
      setPreviewPaymentMethodId(
        parsed.payment_method?.id || Number(selectedPaymentMethodId)
      );
      setStep('preview');
    } catch (err) {
      setError(err.message || '명세서 복호화 및 파싱에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --- 프리뷰 조작 핸들러 ---
  const handleToggleExclude = (index) => {
    setPreviewTransactions((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, is_excluded: !item.is_excluded } : item
      )
    );
  };

  const handleCategoryChange = (index, categoryId) => {
    setPreviewTransactions((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, category_id: categoryId ? Number(categoryId) : null } : item
      )
    );
  };

  const handleMemoChange = (index, newMemo) => {
    setPreviewTransactions((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, memo: newMemo } : item))
    );
  };

  // --- 통계 집계 계산 ---
  const totalCount = previewTransactions.length;
  const totalAmount = previewTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const includedItems = previewTransactions.filter((item) => !item.is_excluded);
  const includedCount = includedItems.length;
  const includedAmount = includedItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const excludedItems = previewTransactions.filter((item) => item.is_excluded);
  const excludedCount = excludedItems.length;
  const excludedAmount = excludedItems.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // --- 커밋 (확정 덮어쓰기) 핸들러 ---
  const handleCommit = async () => {
    if (!previewPaymentMethodId) {
      setError('결제수단이 지정되지 않았습니다.');
      return;
    }

    try {
      setCommitting(true);
      setError(null);

      const payload = {
        payment_method_id: previewPaymentMethodId,
        year_month: previewData.year_month,
        source_file: previewData.source_file || file?.name,
        items: previewTransactions.map((tx) => ({
          transaction_date: tx.transaction_date,
          year_month: tx.year_month,
          merchant: tx.merchant,
          amount: tx.amount,
          category_id: tx.category_id,
          is_excluded: tx.is_excluded,
          memo: tx.memo,
          original_type: tx.original_type,
        })),
      };

      const result = await expenseService.commitExpenses(payload);
      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      setError(err.message || '지출 데이터 저장에 실패했습니다.');
    } finally {
      setCommitting(false);
    }
  };

  const currentPaymentMethod = paymentMethods.find((pm) => pm.id === previewPaymentMethodId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          step === 'upload' ? 'w-full max-w-xl' : 'w-full max-w-5xl h-[90vh]'
        }`}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-850">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors mr-1"
                title="파일 다시 선택"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" />
              {step === 'upload' ? '명세서 업로드 및 검토' : '명세서 거래 미리보기 및 확정'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 에러 메시지 배너 */}
        {error && (
          <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Step 1: 업로드 및 옵션 입력 */}
        {step === 'upload' && (
          <div className="p-6 space-y-5">
            {/* 드래그앤드롭 영역 */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30 bg-slate-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.html,.htm"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full mb-3">
                    {file.name.endsWith('.html') || file.name.endsWith('.htm') ? (
                      <FileText className="w-8 h-8" />
                    ) : (
                      <FileSpreadsheet className="w-8 h-8" />
                    )}
                  </div>
                  <p className="font-semibold text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB · 클릭하여 변경
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full mb-3">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    파일을 드래그하여 놓거나 클릭하여 선택하세요
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    현대카드 보안 HTML (.html) 또는 카카오뱅크 통장내역 (.xlsx)
                  </p>
                </div>
              )}
            </div>

            {/* 결제수단 선택 (필수) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                결제수단 선택 (필수)
              </label>
              <select
                value={selectedPaymentMethodId}
                onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">결제수단을 선택해주세요</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    [{pm.owner}] {pm.alias || pm.institution} ({pm.account_number || pm.institution})
                  </option>
                ))}
              </select>
            </div>

            {/* 비밀번호 입력 (선택 사항) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                복호화 비밀번호 (선택)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="미입력 시 기본 비밀번호 사용 (생년월일 6자리)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                등록된 결제수단의 기본 비밀번호 또는 settings.toml의 [expenses] 기본값이 자동 적용됩니다.
              </p>
            </div>

            {/* 하단 버튼 */}
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleParsePreview}
                disabled={!file || !selectedPaymentMethodId || loading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>파싱 중...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>미리보기 파싱</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 프리뷰 및 검토 테이블 */}
        {step === 'preview' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* 상단 메타 바 */}
            <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-400">청구년월:</span>
                  <span className="font-semibold text-slate-100">{previewData.year_month}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-400">결제수단:</span>
                  <select
                    value={previewPaymentMethodId || ''}
                    onChange={(e) => setPreviewPaymentMethodId(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500"
                  >
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        [{pm.owner}] {pm.alias || pm.institution} ({pm.account_number || pm.institution})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                  <span>출처:</span>
                  <span className="text-slate-300 truncate max-w-xs">{previewData.source_file}</span>
                </div>
              </div>

              {/* 요약 뱃지 */}
              <div className="flex items-center gap-3 text-xs">
                <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
                  <span className="text-slate-400">총 거래:</span>
                  <span className="font-semibold text-slate-200">{totalCount}건</span>
                  <span className="font-bold text-slate-100">{totalAmount.toLocaleString()}원</span>
                </div>
                <div className="bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/30 flex items-center gap-2">
                  <span className="text-blue-300">통계 반영:</span>
                  <span className="font-semibold text-blue-200">{includedCount}건</span>
                  <span className="font-bold text-blue-400">{includedAmount.toLocaleString()}원</span>
                </div>
                {excludedCount > 0 && (
                  <div className="bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30 flex items-center gap-2">
                    <span className="text-amber-300">통계 제외:</span>
                    <span className="font-semibold text-amber-200">{excludedCount}건</span>
                    <span className="font-bold text-amber-400">{excludedAmount.toLocaleString()}원</span>
                  </div>
                )}
              </div>
            </div>

            {/* 덮어쓰기 안내 알림 */}
            <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                확정 시 <strong>{previewData.year_month}</strong> 기준{' '}
                <strong>{currentPaymentMethod?.alias || currentPaymentMethod?.institution || '해당 결제수단'}</strong>의 기존
                데이터를 모두 삭제하고 현재 명세서 목록으로 <strong>완전히 덮어씁니다(대체)</strong>.
              </span>
            </div>

            {/* 테이블 영역 */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-850 text-slate-400 border-b border-slate-700 uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-4 w-24 text-center">통계 제외</th>
                    <th className="py-2.5 px-3 w-32">거래일시</th>
                    <th className="py-2.5 px-3">가맹점 / 내용</th>
                    <th className="py-2.5 px-3 w-24">구분</th>
                    <th className="py-2.5 px-3 w-28 text-right">금액</th>
                    <th className="py-2.5 px-3 w-36">카테고리</th>
                    <th className="py-2.5 px-3 w-40">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {previewTransactions.map((tx, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-700/30 transition-colors ${
                        tx.is_excluded ? 'bg-slate-900/30 opacity-60' : ''
                      }`}
                    >
                      {/* 제외 체크박스 */}
                      <td className="py-2.5 px-4 text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tx.is_excluded}
                            onChange={() => handleToggleExclude(idx)}
                            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* 거래일시 */}
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {tx.transaction_date}
                      </td>

                      {/* 가맹점 */}
                      <td className="py-2.5 px-3 font-medium text-slate-100">
                        {tx.merchant}
                      </td>

                      {/* 원본구분 */}
                      <td className="py-2.5 px-3 text-slate-400">
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-700/50">
                          {tx.original_type || '-'}
                        </span>
                      </td>

                      {/* 금액 */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-right text-slate-100">
                        {Number(tx.amount).toLocaleString()}원
                      </td>

                      {/* 카테고리 */}
                      <td className="py-2.5 px-3">
                        <select
                          value={tx.category_id || ''}
                          onChange={(e) => handleCategoryChange(idx, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">카테고리 선택</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 메모 */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={tx.memo || ''}
                          onChange={(e) => handleMemoChange(idx, e.target.value)}
                          placeholder="메모 입력"
                          className="w-full bg-slate-900/60 border border-slate-700/60 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 하단 커밋 버튼 바 */}
            <div className="px-6 py-4 border-t border-slate-700 bg-slate-850 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>파일 다시 선택</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={committing || totalCount === 0}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                >
                  {committing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>등록 및 덮어쓰기</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
