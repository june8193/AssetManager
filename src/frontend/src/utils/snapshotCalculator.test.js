// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  formatWithCommas,
  parseCommas,
  calculateStockValuation,
  calculateAccountValuation,
  calculateCashDifference,
  getIncomingTransferDeposits,
  validateAccountTransferTargets,
  TRANSACTION_TYPES,
  buildBrokerageCalculatePayload,
  buildBankCalculatePayload,
  buildSnapshotPayload,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
} from './snapshotCalculator';

describe('snapshotCalculator - 포맷팅 및 파싱 유틸리티', () => {
  it('천단위 쉼표 포맷팅이 올바르게 동작해야 한다', () => {
    expect(formatWithCommas(1000)).toBe('1,000');
    expect(formatWithCommas('1234567.89')).toBe('1,234,567.89');
    expect(formatWithCommas(0)).toBe('0');
    expect(formatWithCommas('')).toBe('');
    expect(formatWithCommas(null)).toBe('');
    expect(formatWithCommas(undefined)).toBe('');
    expect(formatWithCommas('invalid')).toBe('invalid');
  });

  it('쉼표가 포함된 문자열을 부동소수점 숫자로 올바르게 파싱해야 한다', () => {
    expect(parseCommas('1,000')).toBe(1000);
    expect(parseCommas('1,234,567.89')).toBe(1234567.89);
    expect(parseCommas(0)).toBe(0);
    expect(parseCommas('')).toBe(0);
    expect(parseCommas(null)).toBe(0);
    expect(parseCommas(undefined)).toBe(0);
  });
});

describe('snapshotCalculator - 순수 금융 연산', () => {
  it('주식 종목 평가액을 원화 및 외화(환율 적용)로 올바르게 계산해야 한다', () => {
    // 원화 종목
    const krwStock = { quantity: 10, price: 50000, currency: 'KRW' };
    expect(calculateStockValuation(krwStock, 1300)).toBe(500000);

    // 외화 종목 (환율 적용)
    const usdStock = { quantity: 5, price: 100, currency: 'USD' };
    expect(calculateStockValuation(usdStock, 1300)).toBe(650000); // 500 * 1300 = 650,000
  });

  it('계좌별 보유 주식 및 예수금을 합산한 총 평가액을 계산해야 한다', () => {
    const holdings = [
      { quantity: 10, price: 50000, currency: 'KRW' },
      { quantity: 5, price: 100, currency: 'USD' },
    ];
    const cashItems = { krw: 100000, usd: 200 };
    const exchangeRate = 1300;

    // holdings (500,000 + 650,000) + krw(100,000) + usd(200 * 1300 = 260,000) = 1,510,000
    const total = calculateAccountValuation(holdings, cashItems, exchangeRate);
    expect(total).toBe(1510000);
  });

  it('예수금 및 거래 내역을 바탕으로 이론상 잔액과 차액을 계산해야 한다 (TRANSFER는 출금으로 차감)', () => {
    const previousCash = 1000000;
    const transactions = [
      { type: 'DEPOSIT', amount: 500000 },
      { type: 'WITHDRAW', amount: 200000 },
      { type: 'TRANSFER', amount: 300000 }, // 이체 출금: 300,000원 차감
      { type: 'INTEREST', amount: 10000 },
      { type: 'TAX', amount: 1540 },
    ];
    // theoretical = 1,000,000 + 500,000 - 200,000 - 300,000 + 10,000 - 1,540 = 1,008,460
    const currentCash = 1000000;
    const diffResult = calculateCashDifference(previousCash, transactions, currentCash);

    expect(diffResult.theoreticalCash).toBe(1008460);
    expect(diffResult.diff).toBe(-8460);
  });

  it('validateAccountTransferTargets: TRANSFER 거래의 도착 계좌 미선택 여부를 올바르게 검증한다', () => {
    expect(validateAccountTransferTargets([
      { type: 'TRANSFER', amount: '100,000', target_account_id: null }
    ]).isValid).toBe(false);

    expect(validateAccountTransferTargets([
      { type: 'TRANSFER', amount: '100,000', target_account_id: 2 }
    ]).isValid).toBe(true);

    expect(validateAccountTransferTargets([
      { type: 'DEPOSIT', amount: '100,000' }
    ]).isValid).toBe(true);
  });
});

