import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Edit2, Trash2, Filter, AlertCircle, Search, Ban } from 'lucide-react';
import { expenseService } from '../services/expenseService';

/**
 * 가맹점 키워드 자동분류 규칙 관리 전용 모달 컴포넌트입니다.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Function} [props.onSuccess] - 변경 완료 시 콜백
 * @param {Array} [props.categories] - 전달받은 카테고리 목록 (미전달 시 직접 조회)
 */
export default function ExpenseRulesModal({ isOpen, onClose, onSuccess, categories: propCategories }) {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState(propCategories || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 실시간 검색어 상태
  const [searchKeyword, setSearchKeyword] = useState('');

  // 폼 상태
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    keyword: '',
    category_id: '',
    is_excluded: false,
  });

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
    } else if (isOpen) {
      expenseService
        .getCategories()
        .then((res) => setCategories(res || []))
        .catch((err) => console.error('카테고리 목록 조회 실패:', err));
    }
  }, [propCategories, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchRules();
    } else {
      resetForm();
      setSearchKeyword('');
    }
  }, [isOpen]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await expenseService.getRules();
      setRules(data || []);
    } catch (err) {
      setError(err.message || '규칙 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      keyword: '',
      category_id: '',
      is_excluded: false,
    });
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (rule) => {
    setIsAdding(false);
    setEditingId(rule.id);
    setFormData({
      keyword: rule.keyword,
      category_id: rule.category_id !== null && rule.category_id !== undefined ? String(rule.category_id) : '',
      is_excluded: Boolean(rule.is_excluded),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanKeyword = formData.keyword.trim();
    if (!cleanKeyword) {
      setError('키워드를 입력해주세요.');
      return;
    }

    if (!formData.is_excluded && !formData.category_id) {
      setError('카테고리를 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        keyword: cleanKeyword,
        category_id: formData.is_excluded ? null : Number(formData.category_id),
        is_excluded: formData.is_excluded,
      };

      if (editingId) {
        await expenseService.updateRule(editingId, payload);
      } else {
        await expenseService.createRule(payload);
      }

      resetForm();
      await fetchRules();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '규칙 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, keyword) => {
    if (!window.confirm(`'${keyword}' 규칙을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await expenseService.deleteRule(id);
      await fetchRules();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '규칙 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 실시간 검색 필터링
  const filteredRules = useMemo(() => {
    if (!searchKeyword.trim()) return rules;
    const q = searchKeyword.trim().toLowerCase();
    return rules.filter((r) => {
      const kw = (r.keyword || '').toLowerCase();
      const cat = (r.category_name || '').toLowerCase();
      const typeStr = r.is_excluded ? '통계 제외' : '카테고리 분류';
      return kw.includes(q) || cat.includes(q) || typeStr.includes(q);
    });
  }, [rules, searchKeyword]);

  // 날짜 포맷팅
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return dateStr;
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}.${m}.${d}`;
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      data-testid="expense-rules-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Filter size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">자동분류 규칙 관리</h2>
              <p className="text-xs text-slate-500">
                가맹점명 키워드 매칭을 통해 카테고리를 자동 지정하거나 통계에서 제외합니다
              </p>
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
          
          {/* 상단 검색 및 추가 버튼 액션 바 */}
          {!isAdding && editingId === null && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="키워드 또는 카테고리 검색..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <span className="text-xs font-semibold text-slate-500">
                  총 {rules.length}개의 규칙
                </span>
                <button
                  onClick={handleStartAdd}
                  data-testid="add-rule-button"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  <span>규칙 추가</span>
                </button>
              </div>
            </div>
          )}

          {/* 등록 / 수정 폼 */}
          {(isAdding || editingId !== null) && (
            <form noValidate onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-800">
                  {editingId !== null ? '분류 규칙 정보 수정' : '새 분류 규칙 추가'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  취소
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* 1. 동작 유형 라디오 */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">규칙 동작 유형</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="rule_type"
                        checked={!formData.is_excluded}
                        onChange={() => setFormData({ ...formData, is_excluded: false })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>카테고리 분류</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="rule_type"
                        checked={formData.is_excluded}
                        onChange={() => setFormData({ ...formData, is_excluded: true, category_id: '' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-amber-700">통계 제외</span>
                    </label>
                  </div>
                </div>

                {/* 2. 키워드 입력 */}
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">가맹점 키워드 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 쿠팡, 스타벅스, 카드대금"
                    value={formData.keyword}
                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    대소문자를 구분하지 않고 가맹점명에 키워드가 포함(부분 일치)되면 자동 적용됩니다.
                  </p>
                </div>

                {/* 3. 카테고리 드롭다운 */}
                <div>
                  <label htmlFor="rule-category-select" className="block text-slate-600 mb-1 font-medium">
                    적용 카테고리
                  </label>
                  <select
                    id="rule-category-select"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    disabled={formData.is_excluded}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {formData.is_excluded && (
                    <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-[11px] flex items-center gap-1.5">
                      <Ban size={14} className="shrink-0 text-amber-500" />
                      <span>이 키워드가 매칭되면 통계 집계에서 자동 제외됩니다 (카드대금, 이체 등 이중집계 방지).</span>
                    </div>
                  )}
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
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editingId !== null ? '수정 저장' : '등록하기'}
                </button>
              </div>
            </form>
          )}

          {/* 규칙 목록 테이블 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">키워드</th>
                  <th className="px-3 py-2.5">매칭 분류 동작</th>
                  <th className="px-3 py-2.5">등록일자</th>
                  <th className="px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400">
                      {rules.length === 0
                        ? '등록된 자동분류 규칙이 없습니다.'
                        : '검색 조건에 일치하는 규칙이 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 키워드 */}
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {rule.keyword}
                        </span>
                      </td>

                      {/* 매칭 결과 (카테고리 또는 통계 제외) */}
                      <td className="px-3 py-2.5">
                        {rule.is_excluded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Ban size={12} className="text-amber-500" />
                            <span>통계 제외</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0 border border-black/10"
                              style={{ backgroundColor: rule.category_color || '#94A3B8' }}
                            />
                            <span className="font-semibold text-slate-800">
                              {rule.category_name || `카테고리 #${rule.category_id}`}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 등록일자 */}
                      <td className="px-3 py-2.5 font-mono text-slate-400 text-[11px]">
                        {formatDate(rule.created_at)}
                      </td>

                      {/* 관리 버튼 */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(rule)}
                            aria-label={`수정: ${rule.keyword}`}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id, rule.keyword)}
                            aria-label={`삭제: ${rule.keyword}`}
                            title="삭제"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
