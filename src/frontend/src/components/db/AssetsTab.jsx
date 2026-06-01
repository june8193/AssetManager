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
  
  // 백엔드에서 받아올 카테고리 매핑 데이터
  const [categories, setCategories] = useState({});
  const [isVerified, setIsVerified] = useState(false); // 조회 검증 완료 여부
  const [isVerifying, setIsVerifying] = useState(false); // 조회 중 여부
  const [verificationError, setVerificationError] = useState(''); // 검증 에러 메시지

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

  /**
   * 서버에서 카테고리 매핑 테이블을 가져옵니다.
   */
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${DB_API_BASE}/assets/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('카테고리 데이터 로딩 오류:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, []);

  /**
   * 입력 필드 변경 핸들러
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // 티커, 대분류, 중분류, 국가 값이 바뀌면 검증 상태 리셋 (신규 추가 시에만)
    if (['ticker', 'major_category', 'sub_category', 'country'].includes(name)) {
      if (!editingId) {
        setIsVerified(false);
        setVerificationError('');
      }

      setFormData(prev => {
        const updated = { ...prev, [name]: value };
        
        // 대분류가 바뀌면 해당하는 첫 번째 중분류로 자동 초기화
        if (name === 'major_category') {
          const subList = categories[value] || [];
          updated.sub_category = subList[0] || '';
        }

        // 수정 모드가 아닐 때, 핵심 정보가 바뀌면 자산명도 리셋
        if (!editingId) {
          updated.name = '';
        }
        return updated;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  /**
   * 티커 및 국가를 기반으로 실제 종목 존재 여부를 검증하는 조회 함수
   */
  const handleVerify = async () => {
    if (!formData.ticker || !formData.major_category || !formData.country) {
      setVerificationError('티커, 대분류, 국가를 선택/입력해 주세요.');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');
    setIsVerified(false);

    try {
      const query = new URLSearchParams({
        ticker: formData.ticker,
        country: formData.country,
        major_category: formData.major_category
      }).toString();

      const response = await fetch(`${DB_API_BASE}/assets/verify?${query}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, name: data.name }));
        setIsVerified(true);
      } else {
        const err = await response.json();
        setVerificationError(err.detail || '존재하지 않는 종목입니다. 티커와 국가를 확인해 주세요.');
        setFormData(prev => ({ ...prev, name: '' }));
      }
    } catch (error) {
      console.error('자산 검증 통신 오류:', error);
      setVerificationError('서버와 통신 중 오류가 발생했습니다.');
      setFormData(prev => ({ ...prev, name: '' }));
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * 폼 제출(저장/추가) 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isVerified) return;

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
    // 수정 모드 진입 시에는 검증을 거친 기존 데이터이므로 바로 저장 가능하도록 활성화
    setIsVerified(true);
    setVerificationError('');
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
    setIsVerified(false);
    setIsVerifying(false);
    setVerificationError('');
  };


  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  // 대분류 드롭다운 옵션 추출 (신규일 때는 '현금' 제외)
  const majorOptions = Object.keys(categories).filter(cat => {
    if (editingId) {
      const currentAsset = assets.find(a => a.id === editingId);
      if (currentAsset && currentAsset.major_category === '현금') {
        return true;
      }
    }
    return cat !== '현금';
  });

  // 선택된 대분류에 따른 중분류 옵션 추출
  const subOptions = categories[formData.major_category] || [];

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
            <label htmlFor="ticker" className="block text-xs font-medium text-slate-500 mb-1">티커/심볼</label>
            <input
              id="ticker"
              type="text"
              name="ticker"
              value={formData.ticker}
              onChange={handleInputChange}
              placeholder="예: AAPL, 005930"
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                editingId ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300'
              }`}
              required
              disabled={!!editingId}
            />
          </div>
          <div>
            <label htmlFor="major_category" className="block text-xs font-medium text-slate-500 mb-1">대분류</label>
            <select
              id="major_category"
              name="major_category"
              value={formData.major_category}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              <option value="">대분류 선택</option>
              {majorOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sub_category" className="block text-xs font-medium text-slate-500 mb-1">중분류</label>
            <select
              id="sub_category"
              name="sub_category"
              value={formData.sub_category}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
              disabled={!formData.major_category}
            >
              <option value="">중분류 선택</option>
              {subOptions.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="country" className="block text-xs font-medium text-slate-500 mb-1">국가</label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                editingId ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300'
              }`}
              disabled={!!editingId}
            >
              <option value="KR">KR</option>
              <option value="US">US</option>
            </select>
          </div>
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-500 mb-1">자산명</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              readOnly
              placeholder={editingId ? "" : "조회 시 자동 완성"}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-sm outline-none font-medium cursor-default"
              required
            />
          </div>
          <div className="flex gap-2">
            {!isVerified && !editingId ? (
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying || !formData.ticker || !formData.major_category}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
              >
                {isVerifying ? '조회 중...' : '조회'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isVerified}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
              >
                {editingId ? <Check size={16} /> : <Plus size={16} />}
                {editingId ? '저장' : '추가'}
              </button>
            )}
            {(editingId || formData.ticker || formData.major_category || isVerified) && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                {editingId ? '취소' : '초기화'}
              </button>
            )}
          </div>
          {verificationError && (
            <div className="text-xs text-red-500 font-medium col-span-full mt-1 flex items-center gap-1">
              ⚠️ {verificationError}
            </div>
          )}
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
