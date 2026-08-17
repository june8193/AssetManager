import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  WizardProgressBar,
  Step1BasicInfo,
  Step2BrokerageDetail,
  Step3BankSelect,
  Step4BankDetail,
  Step5FinalConfirm,
} from './index';

describe('위저드 스텝별 컴포넌트 렌더링 테스트', () => {
  const mockBrokerageAccount = {
    id: 1,
    name: '미래에셋증권',
    provider: '미래에셋',
    user_name: '홍길동',
    account_type: 'BROKERAGE',
    is_active: true,
  };

  const mockBankAccount = {
    id: 2,
    name: 'KB국민은행',
    provider: 'KB국민',
    user_name: '홍길동',
    account_type: 'BANK',
    is_active: true,
  };

  it('WizardProgressBar: 단계별 진행 상태를 올바르게 렌더링한다', () => {
    render(<WizardProgressBar step={2} totalSteps={5} />);
    expect(screen.getByTestId('wizard-progress-bar')).toBeInTheDocument();
    expect(screen.getByText('기본 정보/증권 선택')).toBeInTheDocument();
    expect(screen.getByText('증권 상세 입력')).toBeInTheDocument();
  });

  it('Step1BasicInfo: 기준 일자, 환율 및 증권 계좌 목록을 렌더링하고 선택 이벤트를 전달한다', () => {
    const toggleMock = vi.fn();
    const selectAllMock = vi.fn();

    render(
      <Step1BasicInfo
        inputDate="2026-08-17"
        exchangeRate="1350.0"
        brokerageAccounts={[mockBrokerageAccount]}
        selectedAccountIds={[1]}
        toggleAccountSelection={toggleMock}
        selectAllBrokerage={selectAllMock}
      />
    );

    expect(screen.getByTestId('step-1-basic-info')).toBeInTheDocument();
    expect(screen.getByText('미래에셋증권')).toBeInTheDocument();

    const row = screen.getByText('미래에셋증권').closest('tr');
    fireEvent.click(row);
    expect(toggleMock).toHaveBeenCalledWith(1);
  });

  it('Step2BrokerageDetail: 증권 계좌의 예수금 입력 및 정산 계산 UI를 렌더링한다', () => {
    const calcMock = vi.fn();
    const confirmMock = vi.fn();

    render(
      <Step2BrokerageDetail
        currentAccIdx={0}
        selectedBrokerageIds={[1]}
        accounts={[mockBrokerageAccount]}
        accountsFormData={{
          1: {
            newTransactions: [],
            currentKrw: '1,000,000',
            currentUsd: '100',
            calcResult: null,
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
        calculateAccountDiff={calcMock}
        handleConfirmAccount={confirmMock}
      />
    );

    expect(screen.getByTestId('step-2-brokerage-detail')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1,000,000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();

    const calcButton = screen.getByRole('button', { name: /정산 결과 계산하기/i });
    fireEvent.click(calcButton);
    expect(calcMock).toHaveBeenCalledWith(1);
  });

  it('Step3BankSelect: 은행 계좌 목록을 렌더링하고 선택 이벤트를 전달한다', () => {
    const toggleMock = vi.fn();

    render(
      <Step3BankSelect
        bankAccounts={[mockBankAccount]}
        selectedAccountIds={[]}
        toggleAccountSelection={toggleMock}
      />
    );

    expect(screen.getByTestId('step-3-bank-select')).toBeInTheDocument();
    expect(screen.getByText('KB국민은행')).toBeInTheDocument();

    const row = screen.getByText('KB국민은행').closest('tr');
    fireEvent.click(row);
    expect(toggleMock).toHaveBeenCalledWith(2);
  });

  it('Step4BankDetail: 은행 계좌 잔액 입력 및 계산 UI를 렌더링한다', () => {
    const calcMock = vi.fn();

    render(
      <Step4BankDetail
        currentAccIdx={0}
        selectedBankIds={[2]}
        accounts={[mockBankAccount]}
        accountsFormData={{
          2: {
            newTransactions: [],
            totalValuation: '5,000,000',
            calcResult: { theoretical_krw: 5000000 },
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
        calculateBankDiff={calcMock}
      />
    );

    expect(screen.getByTestId('step-4-bank-detail')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5,000,000')).toBeInTheDocument();

    const calcButton = screen.getByRole('button', { name: /예상 잔액 계산하기/i });
    fireEvent.click(calcButton);
    expect(calcMock).toHaveBeenCalledWith(2);
  });

  it('Step5FinalConfirm: 정산 완료된 전체 계좌 목록 요약을 렌더링한다', () => {
    render(
      <Step5FinalConfirm
        accounts={[mockBrokerageAccount, mockBankAccount]}
        selectedAccountIds={[1, 2]}
        accountsFormData={{
          1: {
            currentKrw: '1000000',
            currentUsd: '0',
            calcResult: { diff_krw: 0, period_profit: 50000 },
            isConfirmed: true,
          },
          2: {
            totalValuation: '2000000',
            calcResult: { theoretical_krw: 2000000, total_interest: 5000 },
            isConfirmed: true,
          },
        }}
      />
    );

    expect(screen.getByTestId('step-5-final-confirm')).toBeInTheDocument();
    expect(screen.getByText('모든 계좌 정산 완료')).toBeInTheDocument();
    expect(screen.getByText('미래에셋증권')).toBeInTheDocument();
    expect(screen.getByText('KB국민은행')).toBeInTheDocument();
  });
});
