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
      expect(screen.getByText('005930')).toBeInTheDocument();
      expect(screen.getByText('Samsung')).toBeInTheDocument();
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
    let bulkRequestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions/bulk') && options && options.method === 'POST') {
        bulkRequestBody = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 2 }]) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
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
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /일괄 등록/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(bulkRequestBody).not.toBeNull();
      expect(bulkRequestBody.transactions[0].exchange_rate).toBeNull();
    });
  });

  it('계좌 필터와 입력 폼의 계좌 옵션 텍스트 포맷이 올바라야 한다', async () => {
    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const filterSelect = selects[0];
    const draftAccountSelect = screen.getByTestId('draft-account-select-0');

    // 필터 옵션들 검증: 'Bank1 / Acc1 / Alias1', 'Bank2 / Acc2'
    const filterOptions = Array.from(filterSelect.options).map(o => o.text);
    expect(filterOptions).toContain('Bank1 / Acc1 / Alias1');
    expect(filterOptions).toContain('Bank2 / Acc2');

    // 입력 폼(다중 시트 첫 행) 옵션들도 동일하게 적용되어야 하므로 검증
    const draftOptions = Array.from(draftAccountSelect.options).map(o => o.text);
    expect(draftOptions).toContain('Bank1 / Acc1 / Alias1');
    expect(draftOptions).toContain('Bank2 / Acc2');
  });

  it('새 거래 추가 성공 시 날짜, 계좌, 자산, 유형, 통화는 유지되고 수량, 단가, 총금액만 0으로 초기화되어야 한다', async () => {
    let bulkRequestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions/bulk') && options && options.method === 'POST') {
        bulkRequestBody = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 2 }]) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
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
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const quantityInput = screen.getByTestId('draft-quantity-input-0');
    const priceInput = screen.getByTestId('draft-price-input-0');
    const dateInput = screen.getByTestId('draft-date-input-0');
    const typeSelect = screen.getByTestId('draft-type-select-0');

    fireEvent.change(quantityInput, { target: { value: '50' } });
    fireEvent.change(priceInput, { target: { value: '200' } });
    fireEvent.change(dateInput, { target: { value: '2026-05-28' } });
    fireEvent.change(typeSelect, { target: { value: 'SELL' } });

    // 추가 버튼(일괄 등록) 클릭
    const submitButton = screen.getByRole('button', { name: /일괄 등록/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(bulkRequestBody).not.toBeNull();
    });

    // 일괄 등록 후 기본 1행으로 초기화되고 수량, 단가는 0
    await waitFor(() => {
      expect(screen.getByTestId('draft-quantity-input-0').value).toBe('0');
      expect(screen.getByTestId('draft-price-input-0').value).toBe('0');
    });
  });

  it('수량, 단가, 총금액 입력 시 천 단위 구분 쉼표가 렌더링에 표시되어야 한다', async () => {
    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const quantityInput = screen.getByTestId('draft-quantity-input-0');
    const priceInput = screen.getByTestId('draft-price-input-0');
    const totalInput = screen.getByTestId('draft-total-input-0');

    // 쉼표가 포함된 값을 입력했을 때 정상적으로 쉼표 포맷이 노출되는지 확인
    fireEvent.change(quantityInput, { target: { value: '1,250.5' } });
    expect(quantityInput.value).toBe('1,250.5');

    fireEvent.change(priceInput, { target: { value: '5,000' } });
    expect(priceInput.value).toBe('5,000');

    // 수량(1250.5) * 단가(5000) = 6252500 이므로 쉼표 포맷으로 자동 계산 및 노출되는지 검증
    expect(totalInput.value).toBe('6,252,500');
  });

  it('예수금 자산 선택 시 유형이 입금/출금으로 제한되고 단가가 1로 고정되어야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: '005930', name: 'Samsung', country: 'KR' },
      { id: 2, ticker: 'KRW', name: 'Won Cash', country: 'KR' }
    ];
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const assetSelect = screen.getByTestId('draft-asset-select-0');
    const typeSelect = screen.getByTestId('draft-type-select-0');
    const priceInput = screen.getByTestId('draft-price-input-0');

    // 원화예수금(id: 2)으로 자산 변경
    fireEvent.change(assetSelect, { target: { value: '2' } });

    // 유형 옵션이 DEPOSIT, WITHDRAW 등 포함
    const typeOptions = Array.from(typeSelect.options).map(o => o.value);
    expect(typeOptions).toContain('DEPOSIT');
    expect(typeOptions).toContain('WITHDRAW');
    expect(typeOptions).not.toContain('BUY');
    expect(typeOptions).not.toContain('SELL');

    // 단가 필드가 1로 고정되고 disabled/readOnly 상태인지 확인
    expect(priceInput.value).toBe('1');
    expect(priceInput.disabled || priceInput.readOnly).toBe(true);
  });

  it('자산 국가에 따라 통화(Currency)가 자동 매핑되고 비활성화되어야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: '005930', name: 'Samsung', country: 'KR' },
      { id: 2, ticker: 'KO', name: 'CocaCola', country: 'US' }
    ];
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const assetSelect = screen.getByTestId('draft-asset-select-0');

    // 기본적으로 id: 1(한국 자산)이 세팅되어 있으므로 통화가 KRW 표시
    expect(screen.getByTestId('draft-currency-0')).toHaveTextContent('KRW');

    // 미국 주식(id: 2)으로 자산 변경
    fireEvent.change(assetSelect, { target: { value: '2' } });

    // 통화가 USD로 자동 변경
    expect(screen.getByTestId('draft-currency-0')).toHaveTextContent('USD');
  });

  it('API 호출 실패 시 에러 경고 배너가 표시되어야 한다', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: false, status: 500 });
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
      expect(screen.getByText(/거래 내역을 불러오는데 실패했습니다/)).toBeInTheDocument();
    });
  });

  it('환전(EXCHANGE) 선택 시 도착 자산 보조 줄이 표시되고 자동 연동 계산 및 POST bulk 전송이 성공해야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: 'KRW', name: '원화예수금', country: 'KR' },
      { id: 2, ticker: 'USD', name: '달러예수금', country: 'US' }
    ];
    let bulkRequestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions/bulk') && options && options.method === 'POST') {
        bulkRequestBody = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 99 }]) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const typeSelect = screen.getByTestId('draft-type-select-0');
    
    // 유형에서 환전(EXCHANGE) 선택
    fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

    // 보조 줄 확장 렌더링 확인
    expect(screen.getByTestId('draft-subrow-exchange-0')).toBeInTheDocument();

    const targetAssetSelect = screen.getByTestId('draft-target-asset-select-0');
    const quantityInput = screen.getByTestId('draft-quantity-input-0');
    const exchangeRateInput = screen.getByTestId('draft-price-input-0');
    const totalInput = screen.getByTestId('draft-total-input-0');

    // 도착 자산을 USD(id: 2)로 설정
    fireEvent.change(targetAssetSelect, { target: { value: '2' } });

    // 수량 $1,000, 환율 1,350 입력
    fireEvent.change(quantityInput, { target: { value: '1,000' } });
    fireEvent.change(exchangeRateInput, { target: { value: '1,350' } });

    // 총 금액 = 1,000 * 1,350 = 1,350,000 자동 계산 검증
    expect(totalInput.value).toBe('1,350,000');

    // 일괄 등록 버튼 클릭
    const submitButton = screen.getByRole('button', { name: /일괄 등록/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(bulkRequestBody).not.toBeNull();
      const tx = bulkRequestBody.transactions[0];
      expect(tx.type).toBe('EXCHANGE');
      expect(tx.asset_id.toString()).toBe('1');
      expect(tx.target_asset_id.toString()).toBe('2');
      expect(tx.quantity).toBe(1000);
      expect(tx.total_amount).toBe(1350000);
      expect(tx.exchange_rate).toBe(1350);
    });
  });

  it('환전(EXCHANGE) 선택 시 출발 및 도착 자산 드롭다운에 현금(CASH) 자산만 필터링되고 출발 자산이 도착 자산에서 제외되어야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: 'KRW', name: '원화예수금', category: 'CASH', country: 'KR' },
      { id: 2, ticker: 'USD', name: '달러예수금', category: 'CASH', country: 'US' },
      { id: 3, ticker: 'AAPL', name: '애플 주식', category: 'STOCK', country: 'US' }
    ];
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const typeSelect = screen.getByTestId('draft-type-select-0');
    fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

    const sourceAssetSelect = screen.getByTestId('draft-asset-select-0');
    const targetAssetSelect = screen.getByTestId('draft-target-asset-select-0');

    // 출발 자산 옵션에 AAPL이 없어야 함
    const sourceOptions = Array.from(sourceAssetSelect.querySelectorAll('option')).map(opt => opt.value);
    expect(sourceOptions).toContain('1');
    expect(sourceOptions).toContain('2');
    expect(sourceOptions).not.toContain('3');

    // 출발 자산이 1(KRW)일 때 도착 자산 옵션에는 2(USD)만 있고 1(KRW), 3(AAPL)은 없어야 함
    const targetOptions = Array.from(targetAssetSelect.querySelectorAll('option')).map(opt => opt.value);
    expect(targetOptions).toContain('2');
    expect(targetOptions).not.toContain('1');
    expect(targetOptions).not.toContain('3');
  });

  it('환전(EXCHANGE) 선택 시 보조 줄에 환전 요약 표시 및 지불 금액 실시간 자동계산이 적용되어야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: 'KRW', name: '원화예수금', category: 'CASH', country: 'KR' },
      { id: 2, ticker: 'USD', name: '달러예수금', category: 'CASH', country: 'US' }
    ];
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const typeSelect = screen.getByTestId('draft-type-select-0');
    fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

    const targetAssetSelect = screen.getByTestId('draft-target-asset-select-0');
    fireEvent.change(targetAssetSelect, { target: { value: '2' } });

    // 보조 줄 확인
    expect(screen.getByTestId('draft-subrow-exchange-0')).toBeInTheDocument();

    // readOnly 상태 검증
    const totalInput = screen.getByTestId('draft-total-input-0');
    expect(totalInput.readOnly).toBe(true);

    // 수량 * 환율 = 지불 금액 실시간 자동 계산 검증
    const quantityInput = screen.getByTestId('draft-quantity-input-0');
    const priceInput = screen.getByTestId('draft-price-input-0');

    fireEvent.change(quantityInput, { target: { value: '500' } });
    fireEvent.change(priceInput, { target: { value: '1,300' } });

    expect(totalInput.value).toBe('650,000');
  });

  it('거래 목록 테이블에서 환전(EXCHANGE) 거래 항목이 [출발자산 ➔ 도착자산] 형식과 환율로 표시되어야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: 'KRW', name: '원화예수금', country: 'KR' },
      { id: 2, ticker: 'USD', name: '달러예수금', country: 'US' }
    ];
    const exchangeTx = [
      {
        id: 10,
        account_id: 1,
        asset_id: 1,
        target_asset_id: 2,
        target_asset_name: '달러예수금',
        target_asset_ticker: 'USD',
        transaction_date: '2026-07-30',
        type: 'EXCHANGE',
        quantity: 1000,
        price: 1350,
        total_amount: 1350000,
        currency: 'KRW',
        exchange_rate: 1350
      }
    ];

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(exchangeTx) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('KRW ➔ USD')).toBeInTheDocument();
      expect(screen.getByText('환전')).toBeInTheDocument();
    });
  });

  it('거래 유형으로 계좌 이체(TRANSFER) 선택 시 이체 보조 줄이 노출되고 POST /transactions/bulk 요청이 성공해야 한다', async () => {
    let bulkRequestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions/bulk') && options?.method === 'POST') {
        bulkRequestBody = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 100 }, { id: 101 }]) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
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
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const typeSelect = screen.getByTestId('draft-type-select-0');
    fireEvent.change(typeSelect, { target: { value: 'TRANSFER' } });

    await waitFor(() => {
      expect(screen.getByTestId('draft-subrow-transfer-0')).toBeInTheDocument();
    });

    const totalInput = screen.getByTestId('draft-total-input-0');
    fireEvent.change(totalInput, { target: { value: '50,000' } });

    const submitButton = screen.getByRole('button', { name: /일괄 등록/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(bulkRequestBody).not.toBeNull();
      const tx = bulkRequestBody.transactions[0];
      expect(tx.type).toBe('TRANSFER');
      expect(tx.account_id).toBeDefined();
      expect(tx.target_account_id).toBeDefined();
      expect(tx.total_amount).toBe(50000);
    });
  });

  it('거래 목록 테이블에서 이체 거래 건(transfer_pair_id 존재)에 이체 배지와 상대 계좌 정보가 표시되어야 한다', async () => {
    const transferTxList = [
      {
        id: 20,
        account_id: 1,
        asset_id: 1,
        transaction_date: '2026-08-01',
        type: 'WITHDRAW',
        total_amount: 50000,
        currency: 'KRW',
        transfer_pair_id: 'uuid-1234',
        memo: '이체 메모'
      },
      {
        id: 21,
        account_id: 2,
        asset_id: 1,
        transaction_date: '2026-08-01',
        type: 'DEPOSIT',
        total_amount: 50000,
        currency: 'KRW',
        transfer_pair_id: 'uuid-1234',
        memo: '이체 메모'
      }
    ];

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(transferTxList) });
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
      expect(screen.getByText('WITHDRAW')).toBeInTheDocument();
      expect(screen.getByText('DEPOSIT')).toBeInTheDocument();
      expect(screen.getAllByText('이체')).toHaveLength(2);
      expect(screen.getByText(/➔ Acc2/i)).toBeInTheDocument();
      expect(screen.getByText(/⬅ Acc1/i)).toBeInTheDocument();
    });
  });

  it('source가 AUTO_KIWOOM일 경우 거래 목록에 키움자동 뱃지가 표시되어야 한다', async () => {
    const autoTxList = [
      {
        id: 30,
        account_id: 1,
        asset_id: 1,
        transaction_date: '2026-08-03',
        type: 'BUY',
        quantity: 10,
        price: 50000,
        total_amount: 500000,
        currency: 'KRW',
        source: 'AUTO_KIWOOM',
        memo: '키움 자동저장 (체결)'
      },
      {
        id: 31,
        account_id: 1,
        asset_id: 1,
        transaction_date: '2026-08-03',
        type: 'BUY',
        quantity: 5,
        price: 50000,
        total_amount: 250000,
        currency: 'KRW',
        source: 'MANUAL',
        memo: '수동 저장건'
      }
    ];

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(autoTxList) });
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
      expect(screen.getByText('키움자동')).toBeInTheDocument();
      expect(screen.getByText('수동입력')).toBeInTheDocument();
    });
  });

  it('최신 스냅샷 기준일 이전 과거 거래 등록 시도 시 경고 모달이 노출되고 확인 시에만 bulk API가 호출된다', async () => {
    let postCalled = false;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/snapshots/latest')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_snapshot_date: '2026-08-01' }) });
      }
      if (url.endsWith('/transactions/bulk')) {
        if (options && options.method === 'POST') {
          postCalled = true;
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 99 }]) });
        }
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
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
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const dateInput = screen.getByTestId('draft-date-input-0');
    fireEvent.change(dateInput, { target: { value: '2026-07-15' } }); // 최신 스냅샷(2026-08-01) 이전 날짜

    const submitButton = screen.getByRole('button', { name: /일괄 등록/i });
    fireEvent.click(submitButton);

    // 경고 모달 노출 확인
    await waitFor(() => {
      expect(screen.getByTestId('past-tx-warning-modal')).toBeInTheDocument();
      expect(screen.getByText(/과거 거래 일괄 등록 확인/)).toBeInTheDocument();
    });
    expect(postCalled).toBe(false);

    // 모달에서 확인 클릭 시 API 호출
    const confirmBtn = screen.getByTestId('past-tx-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(postCalled).toBe(true);
      expect(screen.queryByTestId('past-tx-warning-modal')).not.toBeInTheDocument();
    });
  });

  it('과거 거래 삭제 시 경고 모달이 노출되고 취소 클릭 시 삭제가 수행되지 않는다', async () => {
    let deleteCalled = false;
    const pastTxList = [
      { id: 77, account_id: 1, asset_id: 1, transaction_date: '2026-06-10', type: 'BUY', quantity: 10, price: 1000, total_amount: 10000, currency: 'KRW' }
    ];

    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/snapshots/latest')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_snapshot_date: '2026-08-01' }) });
      }
      if (url.endsWith('/transactions/77') && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: '삭제' }) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(pastTxList) });
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
      expect(screen.getByText('2026-06-10')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle('삭제');
    fireEvent.click(deleteBtn);

    // 과거 거래 삭제 경고 모달 노출 확인
    await waitFor(() => {
      expect(screen.getByTestId('past-tx-warning-modal')).toBeInTheDocument();
      expect(screen.getByText(/과거 거래 삭제 확인/)).toBeInTheDocument();
    });
    expect(deleteCalled).toBe(false);

    // 취소 버튼 클릭 시 모달이 닫히고 삭제되지 않음
    const cancelBtn = screen.getByTestId('past-tx-cancel-btn');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('past-tx-warning-modal')).not.toBeInTheDocument();
    });
    expect(deleteCalled).toBe(false);
  });

  it('현금 자산(KRW, USD) 선택 시 이자(INTEREST), 세금(TAX), 현금 보정(CASH_ADJUSTMENT) 유형을 선택할 수 있어야 하고 단가는 1로 고정되어야 한다', async () => {
    let postPayload = null;
    const cashAssets = [
      { id: 10, ticker: 'KRW', name: '원화 현금', category: 'CASH' },
      { id: 20, ticker: 'USD', name: '달러 현금', category: 'CASH' }
    ];

    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions/bulk') && options?.method === 'POST') {
        postPayload = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 99 }]) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(cashAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록/i })).toBeInTheDocument();
    });

    const typeSelect = screen.getByTestId('draft-type-select-0');
    const options = Array.from(typeSelect.options).map(o => o.value);

    // 현금 자산 선택 시 허용되는 옵션 검증
    expect(options).toContain('DEPOSIT');
    expect(options).toContain('WITHDRAW');
    expect(options).toContain('TRANSFER');
    expect(options).toContain('EXCHANGE');
    expect(options).toContain('INTEREST');
    expect(options).toContain('TAX');
    expect(options).toContain('CASH_ADJUSTMENT');

    // 이자(INTEREST) 선택
    fireEvent.change(typeSelect, { target: { value: 'INTEREST' } });

    // 단가 필드는 1로 고정되고 readOnly/disabled 상태인지 확인
    const priceInput = screen.getByTestId('draft-price-input-0');
    expect(priceInput).toHaveValue('1');
    expect(priceInput.readOnly || priceInput.disabled).toBe(true);

    // 수량에 50,000 입력 시 총금액도 50,000 자동 계산되는지 확인
    const quantityInput = screen.getByTestId('draft-quantity-input-0');
    fireEvent.change(quantityInput, { target: { value: '50000' } });

    const totalAmountInput = screen.getByTestId('draft-total-input-0');
    expect(totalAmountInput).toHaveValue('50,000');

    // 등록 버튼 클릭
    const submitBtn = screen.getByRole('button', { name: /일괄 등록/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postPayload).not.toBeNull();
      const tx = postPayload.transactions[0];
      expect(tx.type).toBe('INTEREST');
      expect(tx.quantity).toBe(50000);
      expect(tx.price).toBe(1);
      expect(tx.total_amount).toBe(50000);
    });
  });

  it('이자(INTEREST) 거래는 초록색 뱃지, 세금(TAX) 거래는 빨간색 뱃지로 렌더링되어야 한다', async () => {
    const txList = [
      { id: 101, account_id: 1, asset_id: 10, transaction_date: '2026-08-20', type: 'INTEREST', quantity: 5000, price: 1, total_amount: 5000, currency: 'KRW' },
      { id: 102, account_id: 1, asset_id: 10, transaction_date: '2026-08-21', type: 'TAX', quantity: 700, price: 1, total_amount: 700, currency: 'KRW' }
    ];
    const cashAssets = [{ id: 10, ticker: 'KRW', name: '원화 현금', category: 'CASH' }];

    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(txList) });
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(cashAssets) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('INTEREST')).toBeInTheDocument();
      expect(screen.getByText('TAX')).toBeInTheDocument();
    });

    const interestBadge = screen.getByText('INTEREST');
    const taxBadge = screen.getByText('TAX');

    expect(interestBadge.className).toContain('bg-emerald-50 text-emerald-600');
    expect(taxBadge.className).toContain('bg-red-50 text-red-600');
  });

  describe('이체(TRANSFER) 거래 수정 및 PUT 페이로드 연동', () => {
    const mockAccountsList = [
      { id: 1, name: '출발계좌', provider: 'KB', alias: 'KB계좌' },
      { id: 2, name: '도착계좌', provider: '신한', alias: '신한계좌' },
      { id: 3, name: '제3계좌', provider: '토스', alias: '토스계좌' }
    ];
    const mockAssetsList = [
      { id: 10, ticker: 'KRW', name: '원화 현금', category: 'CASH' }
    ];

    it('이체 출금(WITHDRAW) 행 수정 클릭 시 TRANSFER 유형과 출발/도착 계좌가 자동 매핑되어야 한다', async () => {
      const transferPairTxs = [
        {
          id: 101,
          account_id: 1,
          asset_id: 10,
          transaction_date: '2026-05-01',
          type: 'WITHDRAW',
          quantity: 50000,
          price: 1,
          total_amount: 50000,
          currency: 'KRW',
          transfer_pair_id: 999
        },
        {
          id: 102,
          account_id: 2,
          asset_id: 10,
          transaction_date: '2026-05-01',
          type: 'DEPOSIT',
          quantity: 50000,
          price: 1,
          total_amount: 50000,
          currency: 'KRW',
          transfer_pair_id: 999
        }
      ];

      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(transferPairTxs) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccountsList) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAssetsList) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: '수정' })).toHaveLength(2);
      });

      // 첫 번째 행 (WITHDRAW 행, id: 101) 수정 버튼 클릭
      const editButtons = screen.getAllByRole('button', { name: '수정' });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit-row-101')).toBeInTheDocument();
        expect(screen.getByTestId('inline-subrow-transfer')).toBeInTheDocument();
      });

      const accountSelect = screen.getByTestId('inline-account-select');
      const targetAccountSelect = screen.getByTestId('inline-target-account-select');
      const typeSelect = screen.getByTestId('inline-type-select');

      expect(typeSelect.value).toBe('TRANSFER');
      expect(accountSelect.value).toBe('1');
      expect(targetAccountSelect.value).toBe('2');
    });

    it('이체 입금(DEPOSIT) 행 수정 클릭 시 WITHDRAW 쪽이 출발 계좌, DEPOSIT 쪽이 도착 계좌로 반전 매핑되어야 한다', async () => {
      const transferPairTxs = [
        {
          id: 101,
          account_id: 1,
          asset_id: 10,
          transaction_date: '2026-05-01',
          type: 'WITHDRAW',
          quantity: 50000,
          price: 1,
          total_amount: 50000,
          currency: 'KRW',
          transfer_pair_id: 999
        },
        {
          id: 102,
          account_id: 2,
          asset_id: 10,
          transaction_date: '2026-05-01',
          type: 'DEPOSIT',
          quantity: 50000,
          price: 1,
          total_amount: 50000,
          currency: 'KRW',
          transfer_pair_id: 999
        }
      ];

      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(transferPairTxs) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccountsList) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAssetsList) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: '수정' })).toHaveLength(2);
      });

      // 두 번째 행 (DEPOSIT 행, id: 102) 수정 버튼 클릭
      const editButtons = screen.getAllByRole('button', { name: '수정' });
      fireEvent.click(editButtons[1]);

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit-row-102')).toBeInTheDocument();
        expect(screen.getByTestId('inline-subrow-transfer')).toBeInTheDocument();
      });

      const accountSelect = screen.getByTestId('inline-account-select');
      const targetAccountSelect = screen.getByTestId('inline-target-account-select');
      const typeSelect = screen.getByTestId('inline-type-select');

      expect(typeSelect.value).toBe('TRANSFER');
      expect(accountSelect.value).toBe('1'); // pairTx인 WITHDRAW 행 계좌
      expect(targetAccountSelect.value).toBe('2'); // 본인 DEPOSIT 행 계좌
    });

    it('단일 TRANSFER 행 수정 후 도착 계좌를 변경하여 저장할 때 PUT 요청 payload에 target_account_id, quantity, price 등이 올바르게 전송되어야 한다', async () => {
      const singleTransferTx = [
        {
          id: 201,
          account_id: 1,
          asset_id: 10,
          transaction_date: '2026-05-02',
          type: 'TRANSFER',
          quantity: 30000,
          price: 1,
          total_amount: 30000,
          currency: 'KRW',
          memo: '생활비 이체'
        }
      ];

      let putUrl = null;
      let putPayload = null;

      vi.stubGlobal('fetch', vi.fn((url, options) => {
        if (url.includes('/transactions/201') && options?.method === 'PUT') {
          putUrl = url;
          putPayload = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 201, ...putPayload }) });
        }
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(singleTransferTx) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccountsList) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAssetsList) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
      });

      // 단일 TRANSFER 행 수정 버튼 클릭
      fireEvent.click(screen.getByRole('button', { name: '수정' }));

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit-row-201')).toBeInTheDocument();
        expect(screen.getByTestId('inline-subrow-transfer')).toBeInTheDocument();
      });

      // 도착 계좌를 2에서 3으로 변경
      const targetAccountSelect = screen.getByTestId('inline-target-account-select');
      expect(targetAccountSelect.value).toBe('2'); // findAlternative에 의해 2로 설정됨
      fireEvent.change(targetAccountSelect, { target: { value: '3' } });

      // 이체 금액을 35,000으로 수정
      const totalAmountInput = screen.getByTestId('inline-total-input');
      fireEvent.change(totalAmountInput, { target: { value: '35000' } });

      // 수정 저장 버튼 클릭
      const saveButton = screen.getByRole('button', { name: '인라인 저장' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(putUrl).toContain('/transactions/201');
        expect(putPayload).not.toBeNull();
      });

      expect(putPayload.account_id).toBe(1);
      expect(putPayload.target_account_id).toBe(3);
      expect(putPayload.quantity).toBe(35000);
      expect(putPayload.price).toBe(1);
      expect(putPayload.total_amount).toBe(35000);
      expect(putPayload.type).toBe('TRANSFER');
    });
  });

  describe('하단 거래내역 표 9개 컬럼 및 제자리(In-line) 수정', () => {
    const inlineMockTransactions = [
      {
        id: 1,
        account_id: 1,
        asset_id: 1,
        transaction_date: '2026-04-20',
        type: 'BUY',
        quantity: 10,
        price: 70000,
        total_amount: 700000,
        currency: 'KRW',
        memo: '적립식 매수'
      },
      {
        id: 2,
        account_id: 1,
        asset_id: 2,
        transaction_date: '2026-04-21',
        type: 'DEPOSIT',
        quantity: 500000,
        price: 1,
        total_amount: 500000,
        currency: 'KRW',
        memo: null
      }
    ];

    const inlineMockAccounts = [
      { id: 1, name: '메인 계좌', provider: '토스증권', alias: '토스' },
      { id: 2, name: '서브 계좌', provider: '키움증권', alias: '키움' }
    ];

    const inlineMockAssets = [
      { id: 1, ticker: '005930', name: '삼성전자', category: 'STOCK' },
      { id: 2, ticker: 'KRW', name: '원화 현금', category: 'CASH' },
      { id: 3, ticker: 'USD', name: '달러 현금', category: 'CASH' }
    ];

    it('하단 테이블 헤더가 9개 컬럼으로 렌더링되고 메모 컬럼 및 데이터가 정상 표시되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      // 9개 헤더 컬럼 검증 (상단 시트와 하단 표에 모두 9개 헤더 존재)
      const headers = ['날짜', '계좌', '자산', '유형', '수량', '단가/환율', '총액', '메모', '관리'];
      headers.forEach(h => {
        const matches = screen.getAllByRole('columnheader', { name: new RegExp(h, 'i') });
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });

      // 자산 셀에 티커와 이름 함께 표시
      expect(screen.getByText('005930')).toBeInTheDocument();
      expect(screen.getByText('삼성전자')).toBeInTheDocument();

      // 메모가 없는 행은 '-' 표시
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('행 수정 버튼 클릭 시 해당 행이 제자리 인라인 편집 행으로 전환되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      // 하단 테이블 내 첫 번째 수정 버튼 클릭
      const editButtons = screen.getAllByRole('button', { name: '수정' });
      fireEvent.click(editButtons[0]);

      // 인라인 편집 행 내부 입력 컨트롤 렌더링 확인
      await waitFor(() => {
        expect(screen.getByTestId('inline-edit-row-1')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('적립식 매수')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '인라인 저장' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '인라인 취소' })).toBeInTheDocument();
    });

    it('읽기 전용 행 더블클릭 시 제자리 인라인 편집 행으로 전환되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      const txRow = screen.getByTestId('tx-row-1');
      fireEvent.doubleClick(txRow);

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit-row-1')).toBeInTheDocument();
      });
    });

    it('인라인 편집 중 Esc 키 입력 또는 취소 버튼 클릭 시 원래 읽기 행으로 복귀해야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      // 1번 행 더블클릭으로 인라인 편집 진입
      fireEvent.doubleClick(screen.getByTestId('tx-row-1'));
      expect(screen.getByTestId('inline-edit-row-1')).toBeInTheDocument();

      // 인라인 입력 필드에서 Esc 키 입력
      const memoInput = screen.getByDisplayValue('적립식 매수');
      fireEvent.keyDown(memoInput, { key: 'Escape', code: 'Escape' });

      // 인라인 편집 모드 종료되고 일반 행으로 복원
      await waitFor(() => {
        expect(screen.queryByTestId('inline-edit-row-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('tx-row-1')).toBeInTheDocument();
      });
    });

    it('인라인 편집 중 Enter 키 입력 또는 저장 버튼 클릭 시 PUT 요청을 보내고 정상 저장되어야 한다', async () => {
      let putUrl = null;
      let putBody = null;

      vi.stubGlobal('fetch', vi.fn((url, options) => {
        if (url.includes('/transactions/1') && options?.method === 'PUT') {
          putUrl = url;
          putBody = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, ...putBody }) });
        }
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      fireEvent.doubleClick(screen.getByTestId('tx-row-1'));
      const memoInput = screen.getByDisplayValue('적립식 매수');
      fireEvent.change(memoInput, { target: { value: '메모 수정 완료' } });

      // Enter 키로 저장 트리거
      fireEvent.keyDown(memoInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(putUrl).toContain('/transactions/1');
        expect(putBody).not.toBeNull();
      });
      expect(putBody.memo).toBe('메모 수정 완료');
    });

    it('인라인 편집 중 TRANSFER 선택 시 inline-subrow-transfer가 렌더링되고 도착 계좌를 선택할 수 있어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      fireEvent.doubleClick(screen.getByTestId('tx-row-1'));
      
      // 자산을 현금(KRW)으로 변경하고 유형을 TRANSFER로 변경
      const assetSelect = screen.getByTestId('inline-asset-select');
      fireEvent.change(assetSelect, { target: { value: '2' } });

      const typeSelect = screen.getByTestId('inline-type-select');
      fireEvent.change(typeSelect, { target: { value: 'TRANSFER' } });

      // 보조 설정 줄 inline-subrow-transfer 렌더링 검증
      await waitFor(() => {
        expect(screen.getByTestId('inline-subrow-transfer')).toBeInTheDocument();
      });

      const targetAccountSelect = screen.getByTestId('inline-target-account-select');
      expect(targetAccountSelect).toBeInTheDocument();
      expect(targetAccountSelect.value).toBe('2'); // 출발(1)을 제외한 서브 계좌(2)가 자동 매핑
    });

    it('인라인 편집 중 EXCHANGE 선택 시 inline-subrow-exchange가 렌더링되고 도착 통화를 선택할 수 있어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      fireEvent.doubleClick(screen.getByTestId('tx-row-1'));

      // 자산을 현금(KRW)으로 변경하고 유형을 EXCHANGE로 변경
      const assetSelect = screen.getByTestId('inline-asset-select');
      fireEvent.change(assetSelect, { target: { value: '2' } });

      const typeSelect = screen.getByTestId('inline-type-select');
      fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

      // 보조 설정 줄 inline-subrow-exchange 렌더링 검증
      await waitFor(() => {
        expect(screen.getByTestId('inline-subrow-exchange')).toBeInTheDocument();
      });

      const targetAssetSelect = screen.getByTestId('inline-target-asset-select');
      expect(targetAssetSelect).toBeInTheDocument();
      expect(targetAssetSelect.value).toBe('3'); // 출발(KRW: 2)을 제외한 현금 자산 USD(3) 매핑
    });

    it('과거 스냅샷 기준일 이전 거래를 인라인 수정 저장 시 경고 모달이 노출되고 확인 시에만 PUT API가 호출되어야 한다', async () => {
      let putCalled = false;

      vi.stubGlobal('fetch', vi.fn((url, options) => {
        if (url.includes('/transactions/1') && options?.method === 'PUT') {
          putCalled = true;
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1 }) });
        }
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockTransactions) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(inlineMockAssets) });
        if (url.endsWith('/snapshots/latest')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_snapshot_date: '2026-04-25' }) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('적립식 매수')).toBeInTheDocument();
      });

      // 1번 거래(날짜: 2026-04-20 < 2026-04-25) 행 더블클릭
      fireEvent.doubleClick(screen.getByTestId('tx-row-1'));

      // 인라인 저장 클릭
      fireEvent.click(screen.getByRole('button', { name: '인라인 저장' }));

      // 경고 모달 노출 확인
      await waitFor(() => {
        expect(screen.getByText('과거 거래 수정 확인')).toBeInTheDocument();
      });
      expect(putCalled).toBe(false);

      // 모달의 확인 버튼 클릭
      const confirmButton = screen.getByTestId('past-tx-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(putCalled).toBe(true);
      });
    });
  });

  describe('상단 신규 거래 다중 입력 시트 (Multi-row Input Sheet)', () => {
    const sheetMockAccounts = [
      { id: 1, name: '메인 계좌', provider: '토스증권', alias: '토스' },
      { id: 2, name: '서브 계좌', provider: '키움증권', alias: '키움' }
    ];
    const sheetMockAssets = [
      { id: 1, ticker: '005930', name: '삼성전자', category: 'STOCK' },
      { id: 2, ticker: 'KRW', name: '원화 현금', category: 'CASH' },
      { id: 3, ticker: 'USD', name: '달러 현금', category: 'CASH' }
    ];

    it('초기 데이터 로딩 완료 시 기본 빈 입력 행 1줄이 자동으로 준비되고 상단 계좌 필터를 반영해야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      // 기본 1행 존재 확인
      expect(screen.getByTestId('draft-date-input-0')).toBeInTheDocument();
      expect(screen.getByTestId('draft-account-select-0')).toBeInTheDocument();
      expect(screen.getByTestId('draft-asset-select-0')).toBeInTheDocument();
      expect(screen.getByTestId('draft-type-select-0')).toBeInTheDocument();
      expect(screen.getByTestId('draft-quantity-input-0')).toHaveValue('0');
      expect(screen.getByTestId('draft-total-input-0')).toHaveValue('0');
      expect(screen.getByTestId('draft-memo-input-0')).toHaveValue('');

      // 상단 계좌 필터를 '2'로 변경 시 새 기본 행 준비 상태에서 계좌가 2로 반영되거나 유지되는지 확인
      const selects = screen.getAllByRole('combobox');
      const filterSelect = selects[0];
      fireEvent.change(filterSelect, { target: { value: '2' } });

      // 행 추가 버튼 클릭 시 계좌 2가 기본값으로 사용되는지 검증
      const addRowBtn = screen.getByRole('button', { name: /행 추가/i });
      fireEvent.click(addRowBtn);

      await waitFor(() => {
        expect(screen.getByTestId('draft-account-select-1')).toHaveValue('2');
      });
    });

    it('[+ 행 추가] 버튼 클릭 시 직전 행의 날짜와 계좌를 이어받은 새 행이 추가되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      // 0번 행의 날짜와 계좌를 특정 값으로 변경
      fireEvent.change(screen.getByTestId('draft-date-input-0'), { target: { value: '2026-05-15' } });
      fireEvent.change(screen.getByTestId('draft-account-select-0'), { target: { value: '2' } });

      // [+ 행 추가] 클릭
      const addRowBtn = screen.getByRole('button', { name: /행 추가/i });
      fireEvent.click(addRowBtn);

      // 1번 행 생성 확인 및 날짜, 계좌 직전 행 계승 검증
      await waitFor(() => {
        expect(screen.getByTestId('draft-date-input-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('draft-date-input-1')).toHaveValue('2026-05-15');
      expect(screen.getByTestId('draft-account-select-1')).toHaveValue('2');
      expect(screen.getByTestId('draft-quantity-input-1')).toHaveValue('0');
      expect(screen.getByTestId('draft-memo-input-1')).toHaveValue('');
    });

    it('메모 입력 칸에서 Enter 키를 누르면 직전 행의 날짜와 계좌를 이어받은 새 행이 추가되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('draft-date-input-0'), { target: { value: '2026-06-20' } });
      fireEvent.change(screen.getByTestId('draft-account-select-0'), { target: { value: '2' } });
      const memoInput0 = screen.getByTestId('draft-memo-input-0');
      fireEvent.change(memoInput0, { target: { value: '첫 번째 거래 메모' } });

      // 메모 입력 칸에서 Enter 키 입력
      fireEvent.keyDown(memoInput0, { key: 'Enter', code: 'Enter' });

      // 1번 행 추가 확인 및 직전 행의 날짜, 계좌 계승 확인
      await waitFor(() => {
        expect(screen.getByTestId('draft-date-input-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('draft-date-input-1')).toHaveValue('2026-06-20');
      expect(screen.getByTestId('draft-account-select-1')).toHaveValue('2');
      expect(screen.getByTestId('draft-memo-input-1')).toHaveValue('');
    });

    it('행 삭제 버튼 클릭 시 2개 이상이면 행이 삭제되고, 1개뿐이면 행의 입력값이 초기화되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      // 2개 행 생성
      const addRowBtn = screen.getByRole('button', { name: /행 추가/i });
      fireEvent.click(addRowBtn);
      await waitFor(() => {
        expect(screen.getByTestId('draft-memo-input-1')).toBeInTheDocument();
      });

      // 2개인 상태에서 1번 행 삭제 클릭
      const deleteBtn1 = screen.getByTestId('draft-delete-btn-1');
      fireEvent.click(deleteBtn1);

      // 1번 행 제거되어 총 1개 행만 남음
      await waitFor(() => {
        expect(screen.queryByTestId('draft-memo-input-1')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('draft-memo-input-0')).toBeInTheDocument();

      // 1개만 남은 상태에서 0번 행의 필드 변경 후 삭제 클릭
      fireEvent.change(screen.getByTestId('draft-quantity-input-0'), { target: { value: '123' } });
      fireEvent.change(screen.getByTestId('draft-memo-input-0'), { target: { value: '남아있는 행' } });

      const deleteBtn0 = screen.getByTestId('draft-delete-btn-0');
      fireEvent.click(deleteBtn0);

      // 1개 행 자체는 남아있고 입력값만 초기화됨
      expect(screen.getByTestId('draft-memo-input-0')).toBeInTheDocument();
      expect(screen.getByTestId('draft-quantity-input-0')).toHaveValue('0');
      expect(screen.getByTestId('draft-memo-input-0')).toHaveValue('');
    });

    it('다중 입력 시트에서 TRANSFER 및 EXCHANGE 선택 시 각각의 보조 줄(Sub-row)이 확장 렌더링되어야 한다', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      // 0번 행: 현금 자산(KRW) 선택 후 TRANSFER 선택
      fireEvent.change(screen.getByTestId('draft-asset-select-0'), { target: { value: '2' } });
      fireEvent.change(screen.getByTestId('draft-type-select-0'), { target: { value: 'TRANSFER' } });

      await waitFor(() => {
        expect(screen.getByTestId('draft-subrow-transfer-0')).toBeInTheDocument();
      });
      expect(screen.getByTestId('draft-target-account-select-0')).toHaveValue('2');

      // 1번 행 추가 후 EXCHANGE 선택
      const addRowBtn = screen.getByRole('button', { name: /행 추가/i });
      fireEvent.click(addRowBtn);

      await waitFor(() => {
        expect(screen.getByTestId('draft-type-select-1')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('draft-asset-select-1'), { target: { value: '2' } });
      fireEvent.change(screen.getByTestId('draft-type-select-1'), { target: { value: 'EXCHANGE' } });

      await waitFor(() => {
        expect(screen.getByTestId('draft-subrow-exchange-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('draft-target-asset-select-1')).toHaveValue('3'); // USD
    });

    it('여러 행(일반, TRANSFER, EXCHANGE) 작성 후 [일괄 등록] 클릭 시 POST /api/db/transactions/bulk로 전송되어야 한다', async () => {
      let bulkPayload = null;
      vi.stubGlobal('fetch', vi.fn((url, options) => {
        if (url.endsWith('/transactions/bulk') && options?.method === 'POST') {
          bulkPayload = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }]) });
        }
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      // 0번 행: 일반 매수 (STOCK)
      fireEvent.change(screen.getByTestId('draft-asset-select-0'), { target: { value: '1' } });
      fireEvent.change(screen.getByTestId('draft-type-select-0'), { target: { value: 'BUY' } });
      fireEvent.change(screen.getByTestId('draft-quantity-input-0'), { target: { value: '10' } });
      fireEvent.change(screen.getByTestId('draft-price-input-0'), { target: { value: '70000' } });
      fireEvent.change(screen.getByTestId('draft-memo-input-0'), { target: { value: '삼전 매수' } });

      // 1번 행 추가: TRANSFER
      const addRowBtn = screen.getByRole('button', { name: /행 추가/i });
      fireEvent.click(addRowBtn);

      await waitFor(() => {
        expect(screen.getByTestId('draft-type-select-1')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('draft-asset-select-1'), { target: { value: '2' } });
      fireEvent.change(screen.getByTestId('draft-type-select-1'), { target: { value: 'TRANSFER' } });
      fireEvent.change(screen.getByTestId('draft-total-input-1'), { target: { value: '50000' } });
      fireEvent.change(screen.getByTestId('draft-memo-input-1'), { target: { value: '이체 메모' } });

      // 2번 행 추가: EXCHANGE
      fireEvent.click(addRowBtn);
      await waitFor(() => {
        expect(screen.getByTestId('draft-type-select-2')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('draft-asset-select-2'), { target: { value: '2' } }); // KRW
      fireEvent.change(screen.getByTestId('draft-type-select-2'), { target: { value: 'EXCHANGE' } });
      fireEvent.change(screen.getByTestId('draft-target-asset-select-2'), { target: { value: '3' } }); // USD
      fireEvent.change(screen.getByTestId('draft-quantity-input-2'), { target: { value: '100' } });
      fireEvent.change(screen.getByTestId('draft-price-input-2'), { target: { value: '1350' } });
      fireEvent.change(screen.getByTestId('draft-memo-input-2'), { target: { value: '환전 메모' } });

      // [일괄 등록 (3건)] 클릭
      const bulkSubmitBtn = screen.getByRole('button', { name: /일괄 등록/i });
      expect(bulkSubmitBtn).toHaveTextContent('3건');
      fireEvent.click(bulkSubmitBtn);

      await waitFor(() => {
        expect(bulkPayload).not.toBeNull();
      });

      expect(bulkPayload.transactions).toHaveLength(3);
      // 행 0: BUY
      expect(bulkPayload.transactions[0].type).toBe('BUY');
      expect(bulkPayload.transactions[0].quantity).toBe(10);
      expect(bulkPayload.transactions[0].price).toBe(70000);
      expect(bulkPayload.transactions[0].memo).toBe('삼전 매수');
      // 행 1: TRANSFER
      expect(bulkPayload.transactions[1].type).toBe('TRANSFER');
      expect(bulkPayload.transactions[1].account_id).toBe(1);
      expect(bulkPayload.transactions[1].target_account_id).toBe(2);
      expect(bulkPayload.transactions[1].total_amount).toBe(50000);
      // 행 2: EXCHANGE
      expect(bulkPayload.transactions[2].type).toBe('EXCHANGE');
      expect(bulkPayload.transactions[2].asset_id).toBe(2);
      expect(bulkPayload.transactions[2].target_asset_id).toBe(3);
      expect(bulkPayload.transactions[2].quantity).toBe(100);
      expect(bulkPayload.transactions[2].price).toBe(1350);
      expect(bulkPayload.transactions[2].total_amount).toBe(135000);
    });

    it('다중 입력 행 중 과거 스냅샷 기준일 이전 날짜가 1개 이상 포함된 경우 PastTransactionWarningModal이 1회만 노출되고 확인 시 일괄 전송되어야 한다', async () => {
      let bulkCalled = false;
      vi.stubGlobal('fetch', vi.fn((url, options) => {
        if (url.endsWith('/snapshots/latest')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_snapshot_date: '2026-05-01' }) });
        }
        if (url.endsWith('/transactions/bulk') && options?.method === 'POST') {
          bulkCalled = true;
          return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }, { id: 2 }]) });
        }
        if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAccounts) });
        if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sheetMockAssets) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }));

      render(
        <MaskingProvider>
          <TransactionsTab />
        </MaskingProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('신규 거래 다중 입력')).toBeInTheDocument();
      });

      // 0번 행은 미래 날짜(2026-05-10)
      fireEvent.change(screen.getByTestId('draft-date-input-0'), { target: { value: '2026-05-10' } });

      // 1번 행 추가 및 과거 날짜(2026-04-20 < 2026-05-01)로 설정
      const addRowBtn = screen.getByRole('button', { name: /행 추가/i });
      fireEvent.click(addRowBtn);

      await waitFor(() => {
        expect(screen.getByTestId('draft-date-input-1')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('draft-date-input-1'), { target: { value: '2026-04-20' } });

      // 일괄 등록 클릭
      const bulkSubmitBtn = screen.getByRole('button', { name: /일괄 등록/i });
      fireEvent.click(bulkSubmitBtn);

      // 모달이 1회 노출되는지 확인
      await waitFor(() => {
        expect(screen.getByTestId('past-tx-warning-modal')).toBeInTheDocument();
        expect(screen.getByText(/과거 거래 일괄 등록 확인/)).toBeInTheDocument();
      });
      expect(bulkCalled).toBe(false);

      // 모달 확인 클릭
      const confirmBtn = screen.getByTestId('past-tx-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(bulkCalled).toBe(true);
        expect(screen.queryByTestId('past-tx-warning-modal')).not.toBeInTheDocument();
      });
    });
  });
});
