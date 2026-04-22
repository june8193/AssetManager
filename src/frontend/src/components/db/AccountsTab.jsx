import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { DB_API_BASE } from '../../config';

/**
 * 계좌 관리 탭 컴포넌트입니다.
 * 계좌 목록을 조회하고 새 계좌를 추가하거나 기존 정보를 수정할 수 있습니다.
 */
const AccountsTab = () => {
  const [accounts, setAccounts] = useState([]); // 계좌 목록 상태
  const [users, setUsers] = useState([]);       // 사용자 목록 상태 (드롭다운용)
  const [loading, setLoading] = useState(true); // 로딩 상태
  const [editingId, setEditingId] = useState(null); // 현재 수정 중인 계좌 ID
  
  // 입력 폼 데이터 상태
  const [formData, setFormData] = useState({
    user_id: '',
    name: '',
    provider: '',
    alias: '',
    is_active: true
  });

  /**
   * 서버에서 계좌 및 사용자 데이터를 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const [accRes, userRes] = await Promise.all([
        fetch(`${DB_API_BASE}/accounts`),
        fetch(`${DB_API_BASE}/users`)
      ]);
      const accData = await accRes.json();
      const userData = await userRes.json();
      setAccounts(accData);
      setUsers(userData);
      
      // 사용자 데이터가 있고 선택된 사용자가 없으면 첫 번째 사용자 선택
      if (userData.length > 0 && !formData.user_id) {
        setFormData(prev => ({ ...prev, user_id: userData[0].id }));
      }
    } catch (error) {
      console.error('데이터 로딩 중 오류 발생:', error);
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
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  /**
   * 폼 제출(저장/추가) 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId 
      ? `${DB_API_BASE}/accounts/${editingId}`
      : `${DB_API_BASE}/accounts`;
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
      console.error('계좌 저장 중 오류 발생:', error);
    }
  };

  /**
   * 수정 모드 진입
   */
  const handleEdit = (account) => {
    setEditingId(account.id);
    setFormData({
      user_id: account.user_id,
      name: account.name,
      provider: account.provider,
      alias: account.alias || '',
      is_active: account.is_active
    });
  };

  /**
   * 계좌 삭제 핸들러
   */
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`${DB_API_BASE}/accounts/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('계좌 삭제 중 오류 발생:', error);
    }
  };

  /**
   * 입력 폼 초기화
   */
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      user_id: users.length > 0 ? users[0].id : '',
      name: '',
      provider: '',
      alias: '',
      is_active: true
    });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="p-6">
      {/* 입력 폼 영역 */}
      <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
          {editingId ? '계좌 정보 수정' : '새 계좌 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">소유자</label>
            <select
              name="user_id"
              value={formData.user_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">계좌명/번호</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="예: 5526-9093"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">금융기관</label>
            <input
              type="text"
              name="provider"
              value={formData.provider}
              onChange={handleInputChange}
              placeholder="예: KB증권"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">별칭</label>
            <input
              type="text"
              name="alias"
              value={formData.alias}
              onChange={handleInputChange}
              placeholder="예: (주식)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
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
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">소유자</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">계좌명</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">금융기관</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">별칭</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">상태</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-500">{account.id}</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                  {users.find(u => u.id === account.user_id)?.name || account.user_id}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{account.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{account.provider}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{account.alias || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    account.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(account)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="수정"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
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
        {accounts.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">등록된 계좌가 없습니다.</div>
        )}
      </div>
    </div>
  );
};

export default AccountsTab;
