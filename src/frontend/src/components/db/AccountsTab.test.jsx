import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountsTab from './AccountsTab';

describe('AccountsTab', () => {
  const mockAccounts = [
    { id: 1, user_id: 1, name: '123-456', provider: 'TestBank', alias: 'Main', is_active: true }
  ];
  const mockUsers = [
    { id: 1, name: 'Test User' }
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.endsWith('/accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAccounts),
        });
      }
      if (url.endsWith('/users')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('계좌 목록이 렌더링되어야 한다', async () => {
    render(<AccountsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('123-456')).toBeInTheDocument();
      expect(screen.getByText('TestBank')).toBeInTheDocument();
      // Test User가 드롭다운과 표에 모두 나타나므로 getAllByText 사용
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });
  });

  it('새 계좌 추가 폼이 작동해야 한다', async () => {
    render(<AccountsTab />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('예: 5526-9093')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('예: 5526-9093');
    const providerInput = screen.getByPlaceholderText('예: KB증권');
    const addButton = screen.getByRole('button', { name: /추가/i });

    fireEvent.change(nameInput, { target: { value: '999-999', name: 'name' } });
    fireEvent.change(providerInput, { target: { value: 'NewBank', name: 'provider' } });
    
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/accounts'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('수정 버튼 클릭 시 폼에 데이터가 채워져야 한다', async () => {
    render(<AccountsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('123-456')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('수정');
    fireEvent.click(editButtons[0]);

    expect(screen.getByDisplayValue('123-456')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TestBank')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /저장/i })).toBeInTheDocument();
  });
});
