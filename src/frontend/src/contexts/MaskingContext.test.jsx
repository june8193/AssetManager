import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { MaskingProvider, useMasking } from './MaskingContext';

/**
 * MaskingContext의 동작을 검증하는 테스트입니다.
 */
describe('MaskingContext', () => {
  beforeEach(() => {
    // localStorage 초기화
    localStorage.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }) => <MaskingProvider>{children}</MaskingProvider>;

  it('기본 마스킹 상태는 false여야 한다 (localStorage가 비어있을 때)', () => {
    const { result } = renderHook(() => useMasking(), { wrapper });
    expect(result.current.isMasked).toBe(false);
  });

  it('toggleMasking을 호출하면 isMasked 상태가 반전되어야 한다', () => {
    const { result } = renderHook(() => useMasking(), { wrapper });
    
    act(() => {
      result.current.toggleMasking();
    });
    expect(result.current.isMasked).toBe(true);

    act(() => {
      result.current.toggleMasking();
    });
    expect(result.current.isMasked).toBe(false);
  });

  it('마스킹 상태가 변경되면 localStorage에 저장되어야 한다', () => {
    const { result } = renderHook(() => useMasking(), { wrapper });
    
    act(() => {
      result.current.toggleMasking();
    });
    expect(localStorage.getItem('isMasked')).toBe('true');
  });

  it('maskValue 함수는 마스킹 상태에 따라 값을 올바르게 반환해야 한다', () => {
    const { result } = renderHook(() => useMasking(), { wrapper });
    
    // 마스킹 Off 상태
    expect(result.current.maskValue('1,000,000')).toBe('1,000,000');

    // 마스킹 On 상태
    act(() => {
      result.current.toggleMasking();
    });
    expect(result.current.maskValue('1,000,000')).toBe('***');
  });
});
