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
});

