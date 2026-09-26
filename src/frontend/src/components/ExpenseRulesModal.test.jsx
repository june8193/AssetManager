import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExpenseRulesModal from './ExpenseRulesModal';
import { expenseService } from '../services/expenseService';

vi.mock('../services/expenseService', () => ({
  expenseService: {
    getRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    getCategories: vi.fn(),
  },
}));

describe('ExpenseRulesModal 컴포넌트', () => {
  const mockCategories = [
    { id: 1, name: '식비/카페', color: '#FF6B6B' },
    { id: 2, name: '쇼핑', color: '#4ECDC4' },
    { id: 3, name: '교통', color: '#45B7D1' },
  ];

  const mockRules = [
    {
      id: 1,
      keyword: '스타벅스',
      category_id: 1,
      category_name: '식비/카페',
      category_color: '#FF6B6B',
      is_excluded: false,
      created_at: '2026-09-20T10:00:00',
    },
    {
      id: 2,
      keyword: '쿠팡',
      category_id: 2,
      category_name: '쇼핑',
      category_color: '#4ECDC4',
      is_excluded: false,
      created_at: '2026-09-21T11:00:00',
    },
    {
      id: 3,
      keyword: '카드대금',
      category_id: null,
      category_name: null,
      category_color: null,
      is_excluded: true,
      created_at: '2026-09-22T12:00:00',
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getRules.mockResolvedValue(mockRules);
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.createRule.mockResolvedValue({
      id: 4,
      keyword: '카카오택시',
      category_id: 3,
      category_name: '교통',
      category_color: '#45B7D1',
      is_excluded: false,
      created_at: '2026-09-26T15:00:00',
    });
    expenseService.updateRule.mockResolvedValue({
      id: 1,
      keyword: '스타벅스코리아',
      category_id: 1,
      category_name: '식비/카페',
      category_color: '#FF6B6B',
      is_excluded: false,
      created_at: '2026-09-20T10:00:00',
    });
    expenseService.deleteRule.mockResolvedValue(null);
  });

  it('isOpen이 false이면 렌더링되지 않는다', () => {
    const { container } = render(
      <ExpenseRulesModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen이 true이면 규칙 목록 및 키워드, 카테고리 태그 또는 통계 제외 뱃지가 렌더링된다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        categories={mockCategories}
      />
    );

    expect(screen.getByText('자동분류 규칙 관리')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
      expect(screen.getByText('쿠팡')).toBeInTheDocument();
      expect(screen.getByText('카드대금')).toBeInTheDocument();
      expect(screen.getByText('통계 제외')).toBeInTheDocument();
      expect(screen.getByText('식비/카페')).toBeInTheDocument();
      expect(screen.getByText('쇼핑')).toBeInTheDocument();
    });
  });

  it('실시간 키워드/카테고리 검색 입력창을 통해 목록을 필터링한다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
      expect(screen.getByText('쿠팡')).toBeInTheDocument();
      expect(screen.getByText('카드대금')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/키워드 또는 카테고리 검색/i);
    fireEvent.change(searchInput, { target: { value: '스타' } });

    expect(screen.getByText('스타벅스')).toBeInTheDocument();
    expect(screen.queryByText('쿠팡')).not.toBeInTheDocument();
    expect(screen.queryByText('카드대금')).not.toBeInTheDocument();

    // 카테고리명 검색
    fireEvent.change(searchInput, { target: { value: '쇼핑' } });
    expect(screen.getByText('쿠팡')).toBeInTheDocument();
    expect(screen.queryByText('스타벅스')).not.toBeInTheDocument();
  });

  it('규칙 추가 폼에서 [카테고리 분류] 규칙을 등록할 수 있다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-rule-button');
    fireEvent.click(addBtn);

    expect(screen.getByText('새 분류 규칙 추가')).toBeInTheDocument();

    // 키워드 입력 (앞뒤 공백 포함)
    const keywordInput = screen.getByPlaceholderText(/예: 쿠팡, 스타벅스, 카드대금/i);
    fireEvent.change(keywordInput, { target: { value: '  카카오택시  ' } });

    // 카테고리 선택
    const categorySelect = screen.getByLabelText('적용 카테고리');
    expect(categorySelect).not.toBeDisabled();
    fireEvent.change(categorySelect, { target: { value: '3' } });

    // 등록 버튼 클릭
    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.createRule).toHaveBeenCalledWith({
        keyword: '카카오택시',
        category_id: 3,
        is_excluded: false,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('규칙 추가 폼에서 [통계 제외] 선택 시 카테고리 선택이 비활성화되고 통계 제외 규칙으로 등록된다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-rule-button');
    fireEvent.click(addBtn);

    // [통계 제외] 라디오 선택
    const excludeRadio = screen.getByLabelText(/통계 제외/i);
    fireEvent.click(excludeRadio);

    // 카테고리 선택 비활성화 확인 및 안내 문구 확인
    const categorySelect = screen.getByLabelText('적용 카테고리');
    expect(categorySelect).toBeDisabled();
    expect(screen.getByText(/통계 집계에서 자동 제외됩니다/i)).toBeInTheDocument();

    // 키워드 입력
    const keywordInput = screen.getByPlaceholderText(/예: 쿠팡, 스타벅스, 카드대금/i);
    fireEvent.change(keywordInput, { target: { value: '타계좌이체' } });

    // 등록 버튼 클릭
    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.createRule).toHaveBeenCalledWith({
        keyword: '타계좌이체',
        category_id: null,
        is_excluded: true,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('유효성 검사: 키워드가 없거나 카테고리 분류에서 카테고리를 선택하지 않으면 에러를 표시한다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-rule-button');
    fireEvent.click(addBtn);

    // 1. 키워드 빈 상태로 제출
    const submitBtn = screen.getByRole('button', { name: '등록하기' });
    fireEvent.click(submitBtn);

    expect(screen.getByText('키워드를 입력해주세요.')).toBeInTheDocument();
    expect(expenseService.createRule).not.toHaveBeenCalled();

    // 2. 키워드 입력 후 카테고리 미선택 상태로 제출
    const keywordInput = screen.getByPlaceholderText(/예: 쿠팡, 스타벅스, 카드대금/i);
    fireEvent.change(keywordInput, { target: { value: '테스트' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('카테고리를 선택해주세요.')).toBeInTheDocument();
    expect(expenseService.createRule).not.toHaveBeenCalled();
  });

  it('수정 버튼 클릭 시 기존 정보가 폼에 채워지고 수정을 완료한다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByLabelText(/수정:/i);
    fireEvent.click(editBtns[0]); // 스타벅스 수정 클릭

    expect(screen.getByText('분류 규칙 정보 수정')).toBeInTheDocument();

    const keywordInput = screen.getByPlaceholderText(/예: 쿠팡, 스타벅스, 카드대금/i);
    expect(keywordInput.value).toBe('스타벅스');

    fireEvent.change(keywordInput, { target: { value: '스타벅스코리아' } });

    const submitBtn = screen.getByRole('button', { name: '수정 저장' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(expenseService.updateRule).toHaveBeenCalledWith(
        1,
        {
          keyword: '스타벅스코리아',
          category_id: 1,
          is_excluded: false,
        }
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('삭제 버튼 클릭 시 확인 창 후 deleteRule API를 호출한다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
    });

    const delBtns = screen.getAllByLabelText(/삭제:/i);
    fireEvent.click(delBtns[0]); // 스타벅스 삭제

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('스타벅스')
    );

    await waitFor(() => {
      expect(expenseService.deleteRule).toHaveBeenCalledWith(1);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('닫기 버튼 클릭 시 onClose 콜백이 호출된다', async () => {
    render(
      <ExpenseRulesModal
        isOpen={true}
        onClose={mockOnClose}
        categories={mockCategories}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('스타벅스')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('닫기');
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
