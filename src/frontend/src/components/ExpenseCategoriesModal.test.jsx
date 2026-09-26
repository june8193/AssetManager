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
    { id: 3, name: '구독료', color: '#8B5CF6', is_default: true },
    { id: 4, name: '모임회비', color: '#EC4899', is_default: true },
    { id: 5, name: '여행', color: '#E056FD', is_default: false },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.createCategory.mockResolvedValue({ id: 6, name: '반려동물', color: '#10B981' });
    expenseService.updateCategory.mockResolvedValue({ id: 1, name: '식비', color: '#FF6B6B' });
    expenseService.deleteCategory.mockResolvedValue(null);
  });

  it('isOpen이 false이면 렌더링되지 않는다', () => {
    const { container } = render(
      <ExpenseCategoriesModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen이 true이면 카테고리 목록이 렌더링되고 1차/2차 탭이 존재하지 않는다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('지출 카테고리 관리')).toBeInTheDocument();

    // 1차/2차 탭이 존재하지 않아야 함
    expect(screen.queryByRole('tab', { name: /1차 카테고리/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /2차 카테고리/i })).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
      expect(screen.getByText('구독료')).toBeInTheDocument();
      expect(screen.getByText('모임회비')).toBeInTheDocument();
      expect(screen.getByText('여행')).toBeInTheDocument();
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

    const nameInput = screen.getByPlaceholderText(/예: 식비, 구독료, 반려동물/i);
    fireEvent.change(nameInput, { target: { value: '반려동물' } });

    // 색상 팔레트 클릭
    const colorBtn = screen.getByLabelText('색상 선택: #10B981');
    fireEvent.click(colorBtn);

    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '반려동물',
          color: '#10B981',
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

    const nameInput = screen.getByPlaceholderText(/예: 식비, 구독료, 반려동물/i);
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
    fireEvent.click(delBtns[4]); // '여행' 삭제

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(expenseService.deleteCategory).toHaveBeenCalledWith(5);
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
