import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, Search, AlertTriangle } from 'lucide-react';
import { DB_API_BASE } from '../../config';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 숫자를 3자리마다 쉼표가 들어간 포맷으로 변환합니다.
 * 소수점 이하 자리수도 그대로 유지합니다.
 */
const formatInputNumber = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const str = value.toString();
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

/**
 * 거래 유형 및 연동 여부에 따라 뱃지의 텍스트와 스타일 CSS를 반환합니다.
 */
const getTypeBadgeProps = (tx) => {
  const isExchangeTx = tx.type === 'EXCHANGE';

  if (isExchangeTx) {
    return { label: '환전', style: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
  }
  if (['BUY', 'DEPOSIT', 'INITIAL_BALANCE'].includes(tx.type)) {
    return { label: tx.type, style: 'bg-blue-50 text-blue-600' };
  }
  if (['SELL', 'WITHDRAW'].includes(tx.type)) {
    return { label: tx.type, style: 'bg-red-50 text-red-600' };
  }
  return { label: tx.type, style: 'bg-emerald-50 text-emerald-600' };
};

/**
 * 환전 도착 자산 Ticker 미선택 시 기본 표시 라벨입니다.
 */
const DEFAULT_TARGET_TICKER_LABEL = '도착Ticker';

/**
 * 환전 출발 자산 Ticker 미선택 시 기본 표시 라벨입니다.
 */
const DEFAULT_SOURCE_TICKER_LABEL = '출발Ticker';

/**
 * 현금(CASH) 카테고리 자산인지 판단하는 헬퍼 함수입니다.
 *
 * @param {Object} asset - 자산 객체
 * @returns {boolean} 현금 카테고리 자산 여부
 */
const isCashAsset = (asset) => {
  if (!asset) return false;
  if (asset.category !== undefined) {
    return asset.category === 'CASH';
  }
  return asset.ticker === 'USD' || asset.ticker === 'KRW';
};

/**
 * 두 Entity ID(문자열/숫자)가 동일한지 안전하게 비교하는 헬퍼 함수입니다.
 *
 * @param {string|number} id1 - 첫 번째 ID
 * @param {string|number} id2 - 두 번째 ID
 * @returns {boolean} ID 동일 여부
 */
const isSameId = (id1, id2) => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return String(id1) === String(id2);
};

/**
 * 거래 유형 및 선택된 자산 Ticker에 따라 폼 입력 필드 라벨을 반환합니다.
 *
 * @param {string} type - 거래 유형 (EXCHANGE, TRANSFER, BUY 등)
 * @param {string} sourceTicker - 출발 자산 Ticker
 * @param {string} targetTicker - 도착 자산 Ticker
 * @returns {Object} 필드별 라벨 텍스트 객체
 */
const getFieldLabels = (type, sourceTicker, targetTicker) => {
  const isExchange = type === 'EXCHANGE';
  const isTransfer = type === 'TRANSFER';
  const targetText = targetTicker || DEFAULT_TARGET_TICKER_LABEL;
  const sourceText = sourceTicker || DEFAULT_SOURCE_TICKER_LABEL;

  if (isExchange) {
    return {
      quantity: `환전 도착 금액 (수령 수량) ${targetText}`,
      price: `적용 환율 (1 ${targetText} 당 ${sourceText})`,
      totalAmount: `환전 출발 금액 (지불 금액) ${sourceText}`
    };
  }

  return {
    quantity: '수량',
    price: '단가',
    totalAmount: isTransfer ? '이체 금액' : '총 금액'
  };
};

/**
 * 거래 내역 관리 탭 컴포넌트입니다.
 * 계좌별 거래(매수, 매도, 입출금 등) 내역을 조회하고 편집합니다.
 */
