import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DailyComparisonTable from './DailyComparisonTable';
import { MaskingProvider } from '../contexts/MaskingContext';

describe('DailyComparisonTable', () => {
  // 12개의 아이템 데이터 셋업 (페이지당 10개이므로 2페이지가 생겨야 함)
  const mockData = Array.from({ length: 12 }, (_, idx) => ({
    date: `2026-05-${12 - idx > 9 ? 12 - idx : '0' + (12 - idx)}`,
    assets: 1000000 + idx * 10000,
    roi: 1.5 + idx,
    kospi: 0.5 + idx,
    kosdaq: 0.2 + idx,
    sp500: 0.8 + idx,
    nasdaq: 1.1 + idx
  }));

  beforeEach(() => {
    localStorage.clear();
  });

  it('일자별 포트폴리오 자산과 지수들의 수익률이 1페이지당 10개씩 페이지네이션되어 정상적으로 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <DailyComparisonTable data={mockData} />
      </MaskingProvider>
    );

    // 1페이지에 해당하는 최근 10개 날짜 렌더링 확인 (2026-05-12 ~ 2026-05-03)
    expect(screen.getByText('2026-05-12')).toBeInTheDocument();
    expect(screen.getByText('2026-05-03')).toBeInTheDocument();
    // 2페이지 데이터는 아직 없어야 함
    expect(screen.queryByText('2026-05-02')).not.toBeInTheDocument();

    // 페이지네이션 컨트롤러 렌더링 확인
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // 2페이지 버튼 클릭
    const page2Button = screen.getByText('2');
    fireEvent.click(page2Button);

    // 2페이지 날짜 렌더링 확인 (2026-05-02 ~ 2026-05-01)
    expect(screen.getByText('2026-05-02')).toBeInTheDocument();
    expect(screen.getByText('2026-05-01')).toBeInTheDocument();
    // 1페이지 데이터는 사라져야 함
    expect(screen.queryByText('2026-05-12')).not.toBeInTheDocument();
  });

  it('마스킹 모드가 활성화되면 내 자산(평가액) 금액 정보가 "***"로 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <DailyComparisonTable data={mockData} />
      </MaskingProvider>
    );

    // 한 화면에 최대 10개 노출되므로 ₩ *** 로 표시된 자산 평가액이 10개 노출되어야 함
    expect(screen.getAllByText(/₩ \*\*\*/).length).toBe(10);
  });

  it('표 하단에 수익률 계산 방식 및 지수 수익률의 직전 스냅샷 대비 비교 기준 설명이 명시되어 있어야 한다', () => {
    render(
      <MaskingProvider>
        <DailyComparisonTable data={mockData} />
      </MaskingProvider>
    );

    expect(screen.getAllByText('내 수익률').length).toBe(2);
    expect(screen.getByText(/수익 \/ \(기초 자산 \+ 해당 일자 추가액\)/)).toBeInTheDocument();
    expect(screen.getByText('지수 수익률')).toBeInTheDocument();
    expect(screen.getByText(/직전 스냅샷 날짜 대비 현재 스냅샷 날짜의 종가 변동률/)).toBeInTheDocument();
  });
});
