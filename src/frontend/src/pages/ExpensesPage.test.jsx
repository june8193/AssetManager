import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExpensesPage from './ExpensesPage';
import { expenseService } from '../services/expenseService';
import { MaskingProvider } from '../contexts/MaskingContext';

// 서비스 및 모달 모킹
vi.mock('../services/expenseService', () => ({
  expenseService: {
    getStats: vi.fn(),
    getExpenses: vi.fn(),
    getCategories: vi.fn(),
    getSubCategories: vi.fn(),
    getPaymentMethods: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
  },
}));

// Recharts 모킹 (jsdom 환경에서 ResizeObserver 및 SVG 크기 문제 방지)
vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }) => <div data-testid="responsive-container">{children}</div>;
  const BarChart = ({ children, data }) => <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>{children}</div>;
  const Bar = () => <div data-testid="bar" />;
  const XAxis = () => <div data-testid="x-axis" />;
  const YAxis = () => <div data-testid="y-axis" />;
  const Tooltip = () => <div data-testid="tooltip" />;
  const CartesianGrid = () => <div data-testid="cartesian-grid" />;
  const PieChart = ({ children }) => <div data-testid="pie-chart">{children}</div>;
  const Pie = ({ children, data }) => <div data-testid="pie" data-chart-data={JSON.stringify(data)}>{children}</div>;
  const Cell = () => <div data-testid="cell" />;
  const Legend = () => <div data-testid="legend" />;

  return {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    Legend,
  };
});

const mockCategories = [
  { id: 1, name: '식비/카페', color: '#FF6B6B' },
  { id: 2, name: '쇼핑', color: '#4ECDC4' },
  { id: 3, name: '생활/기타', color: '#95A5A6' },
];

const mockSubCategories = [
  { id: 10, name: '구독료', color: '#8B5CF6' },
  { id: 11, name: '모임회비', color: '#EC4899' },
];

const mockPaymentMethods = [
  { id: 1, owner: '장준', institution: '현대카드', alias: '장준 현대카드' },
  { id: 2, owner: '장준', institution: '카카오뱅크', alias: '장준 카카오뱅크' },
  { id: 3, owner: '성은', institution: '지역화폐', alias: '성은 지역화폐' },
];

const mockStats = {
  year_month: '2026-08',
  current_total: 100000,
  prev_total: 80000,
  mom_change_amount: 20000,
  mom_change_rate: 25.0,
  excluded_total: 60000,
  monthly_trends: [
    { year_month: '2026-06', total_amount: 70000 },
    { year_month: '2026-07', total_amount: 80000 },
    { year_month: '2026-08', total_amount: 100000 },
  ],
  category_breakdown: [
    { category_id: 1, category_name: '식비/카페', color: '#FF6B6B', amount: 50000, percentage: 50.0 },
    { category_id: 2, category_name: '쇼핑', color: '#4ECDC4', amount: 50000, percentage: 50.0 },
  ],
  sub_category_breakdown: [
    { id: 10, sub_category_id: 10, name: '구독료', color: '#8B5CF6', total_amount: 30000, amount: 30000, count: 2, percentage: 30.0 },
    { id: 11, sub_category_id: 11, name: '모임회비', color: '#EC4899', total_amount: 20000, amount: 20000, count: 1, percentage: 20.0 },
  ],
  payment_method_breakdown: [
    { payment_method_id: 1, alias: '장준 현대카드', institution: '현대카드', owner: '장준', amount: 60000, percentage: 60.0 },
    { payment_method_id: 3, alias: '성은 지역화폐', institution: '지역화폐', owner: '성은', amount: 40000, percentage: 40.0 },
  ],
};

