import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileTransactionList from './MobileTransactionList';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileTransactionList', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockAccounts = [
    { id: 1, name: '5526-9093', provider: 'KB증권', alias: '주식' },
    { id: 2, name: '1234-5678', provider: '신한은행', alias: '생활비' },
  ];

  const mockAssets = [
    { id: 101, ticker: '005930', name: '삼성전자', category: '국내주식' },
    { id: 102, ticker: 'AAPL', name: 'Apple Inc.', category: '해외주식' },
    { id: 103, ticker: 'KRW', name: '원화현금', category: 'CASH' },
  ];

  const mockTransactions = [
    {
      id: 1,
      account_id: 1,
      asset_id: 101,
      transaction_date: '2026-08-25',
      type: 'BUY',
      quantity: 10,
      price: 70000,
      total_amount: 700000,
      currency: 'KRW',
      memo: '삼성전자 분할매수',
    },
    {
      id: 2,
      account_id: 1,
      asset_id: 102,
      transaction_date: '2026-08-26',
      type: 'SELL',
      quantity: 5,
      price: 220,
      total_amount: 1100,
      currency: 'USD',
      memo: '애플 차익실현',
    },
    {
      id: 3,
      account_id: 2,
      asset_id: 103,
      transaction_date: '2026-08-27',
      type: 'DEPOSIT',
      quantity: 1000000,
      price: 1,
      total_amount: 1000000,
      currency: 'KRW',
      memo: '급여 입금',
    },
    {
      id: 4,
      account_id: 1,
      asset_id: 101,
      transaction_date: '2026-08-28',
      type: 'DIVIDEND',
      quantity: 1,
      price: 36100,
      total_amount: 36100,
      currency: 'KRW',
      memo: '삼성전자 분기배당',
    },
  ];

  it('전체 거래 내역 리스트가 정상 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={mockTransactions}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    expect(screen.getByText('삼성전자 분할매수')).toBeInTheDocument();
    expect(screen.getByText('애플 차익실현')).toBeInTheDocument();
    expect(screen.getByText('급여 입금')).toBeInTheDocument();
    expect(screen.getByText('삼성전자 분기배당')).toBeInTheDocument();
  });

  it('계좌 필터 선택 시 해당 계좌의 거래만 필터링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={mockTransactions}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    const accountSelect = screen.getByLabelText(/계좌 필터/i);
    fireEvent.change(accountSelect, { target: { value: '2' } });

    expect(screen.getByText('급여 입금')).toBeInTheDocument();
    expect(screen.queryByText('삼성전자 분할매수')).not.toBeInTheDocument();
    expect(screen.queryByText('애플 차익실현')).not.toBeInTheDocument();
  });

  it('거래 유형 필터(매수/매도, 입출금 등) 선택 시 정상 필터링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={mockTransactions}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    const typeSelect = screen.getByLabelText(/유형 필터/i);
    // 매수(BUY) 선택
    fireEvent.change(typeSelect, { target: { value: 'BUY' } });

    expect(screen.getByText('삼성전자 분할매수')).toBeInTheDocument();
    expect(screen.queryByText('애플 차익실현')).not.toBeInTheDocument();
    expect(screen.queryByText('급여 입금')).not.toBeInTheDocument();
  });

  it('키워드 검색 시 종목명, 티커, 메모 등에 매칭되는 거래만 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={mockTransactions}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    const searchInput = screen.getByPlaceholderText(/검색/i);
    fireEvent.change(searchInput, { target: { value: 'AAPL' } });

    expect(screen.getByText('애플 차익실현')).toBeInTheDocument();
    expect(screen.queryByText('삼성전자 분할매수')).not.toBeInTheDocument();
    expect(screen.queryByText('급여 입금')).not.toBeInTheDocument();
  });

  it('마스킹 활성화 시 거래 수량, 단가, 총액이 마스킹(***)되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={mockTransactions}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    expect(screen.queryByText('700,000')).not.toBeInTheDocument();
    expect(screen.queryByText('1,000,000')).not.toBeInTheDocument();
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('일치하는 거래 내역이 없을 때 빈 상태 메시지가 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={[]}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    expect(screen.getByText(/거래 내역이 없습니다/i)).toBeInTheDocument();
  });

  it('CUD(추가, 수정, 삭제) 관련 버튼이나 폼이 전혀 노출되지 않아야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTransactionList
          transactions={mockTransactions}
          accounts={mockAccounts}
          assets={mockAssets}
        />
      </MaskingProvider>
    );

    expect(screen.queryByRole('button', { name: /추가/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /수정/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /삭제/i })).not.toBeInTheDocument();
  });
});
