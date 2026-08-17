import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SnapshotRecalculateModal from './SnapshotRecalculateModal';

describe('SnapshotRecalculateModal 컴포넌트', () => {
  const mockAccounts = [
    { id: 1, name: '카카오뱅크', provider: '카카오뱅크', account_type: 'BANK' },
    { id: 2, name: '키움증권', provider: '키움증권', account_type: 'BROKERAGE' },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('모달 기본 폼 요소들이 올바르게 렌더링된다', () => {
    render(
      <SnapshotRecalculateModal
        isOpen={true}
        accounts={mockAccounts}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('스냅샷 일괄 재계산')).toBeInTheDocument();
    expect(screen.getByLabelText('재계산 시작일')).toBeInTheDocument();
    expect(screen.getByLabelText('대상 계좌')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /미리보기/i })).toBeInTheDocument();
  });

  it('미리보기(Dry Run) 실행 시 diff 테이블이 렌더링되고 반영 버튼이 활성화된다', async () => {
    const mockDiffResponse = {
      total_snapshots_evaluated: 2,
      total_snapshots_updated: 1,
      dry_run: true,
      diffs: [
        {
          snapshot_id: 10,
          account_id: 1,
          account_name: '카카오뱅크',
          account_type: 'BANK',
          snapshot_date: '2026-02-01',
          old_period_deposit: 0,
          new_period_deposit: 200000,
          diff_period_deposit: 200000,
          old_period_profit: 0,
          new_period_profit: 4300,
          diff_period_profit: 4300,
          old_total_valuation: 1200000,
          new_total_valuation: 1200000,
          diff_total_valuation: 0,
          is_changed: true,
        },
      ],
      summary_message: '[Dry Run] 2개 스냅샷 검토 완료, 1개 변경 대상 감지',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDiffResponse,
    });

    render(
      <SnapshotRecalculateModal
        isOpen={true}
        accounts={mockAccounts}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const previewBtn = screen.getByRole('button', { name: /미리보기/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/db/snapshots/recalculate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ from_date: null, account_id: null, dry_run: true }),
        })
      );
    });

    expect(await screen.findByText('2026-02-01')).toBeInTheDocument();
    expect(screen.getByText('카카오뱅크')).toBeInTheDocument();
    expect(screen.getByText('1,200,000원')).toBeInTheDocument(); // 평가액 컬럼
    expect(screen.getByRole('button', { name: /재계산 데이터 반영/i })).toBeEnabled();
  });

  it('변경 대상이 없는 경우 정합성 정상 메시지가 표시되고 반영 버튼이 비활성화된다', async () => {
    const mockDiffResponse = {
      total_snapshots_evaluated: 2,
      total_snapshots_updated: 0,
      dry_run: true,
      diffs: [
        {
          snapshot_id: 10,
          account_id: 1,
          account_name: '카카오뱅크',
          account_type: 'BANK',
          snapshot_date: '2026-02-01',
          old_period_deposit: 200000,
          new_period_deposit: 200000,
          diff_period_deposit: 0,
          old_period_profit: 4300,
          new_period_profit: 4300,
          diff_period_profit: 0,
          old_total_valuation: 1200000,
          new_total_valuation: 1200000,
          diff_total_valuation: 0,
          is_changed: false,
        },
      ],
      summary_message: '[Dry Run] 2개 스냅샷 검토 완료, 0개 변경 대상 감지',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDiffResponse,
    });

    render(
      <SnapshotRecalculateModal
        isOpen={true}
        accounts={mockAccounts}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /미리보기/i }));

    expect(await screen.findByText('정합성에 이상이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /재계산 데이터 반영/i })).toBeDisabled();
  });

  it('재계산 데이터 반영 클릭 시 commit(dry_run=false) 요청이 전송되고 onSuccess가 호출된다', async () => {
    const mockDiffResponse = {
      total_snapshots_evaluated: 1,
      total_snapshots_updated: 1,
      dry_run: true,
      diffs: [
        {
          snapshot_id: 10,
          account_id: 1,
          account_name: '카카오뱅크',
          account_type: 'BANK',
          snapshot_date: '2026-02-01',
          old_period_deposit: 0,
          new_period_deposit: 200000,
          diff_period_deposit: 200000,
          old_period_profit: 0,
          new_period_profit: 4300,
          diff_period_profit: 4300,
          old_total_valuation: 1200000,
          new_total_valuation: 1200000,
          diff_total_valuation: 0,
          is_changed: true,
        },
      ],
      summary_message: '[Dry Run] 1개 변경 대상 감지',
    };

    const mockCommitResponse = {
      total_snapshots_evaluated: 1,
      total_snapshots_updated: 1,
      dry_run: false,
      diffs: [],
      summary_message: '1개 스냅샷 갱신 완료',
    };

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiffResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCommitResponse,
      });

    render(
      <SnapshotRecalculateModal
        isOpen={true}
        accounts={mockAccounts}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // 1. 미리보기 클릭
    fireEvent.click(screen.getByRole('button', { name: /미리보기/i }));
    const commitBtn = await screen.findByRole('button', { name: /재계산 데이터 반영/i });

    // 2. 반영 클릭
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/db/snapshots/recalculate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ from_date: null, account_id: null, dry_run: false }),
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});

