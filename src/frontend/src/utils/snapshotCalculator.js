/**
 * 스냅샷 위저드 순수 금융 연산, 포맷팅 및 DTO 조립 유틸리티 모듈
 * React나 DOM 의존성이 없는 순수 자바스크립트 함수로 구성됩니다.
 */

import { formatWithCommas, parseCommas } from './formatters';

export { formatWithCommas, parseCommas };

/**
 * 거래 내역 유형 상수 객체
 */
export const TRANSACTION_TYPES = Object.freeze({
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
  TRANSFER: 'TRANSFER',
  INTEREST: 'INTEREST',
  FEE: 'FEE',
  TAX: 'TAX',
  DIVIDEND: 'DIVIDEND',
  CASH_ADJUSTMENT: 'CASH_ADJUSTMENT',
});

/**
 * 신규 거래 내역 중 이체(TRANSFER)의 도착 계좌 선택 여부를 검증합니다.
 * @param {Array<object>} newTransactions
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateAccountTransferTargets = (newTransactions = []) => {
  const unassigned = (newTransactions || []).find(
    (tx) => tx.type === TRANSACTION_TYPES.TRANSFER && !tx.target_account_id
  );
  if (unassigned) {
    return { isValid: false, message: '이체(TRANSFER) 거래의 도착 계좌를 선택해주세요.' };
  }
  return { isValid: true };
};

/**
 * 계좌의 표시용 이름을 반환합니다. 별칭이 있는 경우 '계좌명 (별칭)' 형식으로 반환합니다.
 * @param {{ name: string, alias?: string }} acc
 * @returns {string}
 */
export const getAccountDisplayName = (acc) => {
  if (!acc) return '';
  return acc.alias ? `${acc.name} (${acc.alias})` : acc.name;
};

/**
 * 주식 개별 종목의 평가액을 계산합니다 (환율 반영).
 * @param {{ quantity: number, price: number, currency: string }} holding
 * @param {number} [exchangeRate=1.0]
 * @returns {number}
 */
export const calculateStockValuation = (holding, exchangeRate = 1.0) => {
  if (!holding) return 0;
  const quantity = Number(holding.quantity) || 0;
  const price = Number(holding.price) || 0;
  const rate = holding.currency === 'USD' ? (Number(exchangeRate) || 1.0) : 1.0;
  return quantity * price * rate;
};

/**
 * 계좌의 전체 평가액(보유 주식 + 원화 예수금 + 외화 예수금 환산)을 계산합니다.
 * @param {Array<{ quantity: number, price: number, currency: string }>} [holdings=[]]
 * @param {{ krw?: number, usd?: number }} [cashItems={ krw: 0, usd: 0 }]
 * @param {number} [exchangeRate=1.0]
 * @returns {number}
 */
export const calculateAccountValuation = (holdings = [], cashItems = { krw: 0, usd: 0 }, exchangeRate = 1.0) => {
  const stockTotal = (holdings || []).reduce((acc, h) => acc + calculateStockValuation(h, exchangeRate), 0);
  const krwCash = Number(cashItems?.krw) || 0;
  const usdCash = (Number(cashItems?.usd) || 0) * (Number(exchangeRate) || 1.0);
  return stockTotal + krwCash + usdCash;
};

/**
 * 이전 잔액과 기간 내 거래 내역을 바탕으로 이론상 잔액과 차액을 계산합니다.
 * @param {number} previousCash - 이전 스냅샷 잔액
 * @param {Array<{ type: string, amount: number }>} transactions - 기간 내 거래 목록
 * @param {number} currentCash - 현재 입력된 잔액
 * @returns {{ theoreticalCash: number, diff: number }}
 */
export const calculateCashDifference = (previousCash = 0, transactions = [], currentCash = 0) => {
  const prev = Number(previousCash) || 0;
  const curr = Number(currentCash) || 0;

  const netTx = (transactions || []).reduce((sum, tx) => {
    const amt = Number(tx.amount) || 0;
    switch (tx.type) {
      case 'DEPOSIT':
      case 'INTEREST':
      case 'DIVIDEND':
      case 'CASH_ADJUSTMENT':
        return sum + amt;
      case 'WITHDRAW':
      case 'TRANSFER':
      case 'TAX':
      case 'FEE':
        return sum - amt;
      default:
        return sum + amt;
    }
  }, 0);

  const theoreticalCash = prev + netTx;
  const diff = curr - theoreticalCash;

  return {
    theoreticalCash,
    diff,
  };
};

/**
 * 타 계좌에서 현재 계좌(targetAccId)로 전송된 이체(TRANSFER) 거래들을 추출하여
 * 도착 계좌에 표시/정산할 DEPOSIT 트랜잭션 목록으로 변환합니다.
 * @param {number|string} targetAccId - 대상 계좌 ID
 * @param {object} accountsFormData - 계좌별 폼 데이터 맵
 * @param {Array<object>} accounts - 전체 계좌 목록
 * @returns {Array<object>}
 */
