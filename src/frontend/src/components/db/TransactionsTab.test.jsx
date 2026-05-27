import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionsTab from './TransactionsTab';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('TransactionsTab', () => {
  const mockTransactions = [
    { id: 1, account_id: 1, asset_id: 1, transaction_date: '2026-04-22', type: 'BUY', quantity: 10, price: 100, total_amount: 1000, currency: 'KRW' }
  ];
  const mockAccounts = [{ id: 1, name: 'Acc1', provider: 'Bank1' }];
  const mockAssets = [{ id: 1, ticker: '005930', name: 'Samsung' }];

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
  });

  it('거래 내역이 렌더링되어야 한다', async () => {
    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('2026-04-22')).toBeInTheDocument();
      expect(screen.getByText('1,000 KRW')).toBeInTheDocument();
    });
  });

  it('계좌 필터링이 작동해야 한다', async () => {
    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('계좌 필터:')).toBeInTheDocument();
    });

    // 필터 select 요소를 찾음 (첫 번째 select가 필터임)
    const selects = screen.getAllByRole('combobox');
    const filterSelect = selects[0];
    
    fireEvent.change(filterSelect, { target: { value: '1' } });
    
    expect(screen.getByText('2026-04-22')).toBeInTheDocument();
  });

  it('새 거래 기록 추가 시 exchange_rate는 null로 전송되어야 한다', async () => {
    let requestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions')) {
        if (options && options.method === 'POST') {
          requestBody = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 2 }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
      }
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('거래 기록 추가')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('거래 기록 추가');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(requestBody).not.toBeNull();
      expect(requestBody.exchange_rate).toBeNull();
    });
  });
});
