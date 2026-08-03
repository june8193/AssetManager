import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SystemLogPage from './SystemLogPage';

describe('SystemLogPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('로그 파일 목록 및 로그 라인을 정상적으로 렌더링한다', async () => {
    const mockFiles = [
      { name: 'app.log', size_bytes: 1024, modified_at: '2026-08-03T10:00:00' },
    ];
    const mockContent = {
      filename: 'app.log',
      total_lines: 2,
      lines: [
        '2026-08-03 [INFO] Application started',
        '2026-08-03 [ERROR] Failed connection',
      ],
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/system/logs/files')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFiles) });
      }
      if (url.includes('/api/v1/system/logs/content')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockContent) });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<SystemLogPage />);

    expect(screen.getByText('시스템 로그 보기')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Application started/i)).toBeDefined();
      expect(screen.getByText(/Failed connection/i)).toBeDefined();
    });
  });
});
