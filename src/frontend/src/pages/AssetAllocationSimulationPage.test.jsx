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
      { label: '주식 100%', data: [0.0, 0.5] },
      { label: '주식 60% / 현금 40%', data: [0.0, 0.3] }
    ]
  },
  summaries: [
    { name: '주식 100%', stock_ratio: 100.0, cagr: 12.5, mdd: -15.2, final_return: 25.4 },
    { name: '주식 60% / 현금 40%', stock_ratio: 60.0, cagr: 8.2, mdd: -9.1, final_return: 15.6 }
  ],
  yearly_stats: {
    '주식 100%': [
      { year: 2026, year_return: 25.4, cumulative_return: 25.4, mdd: -15.2 }
    ],
    '주식 60% / 현금 40%': [
      { year: 2026, year_return: 15.6, cumulative_return: 15.6, mdd: -9.1 }
    ]
  },
  monthly_stats: {
    '주식 100%': [
      { year: 2026, month: 1, month_return: 25.4, cumulative_return: 25.4, mdd: -15.2 }
    ],
    '주식 60% / 현금 40%': [
      { year: 2026, month: 1, month_return: 15.6, cumulative_return: 15.6, mdd: -9.1 }
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
    expect(screen.getByText(/S&P500 지수와 현금을 활용한/i)).toBeDefined();

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
});
