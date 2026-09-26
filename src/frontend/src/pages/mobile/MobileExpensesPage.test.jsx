import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MobileExpensesPage from './MobileExpensesPage';
import { expenseService } from '../../services/expenseService';
import { MaskingProvider } from '../../contexts/MaskingContext';

// expenseService 모킹
vi.mock('../../services/expenseService', () => ({
  expenseService: {
    getStats: vi.fn(),
    getExpenses: vi.fn(),
    getCategories: vi.fn(),
    getPaymentMethods: vi.fn(),
  },
}));

const mockCategories = [
  { id: 1, name: '식비/카페', color: '#FF6B6B' },
  { id: 2, name: '쇼핑', color: '#4ECDC4' },
  { id: 3, name: '생활/기타', color: '#95A5A6' },
  { id: 4, name: '구독료', color: '#8B5CF6' },
];

const mockStats = {
  year_month: '2026-08',
  start_month: '2026-08',
  end_month: '2026-08',
  period_months: 1,
  period_total: 100000,
  monthly_average: 100000,
  prev_period_total: 80000,
  prev_period_change_amount: 20000,
  prev_period_change_rate: 25.0,
  current_total: 100000,
  prev_total: 80000,
  mom_change_amount: 20000,
  mom_change_rate: 25.0,
  excluded_total: 30000,
  monthly_trends: [
    { year_month: '2026-08', total_amount: 100000 },
  ],
  category_breakdown: [
    { category_id: 1, category_name: '식비/카페', color: '#FF6B6B', amount: 50000, percentage: 50.0 },
    { category_id: 2, category_name: '쇼핑', color: '#4ECDC4', amount: 30000, percentage: 30.0 },
    { category_id: 4, category_name: '구독료', color: '#8B5CF6', amount: 20000, percentage: 20.0 },
  ],
  payment_method_breakdown: [
    { payment_method_id: 1, alias: '장준 현대카드', institution: '현대카드', owner: '장준', amount: 100000, percentage: 100.0 },
  ],
};

const mockExpenses = [
  {
    id: 101,
    transaction_date: '2026-08-15',
    year_month: '2026-08',
    merchant: '스타벅스 강남점',
    amount: 12000,
    category_id: 1,
    category_name: '식비/카페',
    owner: '장준',
    payment_method_name: '장준 현대카드',
    institution: '현대카드',
    is_excluded: false,
    memo: '아메리카노 2잔',
  },
  {
    id: 102,
    transaction_date: '2026-08-14',
    year_month: '2026-08',
    merchant: '쿠팡 로켓와우',
    amount: 4990,
    category_id: 4,
    category_name: '구독료',
    owner: '성은',
    payment_method_name: '성은 국민카드',
    institution: '국민카드',
    is_excluded: false,
    memo: '멤버십 결제',
  },
  {
    id: 103,
    transaction_date: '2026-08-10',
    year_month: '2026-08',
    merchant: '현대카드 대금 납부',
    amount: 500000,
    category_id: 3,
    category_name: '생활/기타',
    owner: '장준',
    payment_method_name: '카카오뱅크',
    institution: '카카오뱅크',
    is_excluded: true,
    memo: '카드대금 이체',
  },
];

const renderComponent = () => {
  return render(
    <MaskingProvider>
      <MobileExpensesPage />
    </MaskingProvider>
  );
};

