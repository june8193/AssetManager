import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentMethodsModal from './PaymentMethodsModal';
import { expenseService } from '../services/expenseService';

vi.mock('../services/expenseService', () => ({
  expenseService: {
    getPaymentMethods: vi.fn(),
    createPaymentMethod: vi.fn(),
    updatePaymentMethod: vi.fn(),
    deletePaymentMethod: vi.fn(),
  },
}));

describe('PaymentMethodsModal 컴포넌트', () => {
  const mockMethods = [
    {
      id: 1,
      owner: '장준',
      institution: '카카오뱅크',
      alias: '장준 카카오뱅크',
      account_number: '3333',
      default_password: '950811',
      is_active: true,
    },
    {
      id: 2,
      owner: '장준',
      institution: '현대카드',
      alias: '장준 현대카드',
      account_number: '1002',
      default_password: '950811',
      is_active: true,
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getPaymentMethods.mockResolvedValue(mockMethods);
    expenseService.createPaymentMethod.mockResolvedValue({ id: 3 });
    expenseService.updatePaymentMethod.mockResolvedValue({ id: 1 });
    expenseService.deletePaymentMethod.mockResolvedValue(null);
  });

  it('isOpen이 false이면 렌더링되지 않는다', () => {
    const { container } = render(
      <PaymentMethodsModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen이 true이면 결제수단 목록이 렌더링된다', async () => {
    render(
      <PaymentMethodsModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('결제수단 관리')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('장준 카카오뱅크')).toBeInTheDocument();
      expect(screen.getByText('장준 현대카드')).toBeInTheDocument();
      expect(screen.getByText('3333')).toBeInTheDocument();
    });
  });

  it('결제수단 추가 버튼 클릭 시 폼이 표시되고 신규 등록을 수행한다', async () => {
    render(
      <PaymentMethodsModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('장준 카카오뱅크')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-pm-button');
    fireEvent.click(addBtn);

    expect(screen.getByText('새 결제수단 추가')).toBeInTheDocument();

    // 폼 입력
    const instInput = screen.getByPlaceholderText('예: 현대카드, 카카오뱅크');
    fireEvent.change(instInput, { target: { value: '신한카드' } });

    const aliasInput = screen.getByPlaceholderText('예: 장준 현대카드');
    fireEvent.change(aliasInput, { target: { value: '장준 신한카드' } });

    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.createPaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          institution: '신한카드',
          alias: '장준 신한카드',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('수정 버튼 클릭 시 폼에 기존 값이 채워지고 수정 저장을 수행한다', async () => {
    render(
      <PaymentMethodsModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('장준 카카오뱅크')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByLabelText(/수정:/i);
    fireEvent.click(editBtns[0]);

    expect(screen.getByText('결제수단 정보 수정')).toBeInTheDocument();

    const aliasInput = screen.getByPlaceholderText('예: 장준 현대카드');
    fireEvent.change(aliasInput, { target: { value: '장준 카뱅 수정' } });

    const submitBtn = screen.getByRole('button', { name: '수정 저장' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.updatePaymentMethod).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          alias: '장준 카뱅 수정',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('삭제 버튼 클릭 시 확인 후 삭제 API를 호출한다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <PaymentMethodsModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('장준 카카오뱅크')).toBeInTheDocument();
    });

    const delBtns = screen.getAllByLabelText(/삭제:/i);
    fireEvent.click(delBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(expenseService.deletePaymentMethod).toHaveBeenCalledWith(1);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('닫기 버튼 클릭 시 onClose 콜백이 호출된다', async () => {
    render(
      <PaymentMethodsModal isOpen={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('장준 카카오뱅크')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('닫기');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

});
