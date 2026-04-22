import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import { DB_API_BASE } from '../../config';

/**
 * 자산 마스터 관리 탭 컴포넌트입니다.
 * 시스템에서 관리할 자산(종목, 통화 등) 목록을 조회하고 편집합니다.
 */
const AssetsTab = () => {
  const [assets, setAssets] = useState([]); // 자산 목록 상태
  const [loading, setLoading] = useState(true); // 로딩 상태
  const [editingId, setEditingId] = useState(null); // 수정 중인 자산 ID
  
  // 입력 폼 데이터 상태
  const [formData, setFormData] = useState({
    ticker: '',
    name: '',
    major_category: '',
    sub_category: '',
    country: 'KR'
  });

  /**
   * 서버에서 자산 마스터 데이터를 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${DB_API_BASE}/assets`);
      const data = await res.json();
      setAssets(data);
    } catch (error) {
      console.error('자산 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /**
   * 입력 필드 변경 핸들러
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  /**
   * 폼 제출(저장/추가) 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `${DB_API_BASE}/assets/${editingId}` : `${DB_API_BASE}/assets`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchData();
        resetForm();
      }
    } catch (error) {
      console.error('자산 저장 오류:', error);
    }
  };

  /**
   * 수정 모드 진입
   */
  const handleEdit = (asset) => {
    setEditingId(asset.id);
    setFormData({
      ticker: asset.ticker,
      name: asset.name,
      major_category: asset.major_category,
      sub_category: asset.sub_category,
      country: asset.country
    });
  };

  /**
   * 자산 삭제 핸들러
   */
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`${DB_API_BASE}/assets/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('자산 삭제 오류:', error);
    }
  };

  /**
   * 입력 폼 초기화
   */
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      ticker: '',
      name: '',
      major_category: '',
      sub_category: '',
      country: 'KR'
    });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="p-6">
      {/* 입력 폼 영역 */}
      <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
          {editingId ? '자산 정보 수정' : '새 자산 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">티커/심볼</label>
            <input
              type="text"
              name="ticker"
              value={formData.ticker}
              onChange={handleInputChange}
              placeholder="예: AAPL, 005930"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">자산명</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="예: 애플, 삼성전자"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">대분류</label>
            <input
              type="text"
              name="major_category"
              value={formData.major_category}
              onChange={handleInputChange}
              placeholder="예: 일반주식"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">중분류</label>
            <input
              type="text"
              name="sub_category"
              value={formData.sub_category}
              onChange={handleInputChange}
              placeholder="예: 해외주식"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">국가</label>
            <select
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="KR">KR</option>
              <option value="US">US</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? '저장' : '추가'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 데이터 테이블 영역 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">티커</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">자산명</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">대분류</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">중분류</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">국가</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-500">{asset.id}</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-bold">{asset.ticker}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{asset.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{asset.major_category}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{asset.sub_category}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    asset.country === 'KR' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {asset.country}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(asset)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="수정"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">등록된 자산 데이터가 없습니다.</div>
        )}
      </div>
    </div>
  );
};

export default AssetsTab;
