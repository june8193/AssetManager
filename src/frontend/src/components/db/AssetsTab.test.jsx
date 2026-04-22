import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssetsTab from './AssetsTab';

describe('AssetsTab', () => {
  const mockAssets = [
    { id: 1, ticker: 'AAPL', name: '애플', major_category: 'Stock', sub_category: 'US', country: 'US' }
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 2, ...JSON.parse(options.body) }),
        });
      }
      if (url.endsWith('/assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAssets),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('자산 목록이 렌더링되어야 한다', async () => {
    render(<AssetsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('애플')).toBeInTheDocument();
    });
  });

  it('자산 추가 폼이 작동해야 한다', async () => {
    render(<AssetsTab />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('예: AAPL, 005930')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('예: AAPL, 005930'), { target: { value: 'TSLA', name: 'ticker' } });
    fireEvent.change(screen.getByPlaceholderText('예: 애플, 삼성전자'), { target: { value: '테슬라', name: 'name' } });
    fireEvent.change(screen.getByPlaceholderText('예: 일반주식'), { target: { value: '주식', name: 'major_category' } });
    fireEvent.change(screen.getByPlaceholderText('예: 해외주식'), { target: { value: '해외', name: 'sub_category' } });
    
    fireEvent.click(screen.getByRole('button', { name: /추가/i }));

    await waitFor(() => {
      // POST 호출이 있었는지 확인
      const postCall = vi.mocked(global.fetch).mock.calls.find(call => call[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(postCall[0]).toContain('/assets');
    });
  });
});
