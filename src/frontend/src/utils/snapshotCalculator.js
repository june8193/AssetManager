/**
 * 스냅샷 위저드 순수 금융 연산, 포맷팅 및 DTO 조립 유틸리티 모듈
 * React나 DOM 의존성이 없는 순수 자바스크립트 함수로 구성됩니다.
 */

/**
 * 천단위 쉼표 포맷터 함수
 * @param {string|number} val
 * @returns {string}
 */
export const formatWithCommas = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const str = val.toString().replace(/,/g, '');
  if (isNaN(str)) return val;
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

/**
 * 천단위 쉼표가 포함된 문자열을 실수(Number)로 파싱합니다.
 * @param {string|number} val
 * @returns {number}
 */
export const parseCommas = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
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
 * 증권 계좌 정산 계산용 API 요청 페이로드를 생성합니다.
 * @param {object} params
 * @returns {object}
 */
export const buildBrokerageCalculatePayload = ({
  accountId,
  snapshotDate,
  newTransactions = [],
  currentKrw = 0,
  currentUsd = 0,
  exchangeRate = 1.0,
}) => {
  return {
    account_id: accountId,
    snapshot_date: snapshotDate,
    new_transactions: (newTransactions || []).map((tx) => ({
      account_id: accountId,
      asset_id: tx.asset_id || 0,
      transaction_date: tx.date || snapshotDate,
      type: tx.type,
      total_amount: parseCommas(tx.amount),
      currency: tx.currency || 'KRW',
      quantity: parseCommas(tx.amount),
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
 * @param {object} params
 * @returns {object}
 */
export const buildBankCalculatePayload = ({
  accountId,
  snapshotDate,
  newTransactions = [],
}) => {
  return {
    account_id: accountId,
    snapshot_date: snapshotDate,
    new_transactions: (newTransactions || []).map((tx) => ({
      account_id: accountId,
      asset_id: tx.asset_id || 0,
      transaction_date: tx.date || snapshotDate,
      type: tx.type,
      total_amount: parseCommas(tx.amount),
      currency: 'KRW',
      quantity: parseCommas(tx.amount),
      price: 1.0,
      memo: tx.memo || '',
    })),
  };
};

/**
 * 최종 스냅샷 통합 저장 API 요청 DTO 페이로드를 조립합니다.
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
  return {
    snapshot_date: snapshotDate,
    exchange_rate: parseFloat(exchangeRate),
    brokerage_accounts: brokerageAccountIds.map((accId) => {
      const data = accountsFormData[accId] || { newTransactions: [] };
      return {
        account_id: accId,
        new_transactions: (data.newTransactions || []).map((tx) => ({
          account_id: accId,
          asset_id: tx.asset_id || 0,
          transaction_date: tx.date || snapshotDate,
          type: tx.type,
          total_amount: parseCommas(tx.amount),
          currency: tx.currency || 'KRW',
          quantity: parseCommas(tx.amount),
          price: 1.0,
          memo: tx.memo || '',
        })),
        diff_krw: parseFloat(data.calcResult?.diff_krw || 0),
        diff_usd: parseFloat(data.calcResult?.diff_usd || 0),
      };
    }),
    bank_accounts: bankAccountIds.map((accId) => {
      const data = accountsFormData[accId] || { newTransactions: [] };
      return {
        account_id: accId,
        new_transactions: (data.newTransactions || []).map((tx) => ({
          account_id: accId,
          asset_id: tx.asset_id || 0,
          transaction_date: tx.date || snapshotDate,
          type: tx.type,
          total_amount: parseCommas(tx.amount),
          currency: 'KRW',
          quantity: parseCommas(tx.amount),
          price: 1.0,
          memo: tx.memo || '',
        })),
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
 * Step 2 증권사 계좌 정산 확정 유효성 검사
 * @param {{ currentAccIdx: number, selectedBrokerageIds: number[], accountsFormData: object }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep2 = ({ currentAccIdx, selectedBrokerageIds = [], accountsFormData = {} }) => {
  const currentAccountId = selectedBrokerageIds[currentAccIdx];
  if (!currentAccountId) {
    return { isValid: false, message: '선택된 증권 계좌가 없습니다.' };
  }
  const currentData = accountsFormData[currentAccountId];
  if (!currentData?.isConfirmed) {
    return { isValid: false, message: '현재 계좌의 정산 결과를 확인하고 확정 버튼을 눌러주세요.' };
  }
  return { isValid: true };
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
 * Step 4 은행 계좌 정산 확정 유효성 검사
 * @param {{ currentAccIdx: number, selectedBankIds: number[], accountsFormData: object }} params
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateStep4 = ({ currentAccIdx, selectedBankIds = [], accountsFormData = {} }) => {
  const currentAccountId = selectedBankIds[currentAccIdx];
  if (!currentAccountId) {
    return { isValid: false, message: '선택된 은행 계좌가 없습니다.' };
  }
  const currentData = accountsFormData[currentAccountId];
  if (!currentData?.isConfirmed) {
    return { isValid: false, message: '현재 계좌의 정산 결과를 확인하고 확정 버튼을 눌러주세요.' };
  }
  return { isValid: true };
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
