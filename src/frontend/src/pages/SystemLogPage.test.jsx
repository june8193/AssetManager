import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SystemLogPage from './SystemLogPage';
import { systemService } from '../services';

vi.mock('../services', () => ({
  systemService: {
    getLogFiles: vi.fn(),
    getLogContent: vi.fn(),
  },
}));

describe('SystemLogPage', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemService.getLogFiles).mockResolvedValue(mockFiles);
    vi.mocked(systemService.getLogContent).mockResolvedValue(mockContent);
  });

  it('로그 파일 목록 및 로그 라인을 정상적으로 렌더링한다', async () => {
    render(<SystemLogPage />);

    expect(screen.getByText('시스템 로그 보기')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Application started/i)).toBeDefined();
      expect(screen.getByText(/Failed connection/i)).toBeDefined();
    });
  });

  it('로그 레벨 필터 및 키워드 검색 시 systemService.getLogContent에 올바른 옵션을 전달한다', async () => {
    render(<SystemLogPage />);

    await waitFor(() => {
      expect(systemService.getLogContent).toHaveBeenCalledWith('app.log', { lines: 100 });
    });

    // 로그 레벨 필터 변경
    const levelSelect = screen.getByLabelText('로그 레벨 필터');
    fireEvent.change(levelSelect, { target: { value: 'ERROR' } });

    await waitFor(() => {
      expect(systemService.getLogContent).toHaveBeenCalledWith('app.log', { lines: 100, level: 'ERROR' });
    });

    // 키워드 검색어 입력 후 제출
    const keywordInput = screen.getByPlaceholderText('검색어 입력...');
    fireEvent.change(keywordInput, { target: { value: 'connection' } });

    const searchBtn = screen.getByLabelText('키워드 검색 실행');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(systemService.getLogContent).toHaveBeenCalledWith('app.log', {
        lines: 100,
        level: 'ERROR',
        keyword: 'connection',
      });
    });
  });

  it('표시 줄 수(Tail) 선택을 변경하면 해당 라인 수로 로그를 다시 조회한다', async () => {
    render(<SystemLogPage />);

    await waitFor(() => {
      expect(systemService.getLogContent).toHaveBeenCalled();
    });

    const tailSelect = screen.getByLabelText('표시 줄 수 (Tail)');
    fireEvent.change(tailSelect, { target: { value: '500' } });

    await waitFor(() => {
      expect(systemService.getLogContent).toHaveBeenCalledWith('app.log', { lines: 500 });
    });
  });
});