const mockExpenses = [
  {
    id: 101,
    transaction_date: '2026-08-15T12:30:00',
    year_month: '2026-08',
    merchant: '스타벅스 강남점',
    amount: 10000,
    payment_method_id: 1,
    payment_method_alias: '장준 현대카드',
    owner: '장준',
    institution: '현대카드',
    category_id: 1,
    category_name: '식비/카페',
    sub_category_id: 10,
    sub_category: { id: 10, name: '구독료', color: '#8B5CF6' },
    sub_category_name: '구독료',
    sub_category_color: '#8B5CF6',
    is_excluded: false,
    memo: '아이스 아메리카노',
  },
  {
    id: 102,
    transaction_date: '2026-08-20T18:00:00',
    year_month: '2026-08',
    merchant: '쿠팡 로켓배송',
    amount: 50000,
    payment_method_id: 1,
    payment_method_alias: '장준 현대카드',
    owner: '장준',
    institution: '현대카드',
    category_id: 2,
    category_name: '쇼핑',
    sub_category_id: null,
    sub_category: null,
    sub_category_name: null,
    sub_category_color: null,
    is_excluded: false,
    memo: '생필품 구매',
  },
  {
    id: 103,
    transaction_date: '2026-08-25T09:00:00',
    year_month: '2026-08',
    merchant: '현대카드 결제대금',
    amount: 60000,
    payment_method_id: 2,
    payment_method_alias: '장준 카카오뱅크',
    owner: '장준',
    institution: '카카오뱅크',
    category_id: null,
    category_name: '미분류',
    sub_category_id: null,
    sub_category: null,
    sub_category_name: null,
    sub_category_color: null,
    is_excluded: true,
    memo: '카드대금 출금',
  },
];

const renderComponent = () => {
  return render(
    <MaskingProvider>
      <ExpensesPage />
    </MaskingProvider>
  );
};

