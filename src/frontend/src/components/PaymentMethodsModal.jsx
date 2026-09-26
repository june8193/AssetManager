import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { expenseService } from '../services/expenseService';

/**
 * 결제수단 마스터 관리 모달 컴포넌트입니다.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Function} [props.onSuccess] - 변경 완료 시 콜백
 */
export default function PaymentMethodsModal({ isOpen, onClose, onSuccess }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 폼 입력 상태
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    owner: '장준',
    institution: '',
    alias: '',
    account_number: '',
    default_password: '',
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchMethods();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const fetchMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await expenseService.getPaymentMethods();
      setMethods(data || []);
    } catch (err) {
      setError(err.message || '결제수단 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      owner: '장준',
      institution: '',
      alias: '',
      account_number: '',
      default_password: '',
      is_active: true,
    });
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (item) => {
    setIsAdding(false);
    setEditingId(item.id);
    setFormData({
      owner: item.owner,
      institution: item.institution,
      alias: item.alias || '',
      account_number: item.account_number || '',
      default_password: item.default_password || '',
      is_active: item.is_active,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.institution.trim()) {
      setError('금융기관명을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (editingId) {
        await expenseService.updatePaymentMethod(editingId, formData);
      } else {
        await expenseService.createPaymentMethod(formData);
      }
      resetForm();
      await fetchMethods();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '결제수단 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`'${name}' 결제수단을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await expenseService.deletePaymentMethod(id);
      await fetchMethods();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '결제수단 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      data-testid="payment-methods-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">결제수단 관리</h2>
              <p className="text-xs text-slate-500">카드 및 계좌의 소유주, 식별번호, 자동 복호화 비밀번호를 관리합니다</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 에러 배너 */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* 모달 본문 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* 상단 액션: 추가 버튼 */}
          {!isAdding && editingId === null && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500">
                총 {methods.length}개의 결제수단 등록됨
              </span>
              <button
                onClick={handleStartAdd}
                data-testid="add-pm-button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>결제수단 추가</span>
              </button>
            </div>
          )}

          {/* 등록 / 수정 폼 */}
          {(isAdding || editingId !== null) && (
            <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">
                  {editingId !== null ? '결제수단 정보 수정' : '새 결제수단 추가'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  취소
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">소유주</label>
                  <select
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="장준">장준</option>
                    <option value="성은">성은</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">금융기관 / 카드사 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 현대카드, 카카오뱅크"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">별칭 (표시명)</label>
                  <input
                    type="text"
                    placeholder="예: 장준 현대카드"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">식별번호 (끝 4자리 등)</label>
                  <input
                    type="text"
                    placeholder="예: 1002, 3333"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">기본 복호화 비밀번호</label>
                  <input
                    type="password"
                    placeholder="예: 950811"
                    value={formData.default_password}
                    onChange={(e) => setFormData({ ...formData, default_password: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>결제수단 활성화</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingId !== null ? '수정 저장' : '등록하기'}
                </button>
              </div>
            </form>
          )}

          {/* 결제수단 목록 테이블 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">소유주</th>
                  <th className="px-3 py-2.5">기관 / 별칭</th>
                  <th className="px-3 py-2.5">식별번호</th>
                  <th className="px-3 py-2.5">비밀번호</th>
                  <th className="px-3 py-2.5 text-center">상태</th>
                  <th className="px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {methods.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-400">
                      등록된 결제수단이 없습니다.
                    </td>
                  </tr>
                ) : (
                  methods.map((pm) => (
                    <tr key={pm.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          pm.owner === '장준' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {pm.owner}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800">{pm.alias || pm.institution}</div>
                        <div className="text-[11px] text-slate-400">{pm.institution}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {pm.account_number || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-400">
                        {pm.default_password ? '••••••' : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          pm.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {pm.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(pm)}
                            aria-label={`수정: ${pm.alias || pm.institution}`}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(pm.id, pm.alias || pm.institution)}
                            aria-label={`삭제: ${pm.alias || pm.institution}`}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
