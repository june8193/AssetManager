import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import SnapshotsTab from './SnapshotsTab';
import { MaskingProvider } from '../../contexts/MaskingContext';

// useNavigate 모킹
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
    <MemoryRouter>
      <MaskingProvider>
        <SnapshotsTab />
      </MaskingProvider>
    </MemoryRouter>
  );

  it('스냅샷 생성 마법사 버튼이 렌더링되어야 함', async () => {
    renderComponent();
    expect(await screen.findByText('스냅샷 생성 마법사')).toBeInTheDocument();
  });

  it('마법사 클릭 시 신규 스냅샷 페이지로 이동해야 함', async () => {
    renderComponent();
    const btn = await screen.findByText('스냅샷 생성 마법사');
    fireEvent.click(btn);
    
    expect(mockNavigate).toHaveBeenCalledWith('/db/snapshots/new');
  });

  it('스냅샷 목록의 계좌 정보가 금융기관, 계좌명, 종류, 별칭 열로 분리되어 올바르게 렌더링되는지 검증', async () => {
    const customAccounts = [
      { id: 1, name: '123-456', provider: 'KB증권', account_type: 'BROKERAGE', alias: '주식별칭', is_active: true },
      { id: 2, name: '987-654', provider: '신한은행', account_type: 'BANK', alias: '', is_active: true }
    ];
    const activeSnapshots = [
      { id: 10, snapshot_date: '2026-05-28', account_id: 1, period_deposit: 1000, total_valuation: 20000, total_profit: 5000 },
      { id: 11, snapshot_date: '2026-05-28', account_id: 2, period_deposit: 2000, total_valuation: 30000, total_profit: -1000 }
    ];

    fetch.mockImplementation((url) => {
      if (url.includes('/snapshots/latest')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_date: '2026-05-28' }) });
      if (url.includes('/snapshots')) return Promise.resolve({ ok: true, json: () => Promise.resolve(activeSnapshots) });
      if (url.includes('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(customAccounts) });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderComponent();

    // 헤더 검증
    expect(await screen.findByText('금융기관')).toBeInTheDocument();
    expect(await screen.findByText('계좌명')).toBeInTheDocument();
    expect(await screen.findByText('종류')).toBeInTheDocument();
    expect(await screen.findByText('별칭')).toBeInTheDocument();

    // 1번 계좌 데이터 검증
    expect(await screen.findByText('KB증권')).toBeInTheDocument();
    expect(await screen.findByText('123-456')).toBeInTheDocument();
    expect(await screen.findByText('BROKERAGE')).toBeInTheDocument();
    expect(await screen.findByText('주식별칭')).toBeInTheDocument();

    // 2번 계좌 데이터 검증 (별칭이 없으므로 '-')
    expect(await screen.findByText('신한은행')).toBeInTheDocument();
    expect(await screen.findByText('987-654')).toBeInTheDocument();
    expect(await screen.findByText('BANK')).toBeInTheDocument();
    expect(await screen.findByText('-')).toBeInTheDocument();
  });
});

