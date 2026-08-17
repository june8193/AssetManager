import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MaskingProvider, useMasking } from '../contexts/MaskingContext';
import { useFormatters } from './useFormatters';

const wrapper = ({ children }) => (
  <MaskingProvider>{children}</MaskingProvider>
);

describe('useFormatters hook', () => {
  it('마스킹 상태가 해제된 기본 상태에서 포맷팅이 정상 동작해야 한다', () => {
    const { result } = renderHook(() => useFormatters(), { wrapper });

    expect(result.current.isMasked).toBe(false);
    expect(result.current.formatCurrency(1000000)).toBe('₩ 1,000,000');
    expect(result.current.formatPercent(12.34)).toBe('+12.34%');
    expect(result.current.formatWithCommas(5000)).toBe('5,000');
    expect(result.current.parseCommas('5,000')).toBe(5000);
  });

  it('마스킹 상태 활성화 시 formatCurrency가 자동으로 ***를 반환해야 한다', () => {
    const { result } = renderHook(() => {
      const masking = useMasking();
      const formatters = useFormatters();
      return { masking, formatters };
    }, { wrapper });

    act(() => {
      result.current.masking.toggleMasking();
    });

    expect(result.current.formatters.isMasked).toBe(true);
    expect(result.current.formatters.formatCurrency(1000000)).toBe('***');
    expect(result.current.formatters.maskValue('test')).toBe('***');

    // formatPercent, formatWithCommas, parseCommas는 마스킹과 무관하게 기능 유지
    expect(result.current.formatters.formatPercent(12.34)).toBe('+12.34%');
  });
});
