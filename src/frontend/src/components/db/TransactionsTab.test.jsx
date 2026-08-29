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

  it('수량, 단가, 총금액 입력 시 천 단위 구분 쉼표가 렌더링에 표시되어야 한다', async () => {
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
    const totalInput = container.querySelector('input[name="total_amount"]');

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

    const { container } = render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('거래 기록 추가')).toBeInTheDocument();
    });

    const assetSelect = container.querySelector('select[name="asset_id"]');
    const typeSelect = container.querySelector('select[name="type"]');
    const priceInput = container.querySelector('input[name="price"]');

    // 원화예수금(id: 2)으로 자산 변경
    fireEvent.change(assetSelect, { target: { value: '2' } });

    // 유형 옵션이 DEPOSIT, WITHDRAW 만 있는지 확인
    const typeOptions = Array.from(typeSelect.options).map(o => o.value);
    expect(typeOptions).toContain('DEPOSIT');
    expect(typeOptions).toContain('WITHDRAW');
    expect(typeOptions).not.toContain('BUY');
    expect(typeOptions).not.toContain('SELL');

    // 단가 필드가 1로 고정되고 readOnly 상태인지 확인
    expect(priceInput.value).toBe('1');
    expect(priceInput.readOnly).toBe(true);
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

    const { container } = render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('거래 기록 추가')).toBeInTheDocument();
    });

    const assetSelect = container.querySelector('select[name="asset_id"]');
    const currencySelect = container.querySelector('select[name="currency"]');

    // 기본적으로 id: 1(한국 자산)이 세팅되어 있으므로 통화가 KRW이고 disabled여야 함
    expect(currencySelect.value).toBe('KRW');
    expect(currencySelect.disabled).toBe(true);

    // 미국 주식(id: 2)으로 자산 변경
    fireEvent.change(assetSelect, { target: { value: '2' } });

    // 통화가 USD로 자동 변경되고 disabled여야 함
    expect(currencySelect.value).toBe('USD');
    expect(currencySelect.disabled).toBe(true);
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

  it('환전(EXCHANGE) 선택 시 도착 자산 및 적용 환율 필드가 표시되고 자동 연동 계산 및 POST 전송이 성공해야 한다', async () => {
    const customAssets = [
      { id: 1, ticker: 'KRW', name: '원화예수금', country: 'KR' },
      { id: 2, ticker: 'USD', name: '달러예수금', country: 'US' }
    ];
    let requestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions')) {
        if (options && options.method === 'POST') {
          requestBody = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 99 }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAssets) });
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

    const typeSelect = container.querySelector('select[name="type"]');
    
    // 유형에서 환전(EXCHANGE) 선택
    fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

    // 출발 자산, 도착 자산 선택창 및 적용 환율 라벨 노출 확인
    expect(screen.getByText('출발 자산')).toBeInTheDocument();
    expect(screen.getByText('도착 자산')).toBeInTheDocument();
    expect(screen.getByText(/적용 환율/)).toBeInTheDocument();

    const targetAssetSelect = container.querySelector('select[name="target_asset_id"]');
    const quantityInput = container.querySelector('input[name="quantity"]');
    const exchangeRateInput = container.querySelector('input[name="price"]');
    const totalInput = container.querySelector('input[name="total_amount"]');

    // 도착 자산을 USD(id: 2)로 설정
    fireEvent.change(targetAssetSelect, { target: { value: '2' } });

    // 수량 $1,000, 환율 1,350 입력
    fireEvent.change(quantityInput, { target: { value: '1,000' } });
    fireEvent.change(exchangeRateInput, { target: { value: '1,350' } });

    // 총 금액 = 1,000 * 1,350 = 1,350,000 자동 계산 검증
    expect(totalInput.value).toBe('1,350,000');

    // 제출
    const submitButton = screen.getByText('거래 기록 추가');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(requestBody).not.toBeNull();
      expect(requestBody.type).toBe('EXCHANGE');
      expect(requestBody.asset_id.toString()).toBe('1');
      expect(requestBody.target_asset_id.toString()).toBe('2');
      expect(requestBody.quantity).toBe(1000);
      expect(requestBody.total_amount).toBe(1350000);
      expect(requestBody.exchange_rate).toBe(1350);
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

    const { container } = render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('거래 기록 추가')).toBeInTheDocument();
    });

    const typeSelect = container.querySelector('select[name="type"]');
    fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

    const sourceAssetSelect = container.querySelector('select[name="asset_id"]');
    const targetAssetSelect = container.querySelector('select[name="target_asset_id"]');

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

  it('환전(EXCHANGE) 선택 시 Ticker 기반 라벨 변경, readOnly 비활성화 및 지불 금액 실시간 자동계산이 적용되어야 한다', async () => {
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

    const { container } = render(
      <MaskingProvider>
        <TransactionsTab />
      </MaskingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('거래 기록 추가')).toBeInTheDocument();
    });

    const typeSelect = container.querySelector('select[name="type"]');
    fireEvent.change(typeSelect, { target: { value: 'EXCHANGE' } });

    const targetAssetSelect = container.querySelector('select[name="target_asset_id"]');
    fireEvent.change(targetAssetSelect, { target: { value: '2' } });

    // 1. 라벨 변경 검증
    expect(screen.getByText('환전 도착 금액 (수령 수량) USD')).toBeInTheDocument();
    expect(screen.getByText('적용 환율 (1 USD 당 KRW)')).toBeInTheDocument();
    expect(screen.getByText('환전 출발 금액 (지불 금액) KRW')).toBeInTheDocument();

    // 2. readOnly 및 시각적 비활성화 스타일 검증
    const totalInput = container.querySelector('input[name="total_amount"]');
    expect(totalInput.readOnly).toBe(true);
    expect(totalInput.className).toContain('bg-slate-100');
    expect(totalInput.className).toContain('cursor-not-allowed');

    // 3. 수량 * 환율 = 지불 금액 실시간 자동 계산 검증
    const quantityInput = container.querySelector('input[name="quantity"]');
    const priceInput = container.querySelector('input[name="price"]');

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

  it('거래 유형으로 계좌 이체(TRANSFER) 선택 시 이체 폼이 노출되고 POST /transactions/transfer 요청이 성공해야 한다', async () => {
    let transferRequestBody = null;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/transactions/transfer') && options?.method === 'POST') {
        transferRequestBody = JSON.parse(options.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 100 }, { id: 101 }]) });
      }
      if (url.endsWith('/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTransactions) });
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

    const typeSelect = container.querySelector('select[name="type"]');
    fireEvent.change(typeSelect, { target: { value: 'TRANSFER' } });


    await waitFor(() => {
      expect(screen.getByText('출발 계좌')).toBeInTheDocument();
      expect(screen.getByText('도착 계좌')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('이체 실행');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(transferRequestBody).not.toBeNull();
      expect(transferRequestBody.source_account_id).toBeDefined();
      expect(transferRequestBody.target_account_id).toBeDefined();
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

  it('최신 스냅샷 기준일 이전 과거 거래 등록 시도 시 경고 모달이 노출되고 확인 시에만 API가 호출된다', async () => {
    let postCalled = false;
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (url.endsWith('/snapshots/latest')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_snapshot_date: '2026-08-01' }) });
      }
      if (url.endsWith('/transactions')) {
        if (options && options.method === 'POST') {
          postCalled = true;
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 99 }) });
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

    const dateInput = container.querySelector('input[name="transaction_date"]');
    fireEvent.change(dateInput, { target: { value: '2026-07-15' } }); // 최신 스냅샷(2026-08-01) 이전 날짜

    const submitButton = screen.getByText('거래 기록 추가');
    fireEvent.click(submitButton);

    // 경고 모달 노출 확인
    await waitFor(() => {
      expect(screen.getByTestId('past-tx-warning-modal')).toBeInTheDocument();
      expect(screen.getByText(/과거 거래 추가 확인/)).toBeInTheDocument();
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
      if (url.endsWith('/transactions')) {
        if (options?.method === 'POST') {
          postPayload = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 99 }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.endsWith('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      if (url.endsWith('/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve(cashAssets) });
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

    const typeSelect = container.querySelector('select[name="type"]');
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

    // 단가 필드는 1로 고정되고 readOnly 상태인지 확인
    const priceInput = container.querySelector('input[name="price"]');
    expect(priceInput).toHaveValue('1');
    expect(priceInput).toHaveAttribute('readOnly');

    // 수량에 50,000 입력 시 총금액도 50,000 자동 계산되는지 확인
    const quantityInput = container.querySelector('input[name="quantity"]');
    fireEvent.change(quantityInput, { target: { value: '50000' } });

    const totalAmountInput = container.querySelector('input[name="total_amount"]');
    expect(totalAmountInput).toHaveValue('50,000');

    // 등록 버튼 클릭
    const submitBtn = screen.getByText('거래 기록 추가');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postPayload).not.toBeNull();
      expect(postPayload.type).toBe('INTEREST');
      expect(postPayload.quantity).toBe(50000);
      expect(postPayload.price).toBe(1);
      expect(postPayload.total_amount).toBe(50000);
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
});



