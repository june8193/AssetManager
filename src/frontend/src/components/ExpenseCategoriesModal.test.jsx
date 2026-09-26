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
    getSubCategories: vi.fn(),
    createSubCategory: vi.fn(),
    updateSubCategory: vi.fn(),
    deleteSubCategory: vi.fn(),
  },
}));

describe('ExpenseCategoriesModal 컴포넌트', () => {
  const mockCategories = [
    { id: 1, name: '식비/카페', color: '#FF6B6B', is_default: true },
    { id: 2, name: '쇼핑', color: '#4ECDC4', is_default: true },
  ];

  const mockSubCategories = [
    { id: 1, name: '구독료', color: '#8B5CF6', is_default: true },
    { id: 2, name: '모임회비', color: '#EC4899', is_default: true },
    { id: 3, name: '경조사', color: '#10B981', is_default: false },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.createCategory.mockResolvedValue({ id: 3, name: '여행', color: '#E056FD' });
    expenseService.updateCategory.mockResolvedValue({ id: 1, name: '식비', color: '#FF6B6B' });
    expenseService.deleteCategory.mockResolvedValue(null);

    expenseService.getSubCategories.mockResolvedValue(mockSubCategories);
    expenseService.createSubCategory.mockResolvedValue({ id: 4, name: '자기계발', color: '#3B82F6' });
    expenseService.updateSubCategory.mockResolvedValue({ id: 3, name: '경조사비', color: '#059669' });
    expenseService.deleteSubCategory.mockResolvedValue(null);
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

  it('2차 카테고리 탭 클릭 시 2차 카테고리 목록이 조회되고 렌더링된다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await waitFor(() => {
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
    });

    const subTabBtn = screen.getByRole('tab', { name: /2차 카테고리/i });
    fireEvent.click(subTabBtn);

    await waitFor(() => {
      expect(expenseService.getSubCategories).toHaveBeenCalled();
      expect(screen.getByText('구독료')).toBeInTheDocument();
      expect(screen.getByText('모임회비')).toBeInTheDocument();
      expect(screen.getByText('경조사')).toBeInTheDocument();
    });
  });

  it('2차 카테고리 탭에서 신규 항목 추가를 수행한다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    // 2차 카테고리 탭으로 전환
    const subTabBtn = screen.getByRole('tab', { name: /2차 카테고리/i });
    fireEvent.click(subTabBtn);

    await waitFor(() => {
      expect(screen.getByText('구독료')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-cat-button');
    fireEvent.click(addBtn);

    expect(screen.getByText('새 2차 카테고리 추가')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/예: 구독료, 모임회비/i);
    fireEvent.change(nameInput, { target: { value: '자기계발' } });

    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.createSubCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '자기계발',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('2차 카테고리 탭에서 기존 항목 수정을 수행한다', async () => {
    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const subTabBtn = screen.getByRole('tab', { name: /2차 카테고리/i });
    fireEvent.click(subTabBtn);

    await waitFor(() => {
      expect(screen.getByText('경조사')).toBeInTheDocument();
    });

    const editBtn = screen.getByLabelText('수정: 경조사');
    fireEvent.click(editBtn);

    expect(screen.getByText('2차 카테고리 정보 수정')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/예: 구독료, 모임회비/i);
    fireEvent.change(nameInput, { target: { value: '경조사비' } });

    const submitBtn = screen.getByRole('button', { name: '수정 저장' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.updateSubCategory).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          name: '경조사비',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('2차 카테고리 기본 항목(is_default)은 삭제 버튼이 비활성화되거나 삭제할 수 없으며, 일반 항목은 삭제 가능하다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ExpenseCategoriesModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    const subTabBtn = screen.getByRole('tab', { name: /2차 카테고리/i });
    fireEvent.click(subTabBtn);

    await waitFor(() => {
      expect(screen.getByText('구독료')).toBeInTheDocument();
      expect(screen.getByText('경조사')).toBeInTheDocument();
    });

    // 기본 항목 '구독료'의 삭제 버튼은 disabled 상태이거나 툴팁 처리됨
    const defaultDelBtn = screen.getByLabelText('삭제: 구독료');
    expect(defaultDelBtn).toBeDisabled();

    // 일반 항목 '경조사' 삭제 클릭
    const normalDelBtn = screen.getByLabelText('삭제: 경조사');
    expect(normalDelBtn).not.toBeDisabled();
    fireEvent.click(normalDelBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(expenseService.deleteSubCategory).toHaveBeenCalledWith(3);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

});
