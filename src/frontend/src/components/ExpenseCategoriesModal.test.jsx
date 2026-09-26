import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExpenseCategoriesModal from './ExpenseCategoriesModal';
import { expenseService } from '../services/expenseService';

vi.mock('../services/expenseService', () => ({
  expenseService: {
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

describe('ExpenseCategoriesModal 컴포넌트', () => {
  const mockCategories = [
    { id: 1, name: '식비/카페', color: '#FF6B6B', is_default: true },
    { id: 2, name: '쇼핑', color: '#4ECDC4', is_default: true },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.createCategory.mockResolvedValue({ id: 3, name: '여행', color: '#E056FD' });
    expenseService.updateCategory.mockResolvedValue({ id: 1, name: '식비', color: '#FF6B6B' });
    expenseService.deleteCategory.mockResolvedValue(null);
  });

  it('isOpen이 false이면 렌더링되지 않는다', () => {
    const { container } = render(
      <ExpenseCategoriesModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen이 true이면 카테고리 목록이 렌더링된다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('지출 카테고리 관리')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
      expect(screen.getByText('쇼핑')).toBeInTheDocument();
    });
  });

  it('카테고리 추가 버튼 클릭 시 폼이 표시되고 신규 등록을 수행한다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-cat-button');
    fireEvent.click(addBtn);

    expect(screen.getByText('새 카테고리 추가')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('예: 반려동물, 구독료');
    fireEvent.change(nameInput, { target: { value: '여행' } });

    // 색상 팔레트 클릭
    const colorBtn = screen.getByLabelText('색상 선택: #E056FD');
    fireEvent.click(colorBtn);

    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '여행',
          color: '#E056FD',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('수정 버튼 클릭 시 기존 정보로 폼이 채워지고 수정 저장을 수행한다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByLabelText(/수정:/i);
    fireEvent.click(editBtns[0]);

    expect(screen.getByText('카테고리 정보 수정')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('예: 반려동물, 구독료');
    fireEvent.change(nameInput, { target: { value: '외식/카페' } });

    const submitBtn = screen.getByRole('button', { name: '수정 저장' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.updateCategory).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: '외식/카페',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('삭제 버튼 클릭 시 확인 후 삭제 API를 호출한다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
    });

    const delBtns = screen.getAllByLabelText(/삭제:/i);
    fireEvent.click(delBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(expenseService.deleteCategory).toHaveBeenCalledWith(1);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('닫기 버튼 클릭 시 onClose 콜백이 호출된다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('닫기');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

});
