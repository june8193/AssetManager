import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DynamicTierEditor from './DynamicTierEditor';

describe('DynamicTierEditor 컴포넌트 단위 테스트', () => {
  const initialTiers = [
    { tier: 1, dd_threshold: -10.0, vix_threshold: 25.0, target_stock_ratio: 75.0 },
    { tier: 2, dd_threshold: -20.0, vix_threshold: 30.0, target_stock_ratio: 90.0 },
  ];

  it('기존 티어 목록이 정상적으로 렌더링된다', () => {
    render(<DynamicTierEditor tiers={initialTiers} onChange={vi.fn()} />);

    expect(screen.getByText('1단계')).toBeDefined();
    expect(screen.getByText('2단계')).toBeDefined();
    expect(screen.getByDisplayValue('-10')).toBeDefined();
    expect(screen.getByDisplayValue('25')).toBeDefined();
    expect(screen.getByDisplayValue('75')).toBeDefined();
    expect(screen.getByDisplayValue('-20')).toBeDefined();
    expect(screen.getByDisplayValue('30')).toBeDefined();
    expect(screen.getByDisplayValue('90')).toBeDefined();
  });

  it('티어 추가 버튼 클릭 시 새 단계가 추가되어 onChange가 호출된다', () => {
    const handleChange = vi.fn();
    render(<DynamicTierEditor tiers={initialTiers} onChange={handleChange} />);

    const addButton = screen.getByRole('button', { name: /단계 추가/i });
    fireEvent.click(addButton);

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updated = handleChange.mock.calls[0][0];
    expect(updated.length).toBe(3);
    expect(updated[2].tier).toBe(3);
  });

  it('티어 삭제 버튼 클릭 시 해당 단계가 제거되어 onChange가 호출된다', () => {
    const handleChange = vi.fn();
    render(<DynamicTierEditor tiers={initialTiers} onChange={handleChange} />);

    const deleteButtons = screen.getAllByRole('button', { name: /티어 삭제/i });
    expect(deleteButtons.length).toBe(2);

    fireEvent.click(deleteButtons[1]); // 2단계 삭제
    expect(handleChange).toHaveBeenCalledTimes(1);
    const updated = handleChange.mock.calls[0][0];
    expect(updated.length).toBe(1);
    expect(updated[0].tier).toBe(1);
  });

  it('티어 입력 필드 값 변경 시 onChange가 호출된다', () => {
    const handleChange = vi.fn();
    render(<DynamicTierEditor tiers={initialTiers} onChange={handleChange} />);

    const ddInput = screen.getByDisplayValue('-10');
    fireEvent.change(ddInput, { target: { value: '-15' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    const updated = handleChange.mock.calls[0][0];
    expect(updated[0].dd_threshold).toBe(-15.0);
  });
});