describe('snapshotCalculator - getIncomingTransferDeposits 이체 입금 추출', () => {
  const accounts = [
    { id: 1, name: '미래에셋증권', alias: '주식계좌' },
    { id: 2, name: 'KB국민은행', alias: '급여통장' },
    { id: 3, name: '신한은행', alias: '적금통장' },
  ];

  it('타 계좌에서 현재 계좌로 보낸 TRANSFER 거래를 DEPOSIT 목록으로 변환해야 한다', () => {
    const accountsFormData = {
      2: {
        newTransactions: [
          { type: 'TRANSFER', amount: '500,000', target_account_id: 1, date: '2026-08-17', memo: '예수금 충전' },
          { type: 'WITHDRAW', amount: '100,000', date: '2026-08-17' },
        ],
      },
      3: {
        newTransactions: [
          { type: 'TRANSFER', amount: '300,000', target_account_id: 1, date: '2026-08-17', memo: '' },
          { type: 'TRANSFER', amount: '200,000', target_account_id: 2, date: '2026-08-17' },
        ],
      },
      1: {
        newTransactions: [
          // 자기 자신 계좌의 거래
          { type: 'TRANSFER', amount: '50,000', target_account_id: 2, date: '2026-08-17' },
        ],
      },
    };

    const incomingFor1 = getIncomingTransferDeposits(1, accountsFormData, accounts);
    expect(incomingFor1).toHaveLength(2);
    expect(incomingFor1[0]).toMatchObject({
      source_account_id: 2,
      source_account_name: 'KB국민은행 (급여통장)',
      type: 'DEPOSIT',
      amount: '500,000',
      currency: 'KRW',
      is_incoming_transfer: true,
    });
    expect(incomingFor1[0].memo).toContain('이체 연동: KB국민은행 (급여통장)');
    expect(incomingFor1[0].memo).toContain('예수금 충전');

    expect(incomingFor1[1]).toMatchObject({
      source_account_id: 3,
      source_account_name: '신한은행 (적금통장)',
      type: 'DEPOSIT',
      amount: '300,000',
      currency: 'KRW',
      is_incoming_transfer: true,
    });
  });

  it('해당 계좌로의 이체가 없으면 빈 배열을 반환해야 한다', () => {
    const accountsFormData = {
      2: {
        newTransactions: [
          { type: 'TRANSFER', amount: '500,000', target_account_id: 3, date: '2026-08-17' },
        ],
      },
    };
    expect(getIncomingTransferDeposits(1, accountsFormData, accounts)).toEqual([]);
  });
});

