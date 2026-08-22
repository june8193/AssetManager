// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  formatWithCommas,
  parseCommas,
  calculateStockValuation,
  calculateAccountValuation,
  calculateCashDifference,
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

  it('예수금 및 거래 내역을 바탕으로 이론상 잔액과 차액을 계산해야 한다', () => {
    const previousCash = 1000000;
    const transactions = [
      { type: 'DEPOSIT', amount: 500000 },
      { type: 'WITHDRAW', amount: 200000 },
      { type: 'INTEREST', amount: 10000 },
      { type: 'TAX', amount: 1540 },
    ];
    // theoretical = 1,000,000 + 500,000 - 200,000 + 10,000 - 1,540 = 1,308,460
    const currentCash = 1300000;
    const diffResult = calculateCashDifference(previousCash, transactions, currentCash);

    expect(diffResult.theoreticalCash).toBe(1308460);
    expect(diffResult.diff).toBe(-8460);
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

  it('최종 스냅샷 통합 저장 DTO 페이로드를 올바르게 조립해야 한다', () => {
    const payload = buildSnapshotPayload({
      snapshotDate: '2026-08-17',
      exchangeRate: '1350.00',
      brokerageAccountIds: [1],
      bankAccountIds: [2],
      accountsFormData: {
        1: {
          newTransactions: [{ type: 'DEPOSIT', amount: '500,000', currency: 'KRW', date: '2026-08-17', memo: '입금' }],
          calcResult: { diff_krw: 1000, diff_usd: 0 },
          currentKrw: '1,500,000',
          currentUsd: '0',
        },
        2: {
          newTransactions: [],
          calcResult: { theoretical_krw: 3000000 },
          totalValuation: '3,000,000',
        },
      },
    });

    expect(payload.snapshot_date).toBe('2026-08-17');
    expect(payload.exchange_rate).toBe(1350);
    expect(payload.brokerage_accounts).toHaveLength(1);
    expect(payload.brokerage_accounts[0].account_id).toBe(1);
    expect(payload.brokerage_accounts[0].diff_krw).toBe(1000);
    expect(payload.bank_accounts).toHaveLength(1);
    expect(payload.bank_accounts[0].account_id).toBe(2);
    expect(payload.bank_accounts[0].total_valuation).toBe(3000000);
  });
});

describe('snapshotCalculator - 스텝 유효성 검사', () => {
  it('Step 1 기본 정보 검증', () => {
    expect(validateStep1({ inputDate: '', exchangeRate: '1300' }).isValid).toBe(false);
    expect(validateStep1({ inputDate: '2026-08-17', exchangeRate: '' }).isValid).toBe(false);
    expect(validateStep1({ inputDate: '2026-08-17', exchangeRate: 'invalid' }).isValid).toBe(false);
    expect(validateStep1({ inputDate: '2026-08-17', exchangeRate: '1300' }).isValid).toBe(true);
  });

  it('Step 2 및 Step 4 계좌 확정 상태 검증', () => {
    const formData = {
      1: { isConfirmed: true },
      2: { isConfirmed: false },
    };
    expect(validateStep2({ currentAccIdx: 0, selectedBrokerageIds: [1], accountsFormData: formData }).isValid).toBe(true);
    expect(validateStep2({ currentAccIdx: 0, selectedBrokerageIds: [2], accountsFormData: formData }).isValid).toBe(false);
    expect(validateStep4({ currentAccIdx: 0, selectedBankIds: [1], accountsFormData: formData }).isValid).toBe(true);
    expect(validateStep4({ currentAccIdx: 0, selectedBankIds: [2], accountsFormData: formData }).isValid).toBe(false);
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