const TransactionsTab = () => {

  const [transactions, setTransactions] = useState([]); // 전체 거래 내역
  const [accounts, setAccounts] = useState([]);         // 계좌 목록 (필터 및 입력용)
  const [assets, setAssets] = useState([]);             // 자산 목록 (입력용)
  const [loading, setLoading] = useState(true);         // 로딩 상태
  const [error, setError] = useState(null);             // 데이터 로딩 에러 상태
  const [editingId, setEditingId] = useState(null);     // 수정 중인 거래 ID
  const [accountFilter, setAccountFilter] = useState('all'); // 계좌 필터 상태
  const { maskValue } = useMasking();
  
  // 입력 폼 데이터 상태
  const [formData, setFormData] = useState({
    account_id: '',
    target_account_id: '',
    asset_id: '',
    target_asset_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'BUY',
    quantity: '0',
    price: '0',
    total_amount: '0',
    currency: 'KRW',
    exchange_rate: null,
    memo: ''
  });

  /**
   * 서버에서 거래, 계좌, 자산 데이터를 병렬로 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [txRes, accRes, assetRes] = await Promise.all([
        fetch(`${DB_API_BASE}/transactions`),
        fetch(`${DB_API_BASE}/accounts`),
        fetch(`${DB_API_BASE}/assets`)
      ]);

      if (!txRes.ok || !accRes.ok || !assetRes.ok) {
        throw new Error('거래 내역을 불러오는데 실패했습니다. 서버 상태나 DB 스키마를 확인해주세요.');
      }

      const txData = await txRes.json();
      const accData = await accRes.json();
      const assetData = await assetRes.json();
      
      setTransactions(txData);
      setAccounts(accData);
      setAssets(assetData);

      // 초기 폼 데이터 설정 및 자산별 기본 제약사항/통화 매핑 자동 적용
      let initialAccountId = formData.account_id;
      let initialTargetAccountId = formData.target_account_id;
      let initialAssetId = formData.asset_id;
      let initialTargetAssetId = formData.target_asset_id;

      if (accData.length > 0 && !initialAccountId) {
        initialAccountId = accData[0].id;
      }
      if (accData.length > 1 && !initialTargetAccountId) {
        const altAcc = accData.find(a => !isSameId(a.id, initialAccountId));
        initialTargetAccountId = altAcc ? altAcc.id : accData[1].id;
      }
      if (assetData.length > 0 && !initialAssetId) {
        initialAssetId = assetData[0].id;
      }
      if (assetData.length > 1 && !initialTargetAssetId) {
        const cashAssets = assetData.filter(isCashAsset);
        const defaultTarget = cashAssets.find(a => !isSameId(a.id, initialAssetId)) || assetData[1];
        initialTargetAssetId = defaultTarget ? defaultTarget.id : '';
      }

      setFormData(prev => {
        const updated = {
          ...prev,
          account_id: initialAccountId,
          target_account_id: initialTargetAccountId,
          asset_id: initialAssetId,
          target_asset_id: initialTargetAssetId
        };
        const firstAsset = assetData.find(a => isSameId(a.id, initialAssetId));
        if (firstAsset) {
          let newCurrency = 'KRW';
          if (firstAsset.ticker === 'USD' || firstAsset.country === 'US') {
            newCurrency = 'USD';
          }
          updated.currency = newCurrency;

          if (isCashAsset(firstAsset)) {
            if (updated.type !== 'DEPOSIT' && updated.type !== 'WITHDRAW' && updated.type !== 'EXCHANGE' && updated.type !== 'TRANSFER') {
              updated.type = 'DEPOSIT';
            }
            if (updated.type !== 'EXCHANGE' && updated.type !== 'TRANSFER') {
              updated.price = '1';
              const q = parseFloat(updated.quantity.toString().replace(/,/g, '')) || 0;
              updated.total_amount = q.toString();
            }
          }
        }
        return updated;
      });
    } catch (err) {
      console.error('거래 데이터 로딩 오류:', err);
      setError(err.message || '거래 내역을 불러오는데 실패했습니다.');
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
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'type') {
      if (value === 'EXCHANGE') {
        const cashAssets = assets.filter(isCashAsset);
        let currentSource = assets.find(a => isSameId(a.id, newFormData.asset_id));
        if (!currentSource || !isCashAsset(currentSource)) {
          newFormData.asset_id = cashAssets[0] ? cashAssets[0].id : newFormData.asset_id;
        }
        let targetId = newFormData.target_asset_id;
        if (!targetId || isSameId(targetId, newFormData.asset_id)) {
          const alternativeTarget = cashAssets.find(a => !isSameId(a.id, newFormData.asset_id));
          targetId = alternativeTarget ? alternativeTarget.id : (cashAssets[0]?.id || '');
        }
        newFormData.target_asset_id = targetId;

        const q = parseFloat(newFormData.quantity.toString().replace(/,/g, '')) || 0;
        const p = parseFloat(newFormData.price.toString().replace(/,/g, '')) || 0;
        if (q > 0 && p > 0) {
          newFormData.total_amount = (q * p).toString();
        }
      } else if (value === 'TRANSFER') {
        let targetAccId = newFormData.target_account_id;
        if (!targetAccId || isSameId(targetAccId, newFormData.account_id)) {
          const altAcc = accounts.find(a => !isSameId(a.id, newFormData.account_id));
          targetAccId = altAcc ? altAcc.id : '';
        }
        newFormData.target_account_id = targetAccId;
        const krwAsset = assets.find(a => a.ticker === 'KRW') || assets[0];
        if (krwAsset) {
          newFormData.asset_id = krwAsset.id;
          newFormData.currency = krwAsset.country === 'US' ? 'USD' : 'KRW';
        }
      }
    } else if (name === 'account_id' && newFormData.type === 'TRANSFER') {
      if (isSameId(newFormData.target_account_id, value)) {
        const altAcc = accounts.find(a => !isSameId(a.id, value));
        newFormData.target_account_id = altAcc ? altAcc.id : '';
      }
    }

    if (name === 'quantity' || name === 'price' || name === 'total_amount') {
      const cleanedValue = value.replace(/,/g, '');
      if (cleanedValue === '' || cleanedValue === '-') {
        newFormData[name] = cleanedValue;
      } else if (!isNaN(cleanedValue) || cleanedValue.endsWith('.')) {
        newFormData[name] = cleanedValue;
      } else {
        return;
      }

      if (name === 'quantity' || name === 'price') {
        const q = name === 'quantity' ? parseFloat(cleanedValue) || 0 : parseFloat(newFormData.quantity.toString().replace(/,/g, '')) || 0;
        const p = name === 'price' ? parseFloat(cleanedValue) || 0 : parseFloat(newFormData.price.toString().replace(/,/g, '')) || 0;
        newFormData.total_amount = (q * p).toString();
      }
    } else if (name === 'asset_id') {
      newFormData.asset_id = value;
      if (newFormData.type === 'EXCHANGE') {
        const cashAssets = assets.filter(isCashAsset);
        if (newFormData.target_asset_id && isSameId(newFormData.target_asset_id, value)) {
          const altTarget = cashAssets.find(a => !isSameId(a.id, value));
          newFormData.target_asset_id = altTarget ? altTarget.id : '';
        }
      }
      const selectedAsset = assets.find(a => isSameId(a.id, value));
      if (selectedAsset) {
        let newCurrency = 'KRW';
        if (selectedAsset.ticker === 'USD' || selectedAsset.country === 'US') {
          newCurrency = 'USD';
        }
        newFormData.currency = newCurrency;

        if (isCashAsset(selectedAsset)) {
          if (newFormData.type !== 'DEPOSIT' && newFormData.type !== 'WITHDRAW' && newFormData.type !== 'EXCHANGE' && newFormData.type !== 'TRANSFER') {
            newFormData.type = 'DEPOSIT';
          }
          if (newFormData.type !== 'EXCHANGE' && newFormData.type !== 'TRANSFER') {
            newFormData.price = '1';
            const q = parseFloat(newFormData.quantity.toString().replace(/,/g, '')) || 0;
            newFormData.total_amount = q.toString();
          }
        }
      }
    }

    setFormData(newFormData);
  };

  /**
   * 폼 제출(저장/추가) 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isTransfer = formData.type === 'TRANSFER';
    const isExchange = formData.type === 'EXCHANGE';

    if (isTransfer && !editingId) {
      const transferPayload = {
        source_account_id: parseInt(formData.account_id),
        target_account_id: parseInt(formData.target_account_id),
        asset_id: parseInt(formData.asset_id),
        amount: parseFloat(formData.total_amount.toString().replace(/,/g, '')) || 0,
        transaction_date: formData.transaction_date,
        memo: formData.memo || null
      };

      try {
        const response = await fetch(`${DB_API_BASE}/transactions/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transferPayload)
        });

        if (response.ok) {
          fetchData();
          resetForm();
        }
      } catch (error) {
        console.error('계좌 이체 등록 오류:', error);
      }
      return;
    }

    const url = editingId ? `${DB_API_BASE}/transactions/${editingId}` : `${DB_API_BASE}/transactions`;
    const method = editingId ? 'PUT' : 'POST';

    const payload = {
      ...formData,
      quantity: parseFloat(formData.quantity.toString().replace(/,/g, '')) || 0,
      price: parseFloat(formData.price.toString().replace(/,/g, '')) || 0,
      total_amount: parseFloat(formData.total_amount.toString().replace(/,/g, '')) || 0,
      target_asset_id: isExchange && formData.target_asset_id ? parseInt(formData.target_asset_id) : null,
      exchange_rate: isExchange 
        ? (parseFloat(formData.price.toString().replace(/,/g, '')) || null) 
        : (formData.exchange_rate ? parseFloat(formData.exchange_rate) : null)
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchData();
        if (editingId) {
          resetForm();
        } else {
          const currentAsset = assets.find(a => a.id.toString() === formData.asset_id.toString());
          const isCash = currentAsset ? (currentAsset.ticker === 'USD' || currentAsset.ticker === 'KRW') : false;
          setFormData(prev => ({
            ...prev,
            quantity: '0',
            price: isCash && prev.type !== 'EXCHANGE' && prev.type !== 'TRANSFER' ? '1' : '0',
            total_amount: '0'
          }));
        }
      }
    } catch (error) {
      console.error('거래 내역 저장 오류:', error);
    }
  };

  /**
   * 수정 모드 진입
   */
  const handleEdit = (tx) => {
    setEditingId(tx.id);
    setFormData({
      account_id: tx.account_id,
      target_account_id: '',
      asset_id: tx.asset_id,
      target_asset_id: tx.target_asset_id || '',
      transaction_date: tx.transaction_date,
      type: tx.type,
      quantity: (tx.quantity ?? 0).toString(),
      price: (tx.price ?? 0).toString(),
      total_amount: (tx.total_amount ?? 0).toString(),
      currency: tx.currency,
      exchange_rate: tx.exchange_rate !== undefined ? tx.exchange_rate : null,
      memo: tx.memo || ''
    });
  };

  /**
   * 거래 내역 삭제 핸들러
   */
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`${DB_API_BASE}/transactions/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('거래 내역 삭제 오류:', error);
    }
  };

  /**
   * 입력 폼 초기화
   */
  const resetForm = () => {
    setEditingId(null);
    const defaultAssetId = assets.length > 0 ? assets[0].id : '';
    const defaultAsset = assets.find(a => isSameId(a.id, defaultAssetId));
    const cashAssets = assets.filter(isCashAsset);
    const defaultTarget = cashAssets.find(a => !isSameId(a.id, defaultAssetId)) || assets[1];
    const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
    const altAcc = accounts.find(a => !isSameId(a.id, defaultAccountId));

    let defaultCurrency = 'KRW';
    let defaultType = 'BUY';
    let defaultPrice = '0';

    if (defaultAsset) {
      if (defaultAsset.ticker === 'USD' || defaultAsset.country === 'US') {
        defaultCurrency = 'USD';
      }
      if (isCashAsset(defaultAsset)) {
        defaultType = 'DEPOSIT';
        defaultPrice = '1';
      }
    }

    setFormData({
      account_id: defaultAccountId,
      target_account_id: altAcc ? altAcc.id : '',
      asset_id: defaultAssetId,
      target_asset_id: defaultTarget ? defaultTarget.id : '',
      transaction_date: new Date().toISOString().split('T')[0],
      type: defaultType,
      quantity: '0',
      price: defaultPrice,
      total_amount: '0',
      currency: defaultCurrency,
      exchange_rate: null,
      memo: ''
    });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  // 선택된 계좌 필터에 따른 목록 필터링
  const filteredTransactions = accountFilter === 'all' 
    ? transactions 
    : transactions.filter(tx => isSameId(tx.account_id, accountFilter));

  // 현재 선택된 자산 및 예수금 여부 판단
  const selectedAsset = assets.find(a => isSameId(a.id, formData.asset_id));
  const selectedTargetAsset = assets.find(a => isSameId(a.id, formData.target_asset_id));
  const isCash = isCashAsset(selectedAsset);
  const isExchangeForm = formData.type === 'EXCHANGE';
  const isTransferForm = formData.type === 'TRANSFER';
  const sourceTicker = selectedAsset ? selectedAsset.ticker : '';
  const targetTicker = selectedTargetAsset ? selectedTargetAsset.ticker : '';

  const fieldLabels = getFieldLabels(formData.type, sourceTicker, targetTicker);

  return (
    <div className="p-6">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h4 className="font-semibold text-sm">데이터 로딩 오류</h4>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 필터 영역 */}
      <div className="mb-6 flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">계좌 필터:</span>
        </div>
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">전체 계좌</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.provider} / {acc.name}{acc.alias ? ` / ${acc.alias}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 입력 폼 영역 */}
      <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
          {editingId ? '거래 내역 수정' : (isTransferForm ? '계좌 이체' : '새 거래 내역 추가')}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">날짜</label>
            <input
              type="date"
              name="transaction_date"
              value={formData.transaction_date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {isTransferForm ? '출발 계좌' : '계좌'}
            </label>
            <select
              name="account_id"
              value={formData.account_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.provider} / {acc.name}{acc.alias ? ` / ${acc.alias}` : ''}
                </option>
              ))}
            </select>
          </div>

          {isTransferForm && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">도착 계좌</label>
              <select
                name="target_account_id"
                value={formData.target_account_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                {accounts
                  .filter(acc => acc.id.toString() !== formData.account_id.toString())
                  .map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.provider} / {acc.name}{acc.alias ? ` / ${acc.alias}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {isExchangeForm ? '출발 자산' : '자산'}
            </label>
            <select
              name="asset_id"
              value={formData.asset_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              {(isExchangeForm ? assets.filter(isCashAsset) : assets).map(asset => (
                <option key={asset.id} value={asset.id}>{asset.ticker} ({asset.name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">유형</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            >
              {isCash ? (
                <>
                  <option value="DEPOSIT">입금 (DEPOSIT)</option>
                  <option value="WITHDRAW">출금 (WITHDRAW)</option>
                  <option value="TRANSFER">이체 (TRANSFER)</option>
                  <option value="EXCHANGE">환전 (EXCHANGE)</option>
                  {editingId && !['DEPOSIT', 'WITHDRAW', 'TRANSFER', 'EXCHANGE'].includes(formData.type) && (
                    <option value={formData.type}>{formData.type}</option>
                  )}
                </>
              ) : (
                <>
                  <option value="BUY">매수 (BUY)</option>
                  <option value="SELL">매도 (SELL)</option>
                  <option value="DEPOSIT">입금 (DEPOSIT)</option>
                  <option value="WITHDRAW">출금 (WITHDRAW)</option>
                  <option value="TRANSFER">이체 (TRANSFER)</option>
                  <option value="INITIAL_BALANCE">초기 잔고 (INITIAL_BALANCE)</option>
                  <option value="INTEREST">이자 (INTEREST)</option>
                  <option value="TAX">세금 (TAX)</option>
                  <option value="CASH_ADJUSTMENT">현금 보정 (CASH_ADJUSTMENT)</option>
                  <option value="EXCHANGE">환전 (EXCHANGE)</option>
                </>
              )}
            </select>
          </div>

          {isExchangeForm && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">도착 자산</label>
              <select
                name="target_asset_id"
                value={formData.target_asset_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                {assets
                  .filter(a => isCashAsset(a) && !isSameId(a.id, formData.asset_id))
                  .map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.ticker} ({asset.name})</option>
                  ))}
              </select>
            </div>
          )}

          {!isTransferForm && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {fieldLabels.quantity}
                </label>
                <input
                  type="text"
                  name="quantity"
                  value={formatInputNumber(formData.quantity)}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {fieldLabels.price}
                </label>
                <input
                  type="text"
                  name="price"
                  value={formatInputNumber(formData.price)}
                  onChange={handleInputChange}
                  readOnly={isCash && !isExchangeForm}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                    isCash && !isExchangeForm ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                  }`}
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {fieldLabels.totalAmount}
            </label>
            <input
              type="text"
              name="total_amount"
              value={formatInputNumber(formData.total_amount)}
              onChange={handleInputChange}
              readOnly={isExchangeForm}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                isExchangeForm ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
              }`}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">통화</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              disabled={selectedAsset !== undefined}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                selectedAsset ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
              }`}
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="flex gap-2 lg:col-span-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? '저장' : (isTransferForm ? '이체 실행' : '거래 기록 추가')}
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
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">날짜</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">계좌</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">티커</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">자산명</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">유형</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">수량</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">단가/환율</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">총액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isExchangeTx = tx.type === 'EXCHANGE';
              const isTransferTx = !!tx.transfer_pair_id || tx.type === 'TRANSFER';
              const srcAsset = assets.find(a => a.id === tx.asset_id);
              const targetAsset = tx.target_asset_name 
                ? { name: tx.target_asset_name, ticker: tx.target_asset_ticker }
                : assets.find(a => a.id === tx.target_asset_id);

              const tickerDisplay = isExchangeTx
                ? `${srcAsset?.ticker || tx.asset_id} ➔ ${targetAsset?.ticker || tx.target_asset_id || '?'}`
                : (srcAsset?.ticker || tx.asset_id);

              const nameDisplay = isExchangeTx
                ? `${srcAsset?.name || ''} ➔ ${targetAsset?.name || ''}`
                : (srcAsset?.name || '');

              const badgeProps = getTypeBadgeProps(tx);

              const safeQuantity = tx.quantity ?? 0;
              const safePrice = tx.price ?? 0;
              const safeTotal = tx.total_amount ?? 0;

              const currentAccount = accounts.find(a => a.id === tx.account_id);
              const currentAccountName = currentAccount ? currentAccount.name : tx.account_id;

              let counterpartElement = null;
              if (isTransferTx && tx.transfer_pair_id) {
                const pairTx = transactions.find(t => t.transfer_pair_id === tx.transfer_pair_id && t.id !== tx.id);
                if (pairTx) {
                  const pairAccount = accounts.find(a => a.id === pairTx.account_id);
                  if (pairAccount) {
                    const arrow = tx.type === 'WITHDRAW' ? '➔' : '⬅';
                    counterpartElement = (
                      <span className="ml-1.5 text-xs text-purple-600 font-semibold">
                        {arrow} {pairAccount.name}
                      </span>
                    );
                  }
                }
              }

              return (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{tx.transaction_date}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {currentAccountName}
                    {counterpartElement}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-bold">
                    {tickerDisplay}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {nameDisplay}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeProps.style}`}>
                        {badgeProps.label}
                      </span>
                      {isTransferTx && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          이체
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        tx.source === 'AUTO_KIWOOM' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {tx.source === 'AUTO_KIWOOM' ? '키움자동' : '수동입력'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{maskValue(safeQuantity.toLocaleString())}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-slate-500">
                    {isExchangeTx 
                      ? `@ ${maskValue(((tx.exchange_rate !== undefined && tx.exchange_rate !== null) ? tx.exchange_rate : safePrice).toLocaleString())}`
                      : `${maskValue(safePrice.toLocaleString())} ${tx.currency}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold font-mono">
                    {maskValue(safeTotal.toLocaleString())} {tx.currency}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(tx)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                        title="수정"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
        {filteredTransactions.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">거래 내역이 없습니다.</div>
        )}
      </div>
    </div>
  );

};

export default TransactionsTab;
