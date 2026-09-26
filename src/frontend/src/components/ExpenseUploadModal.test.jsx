import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseUploadModal from './ExpenseUploadModal';
import { expenseService } from '../services/expenseService';

vi.mock('../services/expenseService', () => ({
  expenseService: {
    getPaymentMethods: vi.fn(),
    getCategories: vi.fn(),
    uploadPreview: vi.fn(),
    commitExpenses: vi.fn(),
  },
}));

describe('ExpenseUploadModal 컴포넌트 테스트', () => {
  const mockPaymentMethods = [
    { id: 1, owner: '장준', institution: '카카오뱅크', alias: '장준 카카오뱅크', account_number: '3333' },
    { id: 2, owner: '장준', institution: '현대카드', alias: '장준 현대카드', account_number: '1002' },
  ];

  const mockCategories = [
    { id: 1, name: '식비/카페', color: '#FF6B6B' },
    { id: 2, name: '쇼핑', color: '#4ECDC4' },
    { id: 3, name: '생활/기타', color: '#95A5A6' },
  ];

  const mockPreviewResponse = {
    payment_method: mockPaymentMethods[0],
    year_month: '2026-08',
    source_file: '카카오뱅크_명세서.xlsx',
    transactions: [
      {
        transaction_date: '2026-08-01 12:00:00',
        year_month: '2026-08',
        merchant: '스타벅스 강남점',
        amount: 6000,
        original_type: '출금',
        memo: '커피',
        category_id: 1,
        is_excluded: false,
      },
      {
        transaction_date: '2026-08-10 18:00:00',
        year_month: '2026-08',
        merchant: '현대카드대금 결제',
        amount: 350000,
        original_type: '출금',
        memo: '카드대금',
        category_id: 3,
        is_excluded: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getPaymentMethods.mockResolvedValue(mockPaymentMethods);
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.uploadPreview.mockResolvedValue(mockPreviewResponse);
    expenseService.commitExpenses.mockResolvedValue({ status: 'success', count: 2 });
  });

  it('모달이 열리면 업로드 드래그앤드롭 영역과 1회성 비밀번호 필드 및 안내문구가 렌더링된다', () => {
    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={vi.fn()}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    expect(screen.getByText(/명세서 업로드 및 검토/i)).toBeInTheDocument();
    expect(screen.getByText(/파일을 드래그하여 놓거나/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/필요 시 복호화 비밀번호 1회 입력/i)).toBeInTheDocument();
    expect(screen.getByText(/암호화된 명세서 복호화에만 1회성으로 사용됩니다/i)).toBeInTheDocument();
    expect(screen.queryByText(/미입력 시 기본 비밀번호 사용/i)).not.toBeInTheDocument();
  });

  it('결제수단 드롭다운에 자동 감지 옵션이 없고 결제수단을 선택해주세요 안내 문구가 기본 표시된다', () => {
    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={vi.fn()}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    // '자동 감지' 문구가 없어야 함
    expect(screen.queryByText(/자동 감지/i)).not.toBeInTheDocument();

    // 기본 플레이스홀더 옵션 확인
    expect(screen.getByText('결제수단을 선택해주세요')).toBeInTheDocument();

    // 등록된 결제수단 옵션들 렌더링 확인
    expect(screen.getByText(/장준 카카오뱅크/i)).toBeInTheDocument();
    expect(screen.getByText(/장준 현대카드/i)).toBeInTheDocument();
  });

  it('결제수단이 선택되지 않으면 파일이 선택되어도 미리보기 파싱 버튼이 비활성화된다', () => {
    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={vi.fn()}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    const file = new File(['dummy content'], 'statement.xlsx', { type: 'application/vnd.ms-excel' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    expect(parseBtn).toBeDisabled();
  });

  it('파일과 결제수단을 모두 선택하고 일회성 비밀번호를 입력하여 미리보기 파싱을 실행하면 정상적으로 호출되고 프리뷰가 렌더링된다', async () => {
    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={vi.fn()}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    const file = new File(['dummy content'], 'statement.xlsx', { type: 'application/vnd.ms-excel' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // 결제수단 선택
    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: '1' } });

    // 파싱 버튼 활성화 확인
    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    expect(parseBtn).not.toBeDisabled();

    // 일회성 비밀번호 입력
    const passwordInput = screen.getByPlaceholderText(/필요 시 복호화 비밀번호 1회 입력/i);
    fireEvent.change(passwordInput, { target: { value: '950811' } });

    // 미리보기 파싱 버튼 클릭
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(expenseService.uploadPreview).toHaveBeenCalledWith(file, '950811', 1);
    });

    // 프리뷰 화면 전환 확인
    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
      expect(screen.getByText('현대카드대금 결제')).toBeInTheDocument();
      expect(screen.getAllByText('2026-08').length).toBeGreaterThan(0);
    });

    // 요약 금액 검증 (전체 356,000원, 통계 포함 6,000원)
    expect(screen.getAllByText(/356,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6,000/).length).toBeGreaterThan(0);
  });


  it('프리뷰 화면에서 카테고리를 변경하고 통계 제외 체크박스를 토글할 수 있다', async () => {
    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={vi.fn()}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    const file = new File(['dummy'], 'statement.xlsx');
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // 결제수단 선택
    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: '1' } });

    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
    });

    // 통계 제외 체크박스 토글 (첫 번째 행 스타벅스를 제외로 토글)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].checked).toBe(false);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].checked).toBe(true);

    // 카테고리 셀렉트 변경 (첫 번째 행을 '쇼핑'으로 변경)
    const categorySelects = screen.getAllByRole('combobox');
    // 첫 번째 combobox는 결제수단 선택 또는 행 카테고리 셀렉트
    const starbucksCatSelect = categorySelects.find(sel => sel.value === '1');
    expect(starbucksCatSelect).toBeInTheDocument();
    fireEvent.change(starbucksCatSelect, { target: { value: '2' } });
    expect(starbucksCatSelect.value).toBe('2');
  });

  it('확정 등록 및 덮어쓰기 버튼을 클릭하면 commitExpenses가 호출되고 onSuccess 콜백이 실행된다', async () => {
    const onSuccessMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={onCloseMock}
        onSuccess={onSuccessMock}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    const file = new File(['dummy'], 'statement.xlsx');
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // 결제수단 선택
    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: '1' } });

    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText(/등록 및 덮어쓰기/i)).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /등록 및 덮어쓰기/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(expenseService.commitExpenses).toHaveBeenCalledTimes(1);
    });

    const commitPayload = expenseService.commitExpenses.mock.calls[0][0];
    expect(commitPayload.payment_method_id).toBe(1);
    expect(commitPayload.year_month).toBe('2026-08');
    expect(commitPayload.items.length).toBe(2);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  it('파싱 실패 시 에러 배너가 노출된다', async () => {
    expenseService.uploadPreview.mockRejectedValueOnce(new Error('비밀번호가 일치하지 않습니다.'));

    render(
      <ExpenseUploadModal
        isOpen={true}
        onClose={vi.fn()}
        paymentMethods={mockPaymentMethods}
        categories={mockCategories}
      />
    );

    const file = new File(['dummy'], 'statement.xlsx');
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // 결제수단 선택
    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: '1' } });

    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText(/비밀번호가 일치하지 않습니다/i)).toBeInTheDocument();
    });
  });

});
