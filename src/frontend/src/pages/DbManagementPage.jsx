import React, { useState } from 'react';
import AccountsTab from '../components/db/AccountsTab';
import AssetsTab from '../components/db/AssetsTab';
import TransactionsTab from '../components/db/TransactionsTab';
import SnapshotsTab from '../components/db/SnapshotsTab';
import { Database, Wallet, BarChart3, Receipt, Camera } from 'lucide-react';

/**
 * 데이터베이스 관리 통합 페이지 컴포넌트입니다.
 * 탭 인터페이스를 통해 계좌, 자산 마스터, 거래 내역, 스냅샷 정보를 관리합니다.
 */
const DbManagementPage = () => {
  const [activeTab, setActiveTab] = useState('accounts'); // 현재 활성화된 탭 ID

  // 탭 구성 정의
  const tabs = [
    { id: 'accounts', label: '계좌 관리', icon: <Wallet size={18} /> },
    { id: 'assets', label: '자산 마스터', icon: <BarChart3 size={18} /> },
    { id: 'transactions', label: '거래 내역', icon: <Receipt size={18} /> },
    { id: 'snapshots', label: '스냅샷', icon: <Camera size={18} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <Database size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">데이터베이스 관리</h1>
          <p className="text-slate-500 text-sm">시스템의 원천 데이터를 조회하고 직접 수정할 수 있습니다.</p>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭별 콘텐츠 영역 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'accounts' && <AccountsTab />}
        {activeTab === 'assets' && <AssetsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {activeTab === 'snapshots' && <SnapshotsTab />}
      </div>
    </div>
  );
};

export default DbManagementPage;
