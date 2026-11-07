import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, Search, AlertTriangle, X } from 'lucide-react';
import { DB_API_BASE } from '../../config';
import { useMasking } from '../../contexts/MaskingContext';
import { PastTransactionWarningModal } from './PastTransactionWarningModal';
import SnapshotRecalculateModal from './SnapshotRecalculateModal';

/**
 * 숫자를 3자리마다 쉼표가 들어간 포맷으로 변환합니다.
 * 소수점 이하 자리수도 그대로 유지합니다.
 *
 * @param {string|number} value - 변환할 값
 * @returns {string} 쉼표가 포함된 포맷팅된 문자열
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
 *
 * @param {Object} tx - 거래 객체
 * @returns {Object} 뱃지 라벨 및 스타일 객체
 */
const getTypeBadgeProps = (tx) => {
  const isExchangeTx = tx.type === 'EXCHANGE';

  if (isExchangeTx) {
    return { label: '환전', style: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
  }
  if (['BUY', 'DEPOSIT', 'INITIAL_BALANCE'].includes(tx.type)) {
    return { label: tx.type, style: 'bg-blue-50 text-blue-600' };
  }
  if (['SELL', 'WITHDRAW', 'TAX'].includes(tx.type)) {
    return { label: tx.type, style: 'bg-red-50 text-red-600' };
  }
  return { label: tx.type, style: 'bg-emerald-50 text-emerald-600' };
};

/**
 * 현금 자산에서 선택 가능한 거래 유형 목록입니다.
 */
const CASH_TRANSACTION_TYPES = ['DEPOSIT', 'WITHDRAW', 'TRANSFER', 'EXCHANGE', 'INTEREST', 'TAX', 'CASH_ADJUSTMENT'];

/**
 * 계좌 객체를 select option 표시용 텍스트 문자열로 변환합니다.
 *
 * @param {Object} acc - 계좌 객체
 * @returns {string} 포맷팅된 계좌 라벨
 */
const formatAccountOptionText = (acc) => {
  if (!acc) return '';
  return `${acc.provider} / ${acc.name}${acc.alias ? ` / ${acc.alias}` : ''}`;
};

/**
 * 현금(CASH) 카테고리 자산인지 판단하는 헬퍼 함수입니다.
 *
 * @param {Object} asset - 자산 객체
 * @returns {boolean} 현금 카테고리 자산 여부
 */
const isCashAsset = (asset) => {
  if (!asset) return false;
  if (asset.category) {
    return asset.category === 'CASH';
  }
  return asset.ticker === 'USD' || asset.ticker === 'KRW';
};

/**
 * 쉼표가 포함된 숫자 문자열을 파싱하여 수치형(number)으로 반환합니다.
 *
 * @param {string|number} value - 변환할 값
 * @returns {number} 파싱된 숫자
 */
const parseFormattedNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const cleaned = value.toString().replace(/,/g, '');
  return parseFloat(cleaned) || 0;
};

/**
 * 목록에서 특정 ID를 제외한 첫 번째 항목(대체 항목)을 반환합니다.
 *
 * @param {Array} list - 검색할 목록 Array
 * @param {string|number} excludeId - 제외할 ID
 * @returns {Object|null} 발견된 대체 항목 객체
 */
const findAlternative = (list, excludeId) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.find(item => !isSameId(item.id, excludeId)) || null;
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
 * 거래 일자가 최신 스냅샷 기준일 이전(또는 당일)인지 검사하는 헬퍼 함수입니다.
 *
 * @param {string} targetDate - 대상 일자 (YYYY-MM-DD)
 * @param {string|null} snapshotDate - 최신 스냅샷 일자 (YYYY-MM-DD)
 * @returns {boolean} 과거 여부
 */
const isPastDate = (targetDate, snapshotDate) => {
  if (!targetDate || !snapshotDate) return false;
  return targetDate <= snapshotDate;
};

let draftIdCounter = 1;

/**
 * 신규 다중 입력 행의 고유 식별자(tempId)를 생성합니다.
 *
 * @returns {string} 고유 임시 ID 문자열
 */
const generateDraftId = () => `draft-${Date.now()}-${draftIdCounter++}`;

/**
 * 신규 다중 입력 시트의 기본 행 객체를 생성합니다.
 *
 * @param {Array} accounts - 전체 계좌 목록
 * @param {Array} assets - 전체 자산 목록
 * @param {Object|null} baseRow - 날짜와 계좌를 계승할 직전 행 (선택)
 * @param {string|number} defaultAccountId - 계좌 필터 등에 따른 기본 계좌 ID
 * @returns {Object} 초기화된 다중 시트 행 객체
 */
