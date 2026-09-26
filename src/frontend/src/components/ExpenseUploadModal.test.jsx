import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseUploadModal from './ExpenseUploadModal';
import { expenseService } from '../services/expenseService';

vi.mock('../services/expenseService', () => ({
  expenseService: {
    getPaymentMethods: vi.fn(),
    getCategories: vi.fn(),
    getSubCategories: vi.fn(),
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
    expenseService.getSubCategories.mockResolvedValue([]);
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

  it('확정 및 저장 버튼을 클릭하면 commitExpenses가 호출되고 onSuccess 콜백이 실행된다', async () => {
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
      expect(screen.getByText(/확정 및 저장/i)).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /확정 및 저장/i });
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

  it('미리보기 테이블에 2차 카테고리 열 및 관련 셀렉트가 렌더링되지 않는다', async () => {
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

    // 2차 카테고리 헤더가 없어야 함
    expect(screen.queryByText('2차 카테고리')).not.toBeInTheDocument();
  });

  it('업로드 미리보기 테이블에서 거래의 통계 제외 체크박스를 체크하면 카테고리 선택 드롭다운이 disabled 처리되고, 체크 해제 시 다시 활성화된다', async () => {
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

    const checkboxes = screen.getAllByRole('checkbox');
    // mockPreviewResponse: 첫 번째(스타벅스) is_excluded: false, 두 번째(현대카드대금) is_excluded: true
    const starbucksCheckbox = checkboxes[0];
    const cardPayCheckbox = checkboxes[1];

    // 카테고리 셀렉트박스들 (테이블 행 내의 셀렉트박스)
    const catSelects = document.querySelectorAll('tbody select');
    const starbucksCatSelect = catSelects[0];
    const cardPayCatSelect = catSelects[1];

    // 초기 상태: 스타벅스(통계 반영)는 활성화, 현대카드대금(통계 제외)은 비활성화
    expect(starbucksCatSelect).not.toBeDisabled();
    expect(cardPayCatSelect).toBeDisabled();

    // 스타벅스 제외 체크박스 클릭 -> 카테고리 셀렉트 비활성화
    fireEvent.click(starbucksCheckbox);
    expect(starbucksCatSelect).toBeDisabled();

    // 스타벅스 제외 체크박스 다시 클릭 (해제) -> 카테고리 셀렉트 다시 활성화
    fireEvent.click(starbucksCheckbox);
    expect(starbucksCatSelect).not.toBeDisabled();
  });

  it('통계 반영 거래 중 카테고리가 미분류된 거래가 있으면 경고 배너가 표시되고 확정 및 저장 버튼이 비활성화된다', async () => {
    const unclassifiedPreviewResponse = {
      payment_method: mockPaymentMethods[0],
      year_month: '2026-08',
      source_file: '카카오뱅크_명세서.xlsx',
      transactions: [
        {
          transaction_date: '2026-08-01 12:00:00',
          year_month: '2026-08',
          merchant: '미분류 식당',
          amount: 15000,
          original_type: '출금',
          memo: '점심',
          category_id: null,
          is_excluded: false,
        },
        {
          transaction_date: '2026-08-10 18:00:00',
          year_month: '2026-08',
          merchant: '카드대금 결제',
          amount: 350000,
          original_type: '출금',
          memo: '카드대금',
          category_id: null,
          is_excluded: true, // 통계 제외는 카테고리 없어도 허용
        },
      ],
    };
    expenseService.uploadPreview.mockResolvedValueOnce(unclassifiedPreviewResponse);

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

    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: '1' } });

    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText('미분류 식당')).toBeInTheDocument();
    });

    // 경고 배너 노출 확인: "미분류된 거래가 1건 있습니다. 모든 유효 지출에 카테고리를 지정해야 저장할 수 있습니다."
    expect(
      screen.getByText(/미분류된 거래가 1건 있습니다\. 모든 유효 지출에 카테고리를 지정해야 저장할 수 있습니다\./i)
    ).toBeInTheDocument();

    // 확정 및 저장 버튼 비활성화 확인
    const commitBtn = screen.getByRole('button', { name: /확정 및 저장|등록 및 덮어쓰기/i });
    expect(commitBtn).toBeDisabled();

    // 1) 미분류 거래에 카테고리 지정 시 경고 배너가 사라지고 버튼 활성화
    const catSelects = document.querySelectorAll('tbody select');
    const firstCatSelect = catSelects[0];
    fireEvent.change(firstCatSelect, { target: { value: '1' } });

    expect(
      screen.queryByText(/미분류된 거래가 1건 있습니다/i)
    ).not.toBeInTheDocument();
    expect(commitBtn).not.toBeDisabled();
  });

  it('통계 제외(is_excluded=True)로 체크된 거래는 카테고리가 없어도 미분류 건수에서 제외되어 버튼이 활성화된다', async () => {
    const unclassifiedPreviewResponse = {
      payment_method: mockPaymentMethods[0],
      year_month: '2026-08',
      source_file: '카카오뱅크_명세서.xlsx',
      transactions: [
        {
          transaction_date: '2026-08-01 12:00:00',
          year_month: '2026-08',
          merchant: '미분류 통계제외 거래',
          amount: 50000,
          original_type: '출금',
          memo: '타행이체',
          category_id: null,
          is_excluded: false,
        },
      ],
    };
    expenseService.uploadPreview.mockResolvedValueOnce(unclassifiedPreviewResponse);

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

    const selectElem = screen.getByRole('combobox');
    fireEvent.change(selectElem, { target: { value: '1' } });

    const parseBtn = screen.getByRole('button', { name: /미리보기 파싱/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText('미분류 통계제외 거래')).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /확정 및 저장|등록 및 덮어쓰기/i });
    expect(commitBtn).toBeDisabled();

    // 통계 제외 체크박스를 클릭하여 제외 처리
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // 경고 배너가 사라지고 버튼이 활성화되어야 함
    expect(
      screen.queryByText(/미분류된 거래가/i)
    ).not.toBeInTheDocument();
    expect(commitBtn).not.toBeDisabled();

    // 저장 버튼 클릭 시 commitExpenses 호출 가능 확인
    fireEvent.click(commitBtn);
    await waitFor(() => {
      expect(expenseService.commitExpenses).toHaveBeenCalled();
    });
  });
});


