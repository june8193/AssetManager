import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB_API_BASE } from '../../config';
import { Camera, Calendar, Clock } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 자산 상태 스냅샷 조회 탭 컴포넌트입니다.
 * 증권계좌와 은행계좌 스냅샷 입력을 이원화하여 관리합니다.
 */
const SnapshotsTab = () => {
  const [snapshots, setSnapshots] = useState([]); // 스냅샷 목록 상태
  const [accounts, setAccounts] = useState([]);   // 전체 계좌 목록
  const [latestInfo, setLatestInfo] = useState(null); // 최신 스냅샷 정보
  const [loading, setLoading] = useState(true);   // 로딩 상태
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">자산 상태 스냅샷 이력</h3>
          <p className="text-xs text-slate-500 mt-1">정기적으로 자산 상태를 기록하여 시계열 차트를 생성합니다.</p>
        </div>
        <button
          onClick={() => navigate('/db/snapshots/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Camera size={16} />
          스냅샷 생성 마법사
        </button>
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
                  {maskValue(snap.period_deposit.toLocaleString())}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                  {maskValue(snap.total_valuation.toLocaleString())}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-emerald-600">
                  {maskValue(snap.total_profit.toLocaleString())}
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