describe('MobileExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expenseService.getStats.mockResolvedValue(mockStats);
    expenseService.getExpenses.mockResolvedValue(mockExpenses);
    expenseService.getCategories.mockResolvedValue(mockCategories);
    expenseService.getPaymentMethods.mockResolvedValue([]);
  });

  it('페이지 헤더, 새로고침 버튼, 소유주 탭 및 기간 프리셋 칩이 정상 렌더링되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /지출 관리/i })).toBeInTheDocument();
    });

    // 새로고침 버튼
    expect(screen.getByRole('button', { name: /새로고침/i })).toBeInTheDocument();

    // 상단 소유주 탭 ('전체', '장준', '성은')
    expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '장준' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '성은' })).toBeInTheDocument();

    // 기간 프리셋 칩 ('당월', '3개월', '6개월', '1년', '올해', '직접 지정 🗓')
    expect(screen.getByRole('button', { name: '당월' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3개월' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6개월' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1년' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '올해' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /직접 지정/i })).toBeInTheDocument();
  });

  it('모바일 요약 카드에 총 지출, 월평균 지출, 직전 동기간 대비 증감률이 렌더링되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('기간 총 지출')).toBeInTheDocument();
    });

    // 기간 총 지출 (₩ 100,000)
    expect(screen.getAllByText(/100,000/).length).toBeGreaterThan(0);

    // 월평균 지출 라벨
    expect(screen.getByText('월평균 지출')).toBeInTheDocument();

    // 직전 동기간 대비 증감률 (+25.0%)
    expect(screen.getByText('+25.0%')).toBeInTheDocument();
  });

  it('모바일 카테고리 비중 랭킹 요약에 카테고리별 누적 금액 및 점유율(%) 프로그레스 바가 표시되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('카테고리별 비중')).toBeInTheDocument();
    });

    // 상위 카테고리명 및 비중 표시
    expect(screen.getAllByText('식비/카페').length).toBeGreaterThan(0);
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();

    expect(screen.getByText('쇼핑')).toBeInTheDocument();
    expect(screen.getAllByText(/30,000/).length).toBeGreaterThan(0);
    expect(screen.getByText('30.0%')).toBeInTheDocument();

    expect(screen.getAllByText('구독료').length).toBeGreaterThan(0);
    expect(screen.getByText(/20,000/)).toBeInTheDocument();
    expect(screen.getByText('20.0%')).toBeInTheDocument();
  });

  it('카드형 거래 내역 리스트에 일자, 가맹점, 소유주/결제수단, 카테고리 뱃지, 금액, 통계 제외 여부가 렌더링되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('스타벅스 강남점')).toBeInTheDocument();
    });

    // 거래 1: 스타벅스 강남점 (유효 지출)
    expect(screen.getByText('2026-08-15')).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(screen.getAllByText('식비/카페').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/장준/i).length).toBeGreaterThan(0);

    // 거래 2: 쿠팡 로켓와우
    expect(screen.getByText('쿠팡 로켓와우')).toBeInTheDocument();
    expect(screen.getByText(/4,990/)).toBeInTheDocument();

    // 거래 3: 현대카드 대금 납부 (통계 제외 거래)
    expect(screen.getByText('현대카드 대금 납부')).toBeInTheDocument();
    expect(screen.getByText(/500,000/)).toBeInTheDocument();
    expect(screen.getByText('통계 제외')).toBeInTheDocument();
  });

  it('기간 프리셋 칩 클릭 시 해당 기간으로 통계 및 거래 내역을 다시 조회해야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '3개월' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '3개월' }));

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalledWith(
        expect.objectContaining({
          start_month: '2026-06',
          end_month: '2026-08',
        })
      );
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({
          start_month: '2026-06',
          end_month: '2026-08',
          limit: 100,
          offset: 0,
        })
      );
    });
  });

  it('소유주 탭 클릭 시 소유주 필터가 적용되어 API를 다시 호출해야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '장준' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '장준' }));

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: '장준',
        })
      );
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: '장준',
        })
      );
    });
  });

  it('직접 지정 🗓 칩 클릭 시 기간 선택기 패널이 토글되고, 시작/종료월 선택 후 조회 시 API가 호출되어야 한다', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /직접 지정/i })).toBeInTheDocument();
    });

    // 초기에는 직접 선택 패널의 '조회' 버튼이 보이지 않음
    expect(screen.queryByRole('button', { name: '조회' })).not.toBeInTheDocument();

    // 직접 지정 칩 클릭하여 패널 열기
    fireEvent.click(screen.getByRole('button', { name: /직접 지정/i }));

    expect(screen.getByLabelText('시작년월 선택')).toBeInTheDocument();
    expect(screen.getByLabelText('종료년월 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회' })).toBeInTheDocument();

    // 시작년월, 종료년월 변경
    fireEvent.change(screen.getByLabelText('시작년월 선택'), { target: { value: '2026-03' } });
    fireEvent.change(screen.getByLabelText('종료년월 선택'), { target: { value: '2026-05' } });

    // 조회 버튼 클릭
    fireEvent.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      expect(expenseService.getStats).toHaveBeenCalledWith(
        expect.objectContaining({
          start_month: '2026-03',
          end_month: '2026-05',
        })
      );
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({
          start_month: '2026-03',
          end_month: '2026-05',
        })
      );
    });
  });

  it('거래 내역이 100건 이상인 경우 내역 더보기 버튼이 렌더링되고 클릭 시 페이징 데이터를 누적 로드해야 한다', async () => {
    // 100건의 거래 내역 모킹
    const mock100Expenses = Array.from({ length: 100 }, (_, i) => ({
      id: 200 + i,
      transaction_date: '2026-08-01',
      year_month: '2026-08',
      merchant: `가맹점 ${i + 1}`,
      amount: 1000 * (i + 1),
      category_id: 1,
      category_name: '식비/카페',
      owner: '장준',
      payment_method_name: '장준 현대카드',
      institution: '현대카드',
      is_excluded: false,
      memo: `메모 ${i + 1}`,
    }));

    const mockNextExpenses = [
      {
        id: 301,
        transaction_date: '2026-07-31',
        year_month: '2026-07',
        merchant: '추가 로드 가맹점',
        amount: 25000,
        category_id: 2,
        category_name: '쇼핑',
        owner: '성은',
        payment_method_name: '성은 국민카드',
        institution: '국민카드',
        is_excluded: false,
        memo: '추가 아이템',
      },
    ];

    expenseService.getExpenses.mockResolvedValueOnce(mock100Expenses);
    expenseService.getExpenses.mockResolvedValueOnce(mockNextExpenses);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('가맹점 1')).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByRole('button', { name: /내역 더보기/i });
    expect(loadMoreButton).toBeInTheDocument();

    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(expenseService.getExpenses).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 100,
          limit: 100,
        })
      );
      expect(screen.getByText('추가 로드 가맹점')).toBeInTheDocument();
      // 기존 100건도 유지되어야 함
      expect(screen.getByText('가맹점 1')).toBeInTheDocument();
    });
  });
});