export const getIncomingTransferDeposits = (targetAccId, accountsFormData = {}, accounts = []) => {
  if (!targetAccId || !accountsFormData) return [];

  const targetIdStr = String(targetAccId);
  const incoming = [];

  Object.entries(accountsFormData).forEach(([srcAccId, formData]) => {
    // 본인 계좌에서 입력한 거래는 제외
    if (String(srcAccId) === targetIdStr) return;

    const newTxs = formData?.newTransactions || [];
    newTxs.forEach((tx) => {
      if (tx.type === 'TRANSFER' && tx.target_account_id && String(tx.target_account_id) === targetIdStr) {
        const sourceAcc = (accounts || []).find((a) => String(a.id) === String(srcAccId));
        const sourceName = getAccountDisplayName(sourceAcc) || (sourceAcc ? sourceAcc.name : '타 계좌');
        const transferMemo = tx.memo ? `이체 연동: ${sourceName} (${tx.memo})` : `이체 연동: ${sourceName}`;

        incoming.push({
          source_account_id: Number(srcAccId),
          source_account_name: sourceName,
          transaction_date: tx.date || '',
          date: tx.date || '',
          type: 'DEPOSIT',
          amount: tx.amount,
          total_amount: parseCommas(tx.amount),
          currency: 'KRW',
          quantity: parseCommas(tx.amount),
          price: 1.0,
          memo: transferMemo,
          is_incoming_transfer: true,
        });
      }
    });
  });

  return incoming;
};

/**
 * 증권 계좌 정산 계산용 API 요청 페이로드를 생성합니다.
 * 타 계좌발 연동 이체 입금(incomingTransfers)이 있는 경우 new_transactions에 합산합니다.
 * @param {object} params
 * @returns {object}
 */
export const buildBrokerageCalculatePayload = ({
  accountId,
  snapshotDate,
  newTransactions = [],
  incomingTransfers = [],
  currentKrw = 0,
  currentUsd = 0,
  exchangeRate = 1.0,
}) => {
  const combinedTxs = [...(newTransactions || []), ...(incomingTransfers || [])];

  return {
    account_id: accountId,
    snapshot_date: snapshotDate,
    new_transactions: combinedTxs.map((tx) => ({
      account_id: accountId,
      asset_id: tx.asset_id || 0,
      transaction_date: tx.date || tx.transaction_date || snapshotDate,
      type: tx.type,
      total_amount: parseCommas(tx.amount ?? tx.total_amount),
      currency: tx.currency || 'KRW',
      quantity: parseCommas(tx.amount ?? tx.quantity),
      price: 1.0,
      memo: tx.memo || '',
    })),
    current_krw: parseCommas(currentKrw),
    current_usd: parseCommas(currentUsd),
    exchange_rate: parseFloat(exchangeRate) || 1.0,
  };
};

/**
 * 은행 계좌 잔액 계산용 API 요청 페이로드를 생성합니다.
 * 타 계좌발 연동 이체 입금(incomingTransfers)이 있는 경우 new_transactions에 합산합니다.
 * @param {object} params
 * @returns {object}
 */
export const buildBankCalculatePayload = ({
  accountId,
  snapshotDate,
  newTransactions = [],
  incomingTransfers = [],
}) => {
  const combinedTxs = [...(newTransactions || []), ...(incomingTransfers || [])];

  return {
    account_id: accountId,
    snapshot_date: snapshotDate,
    new_transactions: combinedTxs.map((tx) => ({
      account_id: accountId,
      asset_id: tx.asset_id || 0,
      transaction_date: tx.date || tx.transaction_date || snapshotDate,
      type: tx.type,
      total_amount: parseCommas(tx.amount ?? tx.total_amount),
      currency: 'KRW',
      quantity: parseCommas(tx.amount ?? tx.quantity),
      price: 1.0,
      memo: tx.memo || '',
    })),
  };
};

/**
 * 최종 스냅샷 통합 저장 API 요청 DTO 페이로드를 조립합니다.
 * TRANSFER 거래의 경우 target_account_id를 포함합니다.
 * 읽기 전용 연동 이체 입금 행은 백엔드에서 쌍으로 생성하므로 포함하지 않습니다.
 * @param {object} params
 * @returns {object}
 */
export const buildSnapshotPayload = ({
  snapshotDate,
  exchangeRate,
  brokerageAccountIds = [],
  bankAccountIds = [],
  accountsFormData = {},
}) => {
  const mapNewTx = (accId, tx) => {
    const mapped = {
      account_id: accId,
      asset_id: tx.asset_id || 0,
      transaction_date: tx.date || snapshotDate,
      type: tx.type,
      total_amount: parseCommas(tx.amount),
      currency: tx.currency || 'KRW',
      quantity: parseCommas(tx.amount),
      price: 1.0,
      memo: tx.memo || '',
    };
    if (tx.type === 'TRANSFER' && tx.target_account_id) {
      mapped.target_account_id = Number(tx.target_account_id);
    }
    return mapped;
  };

  return {
    snapshot_date: snapshotDate,
    exchange_rate: parseFloat(exchangeRate),
    brokerage_accounts: brokerageAccountIds.map((accId) => {
      const data = accountsFormData[accId] || { newTransactions: [] };
      return {
        account_id: accId,
        new_transactions: (data.newTransactions || []).map((tx) => mapNewTx(accId, tx)),
        diff_krw: parseFloat(data.calcResult?.diff_krw || 0),
        diff_usd: parseFloat(data.calcResult?.diff_usd || 0),
      };
    }),
    bank_accounts: bankAccountIds.map((accId) => {
      const data = accountsFormData[accId] || { newTransactions: [] };
      return {
        account_id: accId,
        new_transactions: (data.newTransactions || []).map((tx) => mapNewTx(accId, tx)),
        total_valuation: data.totalValuation
          ? parseCommas(data.totalValuation)
          : (data.calcResult?.theoretical_krw ?? null),
      };
    }),
  };
};