const createInitialDraftRow = (accounts, assets, baseRow = null, defaultAccountId = '') => {
  let accId = defaultAccountId;
  if (!accId && baseRow?.account_id) {
    accId = baseRow.account_id;
  }
  if (!accId && accounts && accounts.length > 0) {
    accId = accounts[0].id;
  }

  const date = baseRow?.transaction_date || new Date().toISOString().split('T')[0];

  const assetId = assets && assets.length > 0 ? assets[0].id : '';
  const selectedAsset = assets ? assets.find(a => isSameId(a.id, assetId)) : null;

  let currency = 'KRW';
  if (selectedAsset) {
    if (selectedAsset.ticker === 'USD' || selectedAsset.country === 'US') {
      currency = 'USD';
    }
  }

  let type = 'BUY';
  let price = '0';
  if (isCashAsset(selectedAsset)) {
    type = 'DEPOSIT';
    price = '1';
  }

  let targetAccId = '';
  if (accounts && accounts.length > 1) {
    const alt = findAlternative(accounts, accId);
    targetAccId = alt ? alt.id : '';
  }

  let targetAssetId = '';
  if (assets) {
    const cashAssets = assets.filter(isCashAsset);
    const altTarget = findAlternative(cashAssets, assetId) || (cashAssets.length > 0 ? cashAssets[0] : (assets[1] || assets[0]));
    targetAssetId = altTarget ? altTarget.id : '';
  }

  return {
    tempId: generateDraftId(),
    transaction_date: date,
    account_id: accId,
    target_account_id: targetAccId,
    asset_id: assetId,
    target_asset_id: targetAssetId,
    type,
    quantity: '0',
    price,
    total_amount: '0',
    currency,
    memo: ''
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
  const [latestSnapshotDate, setLatestSnapshotDate] = useState(null); // 최신 스냅샷 기준일
  const [pendingPastAction, setPendingPastAction] = useState(null);   // 과거 거래 확인 모달 상태 ({ type, transactionDate, action })
  const [isRecalcModalOpen, setIsRecalcModalOpen] = useState(false); // 재계산 모달 상태
  const [loading, setLoading] = useState(true);         // 로딩 상태

  const [error, setError] = useState(null);             // 데이터 로딩 에러 상태
  const [editingId, setEditingId] = useState(null);     // 수정 중인 거래 ID
  const [accountFilter, setAccountFilter] = useState('all'); // 계좌 필터 상태
  const [editFormData, setEditFormData] = useState({
    account_id: '',
    target_account_id: '',
    asset_id: '',
    target_asset_id: '',
    transaction_date: '',
    type: 'BUY',
    quantity: '0',
    price: '0',
    total_amount: '0',
    currency: 'KRW',
    exchange_rate: null,
    memo: ''
  });

  const { maskValue } = useMasking();
  
  // 신규 거래 다중 입력 시트 행 배열 상태
  const [draftRows, setDraftRows] = useState([]);

  /**
   * 서버에서 거래, 계좌, 자산, 최신 스냅샷 데이터를 병렬로 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [txRes, accRes, assetRes, snapRes] = await Promise.all([
        fetch(`${DB_API_BASE}/transactions`),
        fetch(`${DB_API_BASE}/accounts`),
        fetch(`${DB_API_BASE}/assets`),
        fetch(`${DB_API_BASE}/snapshots/latest`).catch(() => null)
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

      if (snapRes && snapRes.ok) {
        const snapData = await snapRes.json();
        setLatestSnapshotDate(snapData?.latest_snapshot_date || null);
      }

      setDraftRows(prev => {
        if (prev.length === 0) {
          const defaultAcc = accountFilter !== 'all' ? accountFilter : (accData[0]?.id || '');
          return [createInitialDraftRow(accData, assetData, null, defaultAcc)];
        }
        return prev;
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
   * 계좌 필터 변경 핸들러
   * (기본 초기 행 1줄만 있고 수정되지 않은 상태이면 해당 계좌를 자동 반영)
   */
  const handleAccountFilterChange = (newFilter) => {
    setAccountFilter(newFilter);
    if (newFilter !== 'all') {
      setDraftRows(prev => {
        if (prev.length === 1 && prev[0].quantity === '0' && (!prev[0].memo || prev[0].memo === '') && prev[0].total_amount === '0') {
          return [{
            ...prev[0],
            account_id: newFilter
          }];
        }
        return prev;
      });
    }
  };

  /**
   * 다중 입력 시트에 새 행을 추가합니다.
   * 직전 행(또는 파라미터 행)의 날짜와 계좌를 계승합니다.
   *
   * @param {Object|null} baseRow - 날짜와 계좌를 계승할 기준 행
   */
  const handleAddDraftRow = (baseRow = null) => {
    const base = baseRow || (draftRows.length > 0 ? draftRows[draftRows.length - 1] : null);
    const defaultAcc = accountFilter !== 'all' ? accountFilter : '';
    const newRow = createInitialDraftRow(accounts, assets, base, defaultAcc);
    setDraftRows(prev => [...prev, newRow]);
  };

  /**
   * 다중 입력 시트의 특정 행을 삭제합니다.
   * 2개 이상이면 행을 삭제하고, 1개뿐이면 기본값으로 초기화합니다.
   *
   * @param {string} tempId - 삭제할 행의 고유 식별자
   */
  const handleDeleteDraftRow = (tempId) => {
    if (draftRows.length > 1) {
      setDraftRows(prev => prev.filter(r => r.tempId !== tempId));
    } else {
      const defaultAcc = accountFilter !== 'all' ? accountFilter : '';
      setDraftRows([createInitialDraftRow(accounts, assets, null, defaultAcc)]);
    }
  };

  /**
   * 다중 입력 시트의 행 필드 변경 핸들러
   *
   * @param {string} tempId - 변경할 행 ID
   * @param {string} name - 필드 이름
   * @param {string} value - 새 입력값
   */
  const handleDraftRowChange = (tempId, name, value) => {
    setDraftRows(prev => prev.map(row => {
      if (row.tempId !== tempId) return row;
      let next = { ...row, [name]: value };

      if (name === 'asset_id') {
        const selected = assets.find(a => isSameId(a.id, value));
        if (selected) {
          let newCur = 'KRW';
          if (selected.ticker === 'USD' || selected.country === 'US') {
            newCur = 'USD';
          }
          next.currency = newCur;
          if (isCashAsset(selected)) {
            if (!CASH_TRANSACTION_TYPES.includes(next.type)) {
              next.type = 'DEPOSIT';
            }
            if (next.type !== 'EXCHANGE' && next.type !== 'TRANSFER') {
              next.price = '1';
              const q = parseFormattedNumber(next.quantity);
              next.total_amount = q.toString();
            }
          } else {
            if (next.type === 'EXCHANGE' || next.type === 'TRANSFER') {
              next.type = 'BUY';
            }
          }
        }
        if (next.type === 'EXCHANGE') {
          const cashAssets = assets.filter(isCashAsset);
          if (next.target_asset_id && isSameId(next.target_asset_id, value)) {
            const alt = findAlternative(cashAssets, value);
            next.target_asset_id = alt ? alt.id : '';
          }
        }
      }

      if (name === 'type') {
        const selected = assets.find(a => isSameId(a.id, next.asset_id));
        if (value === 'TRANSFER') {
          if (!next.target_account_id || isSameId(next.target_account_id, next.account_id)) {
            next.target_account_id = findAlternative(accounts, next.account_id)?.id || '';
          }
          next.price = '1';
          next.quantity = next.total_amount;
          const krwAsset = assets.find(a => a.ticker === 'KRW') || assets.find(isCashAsset) || assets[0];
          if (krwAsset) {
            next.asset_id = krwAsset.id;
            next.currency = krwAsset.country === 'US' ? 'USD' : 'KRW';
          }
        } else if (value === 'EXCHANGE') {
          const cashAssets = assets.filter(isCashAsset);
          let currentSource = assets.find(a => isSameId(a.id, next.asset_id));
          if (!currentSource || !isCashAsset(currentSource)) {
            next.asset_id = cashAssets[0] ? cashAssets[0].id : next.asset_id;
          }
          if (!next.target_asset_id || isSameId(next.target_asset_id, next.asset_id)) {
            next.target_asset_id = findAlternative(cashAssets, next.asset_id)?.id || '';
          }
          const q = parseFormattedNumber(next.quantity);
          const r = parseFormattedNumber(next.price);
          next.total_amount = Math.round(q * r).toString();
        } else if (isCashAsset(selected)) {
          next.price = '1';
          const q = parseFormattedNumber(next.quantity);
          next.total_amount = q.toString();
        } else {
          const q = parseFormattedNumber(next.quantity);
          const p = parseFormattedNumber(next.price);
          next.total_amount = Math.round(q * p).toString();
        }
      }

      if (name === 'account_id' && next.type === 'TRANSFER') {
        if (isSameId(value, next.target_account_id)) {
          next.target_account_id = findAlternative(accounts, value)?.id || '';
        }
      }

      if (name === 'quantity' || name === 'price') {
        const q = parseFormattedNumber(name === 'quantity' ? value : next.quantity);
        const p = parseFormattedNumber(name === 'price' ? value : next.price);
        if (next.type === 'EXCHANGE') {
          next.total_amount = Math.round(q * p).toString();
        } else if (next.type === 'TRANSFER') {
          // 이체에서는 총액 위주
        } else {
          const selected = assets.find(a => isSameId(a.id, next.asset_id));
          if (isCashAsset(selected)) {
            next.total_amount = q.toString();
          } else {
            next.total_amount = Math.round(q * p).toString();
          }
        }
      }

      if (name === 'total_amount' && next.type === 'TRANSFER') {
        next.quantity = value;
        next.price = '1';
      }

      return next;
    }));
  };

  /**
   * 다중 거래 내역 원자적 일괄 등록(Bulk API) 실행
   */
  const executeBulkSubmit = async () => {
    const payload = {
      transactions: draftRows.map(row => {
        const isTransfer = row.type === 'TRANSFER';
        const isExchange = row.type === 'EXCHANGE';
        return {
          account_id: parseInt(row.account_id),
          target_account_id: isTransfer && row.target_account_id ? parseInt(row.target_account_id) : null,
          asset_id: parseInt(row.asset_id),
          target_asset_id: isExchange && row.target_asset_id ? parseInt(row.target_asset_id) : null,
          transaction_date: row.transaction_date,
          type: row.type,
          quantity: isTransfer ? parseFormattedNumber(row.total_amount) : parseFormattedNumber(row.quantity),
          price: isTransfer ? 1 : parseFormattedNumber(row.price),
          total_amount: parseFormattedNumber(row.total_amount),
          currency: row.currency,
          exchange_rate: isExchange ? (parseFormattedNumber(row.price) || null) : null,
          memo: row.memo?.trim() || null
        };
      })
    };

    try {
      const response = await fetch(`${DB_API_BASE}/transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchData();
        const defaultAcc = accountFilter !== 'all' ? accountFilter : '';
        setDraftRows([createInitialDraftRow(accounts, assets, null, defaultAcc)]);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.detail || '다중 거래 내역 일괄 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('거래 내역 일괄 등록 오류:', err);
      alert('거래 내역 일괄 등록 중 오류가 발생했습니다.');
    }
  };

  /**
   * 일괄 등록 버튼 클릭 핸들러 (유효성 검사 및 과거 스냅샷 가드 1회 통합 적용)
   */
  const handleBulkSubmit = () => {
    for (let i = 0; i < draftRows.length; i++) {
      const row = draftRows[i];
      if (!row.account_id) {
        alert(`${i + 1}번째 행의 계좌를 선택해주세요.`);
        return;
      }
      if (!row.asset_id) {
        alert(`${i + 1}번째 행의 자산을 선택해주세요.`);
        return;
      }
      if (row.type === 'TRANSFER') {
        if (!row.target_account_id || isSameId(row.account_id, row.target_account_id)) {
          alert(`${i + 1}번째 행의 도착 계좌를 올바르게 선택해주세요.`);
          return;
        }
      }
      if (row.type === 'EXCHANGE') {
        if (!row.target_asset_id || isSameId(row.asset_id, row.target_asset_id)) {
          alert(`${i + 1}번째 행의 도착 통화를 올바르게 선택해주세요.`);
          return;
        }
      }
    }

    const pastRows = draftRows.filter(r => isPastDate(r.transaction_date, latestSnapshotDate));
    if (pastRows.length > 0) {
      const earliestDate = pastRows.reduce((earliest, r) => r.transaction_date < earliest ? r.transaction_date : earliest, pastRows[0].transaction_date);
      setPendingPastAction({
        type: '일괄 등록',
        transactionDate: earliestDate,
        action: () => executeBulkSubmit()
      });
      return;
    }

    executeBulkSubmit();
  };

/**
   * 하단 테이블 행 인라인 수정 모드 진입
   *
   * @param {Object} tx - 수정 대상 거래 객체
   */
  const handleStartInlineEdit = (tx) => {
    setEditingId(tx.id);

    let editType = tx.type;
    let editAccountId = tx.account_id;
    let editTargetAccountId = '';
    let editAssetId = tx.asset_id;
    let editTargetAssetId = tx.target_asset_id || '';

    if (tx.transfer_pair_id) {
      const pairTx = transactions.find(t => isSameId(t.transfer_pair_id, tx.transfer_pair_id) && !isSameId(t.id, tx.id));
      if (tx.type === 'DEPOSIT' && pairTx) {
        editAccountId = pairTx.account_id;
        editTargetAccountId = tx.account_id;
      } else {
        editAccountId = tx.account_id;
        editTargetAccountId = pairTx ? pairTx.account_id : (findAlternative(accounts, tx.account_id)?.id || '');
      }
      editType = 'TRANSFER';
    } else if (tx.type === 'TRANSFER') {
      editAccountId = tx.account_id;
      editTargetAccountId = tx.target_account_id || (findAlternative(accounts, tx.account_id)?.id || '');
      editType = 'TRANSFER';
    } else if (tx.type === 'EXCHANGE') {
      editType = 'EXCHANGE';
      editAssetId = tx.asset_id;
      const cashAssets = assets.filter(isCashAsset);
      editTargetAssetId = tx.target_asset_id || (findAlternative(cashAssets, tx.asset_id)?.id || '');
    }

    setEditFormData({
      account_id: editAccountId,
      target_account_id: editTargetAccountId,
      asset_id: editAssetId,
      target_asset_id: editTargetAssetId,
      transaction_date: tx.transaction_date,
      type: editType,
      quantity: (tx.quantity ?? 0).toString(),
      price: (tx.price ?? 0).toString(),
      total_amount: (tx.total_amount ?? 0).toString(),
      currency: tx.currency,
      exchange_rate: tx.exchange_rate !== undefined ? tx.exchange_rate : null,
      memo: tx.memo || ''
    });
  };

  /**
   * 인라인 편집 필드 변경 핸들러
   *
   * @param {string} name - 필드 이름
   * @param {string} value - 새 입력값
   */
  const handleInlineInputChange = (name, value) => {
    setEditFormData(prev => {
      let next = { ...prev, [name]: value };

      if (name === 'asset_id') {
        const selected = assets.find(a => isSameId(a.id, value));
        if (selected) {
          let newCur = 'KRW';
          if (selected.ticker === 'USD' || selected.country === 'US') {
            newCur = 'USD';
          }
          next.currency = newCur;
          if (isCashAsset(selected)) {
            if (!CASH_TRANSACTION_TYPES.includes(next.type)) {
              next.type = 'DEPOSIT';
            }
            if (next.type !== 'EXCHANGE' && next.type !== 'TRANSFER') {
              next.price = '1';
              const q = parseFormattedNumber(next.quantity);
              next.total_amount = q.toString();
            }
          }
        }
      }

      if (name === 'type') {
        const selected = assets.find(a => isSameId(a.id, next.asset_id));
        if (value === 'TRANSFER') {
          if (!next.target_account_id || isSameId(next.target_account_id, next.account_id)) {
            next.target_account_id = findAlternative(accounts, next.account_id)?.id || '';
          }
          next.price = '1';
          next.quantity = next.total_amount;
          const krwAsset = assets.find(a => a.ticker === 'KRW') || assets.find(isCashAsset) || assets[0];
          if (krwAsset) {
            next.asset_id = krwAsset.id;
            next.currency = krwAsset.country === 'US' ? 'USD' : 'KRW';
          }
        } else if (value === 'EXCHANGE') {
          const cashAssets = assets.filter(isCashAsset);
          if (!next.target_asset_id || isSameId(next.target_asset_id, next.asset_id)) {
            next.target_asset_id = findAlternative(cashAssets, next.asset_id)?.id || '';
          }
          const q = parseFormattedNumber(next.quantity);
          const r = parseFormattedNumber(next.price);
          next.total_amount = Math.round(q * r).toString();
        } else if (isCashAsset(selected)) {
          next.price = '1';
          const q = parseFormattedNumber(next.quantity);
          next.total_amount = q.toString();
        }
      }

      if (name === 'account_id' && next.type === 'TRANSFER') {
        if (isSameId(value, next.target_account_id)) {
          next.target_account_id = findAlternative(accounts, value)?.id || '';
        }
      }

      if (name === 'quantity' || name === 'price') {
        const q = parseFormattedNumber(name === 'quantity' ? value : next.quantity);
        const p = parseFormattedNumber(name === 'price' ? value : next.price);
        if (next.type === 'EXCHANGE') {
          next.total_amount = Math.round(q * p).toString();
        } else if (next.type === 'TRANSFER') {
          // 이체에서는 총액 위주
        } else {
          const selected = assets.find(a => isSameId(a.id, next.asset_id));
          if (isCashAsset(selected)) {
            next.total_amount = q.toString();
          } else {
            next.total_amount = Math.round(q * p).toString();
          }
        }
      }

      if (name === 'total_amount' && next.type === 'TRANSFER') {
        next.quantity = value;
        next.price = '1';
      }

      return next;
    });
  };

  /**
   * 인라인 수정 PUT API 요청 실행
   */
  const executeInlineSubmit = async () => {
    if (!editingId) return;
    const isTransfer = editFormData.type === 'TRANSFER';
    const isExchange = editFormData.type === 'EXCHANGE';

    const payload = {
      account_id: parseInt(editFormData.account_id),
      asset_id: parseInt(editFormData.asset_id),
      transaction_date: editFormData.transaction_date,
      type: editFormData.type,
      quantity: parseFormattedNumber(editFormData.quantity),
      price: parseFormattedNumber(editFormData.price),
      total_amount: parseFormattedNumber(editFormData.total_amount),
      currency: editFormData.currency,
      exchange_rate: isExchange ? (parseFloat(editFormData.price) || null) : null,
      memo: editFormData.memo?.trim() || null
    };

    if (isTransfer) {
      if (!editFormData.target_account_id || isSameId(editFormData.account_id, editFormData.target_account_id)) {
        alert('도착 계좌를 올바르게 선택해주세요.');
        return;
      }
      payload.target_account_id = parseInt(editFormData.target_account_id);
      payload.quantity = parseFormattedNumber(editFormData.total_amount);
      payload.price = 1;
      payload.total_amount = parseFormattedNumber(editFormData.total_amount);
    }
    if (isExchange) {
      if (!editFormData.target_asset_id || isSameId(editFormData.asset_id, editFormData.target_asset_id)) {
        alert('도착 통화를 올바르게 선택해주세요.');
        return;
      }
      payload.target_asset_id = parseInt(editFormData.target_asset_id);
    }

    try {
      const response = await fetch(`${DB_API_BASE}/transactions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        fetchData();
        setEditingId(null);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.detail || '거래 내역 수정에 실패했습니다.');
      }
    } catch (err) {
      console.error('인라인 거래 수정 오류:', err);
      alert('거래 내역 수정 중 오류가 발생했습니다.');
    }
  };

  /**
   * 인라인 수정 저장 (과거 스냅샷 가드 적용)
   */
  const handleInlineSave = async () => {
    if (!editingId) return;
    const originalTx = transactions.find(t => isSameId(t.id, editingId));
    const isTargetPast = isPastDate(editFormData.transaction_date, latestSnapshotDate);
    const isOriginalPast = isPastDate(originalTx?.transaction_date, latestSnapshotDate);

    if (isTargetPast || isOriginalPast) {
      setPendingPastAction({
        type: '수정',
        transactionDate: editFormData.transaction_date,
        action: () => executeInlineSubmit()
      });
      return;
    }
    await executeInlineSubmit();
  };

  /**
   * 인라인 수정 취소
   */
  const handleInlineCancel = () => {
    setEditingId(null);
  };

  /**
   * 인라인 입력 필드 키보드 단축키 (Enter: 저장, Esc: 취소)
   */
  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleInlineCancel();
    }
  };

  /**
   * 실제 거래 삭제 API 호출 실행
   */
  const executeDelete = async (id) => {
    try {
      const response = await fetch(`${DB_API_BASE}/transactions/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('거래 내역 삭제 오류:', error);
    }
  };

  /**
   * 거래 내역 삭제 핸들러 (과거 스냅샷 가드 적용)
   */
  const handleDelete = async (id) => {
    const targetTx = transactions.find((t) => t.id === id);
    const isTargetPast = isPastDate(targetTx?.transaction_date, latestSnapshotDate);

    if (isTargetPast) {
      setPendingPastAction({
        type: '삭제',
        transactionDate: targetTx.transaction_date,
        action: () => executeDelete(id)
      });
      return;
    }

    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    await executeDelete(id);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  // 선택된 계좌 필터에 따른 목록 필터링
  const filteredTransactions = accountFilter === 'all' 
    ? transactions 
    : transactions.filter(tx => isSameId(tx.account_id, accountFilter));

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
          onChange={(e) => handleAccountFilterChange(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">전체 계좌</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {formatAccountOptionText(acc)}
            </option>
          ))}
        </select>
      </div>

      {/* 상단 신규 거래 다중 입력 시트 영역 */}
      <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Plus size={16} />
            신규 거래 다중 입력
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="draft-add-row-btn"
              onClick={() => handleAddDraftRow()}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 transition-colors"
            >
              <Plus size={14} />
              행 추가
            </button>
            <button
              type="button"
              data-testid="draft-bulk-submit-btn"
              onClick={handleBulkSubmit}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Check size={14} />
              일괄 등록 ({draftRows.length}건)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-3 py-2.5">날짜</th>
                <th className="px-3 py-2.5">계좌</th>
                <th className="px-3 py-2.5">자산</th>
                <th className="px-3 py-2.5">유형</th>
                <th className="px-3 py-2.5 text-right">수량</th>
                <th className="px-3 py-2.5 text-right">단가/환율</th>
                <th className="px-3 py-2.5 text-right">총액</th>
                <th className="px-3 py-2.5">메모</th>
                <th className="px-3 py-2.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draftRows.map((row, index) => {
                const draftSelectedAsset = assets.find(a => isSameId(a.id, row.asset_id));
                const draftSrcAsset = draftSelectedAsset;

                return (
                  <React.Fragment key={row.tempId}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          name="transaction_date"
                          data-testid={`draft-date-input-${index}`}
                          value={row.transaction_date}
                          onChange={(e) => handleDraftRowChange(row.tempId, 'transaction_date', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          name="account_id"
                          data-testid={`draft-account-select-${index}`}
                          value={row.account_id}
                          onChange={(e) => handleDraftRowChange(row.tempId, 'account_id', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {formatAccountOptionText(acc)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          name="asset_id"
                          data-testid={`draft-asset-select-${index}`}
                          value={row.asset_id}
                          onChange={(e) => handleDraftRowChange(row.tempId, 'asset_id', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {(row.type === 'EXCHANGE' ? assets.filter(isCashAsset) : assets).map(asset => (
                            <option key={asset.id} value={asset.id}>
                              {asset.ticker} ({asset.name})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          name="type"
                          data-testid={`draft-type-select-${index}`}
                          value={row.type}
                          onChange={(e) => handleDraftRowChange(row.tempId, 'type', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {isCashAsset(draftSelectedAsset) ? (
                            <>
                              <option value="DEPOSIT">입금 (DEPOSIT)</option>
                              <option value="WITHDRAW">출금 (WITHDRAW)</option>
                              <option value="TRANSFER">이체 (TRANSFER)</option>
                              <option value="EXCHANGE">환전 (EXCHANGE)</option>
                              <option value="INTEREST">이자 (INTEREST)</option>
                              <option value="TAX">세금 (TAX)</option>
                              <option value="CASH_ADJUSTMENT">현금 보정 (CASH_ADJUSTMENT)</option>
                            </>
                          ) : (
                            <>
                              <option value="BUY">매수 (BUY)</option>
                              <option value="SELL">매도 (SELL)</option>
                              <option value="DEPOSIT">입금 (DEPOSIT)</option>
                              <option value="WITHDRAW">출금 (WITHDRAW)</option>
                              <option value="TRANSFER">이체 (TRANSFER)</option>
                              <option value="EXCHANGE">환전 (EXCHANGE)</option>
                              <option value="DIVIDEND">배당 (DIVIDEND)</option>
                              <option value="TAX">세금 (TAX)</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {row.type === 'TRANSFER' ? (
                          <div className="text-center text-slate-400 font-mono text-xs py-1">-</div>
                        ) : (
                          <input
                            type="text"
                            name="quantity"
                            data-testid={`draft-quantity-input-${index}`}
                            value={formatInputNumber(row.quantity)}
                            onChange={(e) => handleDraftRowChange(row.tempId, 'quantity', e.target.value.replace(/,/g, ''))}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-right font-mono outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {row.type === 'TRANSFER' ? (
                          <div className="text-center text-slate-400 font-mono text-xs py-1">-</div>
                        ) : (
                          <input
                            type="text"
                            name="price"
                            data-testid={`draft-price-input-${index}`}
                            value={formatInputNumber(row.price)}
                            disabled={isCashAsset(draftSelectedAsset) && row.type !== 'EXCHANGE'}
                            onChange={(e) => handleDraftRowChange(row.tempId, 'price', e.target.value.replace(/,/g, ''))}
                            className={`w-full px-2 py-1 text-xs border border-slate-300 rounded text-right font-mono outline-none focus:ring-1 focus:ring-blue-500 ${
                              isCashAsset(draftSelectedAsset) && row.type !== 'EXCHANGE' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {row.type === 'TRANSFER' ? (
                          <input
                            type="text"
                            name="total_amount"
                            data-testid={`draft-total-input-${index}`}
                            value={formatInputNumber(row.total_amount)}
                            onChange={(e) => handleDraftRowChange(row.tempId, 'total_amount', e.target.value.replace(/,/g, ''))}
                            className="w-full px-2 py-1 text-xs border border-purple-300 rounded bg-purple-50/50 text-right font-mono font-bold outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        ) : (
                          <input
                            type="text"
                            name="total_amount"
                            data-testid={`draft-total-input-${index}`}
                            value={formatInputNumber(row.total_amount)}
                            readOnly={row.type === 'EXCHANGE' || isCashAsset(draftSelectedAsset)}
                            onChange={(e) => handleDraftRowChange(row.tempId, 'total_amount', e.target.value.replace(/,/g, ''))}
                            className={`w-full px-2 py-1 text-xs border border-slate-300 rounded text-right font-mono font-bold outline-none ${
                              row.type === 'EXCHANGE' || isCashAsset(draftSelectedAsset) ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'bg-white focus:ring-1 focus:ring-blue-500'
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          name="memo"
                          data-testid={`draft-memo-input-${index}`}
                          value={row.memo || ''}
                          placeholder="메모 입력 (Enter: 행 추가)"
                          onChange={(e) => handleDraftRowChange(row.tempId, 'memo', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddDraftRow(row);
                            }
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span data-testid={`draft-currency-${index}`} className="hidden">{row.currency}</span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          data-testid={`draft-delete-btn-${index}`}
                          onClick={() => handleDeleteDraftRow(row.tempId)}
                          aria-label="행 삭제"
                          title="행 삭제"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                    {row.type === 'TRANSFER' && (
                      <tr
                        data-testid={`draft-subrow-transfer-${index}`}
                        className="bg-purple-50/70 border-b border-purple-200"
                      >
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center gap-3 text-xs text-purple-900 font-medium flex-wrap">
                            <span>↳ [이체 상세 설정] 도착 계좌:</span>
                            <select
                              name="target_account_id"
                              data-testid={`draft-target-account-select-${index}`}
                              value={row.target_account_id}
                              onChange={(e) => handleDraftRowChange(row.tempId, 'target_account_id', e.target.value)}
                              className="px-2 py-1 bg-white border border-purple-300 rounded text-xs text-purple-900 font-normal outline-none focus:ring-1 focus:ring-purple-500"
                            >
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id} disabled={isSameId(acc.id, row.account_id)}>
                                  {formatAccountOptionText(acc)} {isSameId(acc.id, row.account_id) ? '(출발 계좌)' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="text-[11px] text-purple-600">
                              * 수량/단가 대신 이체 금액(총액)만 입력받습니다.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {row.type === 'EXCHANGE' && (
                      <tr
                        data-testid={`draft-subrow-exchange-${index}`}
                        className="bg-emerald-50/70 border-b border-emerald-200"
                      >
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center gap-3 text-xs text-emerald-900 font-medium flex-wrap">
                            <span>↳ [환전 상세 설정] 도착 통화:</span>
                            <select
                              name="target_asset_id"
                              data-testid={`draft-target-asset-select-${index}`}
                              value={row.target_asset_id}
                              onChange={(e) => handleDraftRowChange(row.tempId, 'target_asset_id', e.target.value)}
                              className="px-2 py-1 bg-white border border-emerald-300 rounded text-xs text-emerald-900 font-normal outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {assets
                                .filter(asset => isCashAsset(asset) && !isSameId(asset.id, row.asset_id))
                                .map(asset => (
                                  <option key={asset.id} value={asset.id}>
                                    {asset.ticker} ({asset.name})
                                  </option>
                                ))}
                            </select>
                            <span className="text-xs text-emerald-700 font-mono">
                              요약: {formatInputNumber(row.quantity) || '0'} {draftSrcAsset?.ticker || ''} × @ {formatInputNumber(row.price) || '0'} = {formatInputNumber(row.total_amount) || '0'} {row.currency} (총 지불금액)
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

{/* 데이터 테이블 영역 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">날짜</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">계좌</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">자산</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">유형</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">수량</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">단가/환율</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">총액</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">메모</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isEditing = isSameId(editingId, tx.id);

              if (isEditing) {
                const inlineSelectedAsset = assets.find(a => isSameId(a.id, editFormData.asset_id));
                const inlineSrcAsset = inlineSelectedAsset;

                return (
                  <React.Fragment key={tx.id}>
                    <tr
                      data-testid={`inline-edit-row-${tx.id}`}
                      className="bg-blue-50/40 border-y-2 border-blue-300"
                    >
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          name="transaction_date"
                          data-testid="inline-date-input"
                          value={editFormData.transaction_date}
                          onChange={(e) => handleInlineInputChange('transaction_date', e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          name="account_id"
                          data-testid="inline-account-select"
                          value={editFormData.account_id}
                          onChange={(e) => handleInlineInputChange('account_id', e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {formatAccountOptionText(acc)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          name="asset_id"
                          data-testid="inline-asset-select"
                          value={editFormData.asset_id}
                          onChange={(e) => handleInlineInputChange('asset_id', e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {assets.map(asset => (
                            <option key={asset.id} value={asset.id}>
                              {asset.ticker} ({asset.name})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          name="type"
                          data-testid="inline-type-select"
                          value={editFormData.type}
                          onChange={(e) => handleInlineInputChange('type', e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-semibold outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {isCashAsset(inlineSelectedAsset) ? (
                            <>
                              <option value="DEPOSIT">입금 (DEPOSIT)</option>
                              <option value="WITHDRAW">출금 (WITHDRAW)</option>
                              <option value="TRANSFER">이체 (TRANSFER)</option>
                              <option value="EXCHANGE">환전 (EXCHANGE)</option>
                              <option value="INTEREST">이자 (INTEREST)</option>
                              <option value="TAX">세금 (TAX)</option>
                              <option value="CASH_ADJUSTMENT">현금 보정 (CASH_ADJUSTMENT)</option>
                            </>
                          ) : (
                            <>
                              <option value="BUY">매수 (BUY)</option>
                              <option value="SELL">매도 (SELL)</option>
                              <option value="DIVIDEND">배당 (DIVIDEND)</option>
                              <option value="TAX">세금 (TAX)</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {editFormData.type === 'TRANSFER' ? (
                          <div className="text-center text-slate-400 font-mono text-xs py-1">-</div>
                        ) : (
                          <input
                            type="text"
                            name="quantity"
                            data-testid="inline-quantity-input"
                            value={formatInputNumber(editFormData.quantity)}
                            onChange={(e) => handleInlineInputChange('quantity', e.target.value.replace(/,/g, ''))}
                            onKeyDown={handleInlineKeyDown}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-right font-mono outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {editFormData.type === 'TRANSFER' ? (
                          <div className="text-center text-slate-400 font-mono text-xs py-1">-</div>
                        ) : (
                          <input
                            type="text"
                            name="price"
                            data-testid="inline-price-input"
                            value={formatInputNumber(editFormData.price)}
                            disabled={isCashAsset(inlineSelectedAsset) && editFormData.type !== 'EXCHANGE'}
                            onChange={(e) => handleInlineInputChange('price', e.target.value.replace(/,/g, ''))}
                            onKeyDown={handleInlineKeyDown}
                            className={`w-full px-2 py-1 text-xs border border-slate-300 rounded text-right font-mono outline-none focus:ring-1 focus:ring-blue-500 ${
                              isCashAsset(inlineSelectedAsset) && editFormData.type !== 'EXCHANGE' ? 'bg-slate-100 text-slate-400' : 'bg-white'
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {editFormData.type === 'TRANSFER' ? (
                          <input
                            type="text"
                            name="total_amount"
                            data-testid="inline-total-input"
                            value={formatInputNumber(editFormData.total_amount)}
                            onChange={(e) => handleInlineInputChange('total_amount', e.target.value.replace(/,/g, ''))}
                            onKeyDown={handleInlineKeyDown}
                            className="w-full px-2 py-1 text-xs border border-purple-300 rounded bg-purple-50/50 text-right font-mono font-bold outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        ) : (
                          <input
                            type="text"
                            name="total_amount"
                            data-testid="inline-total-input"
                            value={formatInputNumber(editFormData.total_amount)}
                            readOnly={editFormData.type === 'EXCHANGE' || isCashAsset(inlineSelectedAsset)}
                            onChange={(e) => handleInlineInputChange('total_amount', e.target.value.replace(/,/g, ''))}
                            onKeyDown={handleInlineKeyDown}
                            className={`w-full px-2 py-1 text-xs border border-slate-300 rounded text-right font-mono font-bold outline-none ${
                              editFormData.type === 'EXCHANGE' || isCashAsset(inlineSelectedAsset) ? 'bg-slate-100 text-slate-600' : 'bg-white focus:ring-1 focus:ring-blue-500'
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          name="memo"
                          data-testid="inline-memo-input"
                          value={editFormData.memo || ''}
                          placeholder="메모 입력"
                          onChange={(e) => handleInlineInputChange('memo', e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleInlineSave}
                            aria-label="인라인 저장"
                            title="인라인 저장"
                            className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleInlineCancel}
                            aria-label="인라인 취소"
                            title="인라인 취소"
                            className="p-1.5 text-slate-600 bg-slate-200 hover:bg-slate-300 rounded transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editFormData.type === 'TRANSFER' && (
                      <tr
                        data-testid="inline-subrow-transfer"
                        className="bg-purple-50/70 border-b-2 border-purple-300"
                      >
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center gap-3 text-xs text-purple-900 font-medium flex-wrap">
                            <span>↳ [이체 상세 설정] 도착 계좌:</span>
                            <select
                              name="target_account_id"
                              data-testid="inline-target-account-select"
                              value={editFormData.target_account_id}
                              onChange={(e) => handleInlineInputChange('target_account_id', e.target.value)}
                              onKeyDown={handleInlineKeyDown}
                              className="px-2 py-1 bg-white border border-purple-300 rounded text-xs text-purple-900 font-normal outline-none focus:ring-1 focus:ring-purple-500"
                            >
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id} disabled={isSameId(acc.id, editFormData.account_id)}>
                                  {formatAccountOptionText(acc)} {isSameId(acc.id, editFormData.account_id) ? '(출발 계좌)' : ''}
                                </option>
                              ))}
                            </select>
                            <span className="text-[11px] text-purple-600">
                              * 수량/단가 대신 이체 금액(총액)만 입력받습니다.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {editFormData.type === 'EXCHANGE' && (
                      <tr
                        data-testid="inline-subrow-exchange"
                        className="bg-emerald-50/70 border-b-2 border-emerald-300"
                      >
                        <td colSpan={9} className="px-4 py-2">
                          <div className="flex items-center gap-3 text-xs text-emerald-900 font-medium flex-wrap">
                            <span>↳ [환전 상세 설정] 도착 통화:</span>
                            <select
                              name="target_asset_id"
                              data-testid="inline-target-asset-select"
                              value={editFormData.target_asset_id}
                              onChange={(e) => handleInlineInputChange('target_asset_id', e.target.value)}
                              onKeyDown={handleInlineKeyDown}
                              className="px-2 py-1 bg-white border border-emerald-300 rounded text-xs text-emerald-900 font-normal outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {assets.filter(isCashAsset).map(asset => (
                                <option key={asset.id} value={asset.id} disabled={isSameId(asset.id, editFormData.asset_id)}>
                                  {asset.ticker} ({asset.name})
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-emerald-700 font-mono">
                              요약: {formatInputNumber(editFormData.quantity) || '0'} {inlineSrcAsset?.ticker || ''} × @ {formatInputNumber(editFormData.price) || '0'} = {formatInputNumber(editFormData.total_amount) || '0'} {editFormData.currency} (총 지불금액)
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              }

              // 읽기 전용 행
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
                <tr
                  key={tx.id}
                  data-testid={`tx-row-${tx.id}`}
                  onDoubleClick={() => handleStartInlineEdit(tx)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-3 text-sm text-slate-500 whitespace-nowrap">{tx.transaction_date}</td>
                  <td className="px-3 py-3 text-sm text-slate-700">
                    {currentAccountName}
                    {counterpartElement}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="font-bold text-slate-900">{tickerDisplay}</div>
                    <div className="text-xs text-slate-500">{nameDisplay}</div>
                  </td>
                  <td className="px-3 py-3 text-sm">
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
                  <td className="px-3 py-3 text-sm text-right font-mono">{maskValue(safeQuantity.toLocaleString())}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono text-slate-500">
                    {isExchangeTx 
                      ? `@ ${maskValue(((tx.exchange_rate !== undefined && tx.exchange_rate !== null) ? tx.exchange_rate : safePrice).toLocaleString())}`
                      : `${maskValue(safePrice.toLocaleString())} ${tx.currency}`}
                  </td>
                  <td className="px-3 py-3 text-sm text-right font-bold font-mono">
                    {maskValue(safeTotal.toLocaleString())} {tx.currency}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-600 max-w-[150px] truncate" title={tx.memo || ''}>
                    {tx.memo || '-'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleStartInlineEdit(tx)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                        title="수정"
                        aria-label="수정"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                        title="삭제"
                        aria-label="삭제"
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

      {/* 과거 거래 스냅샷 정합성 경고 모달 */}
      <PastTransactionWarningModal
        isOpen={!!pendingPastAction}
        title={`과거 거래 ${pendingPastAction?.type || ''} 확인`}
        actionType={pendingPastAction?.type || '조작'}
        transactionDate={pendingPastAction?.transactionDate || ''}
        latestSnapshotDate={latestSnapshotDate || ''}
        onOpenRecalculate={() => {
          setPendingPastAction(null);
          setIsRecalcModalOpen(true);
        }}
        onConfirm={async () => {
          const action = pendingPastAction?.action;
          setPendingPastAction(null);
          if (action) await action();
        }}
        onCancel={() => setPendingPastAction(null)}
      />

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

export default TransactionsTab;

