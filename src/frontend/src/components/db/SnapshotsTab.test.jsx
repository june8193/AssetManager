import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

  it('스냅샷 재계산 버튼 클릭 시 재계산 모달이 열려야 한다', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/snapshots/latest')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_date: '2026-05-28' }) });
      if (url.includes('/snapshots')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderComponent();

    const recalcBtn = await screen.findByRole('button', { name: /스냅샷 재계산/i });
    expect(recalcBtn).toBeInTheDocument();

    fireEvent.click(recalcBtn);

    expect(await screen.findByText('스냅샷 일괄 재계산')).toBeInTheDocument();
  });

  describe('스냅샷 다중 선택 및 일괄 삭제', () => {
    const multiSnapshots = [
      { id: 101, snapshot_date: '2026-05-01', account_id: 1, period_deposit: 0, total_valuation: 10000, total_profit: 0 },
      { id: 102, snapshot_date: '2026-05-02', account_id: 1, period_deposit: 0, total_valuation: 11000, total_profit: 1000 },
      { id: 103, snapshot_date: '2026-05-03', account_id: 1, period_deposit: 0, total_valuation: 12000, total_profit: 2000 },
      { id: 104, snapshot_date: '2026-05-04', account_id: 1, period_deposit: 0, total_valuation: 13000, total_profit: 3000 },
    ];

    beforeEach(() => {
      fetch.mockImplementation((url, options) => {
        if (url.includes('/snapshots/batch') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ deleted_count: 2, deleted_dates: ['2026-05-01', '2026-05-02'], message: '삭제 완료' }),
          });
        }
        if (url.includes('/snapshots/latest')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ latest_date: '2026-05-04' }) });
        if (url.includes('/snapshots')) return Promise.resolve({ ok: true, json: () => Promise.resolve(multiSnapshots) });
        if (url.includes('/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
        return Promise.reject(new Error('Unknown URL: ' + url));
      });
    });

    it('헤더 전체 선택 체크박스 클릭 시 모든 행이 선택/해제되어야 한다', async () => {
      renderComponent();

      const headerCheckbox = await screen.findByTestId('select-all-checkbox');
      expect(headerCheckbox).toBeInTheDocument();
      expect(headerCheckbox).not.toBeChecked();

      // 전체 선택 클릭
      fireEvent.click(headerCheckbox);
      const rowCheckboxes = screen.getAllByRole('checkbox', { name: /행 선택/i });
      expect(rowCheckboxes).toHaveLength(4);
      rowCheckboxes.forEach((cb) => expect(cb).toBeChecked());

      // 선택 삭제 버튼 표시 확인
      expect(screen.getByText(/선택 삭제/)).toBeInTheDocument();

      // 전체 해제 클릭
      fireEvent.click(headerCheckbox);
      rowCheckboxes.forEach((cb) => expect(cb).not.toBeChecked());
      expect(screen.queryByText(/선택 삭제/)).not.toBeInTheDocument();
    });

    it('개별 행 체크박스 선택 시 상단 툴바에 선택 삭제 버튼이 활성화되어야 한다', async () => {
      renderComponent();

      const rowCheckboxes = await screen.findAllByRole('checkbox', { name: /행 선택/i });
      expect(rowCheckboxes).toHaveLength(4);

      // 1번째 행 선택
      fireEvent.click(rowCheckboxes[0]);
      expect(rowCheckboxes[0]).toBeChecked();

      const deleteBtn = screen.getByRole('button', { name: /선택 삭제 \(1개\)/i });
      expect(deleteBtn).toBeInTheDocument();
    });

    it('Shift + 클릭으로 범위 내 모든 행이 일괄 선택되어야 한다', async () => {
      renderComponent();

      const rowCheckboxes = await screen.findAllByRole('checkbox', { name: /행 선택/i });
      expect(rowCheckboxes).toHaveLength(4);

      // index 0 클릭 (시작 지점)
      fireEvent.click(rowCheckboxes[0]);
      expect(rowCheckboxes[0]).toBeChecked();

      // index 2를 Shift 키를 누른 채 클릭 (범위: 0, 1, 2)
      fireEvent.click(rowCheckboxes[2], { shiftKey: true });

      expect(rowCheckboxes[0]).toBeChecked();
      expect(rowCheckboxes[1]).toBeChecked();
      expect(rowCheckboxes[2]).toBeChecked();
      expect(rowCheckboxes[3]).not.toBeChecked();

      expect(screen.getByRole('button', { name: /선택 삭제 \(3개\)/i })).toBeInTheDocument();
    });

    it('선택 삭제 버튼 클릭 및 확인 시 백엔드 일괄 삭제 API를 호출하고 목록을 새로고침해야 한다', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(window, 'alert').mockReturnValue(undefined);

      renderComponent();

      const rowCheckboxes = await screen.findAllByRole('checkbox', { name: /행 선택/i });
      fireEvent.click(rowCheckboxes[0]);
      fireEvent.click(rowCheckboxes[1]);

      const deleteBtn = screen.getByRole('button', { name: /선택 삭제 \(2개\)/i });
      fireEvent.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/snapshots/batch'),
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });
});




