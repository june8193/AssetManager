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

  it('에러 발생 시 에러 메시지와 다시 시도 버튼이 노출되어야 한다', () => {
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
    fireEvent.click(retryBtn);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('정상 데이터 로드 시 총 자산 요약 배너 및 자산군별 비중 카드가 렌더링되어야 한다', () => {
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

    // 헤더 및 요약 정보 확인
    expect(screen.getByText('비중 점검')).toBeInTheDocument();
    expect(screen.getAllByText('100,000,000').length).toBeGreaterThanOrEqual(1);

    // 대분류 카드 렌더링 확인
    expect(screen.getByText('주식')).toBeInTheDocument();
    expect(screen.getByText('현금')).toBeInTheDocument();
  });

  it('추가 투자금 버튼 클릭 시 리밸런싱 목표 금액이 실시간으로 재계산되어야 한다', async () => {
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

    // 기본 총 자산 확인
    expect(screen.getAllByText('100,000,000').length).toBeGreaterThanOrEqual(1);

    // 1,000만 버튼 클릭
    const add10mBtn = screen.getByRole('button', { name: /1,000만|1000만/i });
    await act(async () => {
      fireEvent.click(add10mBtn);
    });

    // 추가 투자금 반영된 목표 총자산: 110,000,000원 확인
    expect(screen.getByText('110,000,000')).toBeInTheDocument();
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
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(1);
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
