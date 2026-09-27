import React, { useState } from 'react';
import { Bookmark, BookmarkPlus, Edit3, Trash2, X, AlertTriangle } from 'lucide-react';

/**
 * 동적 리밸런싱 전략 프리셋 툴바 및 CRUD 모달 컴포넌트입니다.
 *
 * @param {Object} props
 * @param {Array} props.presets - 프리셋 목록
 * @param {number|string} props.selectedPresetId - 현재 선택된 프리셋 ID
 * @param {Function} props.onSelectPreset - 프리셋 선택 변경 콜백
 * @param {Function} props.onSaveNewPreset - 새 프리셋 저장 콜백 ({ name, description }) => Promise<void>
 * @param {Function} props.onUpdatePreset - 프리셋 수정 콜백 (id, { name, description }) => Promise<void>
 * @param {Function} props.onDeletePreset - 프리셋 삭제 콜백 (id) => Promise<void>
 * @param {boolean} [props.isLoading=false] - 비동기 처리 중 여부
 */
const DynamicPresetToolbar = ({
  presets = [],
  selectedPresetId,
  onSelectPreset,
  onSaveNewPreset,
  onUpdatePreset,
  onDeletePreset,
  isLoading = false,
}) => {
  // 모달 상태 관리
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // 폼 입력 상태
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const safePresets = Array.isArray(presets) ? presets : [];
  // 현재 선택된 프리셋 객체
  const currentPreset = safePresets.find((p) => p.id === Number(selectedPresetId)) || safePresets[0];

  // 셀렉트박스 변경 핸들러
  const handleSelectChange = (e) => {
    const selectedId = Number(e.target.value);
    const found = safePresets.find((p) => p.id === selectedId);
    if (found && onSelectPreset) {
      onSelectPreset(found);
    }
  };

  // 새 프리셋 저장 모달 열기
  const handleOpenSaveModal = () => {
    setFormName('');
    setFormDesc('');
    setFormError('');
    setIsSaveModalOpen(true);
  };

  // 프리셋 수정 모달 열기
  const handleOpenEditModal = () => {
    if (!currentPreset) return;
    setFormName(currentPreset.name || '');
    setFormDesc(currentPreset.description || '');
    setFormError('');
    setIsEditModalOpen(true);
  };

  // 프리셋 삭제 모달 열기
  const handleOpenDeleteModal = () => {
    if (!currentPreset) return;
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  // 저장 제출 핸들러
  const handleSubmitSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('프리셋 명칭을 입력해주세요.');
      return;
    }
    setFormError('');
    try {
      await onSaveNewPreset({ name: formName.trim(), description: formDesc.trim() || undefined });
      setIsSaveModalOpen(false);
    } catch (err) {
      setFormError(err.message || '저장 중 오류가 발생했습니다.');
    }
  };

  // 수정 제출 핸들러
  const handleSubmitUpdate = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('프리셋 명칭을 입력해주세요.');
      return;
    }
    setFormError('');
    try {
      await onUpdatePreset(currentPreset.id, {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
      });
      setIsEditModalOpen(false);
    } catch (err) {
      setFormError(err.message || '수정 중 오류가 발생했습니다.');
    }
  };

  // 삭제 제출 핸들러
  const handleSubmitDelete = async () => {
    setDeleteError('');
    try {
      await onDeletePreset(currentPreset.id);
      setIsDeleteModalOpen(false);
    } catch (err) {
      setDeleteError(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };


  return (
    <>
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* 좌측: 프리셋 선택 셀렉트박스 */}
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Bookmark size={16} />
          </div>
          <div className="flex-1">
            <label htmlFor="preset-select" className="sr-only">
              전략 프리셋 선택
            </label>
            <select
              id="preset-select"
              aria-label="전략 프리셋 선택"
              value={selectedPresetId || (currentPreset ? currentPreset.id : '')}
              onChange={handleSelectChange}
              disabled={isLoading || safePresets.length === 0}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {safePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.is_default ? `[추천] ${preset.name}` : preset.name}
                </option>
              ))}

            </select>
          </div>
        </div>

        {/* 우측: 프리셋 관리 액션 버튼들 */}
        <div className="flex items-center gap-2">
          {/* 새 프리셋 저장 버튼 */}
          <button
            type="button"
            aria-label="현재 설정 프리셋 저장"
            onClick={handleOpenSaveModal}
            disabled={isLoading}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <BookmarkPlus size={14} />
            프리셋 저장
          </button>

          {/* 현재 프리셋 수정 버튼 */}
          <button
            type="button"
            aria-label="현재 프리셋 수정"
            onClick={handleOpenEditModal}
            disabled={isLoading || !currentPreset}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-200/60"
          >
            <Edit3 size={14} />
            프리셋 수정
          </button>

          {/* 현재 프리셋 삭제 버튼 */}
          <button
            type="button"
            aria-label="현재 프리셋 삭제"
            onClick={handleOpenDeleteModal}
            disabled={isLoading || !currentPreset || currentPreset.is_default}
            title={currentPreset?.is_default ? '기본 추천 프리셋은 삭제할 수 없습니다' : '프리셋 삭제'}
            className={`p-2 rounded-xl transition-all border ${
              currentPreset?.is_default
                ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50/50'
                : 'border-slate-200/60 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
            }`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 1. 새 프리셋 저장 모달 */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <BookmarkPlus size={16} className="text-blue-600" />
                새 전략 프리셋으로 저장
              </h3>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitSave} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  프리셋 명칭 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  aria-label="새 프리셋 명칭"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="예: 공포지수 2단계 분할매수"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">설명 (선택)</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="전략에 대한 간단한 설명을 입력하세요"
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                * 현재 화면에 설정된 기본 주식 비중, 기간, 운용 방식, 추가 적립금 및 다단계 조건이
                함께 저장됩니다.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 프리셋 수정 모달 */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Edit3 size={16} className="text-blue-600" />
                전략 프리셋 수정
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitUpdate} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  프리셋 명칭 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  aria-label="수정할 프리셋 명칭"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">설명 (선택)</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                현재 화면에 조정된 시뮬레이션 설정값(기본 비중, 기간, 운용방식, 티어 조건 등)으로
                프리셋 파라미터가 덮어씌워집니다.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 프리셋 삭제 모달 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-sm font-black text-slate-800">프리셋 삭제</h3>
            </div>

            <div className="mt-4 space-y-2">
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium">
                  {deleteError}
                </div>
              )}
              <p className="text-xs text-slate-600 font-medium">
                정말 <strong className="text-slate-900 font-black">'{currentPreset?.name}'</strong>{' '}
                프리셋을 삭제하시겠습니까?
              </p>
              <p className="text-[11px] text-slate-400">삭제된 프리셋은 복구할 수 없습니다.</p>
            </div>


            <div className="flex items-center justify-end gap-2 pt-6">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSubmitDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DynamicPresetToolbar;
