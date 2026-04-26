import React, { useState, useEffect } from 'react';
import { DB_API_BASE } from '../../config';
import { Camera, Save, RefreshCw, AlertCircle, X, CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Wallet, Landmark } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 자산 상태 스냅샷 조회 탭 컴포넌트입니다.
 * 증권계좌와 은행계좌 스냅샷 입력을 이원화하여 관리합니다.
 */
const SnapshotsTab = () => {
  const [snapshots, setSnapshots] = useState([]); // 스냅샷 목록 상태
  const [accounts, setAccounts] = useState([]);   // 전체 계좌 목록
  const [loading, setLoading] = useState(true);   // 로딩 상태
  const { maskValue } = useMasking();

  // 모달 및 위저드 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState('select-type'); // 'select-type' | 'config' | 'account-wizard' | 'final-preview'
  const [snapshotType, setSnapshotType] = useState('brokerage'); // 'brokerage' | 'bank'
  
  // 입력 데이터 상태
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRate, setExchangeRate] = useState('');
  
  // 증권계좌 위저드 관련 상태
  const [brokerageAccounts, setBrokerageAccounts] = useState([]);
  const [currentAccIdx, setCurrentAccIdx] = useState(0);
  const [accountsFormData, setAccountsFormData] = useState({}); 
  /* 
    structure: { 
      [accId]: { 
        newTransactions: [{ type: 'DEPOSIT', amount: '', currency: 'KRW', date: '' }],
        currentKrw: '',
        currentUsd: '',
        calcResult: null, // { theoreticalKrw, theoreticalUsd, diffKrw, diffUsd }
        isConfirmed: false
      } 
    }
  */

  const [previews, setPreviews] = useState([]); // 최종 저장 전 미리보기
  const [processing, setProcessing] = useState(false);

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

  const openModal = () => {
    setIsModalOpen(true);
    setWizardStep('select-type');
    // 초기화
    setExchangeRate('');
    setCurrentAccIdx(0);
    setAccountsFormData({});
    setPreviews([]);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setWizardStep('select-type');
  };

  // --- 위저드 단계별 핸들러 ---

  const handleSelectType = (type) => {
    if (type === 'bank') {
      alert('은행 계좌 스냅샷 기능은 준비 중입니다.');
      return;
    }
    setSnapshotType(type);
    setWizardStep('config');
  };

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    if (!exchangeRate || isNaN(exchangeRate)) {
      alert('올바른 환율을 입력해주세요.');
      return;
    }
    
    // 증권계좌 필터링 및 초기화
    const brAccounts = accounts.filter(a => a.account_type === 'BROKERAGE' && a.is_active);
    setBrokerageAccounts(brAccounts);
    
    if (brAccounts.length === 0) {
      alert('활성화된 증권계좌가 없습니다.');
      return;
    }

    // 폼 데이터 초기화 (기존 데이터가 없으면)
    const newFormData = { ...accountsFormData };
    brAccounts.forEach(acc => {
      if (!newFormData[acc.id]) {
        newFormData[acc.id] = {
          newTransactions: [],
          currentKrw: '0',
          currentUsd: '0',
          calcResult: null,
          isConfirmed: false
        };
      }
    });
    setAccountsFormData(newFormData);
    setWizardStep('account-wizard');
  };

  // 개별 계좌 계산 요청
  const calculateAccountDiff = async (accId) => {
    const data = accountsFormData[accId];
    try {
      setProcessing(true);
      const response = await fetch(`${DB_API_BASE}/snapshots/brokerage/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accId,
          snapshot_date: inputDate,
          new_transactions: data.newTransactions.map(tx => ({
            account_id: accId,
            asset_id: 0, // 백엔드에서 통화별로 처리하므로 0 또는 적절한 값 (백엔드 로직에 따라 다름)
            transaction_date: tx.date || inputDate,
            type: tx.type,
            total_amount: parseFloat(tx.amount) || 0,
            currency: tx.currency,
            quantity: parseFloat(tx.amount) || 0,
            price: 1.0
          })),
          current_krw: parseFloat(data.currentKrw) || 0,
          current_usd: parseFloat(data.currentUsd) || 0
        })
      });

      if (response.ok) {
        const result = await response.json();
        setAccountsFormData(prev => ({
          ...prev,
          [accId]: { ...prev[accId], calcResult: result }
        }));
      } else {
        alert('계산 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('계산 요청 오류:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAccount = (accId) => {
    setAccountsFormData(prev => ({
      ...prev,
      [accId]: { ...prev[accId], isConfirmed: true }
    }));
    
    if (currentAccIdx < brokerageAccounts.length - 1) {
      setCurrentAccIdx(currentAccIdx + 1);
    } else {
      // 모든 계좌 처리 완료 시 최종 미리보기로 이동
      handleGoToFinalPreview();
    }
  };

  const handleGoToFinalPreview = async () => {
    try {
      setProcessing(true);
      // 백엔드에 최종 저장이 아닌 '미리보기' 요청 (기존 로직 활용을 위해 임시 저장 필요할 수 있으나, 
      // 여기서는 일단 모든 확정된 데이터를 모아서 최종 저장 API로 보낼 준비를 함)
      
      const accountsPayload = brokerageAccounts.map(acc => ({
        account_id: acc.id,
        new_transactions: accountsFormData[acc.id].newTransactions.map(tx => ({
          account_id: acc.id,
          asset_id: 0,
          transaction_date: tx.date || inputDate,
          type: tx.type,
          total_amount: parseFloat(tx.amount) || 0,
          currency: tx.currency,
          quantity: parseFloat(tx.amount) || 0,
          price: 1.0
        })),
        diff_krw: accountsFormData[acc.id].calcResult?.diff_krw || 0,
        diff_usd: accountsFormData[acc.id].calcResult?.diff_usd || 0
      }));

      // 최종 저장은 아니지만, 전체 스냅샷 요약을 위해 preview API 호출과 비슷한 결과를 얻어야 함.
      // 일단은 바로 최종 저장을 위한 '확인' 단계로 이동 (UI에서 요약 보여줌)
      setWizardStep('final-preview');
    } catch (error) {
      console.error('미리보기 준비 오류:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalSave = async () => {
    try {
      setProcessing(true);
      const payload = {
        snapshot_date: inputDate,
        exchange_rate: parseFloat(exchangeRate),
        accounts: brokerageAccounts.map(acc => ({
          account_id: acc.id,
          new_transactions: accountsFormData[acc.id].newTransactions.map(tx => ({
            account_id: acc.id,
            asset_id: 0,
            transaction_date: tx.date || inputDate,
            type: tx.type,
            total_amount: parseFloat(tx.amount) || 0,
            currency: tx.currency,
            quantity: parseFloat(tx.amount) || 0,
            price: 1.0
          })),
          diff_krw: accountsFormData[acc.id].calcResult?.diff_krw || 0,
          diff_usd: accountsFormData[acc.id].calcResult?.diff_usd || 0
        }))
      };

      const response = await fetch(`${DB_API_BASE}/snapshots/brokerage/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('스냅샷이 성공적으로 저장되었습니다.');
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await response.json();
        alert(`저장 중 오류 발생: ${err.detail || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('최종 저장 오류:', error);
    } finally {
      setProcessing(false);
    }
  };

  // --- 서브 컴포넌트 및 렌더링 함수 ---

  const renderSelectType = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
      <button
        onClick={() => handleSelectType('brokerage')}
        className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
      >
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <Wallet size={32} />
        </div>
        <div className="text-center">
          <h4 className="font-bold text-slate-800 text-lg">증권계좌 스냅샷</h4>
          <p className="text-sm text-slate-500 mt-2">주식, 채권 등 거래 내역을 바탕으로 현금과 배당금을 정산합니다.</p>
        </div>
      </button>
      <button
        onClick={() => handleSelectType('bank')}
        className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-slate-100 hover:border-slate-200 transition-all opacity-60 cursor-not-allowed"
      >
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <Landmark size={32} />
        </div>
        <div className="text-center">
          <h4 className="font-bold text-slate-800 text-lg">은행계좌 스냅샷</h4>
          <p className="text-sm text-slate-400 mt-2">준비 중입니다. 예적금 잔액을 직접 입력하여 관리합니다.</p>
        </div>
      </button>
    </div>
  );

  const renderConfig = () => (
    <form onSubmit={handleConfigSubmit} className="space-y-6 pt-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <AlertCircle className="text-blue-500 shrink-0" size={20} />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">스냅샷 기본 설정</p>
          <p className="opacity-80">기록할 날짜와 달러 자산 환산을 위한 기준 환율을 입력해주세요.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="snapshot-date" className="text-xs font-bold text-slate-500 uppercase tracking-wider">기준 일자</label>
          <input
            id="snapshot-date"
            type="date"
            value={inputDate}
            onChange={(e) => setInputDate(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="exchange-rate" className="text-xs font-bold text-slate-500 uppercase tracking-wider">당일 환율 (USD/KRW)</label>
          <input
            id="exchange-rate"
            type="number"
            step="0.01"
            placeholder="예: 1350.5"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={() => setWizardStep('select-type')} className="px-6 py-2 text-slate-500 font-medium">이전</button>
        <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
          다음 단계 <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );

  const renderAccountWizard = () => {
    const acc = brokerageAccounts[currentAccIdx];
    if (!acc) return null;
    const data = accountsFormData[acc.id] || {};
    
    const updateAccData = (updates) => {
      setAccountsFormData(prev => ({
        ...prev,
        [acc.id]: { ...prev[acc.id], ...updates, isConfirmed: false, calcResult: null }
      }));
    };

    const addTx = () => {
      const newTxs = [...(data.newTransactions || []), { type: 'DEPOSIT', amount: '', currency: 'KRW', date: inputDate }];
      updateAccData({ newTransactions: newTxs });
    };

    const removeTx = (idx) => {
      const newTxs = data.newTransactions.filter((_, i) => i !== idx);
      updateAccData({ newTransactions: newTxs });
    };

    const updateTx = (idx, field, value) => {
      const newTxs = data.newTransactions.map((tx, i) => i === idx ? { ...tx, [field]: value } : tx);
      updateAccData({ newTransactions: newTxs });
    };

    return (
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{currentAccIdx + 1} / {brokerageAccounts.length}</span>
            <h4 className="font-bold text-slate-800 text-lg">{acc.name} <span className="text-slate-400 font-normal">({acc.provider})</span></h4>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <RefreshCw size={14} /> 기간 중 신규 입출금 내역 (직접 입력)
            </h5>
            <div className="space-y-2">
              {(data.newTransactions || []).map((tx, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-100">
                  <select 
                    value={tx.type} 
                    onChange={(e) => updateTx(idx, 'type', e.target.value)}
                    className="text-sm border-none focus:ring-0 bg-transparent font-medium"
                  >
                    <option value="DEPOSIT">입금</option>
                    <option value="WITHDRAW">출금</option>
                  </select>
                  <input 
                    type="number" 
                    placeholder="금액" 
                    value={tx.amount} 
                    onChange={(e) => updateTx(idx, 'amount', e.target.value)}
                    className="flex-1 text-sm border-none focus:ring-0 font-mono"
                  />
                  <select 
                    value={tx.currency} 
                    onChange={(e) => updateTx(idx, 'currency', e.target.value)}
                    className="text-xs border-none focus:ring-0 bg-slate-50 rounded px-1"
                  >
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                  </select>
                  <button onClick={() => removeTx(idx)} className="text-slate-300 hover:text-red-500 p-1"><X size={16} /></button>
                </div>
              ))}
              <button 
                onClick={addTx}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-medium hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-1"
              >
                <Plus size={14} /> 내역 추가하기
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">현재 보유 원화 (KRW)</label>
              <input
                type="number"
                value={data.currentKrw}
                onChange={(e) => updateAccData({ currentKrw: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">현재 보유 달러 (USD)</label>
              <input
                type="number"
                value={data.currentUsd}
                onChange={(e) => updateAccData({ currentUsd: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>
          </div>

          <div className="pt-2">
            {!data.calcResult ? (
              <button 
                onClick={() => calculateAccountDiff(acc.id)}
                disabled={processing}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
              >
                {processing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                배당금/차액 계산하기
              </button>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800 font-bold flex items-center gap-1"><CheckCircle2 size={18} /> 정산 결과</span>
                  <button onClick={() => updateAccData({ calcResult: null })} className="text-xs text-emerald-600 underline">다시 입력</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/50 p-3 rounded-lg border border-emerald-200/50">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">원화 차액 (배당금 등)</p>
                    <p className={`text-lg font-mono font-bold ${data.calcResult.diff_krw >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {data.calcResult.diff_krw >= 0 ? '+' : ''}{Math.round(data.calcResult.diff_krw).toLocaleString()}원
                    </p>
                  </div>
                  <div className="bg-white/50 p-3 rounded-lg border border-emerald-200/50">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">달러 차액 (배당금 등)</p>
                    <p className={`text-lg font-mono font-bold ${data.calcResult.diff_usd >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {data.calcResult.diff_usd >= 0 ? '+' : ''}{data.calcResult.diff_usd.toFixed(2)} USD
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 opacity-80">
                  이론상 잔액(KRW {Math.round(data.calcResult.theoretical_krw).toLocaleString()} / USD {data.calcResult.theoretical_usd.toFixed(2)})과의 차액입니다. 확인 후 다음으로 넘어가세요.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
          <button 
            type="button" 
            onClick={() => {
              if (currentAccIdx > 0) setCurrentAccIdx(currentAccIdx - 1);
              else setWizardStep('config');
            }} 
            className="flex items-center gap-1 text-slate-500 font-medium hover:text-slate-800"
          >
            <ChevronLeft size={20} /> 이전
          </button>
          <button 
            onClick={() => handleConfirmAccount(acc.id)}
            disabled={!data.calcResult || processing}
            className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-200 transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
          >
            {currentAccIdx === brokerageAccounts.length - 1 ? '최종 확인 단계로' : '확인 및 다음 계좌'} <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  const renderFinalPreview = () => (
    <div className="space-y-6 pt-2">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
        <div className="text-sm text-emerald-800">
          <p className="font-semibold mb-1">모든 계좌 정산 완료</p>
          <p className="opacity-80">입력하신 데이터와 계산된 배당금이 최종적으로 반영됩니다. [최종 저장]을 누르면 스냅샷이 생성됩니다.</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">계좌명</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">신규 입출금(KRW)</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">배당/수수료(KRW)</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">현재 보유(KRW)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brokerageAccounts.map((acc) => {
              const data = accountsFormData[acc.id] || {};
              const krwNetTx = (data.newTransactions || []).reduce((acc, tx) => {
                if (tx.currency === 'KRW') return tx.type === 'DEPOSIT' ? acc + parseFloat(tx.amount || 0) : acc - parseFloat(tx.amount || 0);
                return acc;
              }, 0);
              return (
                <tr key={acc.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{acc.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600">{krwNetTx.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{Math.round(data.calcResult?.diff_krw || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{parseFloat(data.currentKrw || 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-slate-100">
        <button type="button" onClick={() => setWizardStep('account-wizard')} className="text-slate-500 font-medium hover:text-slate-800">이전</button>
        <button 
          onClick={handleFinalSave}
          disabled={processing}
          className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-200"
        >
          {processing ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          스냅샷 최종 저장
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">자산 상태 스냅샷 이력</h3>
          <p className="text-xs text-slate-500 mt-1">정기적으로 자산 상태를 기록하여 시계열 차트를 생성합니다.</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Camera size={16} />
          스냅샷 생성 마법사
        </button>
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

      {/* 스냅샷 생성 마법사 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Camera className="text-blue-600" size={20} />
                자산 스냅샷 생성 마법사
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {wizardStep === 'select-type' && renderSelectType()}
              {wizardStep === 'config' && renderConfig()}
              {wizardStep === 'account-wizard' && renderAccountWizard()}
              {wizardStep === 'final-preview' && renderFinalPreview()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotsTab;