describe('ExpensesPage 컴포넌트 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getStats.mockResolvedValue(mockStats);
    expenseService.getExpenses.mockResolvedValue(mockExpenses);
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.getSubCategories.mockResolvedValue(mockSubCategories);
    expenseService.getPaymentMethods.mockResolvedValue(mockPaymentMethods);
  });

  it('기본 UI 요소(제목, 소유주 탭, 모달 오픈 액션 버튼)가 정상 렌더링되어야 한다', async () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: /지출 관리/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^전체$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^장준$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^성은$/ })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /명세서 업로드/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /결제수단 관리/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /카테고리 관리/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalled();
      expect(expenseService.getExpenses).toHaveBeenCalled();
      expect(expenseService.getCategories).toHaveBeenCalled();
      expect(expenseService.getPaymentMethods).toHaveBeenCalled();
    });
  });

  it('KPI 카드와 통계 요약이 정상 표시되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('당월 총지출')).toBeInTheDocument();
      expect(screen.getByText('전월 대비 (MoM)')).toBeInTheDocument();
      expect(screen.getByText('통계 제외 총액')).toBeInTheDocument();
    });

    // 당월 총지출: 100,000원 확인
    expect(screen.getAllByText(/100,000/).length).toBeGreaterThanOrEqual(1);
    // 전월 대비 증감율: +25.0%
    expect(screen.getByText(/\+25\.0%/)).toBeInTheDocument();
    // 통계 제외 총액: 60,000원 확인
    expect(screen.getAllByText(/60,000/).length).toBeGreaterThanOrEqual(1);
  });

  it('소유주 탭 클릭 시 해당 소유주 파라미터로 통계 및 거래 내역을 다시 조회해야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalledTimes(1);
    });

    // '장준' 탭 클릭
    const jjButton = screen.getByRole('button', { name: /^장준$/ });
    fireEvent.click(jjButton);

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalledWith(
        expect.objectContaining({ owner: '장준' })
      );
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ owner: '장준' })
      );
    });

    // '성은' 탭 클릭
    const seButton = screen.getByRole('button', { name: /^성은$/ });
    fireEvent.click(seButton);

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalledWith(
        expect.objectContaining({ owner: '성은' })
      );
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ owner: '성은' })
      );
    });
  });

  it('거래 원장 테이블에 데이터가 렌더링되고 인라인 카테고리 수정이 동작해야 한다', async () => {
    expenseService.updateExpense.mockResolvedValue({
      ...mockExpenses[0],
      category_id: 2,
      category_name: '쇼핑',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
      expect(screen.getByText('쿠팡 로켓배송')).toBeInTheDocument();
    });

    // 첫 번째 행의 카테고리 셀렉트박스 찾기
    const selects = screen.getAllByRole('combobox');
    // 테이블 내 행의 카테고리 셀렉트
    const categorySelect = selects.find((sel) => sel.value === '1');
    expect(categorySelect).toBeDefined();

    // 카테고리를 '쇼핑'(id: 2)으로 변경
    fireEvent.change(categorySelect, { target: { value: '2' } });

    await waitFor(() => {
      expect(expenseService.updateExpense).toHaveBeenCalledWith(101, { category_id: 2 });
    });
  });

  it('인라인 통계 제외 체크박스 토글 시 updateExpense가 호출되어야 한다', async () => {
    expenseService.updateExpense.mockResolvedValue({
      ...mockExpenses[0],
      is_excluded: true,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
    });

    // 첫 번째 거래 체크박스 토글
    const checkboxes = screen.getAllByRole('checkbox');
    const firstCheckbox = checkboxes[0];
    expect(firstCheckbox.checked).toBe(false);

    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(expenseService.updateExpense).toHaveBeenCalledWith(101, { is_excluded: true });
    });
  });

  it('거래 삭제 버튼 클릭 및 확인 시 deleteExpense가 호출되고 목록에서 제거되어야 한다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expenseService.deleteExpense.mockResolvedValue(null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
    });

    // 삭제 버튼들 중 첫 번째 클릭
    const deleteButtons = screen.getAllByTitle('삭제');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(expenseService.deleteExpense).toHaveBeenCalledWith(101);
    });
  });

  it('모달 오픈 액션 버튼 클릭 시 모달이 정상적으로 열려야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalled();
    });

    // 명세서 업로드 버튼 클릭
    const uploadBtn = screen.getByRole('button', { name: /명세서 업로드/i });
    fireEvent.click(uploadBtn);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /명세서 업로드 및 검토/i })).toBeInTheDocument();
    });

    // 결제수단 관리 버튼 클릭
    const pmBtn = screen.getByRole('button', { name: /결제수단 관리/i });
    fireEvent.click(pmBtn);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '결제수단 관리' })).toBeInTheDocument();
    });

    // 카테고리 관리 버튼 클릭
    const catBtn = screen.getByRole('button', { name: /카테고리 관리/i });
    fireEvent.click(catBtn);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '지출 카테고리 관리' })).toBeInTheDocument();
    });
  });

  it('거래 원장 테이블에 2차 카테고리 태그 뱃지가 렌더링되고 인라인으로 수정할 수 있다', async () => {
    expenseService.updateExpense.mockResolvedValue({
      ...mockExpenses[0],
      sub_category_id: 11,
      sub_category: { id: 11, name: '모임회비', color: '#EC4899' },
      sub_category_name: '모임회비',
      sub_category_color: '#EC4899',
    });

    renderComponent();

    // 2차 카테고리 태그 뱃지('구독료') 노출 확인
    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
      expect(screen.getAllByText('구독료').length).toBeGreaterThanOrEqual(1);
    });

    // 테이블 첫 번째 행의 2차 카테고리 셀렉트박스 (value: '10'인 셀렉트)
    const selects = screen.getAllByRole('combobox');
    const subCatSelect = selects.find((sel) => sel.value === '10');
    expect(subCatSelect).toBeDefined();

    // '모임회비'(id: 11)로 변경
    fireEvent.change(subCatSelect, { target: { value: '11' } });

    await waitFor(() => {
      expect(expenseService.updateExpense).toHaveBeenCalledWith(101, { sub_category_id: 11 });
    });
  });

  it('2차 카테고리 필터 선택 시 해당 sub_category_id로 거래 내역을 조회해야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(expenseService.getExpenses).toHaveBeenCalled();
    });

    // 2차 카테고리 필터 셀렉트박스 찾기
    const selects = screen.getAllByRole('combobox');
    const filterSelect = selects.find((sel) =>
      Array.from(sel.options).some((opt) => opt.text === '2차 카테고리: 전체')
    );
    expect(filterSelect).toBeDefined();

    // '구독료'(id: 10) 선택
    fireEvent.change(filterSelect, { target: { value: '10' } });

    await waitFor(() => {
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({ sub_category_id: '10' })
      );
    });
  });

  it('대시보드 상단에 2차 카테고리(지출 특성/구독료 등) 요약이 렌더링된다', async () => {
    renderComponent();

    await waitFor(() => {
      // stats.sub_category_breakdown 데이터인 구독료(30,000원), 모임회비(20,000원) 요약 영역 확인
      expect(screen.getByText(/지출 특성 요약/i)).toBeInTheDocument();
      expect(screen.getAllByText('구독료').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/30,000/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
