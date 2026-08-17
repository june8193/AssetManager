import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountsTab from './AccountsTab';
import { dbService } from '../../services';
import { MaskingProvider } from '../../contexts/MaskingContext';

vi.mock('../../services', () => ({
  dbService: {
    getAccounts: vi.fn(),
    getUsers: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

describe('AccountsTab', () => {
  const mockAccounts = [
    { id: 1, user_id: 1, name: '123-456', provider: 'TestBank', alias: 'Main', account_type: 'BROKERAGE', is_active: true }
  ];
  const mockUsers = [
    { id: 1, name: 'Test User' }
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(dbService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dbService.getUsers).mockResolvedValue(mockUsers);
    vi.mocked(dbService.createAccount).mockResolvedValue({ id: 2 });
    vi.mocked(dbService.updateAccount).mockResolvedValue({ id: 1 });
    vi.mocked(dbService.deleteAccount).mockResolvedValue({ message: '삭제되었습니다.' });
    
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('계좌 목록이 렌더링되어야 한다', async () => {
    render(
      <MaskingProvider>
        <AccountsTab />
      </MaskingProvider>
    );
    
    await waitFor(() => {
      // 마스킹이 꺼져있을 때는 원본 이름이 보여야 함
      expect(screen.getByText('123-456')).toBeInTheDocument();
      expect(screen.getByText('TestBank')).toBeInTheDocument();
      expect(screen.getAllByText('BROKERAGE').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    });
  });

  it('새 계좌 추가 폼이 작동해야 한다', async () => {
    render(
      <MaskingProvider>
        <AccountsTab />
      </MaskingProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('예: 5526-9093')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('예: 5526-9093');
    const providerInput = screen.getByPlaceholderText('예: KB증권');
    const typeSelect = screen.getByLabelText('종류');
    const addButton = screen.getByRole('button', { name: /추가/i });

    fireEvent.change(nameInput, { target: { value: '999-999', name: 'name' } });
    fireEvent.change(providerInput, { target: { value: 'NewBank', name: 'provider' } });
    fireEvent.change(typeSelect, { target: { value: 'BANK', name: 'account_type' } });
    
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(dbService.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '999-999',
          provider: 'NewBank',
          account_type: 'BANK',
        })
      );
    });
  });

  it('수정 버튼 클릭 시 폼에 데이터가 채워지고 저장할 수 있어야 한다', async () => {
    render(
      <MaskingProvider>
        <AccountsTab />
      </MaskingProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('123-456')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('수정');
    fireEvent.click(editButtons[0]);

    // 폼 입력값(DisplayValue)은 마스킹되지 않아야 함
    expect(screen.getByDisplayValue('123-456')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TestBank')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BROKERAGE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /저장/i })).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /저장/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(dbService.updateAccount).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: '123-456',
          provider: 'TestBank',
        })
      );
    });
  });
});
