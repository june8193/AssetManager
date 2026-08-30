import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB_API_BASE } from '../../config';
import { Camera, Calendar, Clock, Trash2, RefreshCw } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';
import SnapshotRecalculateModal from './SnapshotRecalculateModal';

/**
 * 자산 상태 스냅샷 조회 탭 컴포넌트입니다.
 * 증권계좌와 은행계좌 스냅샷 입력을 이원화하여 관리하며 다중 선택 및 일괄 삭제를 지원합니다.
 */
const SnapshotsTab = () => {
  const [snapshots, setSnapshots] = useState([]); // 스냅샷 목록 상태
  const [accounts, setAccounts] = useState([]);   // 전체 계좌 목록
  const [latestInfo, setLatestInfo] = useState(null); // 최신 스냅샷 정보
  const [loading, setLoading] = useState(true);   // 로딩 상태
  const [isRecalcModalOpen, setIsRecalcModalOpen] = useState(false); // 재계산 모달 오픈 상태
  const [selectedIds, setSelectedIds] = useState(new Set()); // 선택된 스냅샷 ID 집합
  const [lastClickedIndex, setLastClickedIndex] = useState(null); // Shift+클릭용 마지막 클릭 행 인덱스
  const headerCheckboxRef = useRef(null);
  const { maskValue } = useMasking();
  const navigate = useNavigate();

  /**
   * 서버에서 스냅샷 및 계좌 데이터를 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const [snapRes, accRes, latestRes] = await Promise.all([
        fetch(`${DB_API_BASE}/snapshots`),
        fetch(`${DB_API_BASE}/accounts`),
        fetch(`${DB_API_BASE}/snapshots/latest`)
      ]);
      const snapData = await snapRes.json();
      const accData = await accRes.json();
      const latestData = await latestRes.json();
      
      setSnapshots(snapData);
      setAccounts(accData);
      setLatestInfo(latestData);
      setSelectedIds(new Set());
      setLastClickedIndex(null);
    } catch (error) {
      console.error('스냅샷 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (snapshotDate) => {
    if (!window.confirm(`${snapshotDate} 날짜의 모든 계좌 스냅샷과 관련 보정 거래(CASH_ADJUSTMENT)가 함께 삭제됩니다.\n정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${DB_API_BASE}/snapshots/${snapshotDate}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '삭제에 실패했습니다.');
      }

      alert(`${snapshotDate} 날짜의 스냅샷이 정상적으로 삭제되었습니다.`);
      await fetchData();
    } catch (error) {
      console.error('스냅샷 삭제 오류:', error);
      alert(`스냅샷 삭제에 실패했습니다: ${error.message}`);
      setLoading(false);
    }
  };

  /**
   * 선택된 다중 스냅샷 및 해당 날짜의 CASH_ADJUSTMENT 트랜잭션을 일괄 삭제합니다.
   */
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const selectedSnapshots = snapshots.filter(s => selectedIds.has(s.id));
    const targetDates = Array.from(new Set(selectedSnapshots.map(s => s.snapshot_date)));

    if (!window.confirm(`선택한 ${targetDates.length}개 일자 (${selectedIds.size}개 스냅샷)의 모든 데이터와 관련 보정 거래(CASH_ADJUSTMENT)가 함께 삭제됩니다.\n정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${DB_API_BASE}/snapshots/batch`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dates: targetDates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '일괄 삭제에 실패했습니다.');
      }

      alert(`${targetDates.length}개 일자의 스냅샷이 정상적으로 삭제되었습니다.`);
      await fetchData();
    } catch (error) {
      console.error('스냅샷 일괄 삭제 오류:', error);
      alert(`스냅샷 일괄 삭제에 실패했습니다: ${error.message}`);
      setLoading(false);
    }
  };

  // 전체 선택 및 일부 선택 상태 계산
  const isAllSelected = snapshots.length > 0 && snapshots.every(s => selectedIds.has(s.id));
  const isPartiallySelected = snapshots.some(s => selectedIds.has(s.id)) && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected;
    }
  }, [isPartiallySelected]);

  /**
   * 헤더 전체 선택/해제 토글 핸들러
   */
  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(snapshots.map(s => s.id)));
    }
    setLastClickedIndex(null);
  };

  /**
   * 개별 행 체크박스 클릭 핸들러 (Shift + 클릭 범위 선택 지원)
   */
  const handleRowCheckboxChange = (e, snapId, index) => {
    const isShift = e.nativeEvent.shiftKey || e.shiftKey;
    const newSelected = new Set(selectedIds);

    if (isShift && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const targetState = !selectedIds.has(snapId);

      for (let i = start; i <= end; i++) {
        const item = snapshots[i];
        if (item) {
          if (targetState) {
            newSelected.add(item.id);
          } else {
            newSelected.delete(item.id);
          }
        }
      }
    } else {
      if (newSelected.has(snapId)) {
        newSelected.delete(snapId);
      } else {
        newSelected.add(snapId);
      }
    }

    setSelectedIds(newSelected);
    setLastClickedIndex(index);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">자산 상태 스냅샷 이력</h3>
          <p className="text-xs text-slate-500 mt-1">정기적으로 자산 상태를 기록하여 시계열 차트를 생성합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBatchDelete}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm animate-fade-in"
            >
              <Trash2 size={15} />
              선택 삭제 ({selectedIds.size}개)
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsRecalcModalOpen(true)}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={15} />
            스냅샷 재계산
          </button>
          <button
            onClick={() => navigate('/db/snapshots/new')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Camera size={16} />
            스냅샷 생성 마법사
          </button>
        </div>
      </div>


      {/* 최신 스냅샷 요약 정보 */}
      {latestInfo && latestInfo.latest_date && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">마지막 스냅샷 기준일</p>
              <p className="text-xl font-bold text-slate-800 font-mono">{latestInfo.latest_date}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">경과 일수</p>
              <p className="text-xl font-bold text-slate-800 font-mono">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const latest = new Date(latestInfo.latest_date);
                  latest.setHours(0, 0, 0, 0);
                  const diffTime = Math.abs(today - latest);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays;
                })()}일 전
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  ref={headerCheckboxRef}
                  checked={isAllSelected}
                  onChange={handleSelectAllToggle}
                  aria-label="전체 선택"
                  data-testid="select-all-checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">기준 일자</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">금융기관</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">계좌명</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">종류</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">별칭</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">기간 입금액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">총 평가액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">기간 수익</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">동작</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map((snap, index) => {
              const account = accounts.find(a => a.id === snap.account_id);
              const isSelected = selectedIds.has(snap.id);
              return (
                <tr
                  key={snap.id}
                  className={`transition-colors ${isSelected ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleRowCheckboxChange(e, snap.id, index)}
                      aria-label={`${snap.snapshot_date} 행 선택`}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{snap.snapshot_date}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {account?.provider || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {account ? maskValue(account.name) : snap.account_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {account?.account_type || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {account?.alias || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-blue-600">
                    {maskValue(snap.period_deposit.toLocaleString())}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                    {maskValue(snap.total_valuation.toLocaleString())}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-emerald-600">
                    {maskValue(snap.total_profit.toLocaleString())}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <button
                      onClick={() => handleDelete(snap.snapshot_date)}
                      className="text-red-600 hover:text-red-900 transition-colors p-1 rounded hover:bg-red-50"
                      title="스냅샷 삭제"
                    >
                      <Trash2 size={16} className="inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {snapshots.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">데이터가 없습니다.</div>
        )}
      </div>

      {/* 스냅샷 일괄 재계산 모달 */}
      <SnapshotRecalculateModal
        isOpen={isRecalcModalOpen}
        accounts={accounts}
        onClose={() => setIsRecalcModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default SnapshotsTab;


