import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MobileRatiosPage from './MobileRatiosPage';
import { MaskingProvider } from '../../contexts/MaskingContext';
import * as useRatiosModule from '../../hooks/useRatios';

const mockHierarchy = [
  {
    category_name: '주식',
    current_value: 60000000,
    target_percentage: 50.0,
    children: [
      {
        category_name: '미국주식',
        current_value: 40000000,
        target_percentage: 60.0,
        children: [
          {
            name: '애플',
            ticker: 'AAPL',
            valuation_krw: 20000000,
            target_percentage: 50.0,
          },
        ],
      },
    ],
  },
  {
    category_name: '현금',
    current_value: 40000000,
    target_percentage: 50.0,
    children: [],
  },
];

const mockBalancedHierarchy = [
  {
    category_name: '주식',
    current_value: 50000000,
    target_percentage: 50.0,
    children: [],
  },
  {
    category_name: '현금',
    current_value: 50000000,
    target_percentage: 50.0,
    children: [],
  },
];

describe('MobileRatiosPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('로딩 중일 때 스켈레톤 로더가 렌더링되어야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: [],
      loading: true,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    expect(screen.getByText(/비중 데이터를 불러오는 중/i)).toBeInTheDocument();
  });

  it('에러 발생 시 에러 메시지와 다시 시도 버튼이 노출되어야 한다', async () => {
    const mockRefresh = vi.fn();
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: [],
      loading: false,
      error: '네트워크 연결 오류',
      refreshHierarchy: mockRefresh,
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    expect(screen.getByText('네트워크 연결 오류')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('정상 데이터 로드 시 현재 총 자산 단일 금액 및 리밸런싱 규모가 렌더링되고 목표 총 자산 및 시뮬레이션 UI는 노출되지 않아야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    // 헤더 및 현재 총 자산 확인
    expect(screen.getByText('비중 점검')).toBeInTheDocument();
    expect(screen.getByText('현재 총 자산')).toBeInTheDocument();
    expect(screen.getByText('100,000,000')).toBeInTheDocument();

    // 목표 총 자산 및 시뮬레이터 제거 확인
    expect(screen.queryByText('목표 총 자산')).not.toBeInTheDocument();
    expect(screen.queryByText(/추가 투자금/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /100만|500만|1,000만/i })).not.toBeInTheDocument();

    // 리밸런싱 규모 표시 확인 (1,000만 원)
    expect(screen.getByText(/리밸런싱 규모/i)).toBeInTheDocument();
    expect(screen.getByText('10,000,000')).toBeInTheDocument();

    // 대분류 카드 렌더링 확인
    expect(screen.getByText('주식')).toBeInTheDocument();
    expect(screen.getByText('현금')).toBeInTheDocument();
  });

  it('리밸런싱이 불필요한 경우(목표 비중과 현재 비중 일치) 리밸런싱 규모 안내가 노출되지 않아야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockBalancedHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    expect(screen.queryByText(/리밸런싱 규모/i)).not.toBeInTheDocument();
  });

  it('새로고침 버튼 클릭 시 refreshHierarchy가 호출되고 토스트 메시지가 노출되어야 한다', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(true);
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: mockRefresh,
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(mockRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/최신화되었습니다/i)).toBeInTheDocument();
    });
  });

  it('마스킹 활성화 시 총 자산 및 리밸런싱 금액이 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    expect(screen.queryByText('100,000,000')).not.toBeInTheDocument();
    expect(screen.queryByText('10,000,000')).not.toBeInTheDocument();
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(2);
  });

  it('순수 조회 전용(Read-Only)으로 비중 변경 입력 폼 및 저장 버튼이 노출되지 않아야 한다', () => {
    vi.spyOn(useRatiosModule, 'useRatios').mockReturnValue({
      hierarchy: mockHierarchy,
      loading: false,
      error: null,
      refreshHierarchy: vi.fn(),
    });

    render(
      <MaskingProvider>
        <MobileRatiosPage />
      </MaskingProvider>
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /저장/i })).not.toBeInTheDocument();
  });
});
