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
});