/**
 * Step 1 기본 정보 유효성 검사
 * @param {{ inputDate: string, exchangeRate: string|number }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep1 = ({ inputDate, exchangeRate }) => {
  if (!inputDate || !inputDate.trim()) {
    return { isValid: false, message: '기준 일자를 선택해주세요.' };
  }
  if (!exchangeRate || isNaN(Number(exchangeRate)) || Number(exchangeRate) <= 0) {
    return { isValid: false, message: '올바른 환율을 입력해주세요.' };
  }
  return { isValid: true };
};

/**
 * 개별 계좌 상세 정산 확정 상태 공통 검증 헬퍼
 * @private
 * @param {{ currentAccIdx: number, accountIds: number[], accountsFormData: object, accountTypeLabel: string }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
const validateAccountConfirmed = ({ currentAccIdx, accountIds = [], accountsFormData = {}, accountTypeLabel = '계좌' }) => {
  const currentAccountId = accountIds[currentAccIdx];
  if (!currentAccountId) {
    return { isValid: false, message: `선택된 ${accountTypeLabel}가 없습니다.` };
  }
  const currentData = accountsFormData[currentAccountId];

  // 이체(TRANSFER) 거래 중 도착 계좌 미선택 여부 확인
  const transferValidation = validateAccountTransferTargets(currentData?.newTransactions);
  if (!transferValidation.isValid) {
    return transferValidation;
  }

  if (!currentData?.isConfirmed) {
    return { isValid: false, message: '현재 계좌의 정산 결과를 확인하고 확정 버튼을 눌러주세요.' };
  }
  return { isValid: true };
};

/**
 * Step 2 은행 계좌 정산 확정 유효성 검사
 * @param {{ currentAccIdx: number, selectedBankIds?: number[], selectedBrokerageIds?: number[], selectedAccountIds?: number[], accountsFormData: object }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep2 = ({ currentAccIdx, selectedBankIds = [], selectedBrokerageIds = [], selectedAccountIds, accountsFormData = {} }) => {
  const accountIds = selectedAccountIds || (selectedBankIds.length > 0 ? selectedBankIds : selectedBrokerageIds);
  return validateAccountConfirmed({
    currentAccIdx,
    accountIds,
    accountsFormData,
    accountTypeLabel: '은행 계좌',
  });
};

/**
 * Step 3 계좌 선택 유효성 검사 (최소 1개 이상 계좌 선택 필요)
 * @param {{ selectedBrokerageIds?: number[], selectedBankIds?: number[] }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep3 = ({ selectedBrokerageIds = [], selectedBankIds = [] }) => {
  if (selectedBrokerageIds.length === 0 && selectedBankIds.length === 0) {
    return { isValid: false, message: '최소 하나 이상의 계좌(증권 또는 은행)를 선택해야 합니다.' };
  }
  return { isValid: true };
};

/**
 * Step 4 증권 계좌 정산 확정 유효성 검사
 * @param {{ currentAccIdx: number, selectedBrokerageIds?: number[], selectedBankIds?: number[], selectedAccountIds?: number[], accountsFormData: object }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep4 = ({ currentAccIdx, selectedBrokerageIds = [], selectedBankIds = [], selectedAccountIds, accountsFormData = {} }) => {
  const accountIds = selectedAccountIds || (selectedBrokerageIds.length > 0 ? selectedBrokerageIds : selectedBankIds);
  return validateAccountConfirmed({
    currentAccIdx,
    accountIds,
    accountsFormData,
    accountTypeLabel: '증권 계좌',
  });
};

/**
 * Step 5 최종 확정 유효성 검사 (선택된 모든 계좌가 확정되었는지 확인)
 * @param {{ selectedAccountIds: number[], accountsFormData: object }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep5 = ({ selectedAccountIds = [], accountsFormData = {} }) => {
  if (!selectedAccountIds || selectedAccountIds.length === 0) {
    return { isValid: false, message: '선택된 계좌가 없습니다.' };
  }
  const allConfirmed = selectedAccountIds.every((id) => accountsFormData[id]?.isConfirmed);
  if (!allConfirmed) {
    return { isValid: false, message: '모든 선택된 계좌의 정산 결과가 확정되어야 합니다.' };
  }
  return { isValid: true };
};
