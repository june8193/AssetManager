import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronLeft, ChevronRight, Check, Settings, ListChecks, FileSearch, Calendar, DollarSign, Wallet, Landmark, Plus, Trash2, X, RefreshCw, CheckCircle2, Save, HelpCircle } from 'lucide-react';
import { DB_API_BASE } from '../config';

/**
 * 신규 스냅샷 생성을 위한 통합 위저드 페이지 컴포넌트입니다.
 * 5단계의 과정을 통해 증권사와 은행의 자산 상태를 한 번에 기록합니다.
 */
const SnapshotWizardPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // 기본 정보 및 계좌 목록 상태
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRate, setExchangeRate] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // 상세 입력 관련 상태
  const [currentAccIdx, setCurrentAccIdx] = useState(0);
  const [accountsFormData, setAccountsFormData] = useState({});
  const [processing, setProcessing] = useState(false);
  const [existingTxs, setExistingTxs] = useState({});
  const [loadingExistingTxs, setLoadingExistingTxs] = useState(false);

  const getAccountDisplayName = (acc) => {
    if (!acc) return '';
    return acc.alias ? `${acc.name} (${acc.alias})` : acc.name;
  };

  const totalSteps = 5;

  const steps = [
    { id: 1, label: '기본 정보/증권 선택', icon: <Settings size={18} /> },
    { id: 2, label: '증권 상세 입력', icon: <ListChecks size={18} /> },
    { id: 3, label: '은행 계좌 선택', icon: <Landmark size={18} /> },
    { id: 4, label: '은행 상세 입력', icon: <ListChecks size={18} /> },
    { id: 5, label: '최종 확인', icon: <FileSearch size={18} /> },
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

  // 2단계/4단계 계좌 전환 시 기존 트랜잭션 로드
  useEffect(() => {
    const fetchExistingTransactions = async () => {
      const isBrokerage = step === 2;
      const isBank = step === 4;
      if (!isBrokerage && !isBank) return;

      const targetAccounts = isBrokerage ? brokerageAccounts : bankAccounts;
      const selectedIds = selectedAccountIds.filter(id => 
        targetAccounts.some(acc => acc.id === id)
      );
      const accId = selectedIds[currentAccIdx];
      if (!accId) return;

      try {
        setLoadingExistingTxs(true);
        // 마지막 스냅샷 날짜 조회
        const latestResponse = await fetch(`${DB_API_BASE}/snapshots/latest`);
        let lastDate = '1970-01-01';
        if (latestResponse.ok) {
          const latestData = await latestResponse.json();
          if (latestData.latest_date) {
            lastDate = latestData.latest_date;
          }
        }
        
        // 기존 트랜잭션 API 호출
        const response = await fetch(`${DB_API_BASE}/accounts/${accId}/transactions/period?start_date=${lastDate}&end_date=${inputDate}`);
        if (response.ok) {
          const data = await response.json();
          setExistingTxs(prev => ({
            ...prev,
            [accId]: data
          }));
        }
      } catch (error) {
        console.error('기존 거래 내역 로드 실패:', error);
      } finally {
        setLoadingExistingTxs(false);
      }
    };

    fetchExistingTransactions();
  }, [step, currentAccIdx, inputDate, selectedAccountIds, accounts]);

  // 계좌 필터링
  const brokerageAccounts = accounts.filter(acc => acc.is_active && acc.account_type === 'BROKERAGE');
  const bankAccounts = accounts.filter(acc => acc.is_active && acc.account_type === 'BANK');

  // 상세 입력을 위한 폼 데이터 초기화
  const initializeStepFormData = (targetAccounts) => {
    const newFormData = { ...accountsFormData };
    targetAccounts.forEach(acc => {
      if (!newFormData[acc.id]) {
        newFormData[acc.id] = {
          newTransactions: [],
          existingTransactions: [],
          currentKrw: '0',
          currentUsd: '0',
          totalValuation: '0',
          calcResult: null,
          isConfirmed: false
        };
      }
    });
    setAccountsFormData(newFormData);
    setCurrentAccIdx(0);
  };

  const nextStep = () => {
    if (step === 1) {
      if (!inputDate) {
        alert('기준 일자를 선택해주세요.');
        return;
      }
      if (!exchangeRate || isNaN(exchangeRate)) {
        alert('올바른 환율을 입력해주세요.');
        return;
      }
      
      const selectedBrokerageIds = selectedAccountIds.filter(id => 
        brokerageAccounts.some(acc => acc.id === id)
      );
      
      if (selectedBrokerageIds.length === 0) {
        if (window.confirm('선택된 증권 계좌가 없습니다. 증권사 단계를 건너뛰시겠습니까?')) {
          setStep(3);
          return;
        } else {
          return;
        }
      }
      
      initializeStepFormData(brokerageAccounts.filter(acc => selectedBrokerageIds.includes(acc.id)));
    }
    
    else if (step === 2) {
      const selectedBrokerageIds = selectedAccountIds.filter(id => 
        brokerageAccounts.some(acc => acc.id === id)
      );
      const currentAccountId = selectedBrokerageIds[currentAccIdx];
      const currentData = accountsFormData[currentAccountId];
      
      if (!currentData?.isConfirmed) {
        alert('현재 계좌의 정산 결과를 확인하고 확인 버튼을 눌러주세요.');
        return;
      }

      if (currentAccIdx < selectedBrokerageIds.length - 1) {
        setCurrentAccIdx(currentAccIdx + 1);
        return;
      }
    }

    else if (step === 3) {
      const selectedBankIds = selectedAccountIds.filter(id => 
        bankAccounts.some(acc => acc.id === id)
      );
      
      const selectedBrokerageIds = selectedAccountIds.filter(id => 
        brokerageAccounts.some(acc => acc.id === id)
      );

      if (selectedBrokerageIds.length === 0 && selectedBankIds.length === 0) {
        alert('최소 하나 이상의 계좌(증권 또는 은행)를 선택해야 합니다.');
        return;
      }

      if (selectedBankIds.length === 0) {
        if (window.confirm('선택된 은행 계좌가 없습니다. 바로 최종 확인으로 이동하시겠습니까?')) {
          setStep(5);
          return;
        } else {
          return;
        }
      }

      initializeStepFormData(bankAccounts.filter(acc => selectedBankIds.includes(acc.id)));
    }

    else if (step === 4) {
      const selectedBankIds = selectedAccountIds.filter(id => 
        bankAccounts.some(acc => acc.id === id)
      );
      const currentAccountId = selectedBankIds[currentAccIdx];
      const currentData = accountsFormData[currentAccountId];
      
      if (!currentData?.isConfirmed) {
        alert('현재 계좌의 정산 결과를 확인하고 확인 버튼을 눌러주세요.');
        return;
      }

      if (currentAccIdx < selectedBankIds.length - 1) {
        setCurrentAccIdx(currentAccIdx + 1);
        return;
      }
    }

    if (step < totalSteps) setStep(step + 1);
  };

  const prevStep = () => {
    if (step === 2 || step === 4) {
      if (currentAccIdx > 0) {
        setCurrentAccIdx(currentAccIdx - 1);
        return;
      }
    }
    
    if (step === 3) {
      const selectedBrokerageIds = selectedAccountIds.filter(id => 
        brokerageAccounts.some(acc => acc.id === id)
      );
      if (selectedBrokerageIds.length === 0) {
        setStep(1);
        return;
      }
      // Step 2로 돌아갈 때는 마지막 계좌 인덱스로 설정
      setCurrentAccIdx(selectedBrokerageIds.length - 1);
    }

    if (step === 5) {
      const selectedBankIds = selectedAccountIds.filter(id => 
        bankAccounts.some(acc => acc.id === id)
      );
      if (selectedBankIds.length === 0) {
        setStep(3);
        return;
      }
      // Step 4로 돌아갈 때는 마지막 계좌 인덱스로 설정
      setCurrentAccIdx(selectedBankIds.length - 1);
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

  // --- 상세 정보 핸들러 ---

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
          current_usd: parseFloat(data.currentUsd) || 0,
          exchange_rate: parseFloat(exchangeRate) || 1.0
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
    
    // 자동 다음 계좌 이동
    const isBrokerage = step === 2;
    const targetAccounts = isBrokerage ? brokerageAccounts : bankAccounts;
    const selectedIds = selectedAccountIds.filter(id => 
      targetAccounts.some(acc => acc.id === id)
    );

    if (currentAccIdx < selectedIds.length - 1) {
      setCurrentAccIdx(currentAccIdx + 1);
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
      
      const selectedBrokerageIds = selectedAccountIds.filter(id => 
        brokerageAccounts.some(acc => acc.id === id)
      );
      const selectedBankIds = selectedAccountIds.filter(id => 
        bankAccounts.some(acc => acc.id === id)
      );

      const payload = {
        snapshot_date: inputDate,
        exchange_rate: parseFloat(exchangeRate),
        brokerage_accounts: selectedBrokerageIds.map(accId => {
          const data = accountsFormData[accId] || { newTransactions: [] };
          return {
            account_id: accId,
            new_transactions: (data.newTransactions || []).map(tx => ({
              account_id: accId,
              asset_id: 0,
              transaction_date: tx.date || inputDate,
              type: tx.type,
              total_amount: parseFloat(tx.amount) || 0,
              currency: tx.currency || 'KRW',
              quantity: parseFloat(tx.amount) || 0,
              price: 1.0,
              memo: tx.memo || ''
            })),
            diff_krw: parseFloat(data.calcResult?.diff_krw || 0),
            diff_usd: parseFloat(data.calcResult?.diff_usd || 0)
          };
        }),
        bank_accounts: selectedBankIds.map(accId => {
          const data = accountsFormData[accId] || { newTransactions: [] };
          return {
            account_id: accId,
            new_transactions: (data.newTransactions || []).map(tx => ({
              account_id: accId,
              asset_id: 0,
              transaction_date: tx.date || inputDate,
              type: tx.type,
              total_amount: parseFloat(tx.amount) || 0,
              currency: 'KRW',
              quantity: parseFloat(tx.amount) || 0,
              price: 1.0,
              memo: tx.memo || ''
            })),
            total_valuation: parseFloat(data.totalValuation) || data.calcResult?.theoretical_krw || null
          };
        })
      };

      const response = await fetch(`${DB_API_BASE}/snapshots/unified/save`, {
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

  const renderUnifiedTransactions = (accId, isBrokerage) => {
    const txs = existingTxs[accId] || [];
    const data = accountsFormData[accId] || { newTransactions: [] };
    const newTxs = data.newTransactions || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <ListChecks size={18} className="text-slate-500" /> 기간 내 거래 내역 (기존: {txs.length}건 / 신규: {newTxs.length}건)
          </h4>
          <button 
            onClick={() => addTx(accId)}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 border border-blue-100"
          >
            <Plus size={14} /> 신규 거래 추가
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 sticky top-0">
              <tr>
                <th className="px-3 py-3 font-semibold w-[20%]">날짜</th>
                <th className="px-3 py-3 font-semibold w-[20%]">유형</th>
                <th className="px-3 py-3 font-semibold w-[20%] text-right">금액/수량</th>
                <th className="px-3 py-3 font-semibold w-[30%]">메모</th>
                <th className="px-3 py-3 font-semibold w-[10%] text-center">동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* 기존 거래 내역 (읽기 전용) */}
              {loadingExistingTxs ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">기존 거래 내역 불러오는 중...</td>
                </tr>
              ) : txs.length === 0 && newTxs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">기록된 거래 내역이 없습니다. 신규 거래를 추가해 보세요.</td>
                </tr>
              ) : (
                txs.map((tx) => (
                  <tr key={tx.id} className="bg-slate-50/50 text-slate-500 hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono">{tx.transaction_date}</td>
                    <td className="px-3 py-3">
                      <span className="px-1.5 py-0.5 rounded-full font-bold text-[9px] bg-slate-200 text-slate-600">
                        {tx.type} (기존)
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-medium">
                      {tx.currency === 'USD' ? '$' : ''}{tx.total_amount.toLocaleString()}{tx.currency === 'KRW' ? '원' : ''}
                    </td>
                    <td className="px-3 py-3 text-slate-400 truncate max-w-[150px]" title={tx.memo}>{tx.memo || '-'}</td>
                    <td className="px-3 py-3 text-center text-[10px] text-slate-400 font-medium">읽기 전용</td>
                  </tr>
                ))
              )}

              {/* 신규 거래 내역 (편집 가능) */}
              {newTxs.map((tx, idx) => (
                <tr key={`new-${idx}`} className="bg-blue-50/10 hover:bg-blue-50/20">
                  <td className="px-2 py-2">
                    <input 
                      type="date"
                      value={tx.date || inputDate}
                      onChange={(e) => updateTx(accId, idx, 'date', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <select 
                        value={tx.type}
                        onChange={(e) => updateTx(accId, idx, 'type', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
                      >
                        <option value="DEPOSIT">입금</option>
                        <option value="WITHDRAW">출금</option>
                        <option value="INTEREST">이자</option>
                        <option value="FEE">수수료</option>
                        <option value="TAX">세금</option>
                        {!isBrokerage && (
                          <option value="CASH_ADJUSTMENT">현금 보정</option>
                        )}
                      </select>
                      {isBrokerage && (
                        <select 
                          value={tx.currency}
                          onChange={(e) => updateTx(accId, idx, 'currency', e.target.value)}
                          className="px-1 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="KRW">KRW</option>
                          <option value="USD">USD</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="relative">
                      <input 
                        type="number"
                        placeholder="금액"
                        value={tx.amount}
                        onChange={(e) => updateTx(accId, idx, 'amount', e.target.value)}
                        className="w-full pl-2 pr-6 py-1 text-xs text-right border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono font-medium"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                        {isBrokerage ? (tx.currency === 'USD' ? '$' : '₩') : '₩'}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input 
                      type="text"
                      placeholder="메모 (선택)"
                      value={tx.memo}
                      onChange={(e) => updateTx(accId, idx, 'memo', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button 
                      onClick={() => removeTx(accId, idx)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors inline-flex items-center justify-center"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAssetProfits = (calcResult) => {
    const profits = calcResult?.asset_profits || [];
    if (profits.length === 0) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-300">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <DollarSign size={18} className="text-blue-600" /> 종목별 기간수익 상세
        </h4>
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">종목(국가)</th>
                <th className="px-3 py-2.5 font-semibold text-right">이전 평가액</th>
                <th className="px-3 py-2.5 font-semibold text-right">매수/매도</th>
                <th className="px-3 py-2.5 font-semibold text-right">현재 평가액</th>
                <th className="px-3 py-2.5 font-semibold text-right">기간 수익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profits.map((p) => {
                const hasProfit = p.period_profit !== null && p.period_profit !== undefined;
                const hasLast = p.last_valuation !== null && p.last_valuation !== undefined;
                const hasCurrent = p.current_valuation !== null && p.current_valuation !== undefined;
                
                return (
                  <tr key={p.asset_id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-800">{p.asset_name}</div>
                      <div className="text-[9px] text-slate-400 font-mono">{p.ticker} · {p.country}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {hasLast ? `${Math.round(p.last_valuation).toLocaleString()}원` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[10px] text-slate-500">
                      <div className="text-rose-500">매수: {Math.round(p.period_buy).toLocaleString()}원</div>
                      <div className="text-emerald-500">매도: {Math.round(p.period_sell).toLocaleString()}원</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800">
                      {hasCurrent ? `${Math.round(p.current_valuation).toLocaleString()}원` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {hasProfit ? (
                        <span className={`font-bold ${p.period_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {p.period_profit > 0 ? '+' : ''}{Math.round(p.period_profit).toLocaleString()}원
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">조회 실패</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- 렌더링 함수들 ---

  const renderStep1 = () => (
    <div className="py-2 space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">기본 정보 및 증권 계좌 선택</h2>
        <p className="text-slate-500 mb-6">스냅샷 기준 일자와 대상 증권 계좌를 선택해주세요.</p>
      </div>

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
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-700">증권 계좌 목록 ({brokerageAccounts.length})</h3>
          <span className="text-xs text-slate-400 font-medium">선택됨: {selectedAccountIds.filter(id => brokerageAccounts.some(acc => acc.id === id)).length}개</span>
        </div>
        
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded text-blue-600 focus:ring-blue-500"
                    checked={brokerageAccounts.length > 0 && brokerageAccounts.every(a => selectedAccountIds.includes(a.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newIds = [...new Set([...selectedAccountIds, ...brokerageAccounts.map(a => a.id)])];
                        setSelectedAccountIds(newIds);
                      } else {
                        const bIds = brokerageAccounts.map(a => a.id);
                        setSelectedAccountIds(selectedAccountIds.filter(id => !bIds.includes(id)));
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
              ) : brokerageAccounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-400">활성화된 증권 계좌가 없습니다.</td>
                </tr>
              ) : (
                brokerageAccounts.map((acc) => (
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
                    <td className="px-4 py-3 text-slate-800 font-medium">{getAccountDisplayName(acc)}</td>
                    <td className="px-4 py-3 text-slate-500">{acc.alias || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBrokerageDetail = () => {
    const selectedBrokerageIds = selectedAccountIds.filter(id => 
      brokerageAccounts.some(acc => acc.id === id)
    );
    const accId = selectedBrokerageIds[currentAccIdx];
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return null;

    const data = accountsFormData[accId] || { newTransactions: [], currentKrw: '0', currentUsd: '0' };
    const calc = data.calcResult;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">증권사 상세 정보 입력</h2>
            <p className="text-slate-500">선택한 증권 계좌별 상세 잔고 및 자산 정보를 입력합니다.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
            <span className="text-sm font-bold text-blue-600">{currentAccIdx + 1}</span>
            <span className="text-sm text-slate-400">/</span>
            <span className="text-sm font-medium text-slate-600">{selectedBrokerageIds.length} 계좌</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
              {acc.provider[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900">{getAccountDisplayName(acc)}</h3>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">증권</span>
              </div>
              <p className="text-slate-500 text-sm">{acc.provider} · {acc.user_name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">기준 일자</p>
            <p className="font-mono font-bold text-slate-700">{inputDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Column 1 & 2: 통합 거래 내역 테이블 */}
          <div className="xl:col-span-2 space-y-4">
            {renderUnifiedTransactions(accId, true)}
          </div>

          {/* Column 3: 잔고 입력 및 결과 */}
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 space-y-6">
              <h4 className="font-bold text-blue-900 flex items-center gap-2">
                <Wallet size={18} /> 현재 예수금 잔액 입력
              </h4>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-blue-700 uppercase tracking-wider">원화 잔액 (KRW)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={data.currentKrw}
                      onChange={(e) => updateAccData(accId, { currentKrw: e.target.value })}
                      className="w-full pl-4 pr-12 py-3 bg-white border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono font-bold text-lg"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">원</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-blue-700 uppercase tracking-wider">달러 잔액 (USD)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={data.currentUsd}
                      onChange={(e) => updateAccData(accId, { currentUsd: e.target.value })}
                      className="w-full pl-4 pr-12 py-3 bg-white border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono font-bold text-lg"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => calculateAccountDiff(accId)}
                disabled={processing}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:bg-blue-300"
              >
                {processing ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                정산 결과 계산하기
              </button>
            </div>

            {calc && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" /> 계산 결과 (현금 보정액)
                  </h4>
                  <div className="relative group/tooltip">
                    <HelpCircle size={16} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
                    <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50 normal-case font-normal leading-relaxed">
                      입력하신 실제 현금 잔고와 시스템상 계산된 이론적 잔고의 차이입니다. 주로 수수료, 배당, 이자수익 등 누락된 현금 거래 내역으로 인해 발생하며, 스냅샷 저장 시 '현금 보정(CASH_ADJUSTMENT)' 내역으로 자동 기록되어 실제 잔고와 일치하도록 보정합니다.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">원화 잔고 보정액</p>
                    <p className={`text-lg font-mono font-bold ${calc.diff_krw >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calc.diff_krw > 0 ? '+' : ''}{Math.round(calc.diff_krw).toLocaleString()}원
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">달러 잔고 보정액</p>
                    <p className={`text-lg font-mono font-bold ${calc.diff_usd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calc.diff_usd > 0 ? '+' : ''}{calc.diff_usd.toLocaleString()}$
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-100 my-4 pt-4 space-y-3">
                  <div className="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-500">기간 입금액</span>
                    <span className="font-mono font-bold text-slate-700">
                      {Math.round(calc.period_deposit).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-500">기간 수익</span>
                    <span className={`font-mono font-bold ${calc.period_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calc.period_profit > 0 ? '+' : ''}{Math.round(calc.period_profit).toLocaleString()}원
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleConfirmAccount(accId)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 이 결과로 확정
                </button>
              </div>
            )}
            
            {data.isConfirmed && !calc && (
               <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                 <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <Check size={24} />
                 </div>
                 <p className="font-bold text-emerald-900">확인 완료</p>
               </div>
            )}
          </div>
        </div>

        {/* 종목별 기간수익 상세 테이블 하단 표시 */}
        {calc && renderAssetProfits(calc)}
      </div>
    );
  };

  const renderBankDetail = () => {
    const selectedBankIds = selectedAccountIds.filter(id => 
      bankAccounts.some(acc => acc.id === id)
    );
    const accId = selectedBankIds[currentAccIdx];
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return null;

    const data = accountsFormData[accId] || { newTransactions: [], totalValuation: '0' };
    const calc = data.calcResult;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">은행 상세 정보 입력</h2>
            <p className="text-slate-500">선택한 은행 계좌별 신규 내역 및 최종 잔액을 입력합니다.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
            <span className="text-sm font-bold text-blue-600">{currentAccIdx + 1}</span>
            <span className="text-sm text-slate-400">/</span>
            <span className="text-sm font-medium text-slate-600">{selectedBankIds.length} 계좌</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
              {acc.provider[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900">{getAccountDisplayName(acc)}</h3>
                <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">은행</span>
              </div>
              <p className="text-slate-500 text-sm">{acc.provider} · {acc.user_name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">기준 일자</p>
            <p className="font-mono font-bold text-slate-700">{inputDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Column 1 & 2: 통합 거래 내역 테이블 */}
          <div className="xl:col-span-2 space-y-4">
            {renderUnifiedTransactions(accId, false)}
          </div>

          {/* Column 3: 최종 잔액 입력 */}
          <div className="space-y-6">
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 space-y-6">
              <h4 className="font-bold text-amber-900 flex items-center gap-2">
                <Landmark size={18} /> 최종 잔액(평가액) 입력
              </h4>
              
              <div className="space-y-4">
                <button 
                  onClick={() => calculateBankDiff(accId)}
                  disabled={processing}
                  className="w-full py-3 bg-white border border-amber-200 hover:bg-amber-100 text-amber-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                  예상 잔액 계산하기
                </button>

                {calc && (
                  <div className="bg-white/60 p-4 rounded-xl border border-amber-200">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">시스템 계산 예상 잔액</p>
                    <p className="text-xl font-mono font-bold text-slate-700">
                      {Math.round(calc.theoretical_krw).toLocaleString()}원
                    </p>
                    <button 
                      onClick={() => updateAccData(accId, { totalValuation: Math.round(calc.theoretical_krw).toString() })}
                      className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                    >
                      이 금액 적용하기
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-700 uppercase tracking-wider">실제 최종 잔액 (KRW)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={data.totalValuation}
                      onChange={(e) => updateAccData(accId, { totalValuation: e.target.value })}
                      className="w-full pl-4 pr-12 py-3 bg-white border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono font-bold text-lg"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">원</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleConfirmAccount(accId)}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2"
              >
                <Check size={20} /> 이 결과로 확정
              </button>
            </div>
            
            {data.isConfirmed && (
               <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                 <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <Check size={24} />
                 </div>
                 <p className="font-bold text-emerald-900">확인 완료</p>
               </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBankSelection = () => (
    <div className="py-2 space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-semibold mb-2">은행 계좌 선택</h2>
        <p className="text-slate-500 mb-6">스냅샷에 포함할 은행 계좌를 선택해주세요.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-700">은행 계좌 목록 ({bankAccounts.length})</h3>
          <span className="text-xs text-slate-400 font-medium">선택됨: {selectedAccountIds.filter(id => bankAccounts.some(acc => acc.id === id)).length}개</span>
        </div>
        
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input 
                    type="checkbox" 
                    className="rounded text-blue-600 focus:ring-blue-500"
                    checked={bankAccounts.length > 0 && bankAccounts.every(a => selectedAccountIds.includes(a.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newIds = [...new Set([...selectedAccountIds, ...bankAccounts.map(a => a.id)])];
                        setSelectedAccountIds(newIds);
                      } else {
                        const bIds = bankAccounts.map(a => a.id);
                        setSelectedAccountIds(selectedAccountIds.filter(id => !bIds.includes(id)));
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
              ) : bankAccounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-400">활성화된 은행 계좌가 없습니다.</td>
                </tr>
              ) : (
                bankAccounts.map((acc) => (
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
                    <td className="px-4 py-3 text-slate-800 font-medium">{getAccountDisplayName(acc)}</td>
                    <td className="px-4 py-3 text-slate-500">{acc.alias || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderFinalPreview = () => {
    const selectedAccounts = accounts.filter(acc => selectedAccountIds.includes(acc.id));
    
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
          <div className="text-sm text-emerald-800">
            <p className="font-semibold mb-1">모든 계좌 정산 완료</p>
            <p className="opacity-80">
              입력하신 데이터와 계산된 내역이 최종적으로 반영됩니다. 
              [저장하기]를 누르면 스냅샷이 생성됩니다.
            </p>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">계좌명</th>
                <th className="px-4 py-3 font-semibold text-slate-600">유형</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">신규 내역</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">정산 결과(차액)</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">기간 입금 / 수익</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">최종 잔액/평가액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedAccounts.map((acc) => {
                const data = accountsFormData[acc.id] || {};
                const txCount = (data.newTransactions || []).length;
                
                let resultElement = <span className="text-slate-400">-</span>;
                let periodElement = <span className="text-slate-400">-</span>;
                let finalValElement = <span className="text-slate-400">-</span>;

                if (acc.account_type === 'BROKERAGE') {
                  if (data.calcResult) {
                    const diffKrw = Math.round(data.calcResult.diff_krw);
                    const diffUsd = data.calcResult.diff_usd;
                    resultElement = (
                      <div className="flex flex-col items-end">
                        <span className={diffKrw >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {diffKrw > 0 ? '+' : ''}{diffKrw.toLocaleString()}원
                        </span>
                        {Math.abs(diffUsd) > 0.001 && (
                          <span className={`text-[10px] ${diffUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {diffUsd > 0 ? '+' : ''}{diffUsd.toLocaleString()}$
                          </span>
                        )}
                      </div>
                    );
                  }
                  finalValElement = (
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-slate-900">{Math.round(parseFloat(data.currentKrw || 0)).toLocaleString()}원</span>
                      {parseFloat(data.currentUsd || 0) > 0 && (
                        <span className="text-[10px] text-slate-500">{parseFloat(data.currentUsd || 0).toLocaleString()}$</span>
                      )}
                    </div>
                  );
                  if (data.calcResult) {
                    const pDeposit = Math.round(data.calcResult.period_deposit || 0);
                    const pProfit = Math.round(data.calcResult.period_profit || 0);
                    periodElement = (
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-600">입금: {pDeposit.toLocaleString()}원</span>
                        <span className={`text-xs font-bold ${pProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          수익: {pProfit > 0 ? '+' : ''}{pProfit.toLocaleString()}원
                        </span>
                      </div>
                    );
                  }
                } else {
                  // Bank
                  const finalVal = parseFloat(data.totalValuation) || data.calcResult?.theoretical_krw || 0;
                  finalValElement = (
                    <span className="font-bold text-slate-900">{Math.round(finalVal).toLocaleString()}원</span>
                  );
                }

                return (
                  <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800">{getAccountDisplayName(acc)}</div>
                      <div className="text-[10px] text-slate-400">{acc.provider} · {acc.user_name}</div>
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${acc.account_type === 'BROKERAGE' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                        {acc.account_type === 'BROKERAGE' ? '증권' : '은행'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-slate-600">{txCount}건</td>
                    <td className="px-4 py-4 text-right font-mono">
                      {resultElement}
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      {periodElement}
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      {finalValElement}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 증권 계좌들의 종목별 기간수익 정보 노출 */}
        {selectedAccounts
          .filter(acc => acc.account_type === 'BROKERAGE')
          .map(acc => {
            const data = accountsFormData[acc.id] || {};
            if (!data.calcResult) return null;
            return (
              <div key={acc.id} className="mt-6 space-y-3">
                <div className="text-sm font-bold text-slate-700 px-1">
                  [{getAccountDisplayName(acc)}] 종목별 기간수익 상세
                </div>
                {renderAssetProfits(data.calcResult)}
              </div>
            );
          })
        }
      </div>
    );
  };

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
            <p className="text-slate-500 text-sm">현재 자산 상태를 기록하기 위한 통합 위저드를 시작합니다.</p>
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
        {step === 1 && renderStep1()}
        {step === 2 && renderBrokerageDetail()}
        {step === 3 && renderBankSelection()}
        {step === 4 && renderBankDetail()}
        {step === 5 && renderFinalPreview()}
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
        <button
          onClick={step === totalSteps ? handleFinalSave : nextStep}
          disabled={
            (step === totalSteps && (processing || selectedAccountIds.length === 0 || !selectedAccountIds.every(id => accountsFormData[id]?.isConfirmed))) ||
            (processing)
          }
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            ((step === totalSteps && (processing || selectedAccountIds.length === 0 || !selectedAccountIds.every(id => accountsFormData[id]?.isConfirmed))) || processing)
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
      </div>
    </div>
  );
};

export default SnapshotWizardPage;
