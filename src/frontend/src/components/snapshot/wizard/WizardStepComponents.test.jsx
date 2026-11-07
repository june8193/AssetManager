import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  WizardProgressBar,
  DEFAULT_STEPS,
  TransactionTable,
  Step1BasicInfo,
  Step2BankDetail,
  Step3BrokerageSelect,
  Step4BrokerageDetail,
  Step5FinalConfirm,
  Step2BrokerageDetail,
  Step4BankDetail,
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

  it('WizardProgressBar: DEFAULT_STEPS가 은행 우선 5단계 라벨을 올바르게 포함한다', () => {
    expect(DEFAULT_STEPS.map((s) => s.label)).toEqual([
      '기본 정보/은행 선택',
      '은행 상세 입력',
      '증권 계좌 선택',
      '증권 상세 입력',
      '최종 확인',
    ]);

    render(<WizardProgressBar step={2} totalSteps={5} />);
    expect(screen.getByTestId('wizard-progress-bar')).toBeInTheDocument();
    expect(screen.getByText('기본 정보/은행 선택')).toBeInTheDocument();
    expect(screen.getByText('은행 상세 입력')).toBeInTheDocument();
    expect(screen.getByText('증권 계좌 선택')).toBeInTheDocument();
    expect(screen.getByText('증권 상세 입력')).toBeInTheDocument();
    expect(screen.getByText('최종 확인')).toBeInTheDocument();
  });

  it('Step1BasicInfo: 기준 일자, 환율 및 은행 계좌 목록을 렌더링하고 선택 이벤트를 전달한다', () => {
    const toggleMock = vi.fn();
    const selectAllMock = vi.fn();

    render(
      <Step1BasicInfo
        inputDate="2026-08-17"
        exchangeRate="1350.0"
        bankAccounts={[mockBankAccount]}
        selectedAccountIds={[2]}
        toggleAccountSelection={toggleMock}
        selectAllBank={selectAllMock}
      />
    );

    expect(screen.getByTestId('step-1-basic-info')).toBeInTheDocument();
    expect(screen.getByText('기본 정보 및 은행 계좌 선택')).toBeInTheDocument();
    expect(screen.getByText('KB국민은행')).toBeInTheDocument();

    const row = screen.getByText('KB국민은행').closest('tr');
    fireEvent.click(row);
    expect(toggleMock).toHaveBeenCalledWith(2);
  });

  it('Step2BankDetail: 은행 계좌 잔액 입력 및 계산 UI를 렌더링한다', () => {
    const calcMock = vi.fn();

    render(
      <Step2BankDetail
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

    expect(screen.getByTestId('step-2-bank-detail')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5,000,000')).toBeInTheDocument();

    const calcButton = screen.getByRole('button', { name: /예상 잔액 계산하기/i });
    fireEvent.click(calcButton);
    expect(calcMock).toHaveBeenCalledWith(2);
  });

  it('Step3BrokerageSelect: 증권 계좌 목록을 렌더링하고 선택 이벤트를 전달한다', () => {
    const toggleMock = vi.fn();

    render(
      <Step3BrokerageSelect
        brokerageAccounts={[mockBrokerageAccount]}
        selectedAccountIds={[]}
        toggleAccountSelection={toggleMock}
      />
    );

    expect(screen.getByTestId('step-3-brokerage-select')).toBeInTheDocument();
    expect(screen.getByText('증권 계좌 선택')).toBeInTheDocument();
    expect(screen.getByText('미래에셋증권')).toBeInTheDocument();

    const row = screen.getByText('미래에셋증권').closest('tr');
    fireEvent.click(row);
    expect(toggleMock).toHaveBeenCalledWith(1);
  });

  it('Step4BrokerageDetail: 증권 계좌의 예수금 입력 및 정산 계산 UI를 렌더링한다', () => {
    const calcMock = vi.fn();
    const confirmMock = vi.fn();

    render(
      <Step4BrokerageDetail
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

    expect(screen.getByTestId('step-4-brokerage-detail')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1,000,000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();

    const calcButton = screen.getByRole('button', { name: /정산 결과 계산하기/i });
    fireEvent.click(calcButton);
    expect(calcMock).toHaveBeenCalledWith(1);
  });

  it('Step4BrokerageDetail: 예상 원화/달러 금액과 동일 적용 버튼을 렌더링하고, 버튼 클릭 시 updateAccData를 호출한다', () => {
    const updateAccDataMock = vi.fn();

    render(
      <Step4BrokerageDetail
        currentAccIdx={0}
        selectedBrokerageIds={[1]}
        accounts={[mockBrokerageAccount]}
        accountsFormData={{
          1: {
            newTransactions: [
              { type: 'DEPOSIT', amount: '200,000', currency: 'KRW' },
              { type: 'DIVIDEND', amount: '50', currency: 'USD' },
            ],
            baseCash: { cash_krw: 800000, cash_usd: 150 },
            currentKrw: '0',
            currentUsd: '0',
            calcResult: null,
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
        updateAccData={updateAccDataMock}
      />
    );

    // 예상 금액 표시 확인 (800,000 + 200,000 = 1,000,000원 / 150 + 50 = $200)
    expect(screen.getByText('현재 계좌 예상 원화')).toBeInTheDocument();
    expect(screen.getByText('1,000,000원')).toBeInTheDocument();
    expect(screen.getByText('현재 계좌 예상 달러')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();

    // 원화 및 달러 '동일 적용 →' 버튼 클릭
    const applyButtons = screen.getAllByRole('button', { name: /동일 적용/i });
    expect(applyButtons).toHaveLength(2);

    fireEvent.click(applyButtons[0]);
    expect(updateAccDataMock).toHaveBeenCalledWith(1, { currentKrw: '1000000' });

    fireEvent.click(applyButtons[1]);
    expect(updateAccDataMock).toHaveBeenCalledWith(1, { currentUsd: '200' });
  });

  it('Step4BrokerageDetail: 입력값과 예상값의 일치/차액 상태 배지를 실시간으로 올바르게 렌더링한다', () => {
    const { rerender } = render(
      <Step4BrokerageDetail
        currentAccIdx={0}
        selectedBrokerageIds={[1]}
        accounts={[mockBrokerageAccount]}
        accountsFormData={{
          1: {
            newTransactions: [],
            baseCash: { cash_krw: 1000000, cash_usd: 100 },
            currentKrw: '1,000,000', // 일치
            currentUsd: '100', // 일치
            calcResult: null,
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
      />
    );

    // 차액 없음 안내 확인
    const matchBadges = screen.getAllByText(/예상 잔액과 일치합니다 \(차액 없음\)/i);
    expect(matchBadges).toHaveLength(2);

    // 차액 발생 시 리렌더링 (원화 +12,400원, 달러 -$4.50)
    rerender(
      <Step4BrokerageDetail
        currentAccIdx={0}
        selectedBrokerageIds={[1]}
        accounts={[mockBrokerageAccount]}
        accountsFormData={{
          1: {
            newTransactions: [],
            baseCash: { cash_krw: 1000000, cash_usd: 100 },
            currentKrw: '1,012,400', // +12,400원
            currentUsd: '95.5', // -4.50달러
            calcResult: null,
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
      />
    );

    expect(screen.getByText(/\+12,400원/)).toBeInTheDocument();
    expect(screen.getByText(/-\$4.50/)).toBeInTheDocument();
    const adjustNotices = screen.getAllByText(/정산 시 예수금 보정\(배당\/이자\/수수료\)으로 처리됩니다/i);
    expect(adjustNotices.length).toBeGreaterThanOrEqual(1);
  });

  it('Step5FinalConfirm: 정산 완료된 전체 계좌 목록 요약에서 은행 계좌가 먼저 표시된다', () => {
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

    // 테이블 내 행 순서 검증: 은행 계좌(KB국민은행)가 증권 계좌(미래에셋증권)보다 먼저 위치
    const rows = screen.getAllByRole('row');
    const firstBodyRowText = rows[1].textContent;
    const secondBodyRowText = rows[2].textContent;
    expect(firstBodyRowText).toContain('KB국민은행');
    expect(secondBodyRowText).toContain('미래에셋증권');
  });

  it('Step4BrokerageDetail / Step2BrokerageDetail: 차액 또는 정합성 경고 발생 시 빨간색 경고 카드 및 확인 체크박스 가드를 렌더링한다', () => {
    const confirmMock = vi.fn();

    render(
      <Step2BrokerageDetail
        currentAccIdx={0}
        selectedBrokerageIds={[1]}
        accounts={[mockBrokerageAccount]}
        accountsFormData={{
          1: {
            newTransactions: [],
            currentKrw: '1,050,000',
            currentUsd: '0',
            calcResult: {
              diff_krw: 50000,
              diff_usd: 0,
              period_deposit: 0,
              period_profit: 50000,
              integrity_warnings: ['원화 차액(50,000원)이 감지되었습니다.'],
            },
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
        handleConfirmAccount={confirmMock}
      />
    );

    // 경고 카드 표시 확인
    expect(screen.getByTestId('integrity-warning-card')).toBeInTheDocument();
    expect(screen.getByText(/원화 차액\(50,000원\)이 감지되었습니다/)).toBeInTheDocument();

    // 체크박스 미체크 시 '이 결과로 확정' 버튼 비활성화 확인
    const confirmBtn = screen.getByRole('button', { name: /이 결과로 확정/i });
    expect(confirmBtn).toBeDisabled();

    // 체크박스 클릭
    const checkbox = screen.getByTestId('integrity-confirm-checkbox');
    fireEvent.click(checkbox);

    // 버튼 활성화 및 클릭 시 handleConfirmAccount 호출 확인
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(confirmMock).toHaveBeenCalledWith(1);
  });

  it('Step2BankDetail / Step4BankDetail: 비정상 수익 또는 정합성 경고 발생 시 빨간색 경고 카드 및 확인 체크박스 가드를 렌더링한다', () => {
    const confirmMock = vi.fn();

    render(
      <Step4BankDetail
        currentAccIdx={0}
        selectedBankIds={[2]}
        accounts={[mockBankAccount]}
        accountsFormData={{
          2: {
            newTransactions: [],
            totalValuation: '5,050,000',
            calcResult: {
              theoretical_krw: 5000000,
              period_profit: 50000,
              integrity_warnings: ['은행 계좌에서 기간 수익(50,000원)이 발생했습니다.'],
            },
            isConfirmed: false,
          },
        }}
        inputDate="2026-08-17"
        handleConfirmAccount={confirmMock}
      />
    );

    // 경고 카드 표시 확인
    expect(screen.getByTestId('integrity-warning-card')).toBeInTheDocument();
    expect(screen.getByText(/은행 계좌에서 기간 수익/)).toBeInTheDocument();

    // 체크박스 미체크 시 '이 결과로 확정' 버튼 비활성화 확인
    const confirmBtn = screen.getByRole('button', { name: /이 결과로 확정/i });
    expect(confirmBtn).toBeDisabled();

    // 체크박스 클릭
    const checkbox = screen.getByTestId('integrity-confirm-checkbox');
    fireEvent.click(checkbox);

    // 버튼 활성화 및 클릭 시 handleConfirmAccount 호출 확인
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(confirmMock).toHaveBeenCalledWith(2);
  });

  describe('TransactionTable 이체(TRANSFER) 및 이체 연동 입금 렌더링', () => {
    const allAccounts = [mockBrokerageAccount, mockBankAccount];

    it('신규 거래 유형에 TRANSFER(이체) 옵션이 있고, 선택 시 도착 계좌 셀렉트가 표시된다', () => {
      const updateMock = vi.fn();
      render(
        <TransactionTable
          accId={2}
          isBrokerage={false}
          accounts={allAccounts}
          existingTxs={[]}
          newTransactions={[
            { type: 'TRANSFER', amount: '500,000', currency: 'KRW', target_account_id: '' },
          ]}
          onUpdateTx={updateMock}
        />
      );

      // 도착 계좌 선택 셀렉트 존재 확인 (현재 계좌인 2번 KB국민은행은 제외되고 1번 미래에셋증권만 표시)
      const targetSelect = screen.getByRole('combobox', { name: /도착 계좌/i });
      expect(targetSelect).toBeInTheDocument();
      expect(screen.getByText('미래에셋증권')).toBeInTheDocument();
      expect(screen.queryByText('KB국민은행')).not.toBeInTheDocument();

      // 도착 계좌 변경
      fireEvent.change(targetSelect, { target: { value: '1' } });
      expect(updateMock).toHaveBeenCalledWith(2, 0, 'target_account_id', 1);
    });

    it('타 계좌발 이체 연동 입금(incomingTransfers)이 읽기 전용 행으로 표시되고 삭제할 수 없다', () => {
      const removeMock = vi.fn();
      const incoming = [
        {
          source_account_id: 2,
          source_account_name: 'KB국민은행',
          type: 'DEPOSIT',
          amount: '500,000',
          currency: 'KRW',
          memo: '이체 연동: KB국민은행 (생활비)',
          is_incoming_transfer: true,
        },
      ];

      render(
        <TransactionTable
          accId={1}
          isBrokerage={true}
          accounts={allAccounts}
          incomingTransfers={incoming}
          existingTxs={[]}
          newTransactions={[]}
          onRemoveTx={removeMock}
        />
      );

      expect(screen.getByText(/DEPOSIT \(이체 연동: KB국민은행\)/)).toBeInTheDocument();
      expect(screen.getByText('500,000원')).toBeInTheDocument();
      expect(screen.getByText('이체 연동: KB국민은행 (생활비)')).toBeInTheDocument();
      expect(screen.getByText('읽기 전용 (이체 연동)')).toBeInTheDocument();

      // 삭제 버튼이 없어야 함
      expect(screen.queryByRole('button', { name: /삭제/i })).not.toBeInTheDocument();
    });
  });
});
