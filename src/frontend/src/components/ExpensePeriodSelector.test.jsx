import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExpensePeriodSelector from './ExpensePeriodSelector';

const mockMonthOptions = [
  '2026-08',
  '2026-07',
  '2026-06',
  '2026-05',
  '2026-04',
  '2026-03',
  '2026-02',
  '2026-01',
  '2025-12',
  '2025-11',
  '2025-10',
  '2025-09',
  '2025-08',
];

describe('ExpensePeriodSelector 컴포넌트 테스트', () => {
  it('5종 프리셋 버튼(당월, 3개월, 6개월, 1년, 올해 누적)과 직접 선택 드롭다운이 렌더링되어야 한다', () => {
    const handleChange = vi.fn();
    render(
      <ExpensePeriodSelector
        startMonth="2026-08"
        endMonth="2026-08"
        onChange={handleChange}
        monthOptions={mockMonthOptions}
      />
    );

    expect(screen.getByRole('button', { name: /^당월$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^3개월$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^6개월$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1년$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /올해 누적|YTD/ })).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2); // 시작월, 종료월
  });

  it('3개월 프리셋 클릭 시 현재 종료월 기준 직전 3개월 범위로 onChange가 호출되어야 한다', () => {
    const handleChange = vi.fn();
    render(
      <ExpensePeriodSelector
        startMonth="2026-08"
        endMonth="2026-08"
        onChange={handleChange}
        monthOptions={mockMonthOptions}
      />
    );

    const btn3M = screen.getByRole('button', { name: /^3개월$/ });
    fireEvent.click(btn3M);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startMonth: '2026-06',
        endMonth: '2026-08',
        preset: '3m',
      })
    );
  });

  it('6개월 프리셋 클릭 시 직전 6개월 범위로 onChange가 호출되어야 한다', () => {
    const handleChange = vi.fn();
    render(
      <ExpensePeriodSelector
        startMonth="2026-08"
        endMonth="2026-08"
        onChange={handleChange}
        monthOptions={mockMonthOptions}
      />
    );

    const btn6M = screen.getByRole('button', { name: /^6개월$/ });
    fireEvent.click(btn6M);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startMonth: '2026-03',
        endMonth: '2026-08',
        preset: '6m',
      })
    );
  });

  it('1년 프리셋 클릭 시 직전 12개월 범위로 onChange가 호출되어야 한다', () => {
    const handleChange = vi.fn();
    render(
      <ExpensePeriodSelector
        startMonth="2026-08"
        endMonth="2026-08"
        onChange={handleChange}
        monthOptions={mockMonthOptions}
      />
    );

    const btn1Y = screen.getByRole('button', { name: /^1년$/ });
    fireEvent.click(btn1Y);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startMonth: '2025-09',
        endMonth: '2026-08',
        preset: '1y',
      })
    );
  });

  it('올해 누적(YTD) 프리셋 클릭 시 해당 연도 1월부터의 범위로 onChange가 호출되어야 한다', () => {
    const handleChange = vi.fn();
    render(
      <ExpensePeriodSelector
        startMonth="2026-08"
        endMonth="2026-08"
        onChange={handleChange}
        monthOptions={mockMonthOptions}
      />
    );

    const btnYTD = screen.getByRole('button', { name: /올해 누적|YTD/ });
    fireEvent.click(btnYTD);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startMonth: '2026-01',
        endMonth: '2026-08',
        preset: 'ytd',
      })
    );
  });

  it('시작월 셀렉트 드롭다운 변경 시 직접 선택 모드로 onChange가 호출되어야 한다', () => {
    const handleChange = vi.fn();
    render(
      <ExpensePeriodSelector
        startMonth="2026-08"
        endMonth="2026-08"
        onChange={handleChange}
        monthOptions={mockMonthOptions}
      />
    );

    const [startSelect] = screen.getAllByRole('combobox');
    fireEvent.change(startSelect, { target: { value: '2026-05' } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startMonth: '2026-05',
        endMonth: '2026-08',
        preset: 'custom',
      })
    );
  });
});
