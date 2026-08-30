import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MobileSettingsPage from './MobileSettingsPage';
import { MaskingProvider } from '../../contexts/MaskingContext';
import * as systemServiceModule from '../../services/systemService';

// Mock systemService
vi.mock('../../services/systemService', () => ({
  systemService: {
    getTaskStatus: vi.fn(),
  },
}));

const renderWithProviders = (ui, { isMaskedInitial = false } = {}) => {
  if (isMaskedInitial) {
    localStorage.setItem('isMasked', 'true');
  } else {
    localStorage.setItem('isMasked', 'false');
  }

  return render(
    <BrowserRouter>
      <MaskingProvider>{ui}</MaskingProvider>
    </BrowserRouter>
  );
};

describe('MobileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    systemServiceModule.systemService.getTaskStatus.mockResolvedValue({
      price_update: { status: 'idle', last_run: '2026-08-30T10:00:00' },
    });
  });

  it('설정 페이지의 주요 섹션(개인정보 보호, 서버 상태, 앱 정보)이 렌더링되어야 한다', async () => {
    renderWithProviders(<MobileSettingsPage />);

    await waitFor(() => {
      expect(systemServiceModule.systemService.getTaskStatus).toHaveBeenCalled();
    });

    expect(screen.getByText('환경 설정')).toBeInTheDocument();
    expect(screen.getByText('개인정보 보호')).toBeInTheDocument();
    expect(screen.getByText('서버 연결 상태')).toBeInTheDocument();
    expect(screen.getByText('앱 정보')).toBeInTheDocument();
  });

  it('마스킹 스위치를 클릭하면 마스킹 상태가 토글되어야 한다', async () => {
    renderWithProviders(<MobileSettingsPage />);

    await waitFor(() => {
      expect(systemServiceModule.systemService.getTaskStatus).toHaveBeenCalled();
    });

    const maskingToggle = screen.getByRole('switch', { name: /자산 금액 마스킹/i });
    expect(maskingToggle).toBeInTheDocument();
    expect(maskingToggle).toHaveAttribute('aria-checked', 'false');

    // 스위치 클릭 -> On
    fireEvent.click(maskingToggle);
    expect(maskingToggle).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('isMasked')).toBe('true');

    // 다시 클릭 -> Off
    fireEvent.click(maskingToggle);
    expect(maskingToggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('isMasked')).toBe('false');
  });

  it('서버 상태 카드에서 헬스체크 및 응답 시간(ms)이 표시되고 재확인 버튼 클릭 시 갱신되어야 한다', async () => {
    renderWithProviders(<MobileSettingsPage />);

    // 최초 로드 시 getTaskStatus 호출 및 연결 상태 확인
    await waitFor(() => {
      expect(systemServiceModule.systemService.getTaskStatus).toHaveBeenCalled();
    });

    expect(screen.getByText(/정상 연결됨|연결됨/i)).toBeInTheDocument();

    // 연결 상태 재확인 버튼 클릭
    const refreshButton = screen.getByRole('button', { name: /연결 상태 재확인|상태 재확인/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(systemServiceModule.systemService.getTaskStatus).toHaveBeenCalledTimes(2);
    });
  });

  it('서버 연결 실패 시 오프라인 상태와 에러 메시지가 표시되어야 한다', async () => {
    systemServiceModule.systemService.getTaskStatus.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<MobileSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/연결 실패|오프라인/i)).toBeInTheDocument();
    });
  });

  it('앱 정보 섹션에 버전 및 읽기 전용 모드 안내가 올바르게 표시되어야 한다', async () => {
    renderWithProviders(<MobileSettingsPage />);

    await waitFor(() => {
      expect(systemServiceModule.systemService.getTaskStatus).toHaveBeenCalled();
    });

    expect(screen.getByText(/AssetManager Mobile/i)).toBeInTheDocument();
    expect(screen.getByText('읽기 전용 (Read-Only)')).toBeInTheDocument();
    expect(screen.getAllByText(/읽기 전용/i).length).toBeGreaterThan(0);
  });
});
