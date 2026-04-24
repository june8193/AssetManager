import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { useDashboard } from '../hooks/useDashboard';

// useDashboard 훅 모킹
vi.mock('../hooks/useDashboard');

const mockData = {
  accounts: [
    { id: 1, name: '테스트 계좌', provider: '테스트', total_valuation_krw: 1000000, assets: [] }
  ],
  categories: [
    { 
      category: '주식', 
      value_krw: 1000000,
      sub_categories: [
        { category: '국내주식', value_krw: 600000 },
        { category: '해외주식', value_krw: 400000 }
      ]
    }
  ],
  total_valuation_krw: 1000000,
  exchange_rate: {
    rate: 1300,
    date: '2024-03-20',
    created_at: '2024-03-20T10:00:00Z'
  },
  yearly: [],
  snapshots: []
};

describe('DashboardPage', () => {
  it('새로고침 버튼이 정상적으로 렌더링되고 클릭 시 refresh 함수를 호출한다', () => {
    const refreshMock = vi.fn();
    vi.mocked(useDashboard).mockReturnValue({
      data: mockData,
      loading: false,
      error: null,
      refresh: refreshMock
    });

    render(<DashboardPage />);

    // "새로고침" 텍스트를 가진 버튼 확인
    const refreshButton = screen.getByRole('button', { name: /새로고침/i });
    expect(refreshButton).toBeDefined();
    expect(refreshButton.textContent).toContain('새로고침');

    // 버튼 클릭 시 refresh 함수 호출 확인
    fireEvent.click(refreshButton);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('로딩 중일 때 로딩 메시지를 표시한다', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: vi.fn()
    });

    render(<DashboardPage />);
    expect(screen.getByText(/자산 데이터를 분석 중입니다/i)).toBeDefined();
  });

  it('에러 발생 시 에러 메시지를 표시한다', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: null,
      loading: false,
      error: '데이터 로딩 실패',
      refresh: vi.fn()
    });

    render(<DashboardPage />);
    expect(screen.getByText(/데이터 로딩 실패/i)).toBeDefined();
  });

  it('자산 비중의 대분류를 클릭하면 중분류 세부 항목이 노출된다', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: mockData,
      loading: false,
      error: null,
      refresh: vi.fn()
    });

    render(<DashboardPage />);

    // 대분류 '주식' 확인 (중분류는 처음엔 없어야 함)
    expect(screen.getByText('주식')).toBeDefined();
    expect(screen.queryByText('국내주식')).toBeNull();

    // '주식' 클릭
    fireEvent.click(screen.getByText('주식'));

    // 중분류 노출 확인
    expect(screen.getByText('국내주식')).toBeDefined();
    expect(screen.getByText('해외주식')).toBeDefined();
    expect(screen.getByText('60.0%')).toBeDefined(); // (600,000 / 1,000,000)
  });

  it('계좌 확장 후 자산 목록을 정렬할 수 있다', () => {
    const mockDataWithAssets = {
      ...mockData,
      accounts: [
        {
          id: 1,
          name: '테스트 계좌',
          provider: '테스트',
          total_valuation_krw: 3000,
          assets: [
            { ticker: 'B', name: '자산B', category: '주식', valuation_krw: 1000, quantity: 1, price: 1000, country: 'KR' },
            { ticker: 'A', name: '자산A', category: '현금', valuation_krw: 2000, quantity: 1, price: 2000, country: 'KR' },
          ]
        }
      ]
    };

    vi.mocked(useDashboard).mockReturnValue({
      data: mockDataWithAssets,
      loading: false,
      error: null,
      refresh: vi.fn()
    });

    render(<DashboardPage />);
    // 계좌 클릭하여 확장
    const accountHeader = screen.getByText('테스트 계좌');
    fireEvent.click(accountHeader);

    // 기본 정렬: 평가액 순 (자산A(2000) -> 자산B(1000))
    const assetNames = screen.getAllByText(/자산[AB]/).map(el => el.textContent);
    expect(assetNames[0]).toBe('자산A');
    expect(assetNames[1]).toBe('자산B');

    // 카테고리별 정렬로 변경 (주식(자산B) -> 현금(자산A) 가나다순)
    // 주식(J) vs 현금(H) -> 현금이 먼저 옴 (가나다순: 현금, 주식 순서 확인 필요)
    // '주식' vs '현금' -> '주식'이 먼저? (ㅈ vs ㅎ -> ㅈ이 먼저)
    const sortSelect = screen.getByRole('combobox');
    fireEvent.change(sortSelect, { target: { value: 'category' } });

    const sortedAssetNames = screen.getAllByText(/자산[AB]/).map(el => el.textContent);
    // '주식'(자산B) vs '현금'(자산A) -> localeCompare에서 '주식'이 '현금'보다 뒤에 옴 (ㅎ이 뒤)
    // 아, localeCompare는 '가' < '나'. '주' vs '현' -> '주' < '현'.
    // 따라서 '주식'인 자산B가 첫 번째, '현금'인 자산A가 두 번째여야 함.
    expect(sortedAssetNames[0]).toBe('자산B');
    expect(sortedAssetNames[1]).toBe('자산A');
  });
});
