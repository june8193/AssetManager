import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Tag, AlertCircle } from 'lucide-react';
import { expenseService } from '../services/expenseService';

const PRESET_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#95A5A6',
  '#8B5CF6', '#EC4899', '#10B981', '#F59E0B',
  '#E056FD', '#686DE0', '#30336B', '#22A6B3',
];

/**
 * 지출 카테고리 마스터 관리 모달 컴포넌트입니다.
 * 2차 카테고리 체계가 폐지되고 단일 카테고리 목록으로 일원화되었습니다.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Function} [props.onSuccess] - 변경 완료 시 콜백
 */
export default function ExpenseCategoriesModal({ isOpen, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 폼 입력 상태
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#FF6B6B',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const cats = await expenseService.getCategories();
      setCategories(cats || []);
    } catch (err) {
      setError(err.message || '카테고리 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      color: '#FF6B6B',
    });
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (cat) => {
    setIsAdding(false);
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      color: cat.color || '#95A5A6',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('카테고리명을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (editingId) {
        await expenseService.updateCategory(editingId, formData);
      } else {
        await expenseService.createCategory(formData);
      }

      resetForm();
      await fetchCategories();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '카테고리 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`'${name}' 카테고리를 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await expenseService.deleteCategory(id);
      await fetchCategories();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || '카테고리 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      data-testid="expense-categories-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">지출 카테고리 관리</h2>
              <p className="text-xs text-slate-500">지출 카테고리(식비, 구독료 등) 분류를 관리합니다</p>
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
                총 {categories.length}개의 카테고리 등록됨
              </span>
              <button
                onClick={handleStartAdd}
                data-testid="add-cat-button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>카테고리 추가</span>
              </button>
            </div>
          )}

          {/* 등록 / 수정 폼 */}
          {(isAdding || editingId !== null) && (
            <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">
                  {editingId !== null ? '카테고리 정보 수정' : '새 카테고리 추가'}
                </span>
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  취소
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">카테고리명 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 식비, 구독료, 반려동물"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">대표 색상</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-24 px-2 py-1 font-mono text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                    />
                    <div 
                      className="px-2.5 py-1 rounded text-[11px] font-semibold text-white shadow-sm flex items-center gap-1"
                      style={{ backgroundColor: formData.color }}
                    >
                      <span>미리보기: {formData.name || '카테고리'}</span>
                    </div>
                  </div>

                  {/* 프리셋 팔레트 */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        aria-label={`색상 선택: ${c}`}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          formData.color.toLowerCase() === c.toLowerCase()
                            ? 'scale-125 border-slate-800 ring-2 ring-emerald-400'
                            : 'border-white hover:scale-110 shadow-sm'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {editingId !== null ? '수정 저장' : '등록하기'}
                </button>
              </div>
            </form>
          )}

          {/* 카테고리 목록 그리드/테이블 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  등록된 지출 카테고리가 없습니다.
                </div>
              ) : (
                categories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0 border border-black/10"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-slate-800">{cat.name}</span>
                      {cat.is_default && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">
                          기본
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 text-[11px] uppercase mr-2">
                        {cat.color}
                      </span>
                      <button
                        onClick={() => handleStartEdit(cat)}
                        aria-label={`수정: ${cat.name}`}
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        aria-label={`삭제: ${cat.name}`}
                        title="삭제"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
