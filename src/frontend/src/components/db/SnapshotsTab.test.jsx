import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SnapshotsTab from './SnapshotsTab';
import { MaskingProvider } from '../../contexts/MaskingContext';

// fetch 모킹
global.fetch = vi.fn();

const mockAccounts = [
  { id: 1, name: '증권계좌1', provider: 'KB', account_type: 'BROKERAGE', is_active: true },
  { id: 2, name: '은행계좌1', provider: '신한', account_type: 'BANK', is_active: true }
];

const mockSnapshots = [];

describe('SnapshotsTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetch.mockImplementation((url) => {
      if (url.includes('/snapshots')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSnapshots) });
      if (url.includes('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  const renderComponent = () => render(
    <MaskingProvider>
      <SnapshotsTab />
    </MaskingProvider>
  );

  it('스냅샷 생성 마법사 버튼이 렌더링되어야 함', async () => {
    renderComponent();
    expect(await screen.findByText('스냅샷 생성 마법사')).toBeInTheDocument();
  });

  it('마법사 클릭 시 증권계좌/은행계좌 선택 화면이 표시되어야 함', async () => {
    renderComponent();
    const btn = await screen.findByText('스냅샷 생성 마법사');
    fireEvent.click(btn);
    
    expect(screen.getByText('증권계좌 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('은행계좌 스냅샷')).toBeInTheDocument();
  });

  it('증권계좌 선택 후 다음 단계(기본 설정)로 이동해야 함', async () => {
    renderComponent();
    fireEvent.click(await screen.findByText('스냅샷 생성 마법사'));
    fireEvent.click(screen.getByText('증권계좌 스냅샷'));
    
    expect(screen.getByText(/스냅샷 기본 설정/)).toBeInTheDocument();
    expect(screen.getByLabelText('기준 일자')).toBeInTheDocument();
    expect(screen.getByLabelText(/당일 환율/)).toBeInTheDocument();
  });

  it('기본 설정 입력 후 계좌별 마법사 화면으로 이동해야 함', async () => {
    renderComponent();
    fireEvent.click(await screen.findByText('스냅샷 생성 마법사'));
    fireEvent.click(screen.getByText('증권계좌 스냅샷'));
    
    fireEvent.change(screen.getByLabelText(/당일 환율/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('다음 단계'));
    
    expect(await screen.findByText('증권계좌1')).toBeInTheDocument();
    expect(screen.getByText(/기간 중 내역/)).toBeInTheDocument();
  });

  it('계산 후 기존 내역(existingTransactions)이 렌더링되어야 함', async () => {
    // 1. 마법사 진입 및 설정 완료
    renderComponent();
    fireEvent.click(await screen.findByText('스냅샷 생성 마법사'));
    fireEvent.click(screen.getByText('증권계좌 스냅샷'));
    fireEvent.change(screen.getByLabelText(/당일 환율/), { target: { value: '1350' } });
    fireEvent.click(screen.getByText('다음 단계'));

    // 2. 계산 요청 모킹 (기존 내역 포함)
    const mockCalcResult = {
      theoretical_krw: 1000000,
      theoretical_usd: 1000,
      diff_krw: 5000,
      diff_usd: 5,
      existing_transactions: [
        { transaction_date: '2023-01-01', type: 'DEPOSIT', total_amount: 10000, currency: 'KRW', memo: '기존내역테스트' }
      ]
    };

    fetch.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCalcResult)
    }));

    // 3. 계산 버튼 클릭
    fireEvent.click(screen.getByText(/배당금\/차액 계산하기/));

    // 4. 기존 내역 렌더링 확인
    expect(await screen.findByText('기존내역테스트')).toBeInTheDocument();
    expect(screen.getByText('기존')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });
});
