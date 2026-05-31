import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import YearlyComparisonTable from './YearlyComparisonTable';
import { MaskingProvider } from '../contexts/MaskingContext';

describe('YearlyComparisonTable', () => {
  const mockData = [
    {
      year: 2026,
      assets: 1500000,
      roi: 15.38,
      kospi: 10.0,
      kosdaq: -5.2,
      sp500: 8.5,
      nasdaq: 12.0
    },
    {
      year: 2025,
      assets: 1000000,
      roi: 20.0,
      kospi: 10.0,
      kosdaq: 10.0,
      sp500: 10.0,
      nasdaq: 10.0
    }
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  it('연도별 포트폴리오 자산과 각 지수의 수익률이 정상적으로 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <YearlyComparisonTable data={mockData} />
      </MaskingProvider>
    );

    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();

    // ₩ 1,500,000 과 ₩ 1,000,000 이 포맷팅되어 표시되어야 함
    expect(screen.getByText('₩ 1,500,000')).toBeInTheDocument();
    expect(screen.getByText('₩ 1,000,000')).toBeInTheDocument();

    // 내 수익률 렌더링 검증
    expect(screen.getByText('+15.38%')).toBeInTheDocument();
    expect(screen.getByText('+20.00%')).toBeInTheDocument();

    // 지수 수익률 렌더링 검증
    expect(screen.getByText('-5.20%')).toBeInTheDocument();
    expect(screen.getByText('+8.50%')).toBeInTheDocument();
    expect(screen.getByText('+12.00%')).toBeInTheDocument();
  });

  it('마스킹 모드가 활성화되면 내 자산(평가액) 금액 정보가 "***"로 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <YearlyComparisonTable data={mockData} />
      </MaskingProvider>
    );

    // 내 자산 정보는 마스킹 처리되어야 함
    expect(screen.getAllByText(/₩ \*\*\*/).length).toBe(2);

    // 수익률(roi)과 지수 수익률들은 마스킹 대상이 아니므로 정상적으로 숫자가 보여야 함
    expect(screen.getByText('+15.38%')).toBeInTheDocument();
    expect(screen.getByText('-5.20%')).toBeInTheDocument();
  });

  it('표 하단에 수익률 계산 방식 설명 및 지수 수익률 계산 기준 설명이 명시되어 있어야 한다', () => {
    render(
      <MaskingProvider>
        <YearlyComparisonTable data={mockData} />
      </MaskingProvider>
    );

    expect(screen.getByText('내 수익률(ROI)')).toBeInTheDocument();
    expect(screen.getByText(/수익 \/ \(기초 자산 \+ 해당 연도 추가액\)/)).toBeInTheDocument();
    expect(screen.getByText('지수 수익률')).toBeInTheDocument();
    expect(screen.getByText(/해당 연도 1월 1일\(혹은 첫 거래일\) 대비 12월 31일/)).toBeInTheDocument();
  });
});
