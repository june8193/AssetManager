import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobileTotalAssetCard from './MobileTotalAssetCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileTotalAssetCard', () => {
  const mockData = {
    total_valuation_krw: 125000000,
    total_contribution: 90000000,
    initial_base_asset: 10000000,
    total_profit: 25000000,
    cumulative_roi: 25.0,
    contribution_ratio: 80.0,
    profit_ratio: 20.0,
    exchange_rate: {
      rate: 1350.5,
      date: '2026-08-30',
      created_at: '2026-08-30T09:00:00Z',
    },
  };

  it('총 자산, 투자 원금, 평가 손익 및 수익률이 올바르게 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileTotalAssetCard data={mockData} />
      </MaskingProvider>
    );

    // 총 평가 자산 표시 확인 (125,000,000)
    expect(screen.getByText('125,000,000')).toBeInTheDocument();
    expect(screen.getByText(/총 평가 자산/i)).toBeInTheDocument();

    // 총 투자 원금 확인 (90,000,000 + 10,000,000 = 100,000,000)
    expect(screen.getByText('100,000,000')).toBeInTheDocument();
    expect(screen.getByText(/투자 원금/i)).toBeInTheDocument();

    // 평가 손익 및 수익률 확인
    expect(screen.getByText(/\+25,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/\+25.00%/)).toBeInTheDocument();

    // 환율 정보 표시 확인
    expect(screen.getByText('1,350.5')).toBeInTheDocument();
  });

  it('손실 발생 시 마이너스 부호 및 스타일이 적용되어야 한다', () => {
    const lossData = {
      ...mockData,
      total_profit: -5000000,
      cumulative_roi: -5.0,
      contribution_ratio: 100,
      profit_ratio: 0,
    };

    render(
      <MaskingProvider>
        <MobileTotalAssetCard data={lossData} />
      </MaskingProvider>
    );

    expect(screen.getByText(/-5,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/-5.00%/)).toBeInTheDocument();
  });

  it('마스킹 활성화 시 자산 금액이 마스킹(***) 처리되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <MobileTotalAssetCard data={mockData} />
      </MaskingProvider>
    );

    // 마스킹 처리된 값(***) 확인
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(2);

    localStorage.removeItem('isMasked');
  });
});
