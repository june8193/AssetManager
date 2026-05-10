import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronLeft, ChevronRight, Check, LayoutGrid, Settings, ListChecks, FileSearch, AlertCircle, Calendar, DollarSign, Wallet, Landmark, Plus, Trash2, X, RefreshCw, CheckCircle2, Save } from 'lucide-react';
import { DB_API_BASE } from '../config';

/**
 * 신규 스냅샷 생성을 위한 위저드 페이지 컴포넌트입니다.
 * 4단계의 과정을 통해 증권사 또는 은행의 자산 상태를 기록합니다.
 */
const SnapshotWizardPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [snapshotType, setSnapshotType] = useState(null); // 'brokerage' | 'bank'

  // Step 2 관련 상태
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRate, setExchangeRate] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Step 3 관련 상태
  const [currentAccIdx, setCurrentAccIdx] = useState(0);
  const [accountsFormData, setAccountsFormData] = useState({});
  const [processing, setProcessing] = useState(false);

  const totalSteps = 4;

  const steps = [
    { id: 1, label: '유형 선택', icon: <LayoutGrid size={18} /> },
    { id: 2, label: '계좌 선택', icon: <Settings size={18} /> },
    { id: 3, label: '상세 입력', icon: <ListChecks size={18} /> },
    { id: 4, label: '최종 확인', icon: <FileSearch size={18} /> },
  ];

  // 계좌 데이터 가져오기
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const response = await fetch(`${DB_API_BASE}/accounts`);
        if (response.ok) {
          const data = await response.json();
          setAccounts(data);
        }
      } catch (error) {
        console.error('계좌 목록 로드 실패:', error);
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  // Step 3 폼 데이터 초기화
  const initializeStep3Data = () => {
    const newFormData = { ...accountsFormData };
    // 선택된 계좌뿐만 아니라 모든 활성 계좌를 초기화하여 최종 단계에서 누락되지 않도록 함
    filteredAccounts.forEach(acc => {
      if (!newFormData[acc.id]) {
        newFormData[acc.id] = {
          newTransactions: [],
          existingTransactions: [],
          currentKrw: '0',
          currentUsd: '0',
          calcResult: null,
          isConfirmed: !selectedAccountIds.includes(acc.id)
        };
      }
    });
    setAccountsFormData(newFormData);
    setCurrentAccIdx(0);
  };

  const nextStep = () => {
    if (step === 2) {
      if (!inputDate) {
        alert('기준 일자를 선택해주세요.');
        return;
      }
      if (snapshotType === 'brokerage' && (!exchangeRate || isNaN(exchangeRate))) {
        alert('올바른 환율을 입력해주세요.');
        return;
      }
      if (selectedAccountIds.length === 0) {
        alert('최소 하나 이상의 계좌를 선택해주세요.');
        return;
      }
      initializeStep3Data();
    }
    
    if (step === 3) {
      const currentAccountId = selectedAccountIds[currentAccIdx];
      const currentData = accountsFormData[currentAccountId];
      
      if (!currentData?.isConfirmed) {
        alert('현재 계좌의 정산 결과를 확인하고 확인 버튼을 눌러주세요.');
        return;
      }

      if (currentAccIdx < selectedAccountIds.length - 1) {
        setCurrentAccIdx(currentAccIdx + 1);
        return;
      }
    }

    if (step < totalSteps) setStep(step + 1);
  };

  const prevStep = () => {
    if (step === 3) {
      if (currentAccIdx > 0) {
        setCurrentAccIdx(currentAccIdx - 1);
        return;
      }
    }
    if (step > 1) setStep(step - 1);
  };

  const handleCancel = () => {
    if (window.confirm('스냅샷 생성을 취소하시겠습니까? 입력 중인 데이터는 저장되지 않습니다.')) {
      navigate('/db');
    }
  };

  const toggleAccountSelection = (id) => {
    setSelectedAccountIds(prev => 
      prev.includes(id) ? prev.filter(accId => accId !== id) : [...prev, id]
    );
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.is_active && acc.account_type === (snapshotType === 'brokerage' ? 'BROKERAGE' : 'BANK')
  );

  const selectedAccounts = accounts.filter(acc => selectedAccountIds.includes(acc.id));

  // --- Step 3 관련 핸들러 ---

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
    
    if (currentAccIdx < selectedAccountIds.length - 1) {
      setCurrentAccIdx(currentAccIdx + 1);
    } else {
      setStep(4);
    }
  };

  const updateAccData = (accId, updates) => {
    setAccountsFormData(prev => ({
      ...prev,
      [accId]: { ...prev[accId], ...updates, isConfirmed: false }
    }));
  };

  const addTx = (accId) => {
    const data = accountsFormData[accId];
    const newTxs = [...(data.newTransactions || []), { type: 'DEPOSIT', amount: '', currency: 'KRW', date: inputDate, memo: '' }];
    updateAccData(accId, { newTransactions: newTxs });
  };

  const removeTx = (accId, idx) => {
    const data = accountsFormData[accId];
    const newTxs = data.newTransactions.filter((_, i) => i !== idx);
    updateAccData(accId, { newTransactions: newTxs });
  };

  const updateTx = (accId, idx, field, value) => {
    const data = accountsFormData[accId];
    const newTxs = data.newTransactions.map((tx, i) => i === idx ? { ...tx, [field]: value } : tx);
    updateAccData(accId, { newTransactions: newTxs });
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
          accounts: filteredAccounts.map(acc => {
            const data = accountsFormData[acc.id] || { newTransactions: [] };
            return {
              account_id: acc.id,
              new_transactions: (data.newTransactions || []).map(tx => ({
                account_id: acc.id,
                asset_id: 0,
                transaction_date: tx.date || inputDate,
                type: tx.type,
                total_amount: parseFloat(tx.amount) || 0,
                currency: tx.currency || 'KRW',
                quantity: parseFloat(tx.amount) || 0,
                price: 1.0,
                memo: tx.memo || ''
              })),
              diff_krw: data.calcResult?.diff_krw || 0,
              diff_usd: data.calcResult?.diff_usd || 0
            };
          })
        };
      } else {
        endpoint = `${DB_API_BASE}/snapshots/bank/save`;
        payload = {
          snapshot_date: inputDate,
          accounts: filteredAccounts.map(acc => {
            const data = accountsFormData[acc.id] || { newTransactions: [] };
            return {
              account_id: acc.id,
              new_transactions: (data.newTransactions || []).map(tx => ({
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
              total_valuation: data.calcResult?.theoretical_krw || null
            };
          })
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('스냅샷이 성공적으로 저장되었습니다.');
        navigate('/db');
      } else {
        const err = await response.json();
        alert(`저장 중 오류 발생: ${err.detail || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('최종 저장 오류:', error);
      alert('저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const renderFinalPreview = () => (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
        <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
        <div className="text-sm text-emerald-800">
          <p className="font-semibold mb-1">모든 계좌 정산 완료</p>
          <p className="opacity-80">
            입력하신 데이터와 계산된 {snapshotType === 'brokerage' ? '배당금이' : '내역이'} 최종적으로 반영됩니다. 
            [저장하기]를 누르면 스냅샷이 생성됩니다.
          </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">계좌명</th>
              <th className="px-4 py-3 font-semibold text-slate-600">금융기관</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">신규 내역</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">
                {snapshotType === 'brokerage' ? '정산 결과(차액)' : '정산 결과(내역합계)'}
              </th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">최종 잔액(KRW)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAccounts.map((acc) => {
              const data = accountsFormData[acc.id] || {};
              const txCount = (data.newTransactions || []).length;
              const netTx = (data.newTransactions || []).reduce((sum, tx) => {
                const amt = parseFloat(tx.amount || 0);
                if (tx.type === 'DEPOSIT' || tx.type === 'INTEREST') return sum + amt;
                return sum - amt;
              }, 0);
              
              // 최종 잔액 표시
              let finalValText = '-';
              if (snapshotType === 'brokerage') {
                if (selectedAccountIds.includes(acc.id)) {
                   finalValText = Math.round(parseFloat(data.currentKrw || 0)).toLocaleString() + '원';
                }
              } else {
                if (data.calcResult?.theoretical_krw !== undefined) {
                  finalValText = Math.round(data.calcResult.theoretical_krw).toLocaleString() + '원';
                }
              }

              // 정산 결과 표시
              let resultText = '0';
              if (snapshotType === 'brokerage') {
                if (data.calcResult) {
                   const diff = Math.round(data.calcResult.diff_krw);
                   resultText = (diff >= 0 ? '+' : '') + diff.toLocaleString();
                }
              } else {
                resultText = (netTx >= 0 ? '+' : '') + netTx.toLocaleString();
              }

              return (
                <tr key={acc.id} className={!selectedAccountIds.includes(acc.id) ? 'opacity-60 bg-slate-50/50' : ''}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {acc.name}
                    {!selectedAccountIds.includes(acc.id) && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">미선택</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{acc.provider}</td>
                  <td className="px-4 py-3 text-right font-mono">{txCount}건</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{resultText}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{finalValText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Camera size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">신규 스냅샷 생성</h1>
            <p className="text-slate-500 text-sm">현재 자산 상태를 기록하기 위한 위저드를 시작합니다.</p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          취소
        </button>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="mb-10">
        <div className="flex items-center justify-between relative">
          {/* 연결선 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 transition-all duration-300 -z-10"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          ></div>

          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  step > s.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : step === s.id
                    ? 'bg-white border-blue-600 text-blue-600'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {step > s.id ? <Check size={20} /> : s.icon}
              </div>
              <span className={`text-xs mt-2 font-medium ${step === s.id ? 'text-blue-600' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[400px]">
        {step === 1 && (
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold mb-2">스냅샷 유형을 선택하세요</h2>
            <p className="text-slate-500 mb-8">기록하고자 하는 자산의 종류를 선택해주세요.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button
                onClick={() => { setSnapshotType('brokerage'); nextStep(); }}
                className={`flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all text-center hover:shadow-md group ${
                  snapshotType === 'brokerage' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  snapshotType === 'brokerage' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                }`}>
                  <Wallet size={32} />
                </div>
                <div>
                  <div className="font-bold text-lg mb-2">증권사</div>
                  <div className="text-sm text-slate-500">주식, ETF, 예수금 등 금융 상품 현황 기록</div>
                </div>
              </button>
              <button
                onClick={() => { setSnapshotType('bank'); nextStep(); }}
                className={`flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all text-center hover:shadow-md group ${
                  snapshotType === 'bank' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  snapshotType === 'bank' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                }`}>
                  <Landmark size={32} />
                </div>
                <div>
                  <div className="font-bold text-lg mb-2">은행</div>
                  <div className="text-sm text-slate-500">예적금, 입출금 통장 잔액 현황 기록</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="py-2 space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-2">기본 설정 및 계좌 선택</h2>
              <p className="text-slate-500 mb-6">스냅샷 기준 일자와 대상 계좌를 선택해주세요.</p>
            </div>

            {/* 기본 설정 영역 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={14} /> 기준 일자
                </label>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {snapshotType === 'brokerage' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={14} /> 기준 환율 (USD/KRW)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="예: 1350.5"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* 계좌 선택 테이블 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-700">대상 계좌 목록 ({filteredAccounts.length})</h3>
                <span className="text-xs text-slate-400 font-medium">선택됨: {selectedAccountIds.length}개</span>
              </div>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500"
                          checked={filteredAccounts.length > 0 && selectedAccountIds.length === filteredAccounts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAccountIds(filteredAccounts.map(a => a.id));
                            } else {
                              setSelectedAccountIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-600">소유자</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">금융기관</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">계좌명(번호)</th>
                      <th className="px-4 py-3 font-semibold text-slate-600">별칭</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingAccounts ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-10 text-center text-slate-400">계좌 목록을 불러오는 중...</td>
                      </tr>
                    ) : filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-10 text-center text-slate-400">활성화된 계좌가 없습니다.</td>
                      </tr>
                    ) : (
                      filteredAccounts.map((acc) => (
                        <tr 
                          key={acc.id} 
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedAccountIds.includes(acc.id) ? 'bg-blue-50/30' : ''}`}
                          onClick={() => toggleAccountSelection(acc.id)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={selectedAccountIds.includes(acc.id)}
                              onChange={() => toggleAccountSelection(acc.id)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{acc.user_name}</td>
                          <td className="px-4 py-3 text-slate-600">{acc.provider}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{acc.name}</td>
                          <td className="px-4 py-3 text-slate-500">{acc.alias || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
              <AlertCircle className="text-blue-500 shrink-0" size={20} />
              <div className="text-sm text-blue-800">
                <p className="opacity-90">선택한 {selectedAccountIds.length}개의 계좌에 대해 다음 단계에서 상세 정보를 입력합니다.</p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">상세 정보 입력</h2>
                <p className="text-slate-500">선택한 계좌별 상세 잔고 및 자산 정보를 입력합니다.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
                <span className="text-sm font-bold text-blue-600">{currentAccIdx + 1}</span>
                <span className="text-sm text-slate-400">/</span>
                <span className="text-sm font-medium text-slate-600">{selectedAccountIds.length} 계좌</span>
              </div>
            </div>

            {selectedAccounts[currentAccIdx] && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  {snapshotType === 'brokerage' ? <Wallet className="text-blue-600" size={24} /> : <Landmark className="text-emerald-600" size={24} />}
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      {selectedAccounts[currentAccIdx].name}
                      <span className="text-slate-500 font-normal text-sm ml-2">({selectedAccounts[currentAccIdx].provider})</span>
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <RefreshCw size={14} /> 기간 중 내역 (입출금, {snapshotType === 'bank' ? '이자, 세금' : '배당 등'})
                    </h4>
                    
                    <div className="space-y-3">
                      {/* 기존 DB에 저장된 내역 표시 */}
                      {(accountsFormData[selectedAccountIds[currentAccIdx]]?.existingTransactions || []).map((tx, idx) => (
                        <div key={`existing-${idx}`} className="bg-slate-100/50 p-3 rounded-lg border border-slate-200 space-y-2 opacity-80">
                          <div className="flex gap-4 items-center">
                            <span className="text-[10px] font-bold bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded shrink-0">기존</span>
                            <span className="text-sm font-mono text-slate-500 w-24 shrink-0">{tx.transaction_date}</span>
                            <span className="text-sm font-bold text-slate-600 w-16 shrink-0">
                              {tx.type === 'DEPOSIT' ? '입금' : tx.type === 'WITHDRAW' ? '출금' : tx.type === 'INTEREST' ? '이자' : tx.type === 'TAX' ? '세금' : tx.type}
                            </span>
                            <span className="text-sm font-mono font-bold text-slate-700 grow">
                              {tx.total_amount.toLocaleString()}
                            </span>
                            {snapshotType === 'brokerage' && <span className="text-xs font-bold text-slate-500 w-10">{tx.currency}</span>}
                            <span className="text-xs italic text-slate-500 truncate max-w-xs">{tx.memo || '-'}</span>
                          </div>
                        </div>
                      ))}

                      {/* 신규 추가 내역 */}
                      {(accountsFormData[selectedAccountIds[currentAccIdx]]?.newTransactions || []).map((tx, idx) => (
                        <div key={`new-${idx}`} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm space-y-2 ring-1 ring-blue-50">
                          <div className="flex gap-3 items-center">
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">신규</span>
                            <input 
                              type="date" 
                              value={tx.date || inputDate} 
                              onChange={(e) => updateTx(selectedAccountIds[currentAccIdx], idx, 'date', e.target.value)}
                              className="text-sm border border-slate-200 rounded px-2 py-1 w-32 shrink-0"
                            />
                            <select 
                              value={tx.type} 
                              onChange={(e) => updateTx(selectedAccountIds[currentAccIdx], idx, 'type', e.target.value)}
                              className="text-sm border border-slate-200 rounded px-2 py-1 w-24 shrink-0"
                            >
                              <option value="DEPOSIT">입금</option>
                              <option value="WITHDRAW">출금</option>
                              {snapshotType === 'bank' && <option value="INTEREST">이자</option>}
                              {snapshotType === 'bank' && <option value="TAX">세금</option>}
                            </select>
                            <input 
                              type="number" 
                              placeholder="금액" 
                              value={tx.amount} 
                              onChange={(e) => updateTx(selectedAccountIds[currentAccIdx], idx, 'amount', e.target.value)}
                              className="text-sm border border-slate-200 rounded px-2 py-1 grow font-mono"
                            />
                            {snapshotType === 'brokerage' && (
                              <select 
                                value={tx.currency} 
                                onChange={(e) => updateTx(selectedAccountIds[currentAccIdx], idx, 'currency', e.target.value)}
                                className="text-sm border border-slate-200 rounded px-2 py-1 w-16 shrink-0"
                              >
                                <option value="KRW">KRW</option>
                                <option value="USD">USD</option>
                              </select>
                            )}
                            <input 
                              type="text" 
                              placeholder="메모" 
                              value={tx.memo} 
                              onChange={(e) => updateTx(selectedAccountIds[currentAccIdx], idx, 'memo', e.target.value)}
                              className="text-xs italic text-slate-500 border border-slate-100 rounded px-2 py-1 grow"
                            />
                            <button onClick={() => removeTx(selectedAccountIds[currentAccIdx], idx)} className="text-slate-300 hover:text-red-500 shrink-0">
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button 
                        onClick={() => addTx(selectedAccountIds[currentAccIdx])}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={16} /> 거래 내역 추가하기
                      </button>
                    </div>
                  </div>

                  {snapshotType === 'brokerage' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          현재 보유 원화 (KRW)
                        </label>
                        <input
                          type="number"
                          value={accountsFormData[selectedAccountIds[currentAccIdx]]?.currentKrw || '0'}
                          onChange={(e) => updateAccData(selectedAccountIds[currentAccIdx], { currentKrw: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          현재 보유 달러 (USD)
                        </label>
                        <input
                          type="number"
                          value={accountsFormData[selectedAccountIds[currentAccIdx]]?.currentUsd || '0'}
                          onChange={(e) => updateAccData(selectedAccountIds[currentAccIdx], { currentUsd: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    {!(accountsFormData[selectedAccountIds[currentAccIdx]]?.calcResult) && (
                      <button 
                        onClick={() => snapshotType === 'bank' ? calculateBankDiff(selectedAccountIds[currentAccIdx]) : calculateAccountDiff(selectedAccountIds[currentAccIdx])}
                        disabled={processing}
                        className={`w-full py-4 ${snapshotType === 'bank' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-900'} text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-lg shadow-md`}
                      >
                        {processing ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                        {snapshotType === 'bank' ? '최종 잔액 계산하기' : '배당금/차액 계산하기'}
                      </button>
                    )}

                    {snapshotType === 'brokerage' && accountsFormData[selectedAccountIds[currentAccIdx]]?.calcResult && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-800 font-bold flex items-center gap-2"><CheckCircle2 size={20} /> 정산 결과</span>
                          <button 
                            onClick={() => updateAccData(selectedAccountIds[currentAccIdx], { calcResult: null })} 
                            className="text-sm text-emerald-600 font-medium hover:underline"
                          >
                            다시 입력
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-xl border border-emerald-200/50">
                            <p className="text-xs text-emerald-600 font-bold uppercase mb-1">원화 차액 (배당금 등)</p>
                            <p className={`text-2xl font-mono font-bold ${accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.diff_krw >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.diff_krw >= 0 ? '+' : ''}{Math.round(accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.diff_krw).toLocaleString()}원
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-emerald-200/50">
                            <p className="text-xs text-emerald-600 font-bold uppercase mb-1">달러 차액 (배당금 등)</p>
                            <p className={`text-2xl font-mono font-bold ${accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.diff_usd >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.diff_usd >= 0 ? '+' : ''}{accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.diff_usd.toFixed(2)} USD
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-emerald-700 opacity-80 leading-relaxed">
                          이론상 잔액(KRW {Math.round(accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.theoretical_krw).toLocaleString()} / USD {accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.theoretical_usd.toFixed(2)})과의 차액입니다.
                        </p>
                        <button
                          onClick={() => handleConfirmAccount(selectedAccountIds[currentAccIdx])}
                          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md mt-2"
                        >
                          위 결과가 맞습니다 (확인) <ChevronRight size={18} />
                        </button>
                      </div>
                    )}

                    {snapshotType === 'bank' && accountsFormData[selectedAccountIds[currentAccIdx]]?.calcResult && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-800 font-bold flex items-center gap-2"><CheckCircle2 size={20} /> 최종 잔액 확인</span>
                          <button 
                            onClick={() => updateAccData(selectedAccountIds[currentAccIdx], { calcResult: null })} 
                            className="text-sm text-emerald-600 font-medium hover:underline"
                          >
                            내역 수정
                          </button>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-emerald-200/50">
                          <p className="text-xs text-emerald-600 font-bold uppercase mb-1">계산된 최종 잔액 (KRW)</p>
                          <p className="text-3xl font-mono font-bold text-emerald-700">
                            {Math.round(accountsFormData[selectedAccountIds[currentAccIdx]].calcResult.theoretical_krw).toLocaleString()}원
                          </p>
                        </div>
                        <p className="text-sm text-emerald-700 opacity-80 leading-relaxed">
                          이전 잔액과 입력하신 {accountsFormData[selectedAccountIds[currentAccIdx]].newTransactions?.length || 0}건의 내역을 합산한 결과입니다. 실제 잔액과 맞는지 확인해 주세요.
                        </p>
                        <button
                          onClick={() => handleConfirmAccount(selectedAccountIds[currentAccIdx])}
                          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md mt-2"
                        >
                          최종 잔액이 맞습니다 (확인) <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && renderFinalPreview()}
      </div>

      {/* 네비게이션 버튼 */}
      <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          disabled={step === 1}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            step === 1
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ChevronLeft size={18} />
          이전
        </button>
        {step !== 3 && (
          <button
            onClick={step === totalSteps ? handleFinalSave : nextStep}
            disabled={(step === totalSteps && processing) || (step === 1 && !snapshotType)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              (step === totalSteps && processing) || (step === 1 && !snapshotType)
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {step === totalSteps ? (
              <>
                {processing ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                저장하기
              </>
            ) : (
              <>
                다음
                <ChevronRight size={18} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default SnapshotWizardPage;