describe('snapshotCalculator - API DTO 페이로드 생성', () => {
  it('증권 정산 요청 페이로드를 올바르게 조립해야 한다', () => {
    const payload = buildBrokerageCalculatePayload({
      accountId: 1,
      snapshotDate: '2026-08-17',
      newTransactions: [
        { type: 'DEPOSIT', amount: '1,000,000', currency: 'KRW', date: '2026-08-17', memo: '월급 입금' },
        { type: 'WITHDRAW', amount: '100', currency: 'USD', date: '2026-08-17', memo: '해외 출금' },
      ],
      currentKrw: '2,500,000',
      currentUsd: '500',
      exchangeRate: '1350.50',
    });

    expect(payload).toEqual({
      account_id: 1,
      snapshot_date: '2026-08-17',
      new_transactions: [
        {
          account_id: 1,
          asset_id: 0,
          transaction_date: '2026-08-17',
          type: 'DEPOSIT',
          total_amount: 1000000,
          currency: 'KRW',
          quantity: 1000000,
          price: 1.0,
          memo: '월급 입금',
        },
        {
          account_id: 1,
          asset_id: 0,
          transaction_date: '2026-08-17',
          type: 'WITHDRAW',
          total_amount: 100,
          currency: 'USD',
          quantity: 100,
          price: 1.0,
          memo: '해외 출금',
        },
      ],
      current_krw: 2500000,
      current_usd: 500,
      exchange_rate: 1350.5,
    });
  });

  it('은행 정산 요청 페이로드를 올바르게 조립해야 한다', () => {
    const payload = buildBankCalculatePayload({
      accountId: 2,
      snapshotDate: '2026-08-17',
      newTransactions: [
        { type: 'INTEREST', amount: '5,000', date: '2026-08-17', memo: '예금 이자' },
      ],
    });

    expect(payload).toEqual({
      account_id: 2,
      snapshot_date: '2026-08-17',
      new_transactions: [
        {
          account_id: 2,
          asset_id: 0,
          transaction_date: '2026-08-17',
          type: 'INTEREST',
          total_amount: 5000,
          currency: 'KRW',
          quantity: 5000,
          price: 1.0,
          memo: '예금 이자',
        },
      ],
    });
  });

  it('증권 정산 요청 페이로드에 이체 입금(incomingTransfers)이 DEPOSIT으로 자동 합산되어야 한다', () => {
    const payload = buildBrokerageCalculatePayload({
      accountId: 1,
      snapshotDate: '2026-08-17',
      newTransactions: [
        { type: 'WITHDRAW', amount: '100,000', currency: 'KRW', date: '2026-08-17', memo: '출금' },
      ],
      incomingTransfers: [
        {
          source_account_id: 2,
          source_account_name: 'KB국민은행',
          type: 'DEPOSIT',
          amount: '500,000',
          currency: 'KRW',
          date: '2026-08-17',
          memo: '이체 연동: KB국민은행',
        },
      ],
      currentKrw: '1,500,000',
      currentUsd: '0',
      exchangeRate: '1350.0',
    });

    expect(payload.new_transactions).toHaveLength(2);
    expect(payload.new_transactions[0]).toMatchObject({
      type: 'WITHDRAW',
      total_amount: 100000,
    });
    expect(payload.new_transactions[1]).toMatchObject({
      type: 'DEPOSIT',
      total_amount: 500000,
      currency: 'KRW',
      memo: '이체 연동: KB국민은행',
    });
  });

  it('은행 정산 요청 페이로드에 이체 입금(incomingTransfers)이 DEPOSIT으로 자동 합산되어야 한다', () => {
    const payload = buildBankCalculatePayload({
      accountId: 2,
      snapshotDate: '2026-08-17',
      newTransactions: [
        { type: 'INTEREST', amount: '5,000', date: '2026-08-17', memo: '예금 이자' },
      ],
      incomingTransfers: [
        {
          source_account_id: 1,
          source_account_name: '미래에셋증권',
          type: 'DEPOSIT',
          amount: '200,000',
          currency: 'KRW',
          date: '2026-08-17',
          memo: '이체 연동: 미래에셋증권',
        },
      ],
    });

    expect(payload.new_transactions).toHaveLength(2);
    expect(payload.new_transactions[1]).toMatchObject({
      type: 'DEPOSIT',
      total_amount: 200000,
      memo: '이체 연동: 미래에셋증권',
    });
  });

  it('최종 스냅샷 통합 저장 DTO 페이로드에 TRANSFER 타입과 target_account_id가 올바르게 포함되어야 한다', () => {
    const payload = buildSnapshotPayload({
      snapshotDate: '2026-08-17',
      exchangeRate: '1350.00',
      brokerageAccountIds: [1],
      bankAccountIds: [2],
      accountsFormData: {
        1: {
          newTransactions: [],
          calcResult: { diff_krw: 0, diff_usd: 0 },
        },
        2: {
          newTransactions: [
            {
              type: 'TRANSFER',
              amount: '500,000',
              currency: 'KRW',
              target_account_id: 1,
              date: '2026-08-17',
              memo: '증권계좌로 이체',
            },
          ],
          totalValuation: '2,500,000',
        },
      },
    });

    expect(payload.bank_accounts[0].new_transactions).toHaveLength(1);
    expect(payload.bank_accounts[0].new_transactions[0]).toMatchObject({
      type: 'TRANSFER',
      total_amount: 500000,
      target_account_id: 1,
      memo: '증권계좌로 이체',
    });
    // 도착 계좌(1)에는 백엔드가 쌍을 생성하므로 프론트에서는 중복 tx를 넣지 않음
    expect(payload.brokerage_accounts[0].new_transactions).toHaveLength(0);
  });
});

