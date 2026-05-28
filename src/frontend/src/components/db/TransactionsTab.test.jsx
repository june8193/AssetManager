import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionsTab from './TransactionsTab';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('TransactionsTab', () => {
  const mockTransactions = [
    { id: 1, account_id: 1, asset_id: 1, transaction_date: '2026-04-22', type: 'BUY', quantity: 10, price: 100, total_amount: 1000, currency: 'KRW' }
  ];
  const mockAccounts = [
    { id: 1, name: 'Acc1', provider: 'Bank1', alias: 'Alias1' },
    { id: 2, name: 'Acc2', provider: 'Bank2', alias: null }
  ];
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

  it('계좌 필터와 입력 폼의 계좌 옵션 텍스트 포맷이 올바라야 한다', async () => {
    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('계좌 필터:')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const filterSelect = selects[0];
    const formSelect = selects[1]; // 입력 폼의 계좌 선택창

    // 필터 옵션들 검증: 'Bank1 / Acc1 / Alias1', 'Bank2 / Acc2'
    const filterOptions = Array.from(filterSelect.options).map(o => o.text);
    expect(filterOptions).toContain('Bank1 / Acc1 / Alias1');
    expect(filterOptions).toContain('Bank2 / Acc2');

    // 입력 폼 옵션들도 동일하게 적용되어야 하므로 검증
    const formOptions = Array.from(formSelect.options).map(o => o.text);
    expect(formOptions).toContain('Bank1 / Acc1 / Alias1');
    expect(formOptions).toContain('Bank2 / Acc2');
  });

  it('새 거래 추가 성공 시 날짜, 계좌, 자산, 유형, 통화는 유지되고 수량, 단가, 총금액만 0으로 초기화되어야 한다', async () => {
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

    const { container } = render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('거래 기록 추가')).toBeInTheDocument();
    });

    const quantityInput = container.querySelector('input[name="quantity"]');
    const priceInput = container.querySelector('input[name="price"]');
    const dateInput = container.querySelector('input[name="transaction_date"]');
    const typeSelect = container.querySelector('select[name="type"]');

    fireEvent.change(quantityInput, { target: { value: '50' } });
    fireEvent.change(priceInput, { target: { value: '200' } });
    fireEvent.change(dateInput, { target: { value: '2026-05-28' } });
    fireEvent.change(typeSelect, { target: { value: 'SELL' } });

    // 추가 버튼 클릭
    const submitButton = screen.getByText('거래 기록 추가');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(requestBody).not.toBeNull();
    });

    // 수량, 단가, 총금액은 0이 되어야 함
    expect(quantityInput.value).toBe('0');
    expect(priceInput.value).toBe('0');
    
    // 날짜, 유형 등 다른 필드는 유지되어야 함
    expect(dateInput.value).toBe('2026-05-28');
    expect(typeSelect.value).toBe('SELL');
  });
});
