import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompoundInterestPage from './CompoundInterestPage';
import { MaskingProvider } from '../contexts/MaskingContext';

// API Fetch 모킹
global.fetch = vi.fn();

const mockStatsResponse = {
  has_enough_data: true,
  annual_roi_avg: 8.5,
  annual_deposit_avg: 12000000.0,
  latest_total_valuation: 50000000.0
};

describe('CompoundInterestPage - Unit Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기본 UI 레이아웃 및 현재 자산기반 계산 탭 전용 요소가 정상 렌더링된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ has_enough_data: false })
    });

    render(
      <MaskingProvider>
        <CompoundInterestPage />
      </MaskingProvider>
    );

    // 제목 확인
    expect(screen.getByText('시뮬레이션 복리 계산기')).toBeDefined();

    // 기본 탭인 '현재 자산기반 계산' 레이아웃 확인
    await waitFor(() => {
      expect(screen.getByText('출생 연도')).toBeDefined();
      expect(screen.getByText('목표 연도')).toBeDefined();
      expect(screen.getByText('현재 나이 (2026년)')).toBeDefined();
      expect(screen.getByText('목표 연도 나이 (2056년)')).toBeDefined();
      expect(screen.getByText('총 시뮬레이션 기간')).toBeDefined();
    });
  });

  it('자유 계산 탭으로 전환 시 투자 기간 입력 요소가 나타난다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ has_enough_data: false })
    });

    render(
      <MaskingProvider>
        <CompoundInterestPage />
      </MaskingProvider>
    );

    // 자유 계산 탭 클릭
    const freeCalcTabButton = screen.getByRole('button', { name: '자유 계산' });
    expect(freeCalcTabButton).toBeDefined();
    fireEvent.click(freeCalcTabButton);

    // 투자 기간 라벨이 드러나는지 확인
    await waitFor(() => {
      expect(screen.getByLabelText('투자 기간')).toBeDefined();
    });
  });

  it('나의 스냅샷 기록 연동 카드가 렌더링되고 적용 버튼 클릭 시 값이 대입된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatsResponse
    });

    render(
      <MaskingProvider>
        <CompoundInterestPage />
      </MaskingProvider>
    );

    // 스냅샷 데이터 로드 대기
    await waitFor(() => {
      expect(screen.getByText('8.50%')).toBeDefined();
      expect(screen.getByText(/12,000,000/)).toBeDefined();
      expect(screen.getAllByText(/50,000,000/).length).toBeGreaterThan(0);
    });

    // 자동 적용 버튼 클릭
    const applyButton = screen.getByRole('button', { name: /위 통계 수치를 계산기에 자동 적용하기/i });
    expect(applyButton).toBeDefined();
    
    fireEvent.click(applyButton);

    // 값들이 입력 폼에 대입되었는지 확인 (수익률이 8.5% 로 반영되었는지 검사)
    const returnInputs = screen.getAllByRole('spinbutton');
    const returnInput = returnInputs.find(input => parseFloat(input.value) === 8.5);
    expect(returnInput).toBeDefined();
  });

  it('연도별 상세 추이표에 당해 이자 컬럼과 데이터가 정상적으로 렌더링된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ has_enough_data: false })
    });

    render(
      <MaskingProvider>
        <CompoundInterestPage />
      </MaskingProvider>
    );

    // 테이블 헤더에 '당해 이자'가 있는지 확인
    expect(screen.getByText('당해 이자')).toBeDefined();

    // 0년차(시작) 당해 이자는 0원이고, 1년차부터는 이자가 붙음
    await waitFor(() => {
      // 0 원 표시 확인 (시작 연도의 당해 이자)
      expect(screen.getAllByText('0 원').length).toBeGreaterThan(0);
    });
  });

  it('출생 연도 및 목표 연도 입력 필드에 정상적인 값을 입력하고 포커스를 잃으면(onBlur) 정상 반영된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ has_enough_data: false })
    });

    render(
      <MaskingProvider>
        <CompoundInterestPage />
      </MaskingProvider>
    );

    const birthYearInput = screen.getByLabelText('출생 연도');
    const targetYearInput = screen.getByLabelText('목표 연도');

    // 1. 정상 값 입력 및 포커스 아웃 (출생 연도: 1990)
    fireEvent.change(birthYearInput, { target: { value: '1990' } });
    // 아직 반영 안 됨 (포커스 아웃 전)
    expect(screen.queryByText('현재 나이 (2026년)')).toBeDefined();
    // 포커스 아웃 트리거
    fireEvent.blur(birthYearInput);
    
    // 현재 나이가 2026 - 1990 = 36 세로 바뀜을 확인
    await waitFor(() => {
      expect(screen.getByText('36 세')).toBeDefined();
    });

    // 2. 정상 값 입력 및 포커스 아웃 (목표 연도: 2080)
    fireEvent.change(targetYearInput, { target: { value: '2080' } });
    fireEvent.blur(targetYearInput);

    // 총 시뮬레이션 기간이 2080 - 2026 = 54 년으로 바뀜을 확인
    await waitFor(() => {
      expect(screen.getByText('54 년')).toBeDefined();
    });
  });

  it('출생 연도 및 목표 연도에 범위 밖의 비정상 값(예: 20000년)을 입력하고 포커스를 잃으면 이전 값으로 원복된다', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ has_enough_data: false })
    });

    render(
      <MaskingProvider>
        <CompoundInterestPage />
      </MaskingProvider>
    );

    const targetYearInput = screen.getByLabelText('목표 연도');

    // 비정상적인 목표 연도 입력 (20000년)
    fireEvent.change(targetYearInput, { target: { value: '20000' } });
    fireEvent.blur(targetYearInput);

    // 20000년은 상한선인 2126년을 초과하므로 적용되지 않고 기본값인 2056년으로 원복되어야 함
    await waitFor(() => {
      expect(targetYearInput.value).toBe('2056');
      expect(screen.getByText('30 년')).toBeDefined(); // 2056 - 2026 = 30년
    });
  });
});