describe('snapshotCalculator - 스텝 유효성 검사', () => {
  it('Step 1 기본 정보 검증', () => {
    expect(validateStep1({ inputDate: '', exchangeRate: '1300' }).isValid).toBe(false);
    expect(validateStep1({ inputDate: '2026-08-17', exchangeRate: '' }).isValid).toBe(false);
    expect(validateStep1({ inputDate: '2026-08-17', exchangeRate: 'invalid' }).isValid).toBe(false);
    expect(validateStep1({ inputDate: '2026-08-17', exchangeRate: '1300' }).isValid).toBe(true);
  });

  it('Step 2(은행) 및 Step 4(증권) 계좌 확정 상태 검증', () => {
    const formData = {
      1: { isConfirmed: true, newTransactions: [] },
      2: { isConfirmed: false, newTransactions: [] },
    };
    // Step 2: 은행 상세 확정 검증 (selectedBankIds)
    expect(validateStep2({ currentAccIdx: 0, selectedBankIds: [1], accountsFormData: formData }).isValid).toBe(true);
    expect(validateStep2({ currentAccIdx: 0, selectedBankIds: [2], accountsFormData: formData }).isValid).toBe(false);
    // Step 4: 증권 상세 확정 검증 (selectedBrokerageIds)
    expect(validateStep4({ currentAccIdx: 0, selectedBrokerageIds: [1], accountsFormData: formData }).isValid).toBe(true);
    expect(validateStep4({ currentAccIdx: 0, selectedBrokerageIds: [2], accountsFormData: formData }).isValid).toBe(false);
  });

  it('Step 2 및 Step 4에서 TRANSFER 거래의 도착 계좌(target_account_id)가 누락되면 유효성 검사에 실패해야 한다', () => {
    const invalidFormData = {
      1: {
        isConfirmed: true,
        newTransactions: [
          { type: 'TRANSFER', amount: '100,000', target_account_id: null },
        ],
      },
    };
    const validFormData = {
      1: {
        isConfirmed: true,
        newTransactions: [
          { type: 'TRANSFER', amount: '100,000', target_account_id: 2 },
        ],
      },
    };

    const resInvalidStep2 = validateStep2({ currentAccIdx: 0, selectedBankIds: [1], accountsFormData: invalidFormData });
    expect(resInvalidStep2.isValid).toBe(false);
    expect(resInvalidStep2.message).toContain('도착 계좌');

    const resValidStep2 = validateStep2({ currentAccIdx: 0, selectedBankIds: [1], accountsFormData: validFormData });
    expect(resValidStep2.isValid).toBe(true);

    const resInvalidStep4 = validateStep4({ currentAccIdx: 0, selectedBrokerageIds: [1], accountsFormData: invalidFormData });
    expect(resInvalidStep4.isValid).toBe(false);
    expect(resInvalidStep4.message).toContain('도착 계좌');

    const resValidStep4 = validateStep4({ currentAccIdx: 0, selectedBrokerageIds: [1], accountsFormData: validFormData });
    expect(resValidStep4.isValid).toBe(true);
  });

  it('Step 3 최소 계좌 선택 검증', () => {
    expect(validateStep3({ selectedBrokerageIds: [], selectedBankIds: [] }).isValid).toBe(false);
    expect(validateStep3({ selectedBrokerageIds: [1], selectedBankIds: [] }).isValid).toBe(true);
    expect(validateStep3({ selectedBrokerageIds: [], selectedBankIds: [2] }).isValid).toBe(true);
  });

  it('Step 5 모든 선택 계좌 확정 검증', () => {
    const formData = {
      1: { isConfirmed: true },
      2: { isConfirmed: false },
    };
    expect(validateStep5({ selectedAccountIds: [1], accountsFormData: formData }).isValid).toBe(true);
    expect(validateStep5({ selectedAccountIds: [1, 2], accountsFormData: formData }).isValid).toBe(false);
    expect(validateStep5({ selectedAccountIds: [], accountsFormData: formData }).isValid).toBe(false);
  });
});
