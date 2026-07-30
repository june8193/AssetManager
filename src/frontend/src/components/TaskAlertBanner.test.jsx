import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskAlertBanner from './TaskAlertBanner';

describe('TaskAlertBanner 컴포넌트 테스트', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('모든 백그라운드 태스크가 정상(success/pending)일 때 배너가 노출되지 않아야 합니다', async () => {
    const mockStatus = {
      price_update: { status: 'success', last_error: null },
      db_backup: { status: 'pending', last_error: null },
      stock_sync: { status: 'success', last_error: null },
      exchange_rate_update: { status: 'success', last_error: null },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    });

    render(<TaskAlertBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId('task-alert-banner')).not.toBeInTheDocument();
    });
  });

  it('백그라운드 태스크 실패(failed) 상태가 있을 때 경고 배너와 에러 메시지가 노출되어야 합니다', async () => {
    const mockStatus = {
      price_update: { status: 'success', last_error: null },
      db_backup: { status: 'failed', last_error: '디스크 용량 부족' },
      stock_sync: { status: 'pending', last_error: null },
      exchange_rate_update: { status: 'failed', last_error: '키움 API 응답 오류' },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    });

    render(<TaskAlertBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('task-alert-banner')).toBeInTheDocument();
    });

    expect(screen.getByText(/환율 자동 수집 실패/i)).toBeInTheDocument();
    expect(screen.getByText(/키움 API 응답 오류/i)).toBeInTheDocument();
    expect(screen.getByText(/데이터베이스 자동 백업 실패/i)).toBeInTheDocument();
    expect(screen.getByText(/디스크 용량 부족/i)).toBeInTheDocument();
  });
});
