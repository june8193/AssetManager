import React, { useState, useEffect } from 'react';
import { DB_API_BASE } from '../../config';

/**
 * 자산 상태 스냅샷 조회 탭 컴포넌트입니다.
 * 특정 시점의 계좌별 평가액, 누적 수익 등의 이력을 조회합니다.
 */
const SnapshotsTab = () => {
  const [snapshots, setSnapshots] = useState([]); // 스냅샷 목록 상태
  const [accounts, setAccounts] = useState([]);   // 계좌 목록 상태 (이름 매핑용)
  const [loading, setLoading] = useState(true);   // 로딩 상태

  /**
   * 서버에서 스냅샷 및 계좌 데이터를 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const [snapRes, accRes] = await Promise.all([
        fetch(`${DB_API_BASE}/snapshots`),
        fetch(`${DB_API_BASE}/accounts`)
      ]);
      const snapData = await snapRes.json();
      const accData = await accRes.json();
      setSnapshots(snapData);
      setAccounts(accData);
    } catch (error) {
      console.error('스냅샷 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">자산 상태 스냅샷 이력</h3>
        <p className="text-xs text-slate-400">※ 스냅샷 수동 입력 기능은 추후 구현 예정입니다.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">기준 일자</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">계좌</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">기간 입금액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">총 평가액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">누적 수익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map((snap) => (
              <tr key={snap.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-900 font-medium">{snap.snapshot_date}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {accounts.find(a => a.id === snap.account_id)?.name || snap.account_id}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-blue-600">
                  {snap.period_deposit.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                  {snap.total_valuation.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-emerald-600">
                  {snap.total_profit.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {snapshots.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">데이터가 없습니다.</div>
        )}
      </div>
    </div>
  );
};

export default SnapshotsTab;
