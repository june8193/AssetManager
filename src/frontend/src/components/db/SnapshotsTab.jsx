import React, { useState, useEffect } from 'react';
import { DB_API_BASE } from '../../config';
import { Camera, Save, RefreshCw, AlertCircle, X, CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Wallet, Landmark, Calendar, Clock } from 'lucide-react';
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
    setSnapshotType(type);
    setWizardStep('config');
  };

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    if (snapshotType === 'brokerage' && (!exchangeRate || isNaN(exchangeRate))) {
      alert('올바른 환율을 입력해주세요.');
      return;
    }
    
    // 계좌 필터링
    const filteredAccounts = accounts.filter(a => a.account_type === (snapshotType === 'brokerage' ? 'BROKERAGE' : 'BANK') && a.is_active);
    
    if (filteredAccounts.length === 0) {
      alert(`활성화된 ${snapshotType === 'brokerage' ? '증권' : '은행'}계좌가 없습니다.`);
      return;
    }

    setBrokerageAccounts(filteredAccounts); // 공용 상태 사용 (이름은 brokerageAccounts지만 filteredAccounts 의미)
    
    // 폼 데이터 초기화
    const newFormData = { ...accountsFormData };
    filteredAccounts.forEach(acc => {
      if (!newFormData[acc.id]) {
        newFormData[acc.id] = {
          newTransactions: [],
          existingTransactions: [],
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

  // 개별 계좌 계산 요청 (증권계좌 전용)
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
            asset_id: 0, 
            transaction_date: tx.date || inputDate,
            type: tx.type,
            total_amount: parseFloat(tx.amount) || 0,
            currency: tx.currency,
            quantity: parseFloat(tx.amount) || 0,
            price: 1.0,
            memo: tx.memo || ''
          })),
          current_krw: parseFloat(data.currentKrw) || 0,
          current_usd: parseFloat(data.currentUsd) || 0
        })
      });

      if (response.ok) {
        const result = await response.json();
        setAccountsFormData(prev => ({
          ...prev,
          [accId]: { 
            ...prev[accId], 
            calcResult: result,
            existingTransactions: result.existing_transactions || []
          }
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

  // 은행 계좌 잔액 계산 요청
  const calculateBankDiff = async (accId) => {
    const data = accountsFormData[accId];
    try {
      setProcessing(true);
      const response = await fetch(`${DB_API_BASE}/snapshots/bank/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accId,
          snapshot_date: inputDate,
          new_transactions: data.newTransactions.map(tx => ({
            account_id: accId,
            asset_id: 0, 
            transaction_date: tx.date || inputDate,
            type: tx.type,
            total_amount: parseFloat(tx.amount) || 0,
            currency: 'KRW',
            quantity: parseFloat(tx.amount) || 0,
            price: 1.0,
            memo: tx.memo || ''
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        setAccountsFormData(prev => ({
          ...prev,
          [accId]: { 
            ...prev[accId], 
            calcResult: result,
            existingTransactions: result.existing_transactions || []
          }
        }));
      } else {
        alert('계산 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('은행 잔액 계산 오류:', error);
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
      handleGoToFinalPreview();
    }
  };

  const handleGoToFinalPreview = async () => {
    setWizardStep('final-preview');
  };

  const handleFinalSave = async () => {
    try {
      setProcessing(true);
      let payload;
      let endpoint;

      if (snapshotType === 'brokerage') {
        endpoint = `${DB_API_BASE}/snapshots/brokerage/save`;
        payload = {
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
              price: 1.0,
              memo: tx.memo || ''
            })),
            diff_krw: accountsFormData[acc.id].calcResult?.diff_krw || 0,
            diff_usd: accountsFormData[acc.id].calcResult?.diff_usd || 0
          }))
        };
      } else {
        endpoint = `${DB_API_BASE}/snapshots/bank/save`;
        payload = {
          snapshot_date: inputDate,
          accounts: brokerageAccounts.map(acc => ({
            account_id: acc.id,
            new_transactions: accountsFormData[acc.id].newTransactions.map(tx => ({
              account_id: acc.id,
              asset_id: 0,
              transaction_date: tx.date || inputDate,
              type: tx.type,
              total_amount: parseFloat(tx.amount) || 0,
              currency: 'KRW',
              quantity: parseFloat(tx.amount) || 0,
              price: 1.0,
              memo: tx.memo || ''
            })),
            total_valuation: accountsFormData[acc.id].calcResult?.theoretical_krw || 0
          }))
        };
      }

      const response = await fetch(endpoint, {
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
        className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <Landmark size={32} />
        </div>
        <div className="text-center">
          <h4 className="font-bold text-slate-800 text-lg">은행계좌 스냅샷</h4>
          <p className="text-sm text-slate-500 mt-2">입출금, 이자, 세금 내역을 입력하고 계좌 잔액을 기록합니다.</p>
        </div>
      </button>
    </div>
  );

  const renderConfig = () => (
    <form onSubmit={handleConfigSubmit} className="space-y-6 pt-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <AlertCircle className="text-blue-500 shrink-0" size={20} />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">{snapshotType === 'brokerage' ? '증권계좌' : '은행계좌'} 스냅샷 기본 설정</p>
          <p className="opacity-80">기록할 날짜와 {snapshotType === 'brokerage' ? '달러 자산 환산을 위한 기준 환율을' : '정보를'} 입력해주세요.</p>
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
        {snapshotType === 'brokerage' && (
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
        )}
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
    const isBank = snapshotType === 'bank';
    
    const updateAccData = (updates) => {
      setAccountsFormData(prev => ({
        ...prev,
        [acc.id]: { ...prev[acc.id], ...updates, isConfirmed: false, calcResult: isBank ? { success: true } : null }
      }));
    };

    const addTx = () => {
      const newTxs = [...(data.newTransactions || []), { type: 'DEPOSIT', amount: '', currency: 'KRW', date: inputDate, memo: '' }];
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
            <span className={`${isBank ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} text-xs font-bold px-2 py-1 rounded-full`}>{currentAccIdx + 1} / {brokerageAccounts.length}</span>
            <h4 className="font-bold text-slate-800 text-lg">{acc.name} <span className="text-slate-400 font-normal">({acc.provider})</span></h4>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <RefreshCw size={14} /> 기간 중 내역 (입출금, {isBank ? '이자, 세금' : '배당 등'})
            </h5>
            <div className="space-y-3">
              {/* 기존 DB에 저장된 내역 표시 */}
              {(data.existingTransactions || []).map((tx, idx) => (
                <div key={`existing-${idx}`} className="bg-slate-100/50 p-3 rounded-lg border border-slate-200 space-y-2 opacity-80">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-[10px] font-bold bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded">기존</span>
                    <span className="text-xs font-mono w-[100px] text-slate-500">{tx.transaction_date}</span>
                    <span className="text-sm font-bold min-w-[60px] text-slate-600">
                      {tx.type === 'DEPOSIT' ? '입금' : tx.type === 'WITHDRAW' ? '출금' : tx.type === 'INTEREST' ? '이자' : tx.type === 'TAX' ? '세금' : tx.type}
                    </span>
                    <span className="flex-1 text-sm font-mono font-bold text-slate-700">
                      {tx.total_amount.toLocaleString()}
                    </span>
                    {!isBank && <span className="text-xs font-bold text-slate-500">{tx.currency}</span>}
                    <span className="flex-[2] text-xs italic text-slate-500 truncate">{tx.memo || '-'}</span>
                    <div className="w-8"></div> {/* 삭제 버튼 자리 확보용 */}
                  </div>
                </div>
              ))}

              {/* 신규 추가 내역 */}
              {(data.newTransactions || []).map((tx, idx) => (
                <div key={`new-${idx}`} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm space-y-2 ring-1 ring-blue-50">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">신규</span>
                    <input 
                      type="date" 
                      value={tx.date || inputDate} 
                      onChange={(e) => updateTx(idx, 'date', e.target.value)}
                      className="text-xs border-none focus:ring-0 font-mono w-[110px] bg-slate-50 rounded px-2 py-1"
                    />
                    <select 
                      value={tx.type} 
                      onChange={(e) => updateTx(idx, 'type', e.target.value)}
                      className="text-sm border-none focus:ring-0 bg-transparent font-medium min-w-[80px]"
                    >
                      <option value="DEPOSIT">입금</option>
                      <option value="WITHDRAW">출금</option>
                      {isBank && <option value="INTEREST">이자</option>}
                      {isBank && <option value="TAX">세금</option>}
                    </select>
                    <input 
                      type="number" 
                      placeholder="금액" 
                      value={tx.amount} 
                      onChange={(e) => updateTx(idx, 'amount', e.target.value)}
                      className="flex-1 text-sm border-none focus:ring-0 font-mono min-w-[100px]"
                    />
                    {!isBank && (
                      <select 
                        value={tx.currency} 
                        onChange={(e) => updateTx(idx, 'currency', e.target.value)}
                        className="text-xs border-none focus:ring-0 bg-slate-50 rounded px-1"
                      >
                        <option value="KRW">KRW</option>
                        <option value="USD">USD</option>
                      </select>
                    )}
                    <input 
                      type="text" 
                      placeholder="메모" 
                      value={tx.memo} 
                      onChange={(e) => updateTx(idx, 'memo', e.target.value)}
                      className="flex-[2] text-xs border-none focus:ring-0 bg-slate-50 rounded-md py-1.5 px-3 italic text-slate-600 min-w-[150px]"
                    />
                    <button onClick={() => removeTx(idx)} className="text-slate-300 hover:text-red-500 p-1"><X size={16} /></button>
                  </div>
                </div>
              ))}
              <button 
                onClick={addTx}
                className={`w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-medium ${isBank ? 'hover:border-emerald-300 hover:text-emerald-500' : 'hover:border-blue-300 hover:text-blue-500'} transition-all flex items-center justify-center gap-1`}
              >
                <Plus size={14} /> 내역 추가하기
              </button>
            </div>
          </div>

          {!isBank && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          )}

          <div className="pt-2">
            {!data.calcResult && (
              <button 
                onClick={() => isBank ? calculateBankDiff(acc.id) : calculateAccountDiff(acc.id)}
                disabled={processing}
                className={`w-full py-3 ${isBank ? 'bg-emerald-800 hover:bg-emerald-900' : 'bg-slate-800 hover:bg-slate-900'} text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
              >
                {processing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                {isBank ? '최종 잔액 계산하기' : '배당금/차액 계산하기'}
              </button>
            )}
            {!isBank && data.calcResult && (
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
            {isBank && data.calcResult && (
               <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800 font-bold flex items-center gap-1"><CheckCircle2 size={18} /> 최종 잔액 확인</span>
                  <button onClick={() => updateAccData({ calcResult: null })} className="text-xs text-emerald-600 underline">내역 수정</button>
                </div>
                <div className="bg-white/50 p-4 rounded-lg border border-emerald-200/50">
                  <p className="text-xs text-emerald-600 font-bold uppercase mb-1">계산된 최종 잔액 (KRW)</p>
                  <p className="text-2xl font-mono font-bold text-emerald-700">
                    {Math.round(data.calcResult.theoretical_krw).toLocaleString()}원
                  </p>
                </div>
                <p className="text-xs text-emerald-700 opacity-80">
                  이전 잔액과 입력하신 {data.newTransactions?.length || 0}건의 내역을 합산한 결과입니다. 실제 잔액과 맞는지 확인해 주세요.
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
            className={`${isBank ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'} text-white px-10 py-3 rounded-xl font-bold disabled:bg-slate-200 transition-all flex items-center gap-2 shadow-lg`}
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
          <p className="opacity-80">입력하신 데이터와 계산된 {snapshotType === 'brokerage' ? '배당금이' : '내역이'} 최종적으로 반영됩니다. [최종 저장]을 누르면 스냅샷이 생성됩니다.</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">계좌명</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">신규 내역수</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">{snapshotType === 'brokerage' ? '배당/수수료(KRW)' : '내역 합계(KRW)'}</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">최종 잔액(KRW)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brokerageAccounts.map((acc) => {
              const data = accountsFormData[acc.id] || {};
              const txCount = (data.newTransactions || []).length;
              const netTx = (data.newTransactions || []).reduce((acc, tx) => {
                const amt = parseFloat(tx.amount || 0);
                if (tx.type === 'DEPOSIT' || tx.type === 'INTEREST') return acc + amt;
                return acc - amt;
              }, 0);
              const finalVal = snapshotType === 'brokerage' ? data.currentKrw : data.calcResult?.theoretical_krw;
              return (
                <tr key={acc.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{acc.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{txCount}건</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">
                    {snapshotType === 'brokerage' 
                      ? Math.round(data.calcResult?.diff_krw || 0).toLocaleString()
                      : netTx.toLocaleString()
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{parseFloat(finalVal || 0).toLocaleString()}</td>
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
          className={`${snapshotType === 'bank' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white px-10 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-xl`}
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
