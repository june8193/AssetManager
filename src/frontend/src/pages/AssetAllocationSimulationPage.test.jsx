import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AssetAllocationSimulationPage from './AssetAllocationSimulationPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// API Fetch 모킹
global.fetch = vi.fn();

const mockApiResponse = {
  chart: {
    labels: ['2026-01-01', '2026-01-02'],
    datasets: [
      { label: '주식 100%', data: [20000000.0, 20100000.0] },
      { label: '주식 60% / 현금 40%', data: [20000000.0, 20060000.0] }
    ]
  },
  summaries: [
    { name: '주식 100%', stock_ratio: 100.0, cagr: 12.5, mdd: -15.2, final_return: 25.4, final_valuation: 25400000.0, total_invested: 20000000.0, total_interest: 5400000.0 },
    { name: '주식 60% / 현금 40%', stock_ratio: 60.0, cagr: 8.2, mdd: -9.1, final_return: 15.6, final_valuation: 23120000.0, total_invested: 20000000.0, total_interest: 3120000.0 }
  ],
  yearly_stats: {
    '주식 100%': [
      { year: 2026, year_return: 25.4, cumulative_return: 25.4, mdd: -15.2, valuation: 25400000.0, invested: 20000000.0, interest: 5400000.0, annual_interest: 5400000.0 }
    ],
    '주식 60% / 현금 40%': [
      { year: 2026, year_return: 15.6, cumulative_return: 15.6, mdd: -9.1, valuation: 23120000.0, invested: 20000000.0, interest: 3120000.0, annual_interest: 3120000.0 }
    ]
  },
  monthly_stats: {
    '주식 100%': [
      { year: 2026, month: 1, month_return: 25.4, cumulative_return: 25.4, mdd: -15.2, valuation: 25400000.0, invested: 20000000.0, interest: 5400000.0, annual_interest: 5400000.0 }
    ],
    '주식 60% / 현금 40%': [
      { year: 2026, month: 1, month_return: 15.6, cumulative_return: 15.6, mdd: -9.1, valuation: 23120000.0, invested: 20000000.0, interest: 3120000.0, annual_interest: 3120000.0 }
    ]
  }
};

describe('AssetAllocationSimulationPage - Unit Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기본 UI 레이아웃과 프리셋 버튼이 정상적으로 렌더링된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 제목 렌더링 확인
    expect(screen.getByText('자산배분 시뮬레이션')).toBeDefined();

    // 툴팁 및 가이드 렌더링 확인
    expect(screen.getByText(/S&P500 지수와 현금을 활용한 과거 성과 백테스트/i)).toBeDefined();

    // 탭 렌더링 확인
    expect(screen.getByText('적립식 시뮬레이션')).toBeDefined();
    expect(screen.getByText('거치식 백테스트')).toBeDefined();

    // 기간 프리셋 버튼들이 렌더링되는지 확인
    expect(screen.getByText('최근 5년')).toBeDefined();
    expect(screen.getByText('최근 10년')).toBeDefined();
    expect(screen.getByText('최근 20년')).toBeDefined();
    expect(screen.getByText('최근 30년')).toBeDefined();
    expect(screen.getByText('전체 기간')).toBeDefined();

    // 리밸런싱 주기 선택 라디오가 표시되는지 확인
    expect(screen.getByLabelText('매월')).toBeDefined();
    expect(screen.getByLabelText('매년')).toBeDefined();
    expect(screen.getByLabelText('안함')).toBeDefined();
  });

  it('새로운 비중 조합을 추가하고 계산을 수행한다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 조합 이름 및 주식 비중 입력 폼 확인
    const nameInput = screen.getByPlaceholderText('예: 70/30 포트폴리오');
    const ratioInput = screen.getByPlaceholderText('주식 비중 (0-100)');
    const addButton = screen.getByRole('button', { name: /조합 추가/i });

    expect(nameInput).toBeDefined();
    expect(ratioInput).toBeDefined();
    expect(addButton).toBeDefined();

    // 새 비중 조합 정보 입력
    fireEvent.change(nameInput, { target: { value: '주식 50% / 현금 50%' } });
    fireEvent.change(ratioInput, { target: { value: '50' } });
    fireEvent.click(addButton);

    // 추가된 조합이 화면 리스트에 노출되는지 확인
    expect(screen.getAllByText('주식 50% / 현금 50%').length).toBeGreaterThan(0);
  });

  it('적립식 탭과 거치식 탭을 전환할 수 있으며, 추가금 입력 필드가 탭에 따라 노출/비노출된다', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    render(
      <MaskingProvider>
        <AssetAllocationSimulationPage />
      </MaskingProvider>
    );

    // 1. 초기 탭은 적립식이므로 '매년 추가 적립금' 영역이 노출됨
    expect(screen.getByText('매년 추가 적립금')).toBeDefined();

    // 2. 거치식 백테스트 탭 클릭
    const lumpTab = screen.getByText('거치식 백테스트');
    fireEvent.click(lumpTab);

    // 3. 거치식 탭에서는 '매년 추가 적립금' 입력 필드가 비노출됨
    expect(screen.queryByText('매년 추가 적립금')).toBeNull();
  });
});
